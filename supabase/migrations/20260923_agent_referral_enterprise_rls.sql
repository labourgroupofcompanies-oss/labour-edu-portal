-- ==============================================================================
-- Migration: Enterprise Individual Referral & Affiliate System with 50% 1-Term Benefit
-- Includes: Leads Pipeline (60-Day Lock), Payout Requests, Anti-Fraud Telemetry,
-- and Row-Level Security (RLS) Policies.
-- Date: 2026-09-23
-- ==============================================================================

-- 1. Create Referral Agents Table
CREATE TABLE IF NOT EXISTS public.platform_referral_agents (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    referral_code TEXT NOT NULL UNIQUE,
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
    max_terms INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'FLAGGED')),
    total_earned NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    pending_payout NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    held_in_request NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create Agent Commissions Table (Strictly 1 Term per School)
CREATE TABLE IF NOT EXISTS public.platform_agent_commissions (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES public.platform_referral_agents(id) ON DELETE RESTRICT,
    school_id TEXT NOT NULL,
    school_name TEXT,
    academic_year TEXT,
    term TEXT,
    term_number INTEGER NOT NULL DEFAULT 1 CHECK (term_number = 1), -- Strictly 1 term limit
    school_subscription_paid NUMERIC(12, 2) NOT NULL,
    commission_percentage NUMERIC(5, 2) NOT NULL DEFAULT 50.00,
    commission_amount NUMERIC(12, 2) NOT NULL,
    active_learners_count INTEGER DEFAULT 0,
    low_learner_warning BOOLEAN DEFAULT FALSE,
    fraud_risk_badge TEXT DEFAULT 'CLEAN',
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'PAID', 'REVOKED')),
    payout_request_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint ensuring an individual agent is only paid for 1 term per school
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_commissions_unique_school 
    ON public.platform_agent_commissions(school_id);

-- 3. Create Agent Payout Requests Table (On-Demand MoMo Withdrawal)
CREATE TABLE IF NOT EXISTS public.platform_agent_payout_requests (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL REFERENCES public.platform_referral_agents(id) ON DELETE CASCADE,
    agent_name TEXT NOT NULL,
    agent_phone TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payout_contact TEXT NOT NULL,         -- The explicit MoMo number entered by agent
    payout_network TEXT NOT NULL,         -- MTN, Telecel, AT
    payout_account_name TEXT NOT NULL,    -- Name on the MoMo account
    status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'DISBURSED', 'REJECTED')),
    disbursal_reference TEXT,             -- MoMo transaction ID entered by admin
    admin_notes TEXT,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processed_by TEXT
);

-- 4. Create Referral Leads Table (60-Day Attribution Lock)
CREATE TABLE IF NOT EXISTS public.platform_referral_leads (
    id TEXT PRIMARY KEY,
    agent_id TEXT REFERENCES public.platform_referral_agents(id) ON DELETE SET NULL,
    school_name TEXT NOT NULL,
    contact_person TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    region TEXT,
    estimated_learners INTEGER DEFAULT 0,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'NEW_DEMO_REQUEST' CHECK (status IN ('NEW_DEMO_REQUEST', 'CONTACTED', 'CONVERTED', 'EXPIRED')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Extend Schools Table with Agent Referral Link Columns
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'report_schools') THEN
        ALTER TABLE public.report_schools 
            ADD COLUMN IF NOT EXISTS referred_by_agent_id TEXT REFERENCES public.platform_referral_agents(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS agent_referral_code TEXT,
            ADD COLUMN IF NOT EXISTS agent_terms_rewarded INTEGER NOT NULL DEFAULT 0,
            ADD COLUMN IF NOT EXISTS referral_locked BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

-- 6. Indexes for High Performance Querying & Anti-Fraud Lookups
CREATE INDEX IF NOT EXISTS idx_platform_referral_agents_code ON public.platform_referral_agents(UPPER(referral_code));
CREATE INDEX IF NOT EXISTS idx_platform_referral_agents_phone ON public.platform_referral_agents(phone);
CREATE INDEX IF NOT EXISTS idx_platform_agent_commissions_agent ON public.platform_agent_commissions(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_platform_agent_payout_requests_status ON public.platform_agent_payout_requests(status);
CREATE INDEX IF NOT EXISTS idx_platform_referral_leads_agent ON public.platform_referral_leads(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_platform_referral_leads_phone ON public.platform_referral_leads(phone);
CREATE INDEX IF NOT EXISTS idx_platform_referral_leads_email ON public.platform_referral_leads(email);
CREATE INDEX IF NOT EXISTS idx_platform_referral_leads_expiry ON public.platform_referral_leads(expires_at);

-- 7. Row Level Security (RLS) Policies
ALTER TABLE public.platform_referral_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_agent_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_agent_payout_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_referral_leads ENABLE ROW LEVEL SECURITY;

-- 7.1. Public / Anon Key Policies:
-- Allow anyone to look up an agent by referral code (needed during school checkout & /demo?ref=)
DROP POLICY IF EXISTS "Public can view agent by code" ON public.platform_referral_agents;
CREATE POLICY "Public can view agent by code"
    ON public.platform_referral_agents
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Allow individuals to register as an agent from the public portal
DROP POLICY IF EXISTS "Public can register as agent" ON public.platform_referral_agents;
CREATE POLICY "Public can register as agent"
    ON public.platform_referral_agents
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow anyone to book a demo / capture lead (attaching to agent)
DROP POLICY IF EXISTS "Public can submit demo lead" ON public.platform_referral_leads;
CREATE POLICY "Public can submit demo lead"
    ON public.platform_referral_leads
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Allow public lead read for 60-day attribution lock check
DROP POLICY IF EXISTS "Public can query active leads for attribution" ON public.platform_referral_leads;
CREATE POLICY "Public can query active leads for attribution"
    ON public.platform_referral_leads
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- 7.2. Super Admin & Full Access Policies:
-- Authenticated users (Super Admin role) have unrestricted management access
DROP POLICY IF EXISTS "Admins have full access to agents" ON public.platform_referral_agents;
CREATE POLICY "Admins have full access to agents"
    ON public.platform_referral_agents
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins have full access to commissions" ON public.platform_agent_commissions;
CREATE POLICY "Admins have full access to commissions"
    ON public.platform_agent_commissions
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins have full access to payout requests" ON public.platform_agent_payout_requests;
CREATE POLICY "Admins have full access to payout requests"
    ON public.platform_agent_payout_requests
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins have full access to leads" ON public.platform_referral_leads;
CREATE POLICY "Admins have full access to leads"
    ON public.platform_referral_leads
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Grant appropriate permissions
GRANT SELECT, INSERT ON public.platform_referral_agents TO anon, authenticated;
GRANT SELECT, INSERT ON public.platform_referral_leads TO anon, authenticated;
GRANT ALL ON public.platform_referral_agents TO authenticated, service_role;
GRANT ALL ON public.platform_agent_commissions TO authenticated, service_role;
GRANT ALL ON public.platform_agent_payout_requests TO authenticated, service_role;
GRANT ALL ON public.platform_referral_leads TO authenticated, service_role;

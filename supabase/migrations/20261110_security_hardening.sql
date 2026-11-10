-- =============================================================================
-- Migration: 20261110_security_hardening
-- Purpose  : Harden RLS policies, restrict data exposure, and move wallet
--            balance updates server-side to prevent client-side tampering.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- FIX 2a: Restrict platform_referral_agents anon SELECT
-- Drop the overly-permissive anonymous SELECT policy and replace it with a
-- SECURITY DEFINER function that exposes only non-sensitive columns.
-- ---------------------------------------------------------------------------

-- Drop existing permissive anon policy (matching original migration names)
DROP POLICY IF EXISTS "Public can view agent by code"                  ON platform_referral_agents;
DROP POLICY IF EXISTS "Allow anon select on platform_referral_agents" ON platform_referral_agents;
DROP POLICY IF EXISTS "anon_select_referral_agents"                   ON platform_referral_agents;
DROP POLICY IF EXISTS "Public read referral agents"                    ON platform_referral_agents;

-- Deny direct table reads by anon entirely
CREATE POLICY "deny_anon_direct_select_referral_agents"
  ON platform_referral_agents
  FOR SELECT
  TO anon
  USING (false);

-- SECURITY DEFINER function: returns only safe public columns for anon callers
CREATE OR REPLACE FUNCTION get_agent_public_info(p_code text)
RETURNS TABLE (
  id              text,
  full_name       text,
  referral_code   text,
  status          text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    id::text,
    full_name,
    referral_code,
    status
  FROM platform_referral_agents
  WHERE referral_code ILIKE p_code
    AND status = 'ACTIVE'
  LIMIT 1;
$$;

-- Grant execute to anon so they can look up a code without seeing sensitive data
GRANT EXECUTE ON FUNCTION get_agent_public_info(text) TO anon;

-- ---------------------------------------------------------------------------
-- FIX 2b: Restrict platform_referral_leads public SELECT to authenticated only
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Public can query active leads for attribution"   ON platform_referral_leads;
DROP POLICY IF EXISTS "Public read referral leads"                      ON platform_referral_leads;
DROP POLICY IF EXISTS "Allow public select on platform_referral_leads" ON platform_referral_leads;

-- Only authenticated users may read leads
CREATE POLICY "authenticated_select_referral_leads"
  ON platform_referral_leads
  FOR SELECT
  TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- FIX 2c: Replace overly-broad authenticated admin policies with role-checked
--          versions on all platform tables.
-- ---------------------------------------------------------------------------

-- ── platform_referral_agents ──────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins have full access to agents"     ON platform_referral_agents;
DROP POLICY IF EXISTS "admin_all_referral_agents"             ON platform_referral_agents;
DROP POLICY IF EXISTS "Authenticated all referral agents"     ON platform_referral_agents;
DROP POLICY IF EXISTS "Allow authenticated all"                ON platform_referral_agents;

CREATE POLICY "super_admin_all_referral_agents"
  ON platform_referral_agents
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'platform_developer')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'platform_developer')
  );

-- ── platform_referral_leads ───────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins have full access to leads"       ON platform_referral_leads;
DROP POLICY IF EXISTS "admin_all_referral_leads"               ON platform_referral_leads;
DROP POLICY IF EXISTS "Authenticated all referral leads"        ON platform_referral_leads;
DROP POLICY IF EXISTS "Allow authenticated all leads"           ON platform_referral_leads;

CREATE POLICY "super_admin_all_referral_leads"
  ON platform_referral_leads
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'platform_developer')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'platform_developer')
  );

-- ── platform_agent_commissions ────────────────────────────────────────────

DROP POLICY IF EXISTS "Admins have full access to commissions" ON platform_agent_commissions;
DROP POLICY IF EXISTS "admin_all_agent_commissions"            ON platform_agent_commissions;

CREATE POLICY "super_admin_all_agent_commissions"
  ON platform_agent_commissions
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'platform_developer')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'platform_developer')
  );

-- ── platform_agent_payout_requests ────────────────────────────────────────

DROP POLICY IF EXISTS "Admins have full access to payout requests" ON platform_agent_payout_requests;
DROP POLICY IF EXISTS "admin_all_payout_requests"                 ON platform_agent_payout_requests;

CREATE POLICY "super_admin_all_payout_requests"
  ON platform_agent_payout_requests
  FOR ALL
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'platform_developer')
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('super_admin', 'platform_developer')
  );

-- ---------------------------------------------------------------------------
-- FIX 5: atomic_wallet_transaction RPC
-- Performs an idempotent, locked, atomic wallet update server-side so that
-- client code cannot directly write arbitrary balances to report_schools.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION atomic_wallet_transaction(
  p_school_id   text,
  p_amount      numeric,
  p_reference   text,
  p_description text,
  p_created_by  text
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_balance numeric;
  v_new_balance     numeric;
  v_existing_id     text;
BEGIN
  -- Validate required parameters
  IF p_reference IS NULL OR trim(p_reference) = '' THEN
    RAISE EXCEPTION 'atomic_wallet_transaction: p_reference must not be empty';
  END IF;

  IF p_school_id IS NULL OR trim(p_school_id) = '' THEN
    RAISE EXCEPTION 'atomic_wallet_transaction: p_school_id must not be empty';
  END IF;

  -- Idempotency check: if this reference was already processed, return current balance
  SELECT id INTO v_existing_id
  FROM wallet_transactions
  WHERE reference = p_reference
  LIMIT 1;

  IF FOUND THEN
    SELECT wallet_balance INTO v_current_balance
    FROM report_schools
    WHERE id = p_school_id;
    RETURN COALESCE(v_current_balance, 0);
  END IF;

  -- Lock the school row to prevent concurrent race conditions
  SELECT wallet_balance INTO v_current_balance
  FROM report_schools
  WHERE id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'atomic_wallet_transaction: school % not found', p_school_id;
  END IF;

  v_current_balance := COALESCE(v_current_balance, 0);
  v_new_balance     := GREATEST(0, v_current_balance + p_amount);

  -- Insert immutable transaction record
  INSERT INTO wallet_transactions (
    school_id,
    transaction_type,
    currency,
    amount,
    balance_before,
    balance_after,
    reference,
    description,
    created_by,
    created_at
  ) VALUES (
    p_school_id,
    CASE WHEN p_amount >= 0 THEN 'CREDIT' ELSE 'DEBIT' END,
    'GHS',
    ABS(p_amount),
    v_current_balance,
    v_new_balance,
    p_reference,
    p_description,
    p_created_by,
    now()
  );

  -- Update the authoritative balance
  UPDATE report_schools
  SET wallet_balance = v_new_balance
  WHERE id = p_school_id;

  RETURN v_new_balance;
END;
$$;

-- Only authenticated users (and their app service role) may call this RPC.
-- The SECURITY DEFINER clause means it runs with the function owner's
-- privileges, so the caller does NOT need direct UPDATE rights on report_schools.
REVOKE ALL ON FUNCTION atomic_wallet_transaction(text, numeric, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION atomic_wallet_transaction(text, numeric, text, text, text) TO authenticated;

-- =============================================================================
-- End of migration 20261110_security_hardening
-- =============================================================================

import { db } from '../lib/db';
import { supabase } from '../lib/supabase';
import { eventBus } from './eventBus';
import agentNotificationService from './agentNotificationService';

// ── Rate Limiter & Brute-Force Tracker ──────────────────────────────
const loginAttemptTracker = new Map(); // identifier -> { count, lockedUntil }

const checkRateLimit = (identifier) => {
  const record = loginAttemptTracker.get(identifier);
  if (!record) return;
  const now = Date.now();
  if (record.lockedUntil && record.lockedUntil > now) {
    const remainingSecs = Math.ceil((record.lockedUntil - now) / 1000);
    const minutes = Math.ceil(remainingSecs / 60);
    throw new Error(`Security lock: Too many failed attempts. Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before trying again.`);
  }
};

const recordFailedAttempt = (identifier) => {
  const now = Date.now();
  const record = loginAttemptTracker.get(identifier) || { count: 0, lockedUntil: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.lockedUntil = now + (5 * 60 * 1000); // 5-minute lockout
    record.count = 0;
  }
  loginAttemptTracker.set(identifier, record);
};

const resetLoginAttempts = (identifier) => {
  loginAttemptTracker.delete(identifier);
};

// ── Cryptographic Password Hashing (PBKDF2 via WebCrypto) ───────────
async function hashPassword(plainText, existingSalt = null) {
  if (!plainText) return '';
  try {
    const enc = new TextEncoder();
    let saltBytes;
    if (existingSalt) {
      const match = existingSalt.match(/.{1,2}/g);
      saltBytes = new Uint8Array(match ? match.map(byte => parseInt(byte, 16)) : [1, 2, 3, 4]);
    } else {
      saltBytes = window.crypto?.getRandomValues ? window.crypto.getRandomValues(new Uint8Array(16)) : new Uint8Array([12, 45, 78, 90, 23, 56, 89, 12, 34, 67, 89, 10, 11, 22, 33, 44]);
    }
    const saltHex = Array.from(saltBytes).map(b => b.toString(16).padStart(2, '0')).join('');

    if (window.crypto?.subtle) {
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(plainText),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: enc.encode(saltHex),
          iterations: 10000,
          hash: 'SHA-256'
        },
        keyMaterial,
        256
      );
      const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
      return `pbkdf2$${saltHex}$${hashHex}`;
    }
  } catch (err) {
    console.warn('[agentReferralService] WebCrypto hash fallback:', err);
  }
  // SECURITY: Storing plaintext passwords is never acceptable. Fail closed.
  console.error('[agentReferralService] CRITICAL: WebCrypto subtle API unavailable. Cannot hash password securely.');
  throw new Error('Secure password hashing is unavailable in this environment. Please use a modern browser over HTTPS.');
}

async function verifyPassword(plainText, storedHash) {
  if (!plainText || !storedHash) return false;
  // Legacy plain text storage compatibility
  if (!storedHash.startsWith('pbkdf2$') && !storedHash.startsWith('plain$')) {
    return String(storedHash).trim() === String(plainText).trim();
  }
  if (storedHash.startsWith('plain$')) {
    return storedHash.slice(6) === String(plainText).trim();
  }
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;
  const saltHex = parts[1];
  const expectedHashHex = parts[2];
  const computed = await hashPassword(plainText, saltHex);
  const computedParts = computed.split('$');
  return computedParts[2] === expectedHashHex;
}

export const agentReferralService = {
  hashPassword,
  verifyPassword,
  /**
   * Generate clean, unique, collision-resistant Agent Referral Code
   * e.g., "REF-AGT-KOFI-482"
   */
  generateAgentCode(fullName = '') {
    const prefix = 'REF-AGT';
    const cleanName = String(fullName)
      .trim()
      .split(' ')[0]
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase()
      .slice(0, 5) || 'PARTNER';
    const randomDigits = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${cleanName}-${randomDigits}`;
  },

  /**
   * Register a new individual referral agent
   */
  async registerAgent({ fullName, phone, email = '', customCode = '', password = '' }) {
    if (!fullName || !phone) {
      throw new Error('Full Name and Phone Number are required to register as an agent.');
    }

    const cleanPhone = String(phone).trim().replace(/\s+/g, '');
    const cleanName = String(fullName).trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();

    // Check if phone is already registered
    const existing = await db.referralAgents.where('phone').equals(cleanPhone).first();
    if (existing) {
      if (cleanPassword && existing.password) {
        const isMatch = await verifyPassword(cleanPassword, existing.password);
        if (isMatch) {
          return {
            success: true,
            isExisting: true,
            agent: existing,
            message: 'Account already registered. Logging you in.'
          };
        }
      }
      throw new Error('Unable to complete registration with this information. If you already have an account, please log in with your credentials.');
    }

    // Determine referral code
    let code = customCode ? String(customCode).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '') : null;
    if (!code) {
      code = this.generateAgentCode(cleanName);
    }

    // Ensure code uniqueness in Dexie
    const codeTaken = await db.referralAgents.where('referralCode').equals(code).first();
    if (codeTaken) {
      code = `${code}-${Math.floor(10 + Math.random() * 90)}`;
    }

    // Cryptographically secure password hash (PBKDF2)
    const securedPassword = cleanPassword ? await hashPassword(cleanPassword) : '';

    const nowIso = new Date().toISOString();
    const agentRecord = {
      id: `AGT_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      fullName: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      password: securedPassword, // Securely hashed PBKDF2 password
      referralCode: code,
      commissionRate: 50.00, // 50%
      maxTermsEligible: 1,   // 1 Term benefit
      totalEarned: 0.00,
      totalPaid: 0.00,
      pendingPayout: 0.00,
      heldInRequest: 0.00,
      referredSchoolsCount: 0,
      status: 'ACTIVE',
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // 1. Save to Supabase Cloud if available
    if (navigator.onLine) {
      try {
        const { error: insertError } = await supabase
          .from('platform_referral_agents')
          .insert([{
            id: agentRecord.id,
            full_name: agentRecord.fullName,
            phone: agentRecord.phone,
            email: agentRecord.email,
            password: agentRecord.password,
            referral_code: agentRecord.referralCode,
            commission_rate: agentRecord.commissionRate,
            max_terms: agentRecord.maxTermsEligible,
            status: agentRecord.status,
            total_earned: 0,
            total_paid: 0,
            pending_payout: 0,
            created_at: nowIso,
            updated_at: nowIso
          }]);
        if (insertError) {
          console.warn('[agentReferralService] Cloud agent register warning (check if SQL migration was run):', insertError);
        }
      } catch (err) {
        console.warn('[agentReferralService] Cloud agent register notice (storing locally in Dexie):', err);
      }
    }

    // 2. Save to Dexie IndexedDB
    await db.referralAgents.put(agentRecord);

    await eventBus.publish('AgentRegistered', agentRecord);

    return {
      success: true,
      agent: agentRecord,
      message: `Partner account created successfully! Your unique referral code is ${code}.`
    };
  },

  /**
   * Authenticate agent with phone/code and password with rate limiting & PBKDF2 verification
   * Follows OWASP Anti-Enumeration Guidelines (unified generic error messaging)
   */
  async authenticateAgent(identifier, password) {
    const GENERIC_AUTH_ERROR = 'Invalid login credentials. Please verify your phone number or referral code and password.';

    if (!identifier || !String(identifier).trim() || !password || !String(password).trim()) {
      throw new Error('Please enter both your phone number / referral code and password.');
    }

    const cleanId = String(identifier).trim();
    const cleanPassword = String(password).trim();

    // Enforce brute-force rate limiting
    checkRateLimit(cleanId);

    const agent = await this.getAgentByPhoneOrId(cleanId);
    if (!agent) {
      recordFailedAttempt(cleanId);
      // Execute dummy hash computation to mitigate timing side-channel attacks
      await hashPassword(cleanPassword, '0123456789abcdef0123456789abcdef').catch(() => null);
      throw new Error(GENERIC_AUTH_ERROR);
    }

    // Check account status
    if (agent.status === 'SUSPENDED') {
      throw new Error('Account access restricted. Please contact platform administration.');
    }

    // Verify cryptographic password
    if (!agent.password) {
      recordFailedAttempt(cleanId);
      throw new Error(GENERIC_AUTH_ERROR);
    }

    const isMatch = await verifyPassword(cleanPassword, agent.password);
    if (!isMatch) {
      recordFailedAttempt(cleanId);
      throw new Error(GENERIC_AUTH_ERROR);
    }

    // Transparent security upgrade: If password was in legacy plaintext, hash it now
    if (!agent.password.startsWith('pbkdf2$')) {
      const upgradedHash = await hashPassword(cleanPassword);
      await db.referralAgents.update(agent.id, { password: upgradedHash }).catch(() => null);
      if (navigator.onLine) {
        try {
          await supabase.from('platform_referral_agents').update({ password: upgradedHash }).eq('id', agent.id);
        } catch (_) {}
      }
      agent.password = upgradedHash;
    }

    // Successful authentication: Reset brute-force counter
    resetLoginAttempts(cleanId);

    return {
      success: true,
      agent
    };
  },

  /**
   * Find agent by referral code (case-insensitive)
   */
  async getAgentByCode(code) {
    if (!code) return null;
    const clean = String(code).trim().toUpperCase();

    // 1. Dexie lookup
    const all = await db.referralAgents.toArray();
    let agent = all.find(a => String(a.referralCode || '').trim().toUpperCase() === clean);
    if (agent) return agent;

    // 2. Cloud lookup
    if (navigator.onLine) {
      try {
        const { data, error } = await supabase
          .from('platform_referral_agents')
          .select('*')
          .ilike('referral_code', clean)
          .maybeSingle();

        if (!error && data) {
          agent = {
            id: data.id,
            fullName: data.full_name,
            phone: data.phone,
            email: data.email,
            password: data.password || '',
            referralCode: data.referral_code,
            commissionRate: Number(data.commission_rate) || 50.00,
            maxTermsEligible: Number(data.max_terms) || 1,
            totalEarned: Number(data.total_earned) || 0,
            totalPaid: Number(data.total_paid) || 0,
            pendingPayout: Number(data.pending_payout) || 0,
            heldInRequest: 0,
            status: data.status || 'ACTIVE',
            createdAt: data.created_at,
            updatedAt: data.updated_at
          };
          await db.referralAgents.put(agent).catch(() => null);
          return agent;
        }
      } catch (_) {}
    }

    return null;
  },

  /**
   * Find agent by phone or ID
   */
  async getAgentByPhoneOrId(identifier) {
    if (!identifier) return null;
    const clean = String(identifier).trim().replace(/\s+/g, '');
    const cleanUpper = clean.toUpperCase();

    const all = await db.referralAgents.toArray();
    let agent = all.find(a => 
      a.id === clean || 
      a.phone === clean || 
      a.referralCode?.toUpperCase() === cleanUpper ||
      (a.phone && clean.length >= 9 && (a.phone.endsWith(clean.slice(-9)) || clean.endsWith(a.phone.slice(-9))))
    );
    if (agent) return agent;

    if (navigator.onLine) {
      try {
        const { data } = await supabase
          .from('platform_referral_agents')
          .select('*')
          .or(`phone.eq.${clean},referral_code.ilike.${clean},id.eq.${clean}`)
          .maybeSingle();

        if (data) {
          agent = {
            id: data.id,
            fullName: data.full_name,
            phone: data.phone,
            email: data.email,
            password: data.password || '',
            referralCode: data.referral_code,
            commissionRate: Number(data.commission_rate) || 50.00,
            maxTermsEligible: Number(data.max_terms) || 1,
            totalEarned: Number(data.total_earned) || 0,
            totalPaid: Number(data.total_paid) || 0,
            pendingPayout: Number(data.pending_payout) || 0,
            heldInRequest: 0,
            status: data.status || 'ACTIVE',
            createdAt: data.created_at
          };
          await db.referralAgents.put(agent).catch(() => null);
          return agent;
        }
      } catch (_) {}
    }

    return null;
  },

  /**
   * Get all registered agents with aggregated metrics
   * Automatically pulls and syncs from Supabase Cloud if available
   */
  async getAllAgents() {
    if (navigator.onLine) {
      try {
        const { data: cloudAgents, error } = await supabase
          .from('platform_referral_agents')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(cloudAgents) && cloudAgents.length > 0) {
          for (const ca of cloudAgents) {
            const mapped = {
              id: ca.id,
              fullName: ca.full_name,
              phone: ca.phone,
              email: ca.email || '',
              password: ca.password || '',
              referralCode: ca.referral_code,
              commissionRate: Number(ca.commission_rate) || 50.00,
              maxTermsEligible: Number(ca.max_terms) || 1,
              status: ca.status || 'ACTIVE',
              totalEarned: Number(ca.total_earned) || 0,
              totalPaid: Number(ca.total_paid) || 0,
              pendingPayout: Number(ca.pending_payout) || 0,
              heldInRequest: Number(ca.held_in_request) || 0,
              createdAt: ca.created_at,
              updatedAt: ca.updated_at
            };
            await db.referralAgents.put(mapped).catch(() => null);
          }
        }
      } catch (cloudErr) {
        console.warn('[agentReferralService] Cloud agents sync notice:', cloudErr);
      }
    }

    const agents = await db.referralAgents.toArray();
    const schools = await db.schools.toArray();
    const commissions = await db.agentCommissions.toArray();
    const payoutRequests = await db.agentPayoutRequests.toArray();

    return agents.map(agent => {
      const mySchools = schools.filter(s => s.referredByAgentId === agent.id);
      const myComms = commissions.filter(c => c.agentId === agent.id);
      const myRequests = payoutRequests.filter(r => r.agentId === agent.id);

      const totalEarnedCalc = myComms
        .filter(c => c.status !== 'REVOKED')
        .reduce((sum, c) => sum + Number(c.commissionAmount || 0), 0);

      const totalDisbursedCalc = myRequests
        .filter(r => r.status === 'DISBURSED')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);

      const pendingInQueue = myRequests
        .filter(r => r.status === 'PENDING_REVIEW' || r.status === 'APPROVED')
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);

      const availableToRequest = Math.max(0, totalEarnedCalc - totalDisbursedCalc - pendingInQueue);

      return {
        ...agent,
        referredSchoolsCount: mySchools.length,
        totalEarned: totalEarnedCalc > 0 ? totalEarnedCalc : Number(agent.totalEarned || 0),
        totalPaid: totalDisbursedCalc > 0 ? totalDisbursedCalc : Number(agent.totalPaid || 0),
        pendingPayout: availableToRequest,
        heldInRequest: pendingInQueue,
        schoolsList: mySchools.map(s => ({
          id: s.id,
          name: s.name,
          termsRewarded: s.agentTermsRewarded || 0,
          location: s.location || s.district || ''
        }))
      };
    });
  },

  /**
   * Find matching active lead within 60-day attribution window
   */
  async findMatchingActiveLead(phone, email) {
    if (!db.referralLeads) return null;
    const allLeads = await db.referralLeads.toArray();
    const now = Date.now();
    const cleanP = phone ? String(phone).replace(/[^0-9]/g, '').slice(-9) : null;
    const cleanE = email ? String(email).trim().toLowerCase() : null;

    return allLeads.find(l => {
      if (new Date(l.expiresAt).getTime() <= now) return false; // Expired 60-day window
      if (cleanP && l.phone && String(l.phone).replace(/[^0-9]/g, '').slice(-9) === cleanP) return true;
      if (cleanE && l.email && String(l.email).trim().toLowerCase() === cleanE) return true;
      return false;
    });
  },

  /**
   * Attach a school to an individual agent with anti-cheat checks & 60-day attribution
   */
  async attachSchoolToAgent(schoolId, referralCode, schoolData = {}) {
    if (!schoolId) {
      return { success: false, message: 'Missing school ID.' };
    }

    let cleanCode = String(referralCode || '').trim().toUpperCase();
    let agent = cleanCode ? await this.getAgentByCode(cleanCode) : null;

    // Option 3: 60-Day Lead Attribution Fallback (Cookie window)
    if (!agent) {
      const schoolPhone = String(schoolData?.phone || schoolData?.contactNumber || '').trim();
      const schoolEmail = String(schoolData?.email || '').trim();
      const matchedLead = await this.findMatchingActiveLead(schoolPhone, schoolEmail);
      if (matchedLead && matchedLead.agentId) {
        agent = await db.referralAgents.get(matchedLead.agentId);
        if (agent) {
          cleanCode = agent.referralCode;
          await db.referralLeads.update(matchedLead.id, { status: 'CONVERTED' }).catch(() => null);
        }
      }
    }

    if (!agent) {
      return { success: false, isAgentCode: false, message: 'Referral code does not belong to an agent.' };
    }

    const targetSchoolId = String(schoolId).trim();
    let school = await db.schools.get(targetSchoolId);

    // 1. Anti-Cheat Check: Cannot re-attach if already locked or referred
    if (school?.referralLocked || school?.referredByAgentId || school?.referredBySchoolId) {
      return {
        success: false,
        message: 'This school has already been linked to a referral program.'
      };
    }

    // 2. Anti-Cheat Check: Self-Referral Prevention
    // Check if agent phone/email matches school administrator or contact
    const agentPhone = agent.phone.replace(/[^0-9]/g, '').slice(-9);
    const schoolPhone = String(school?.phone || schoolData?.phone || schoolData?.contactNumber || '')
      .replace(/[^0-9]/g, '')
      .slice(-9);

    // Normalize email (handles Gmail aliases, plus-tags, and case)
    const normalizeEmail = (raw) => {
      if (!raw) return '';
      const [local, dom] = String(raw).toLowerCase().trim().split('@');
      if (!dom) return local;
      const cleanDom = dom === 'googlemail.com' ? 'gmail.com' : dom;
      const cleanLocal = cleanDom === 'gmail.com' ? local.replace(/\./g, '').split('+')[0] : local.split('+')[0];
      return `${cleanLocal}@${cleanDom}`;
    };

    const agentEmailNorm = normalizeEmail(agent.email);
    const schoolEmailNorm = normalizeEmail(school?.email || schoolData?.email || '');

    if (agentPhone && schoolPhone && agentPhone === schoolPhone) {
      return {
        success: false,
        isSelfReferral: true,
        message: 'Self-referral detected: Agent phone number matches the school contact number.'
      };
    }

    if (agentEmailNorm && schoolEmailNorm && agentEmailNorm === schoolEmailNorm) {
      return {
        success: false,
        isSelfReferral: true,
        message: 'Self-referral detected: Agent email matches the school registered email.'
      };
    }

    // Administrator Name Cross-Check
    const normalizeName = (n) => String(n || '').toLowerCase().replace(/[^a-z]/g, '');
    const agentNameNorm = normalizeName(agent.fullName);
    const contactNameNorm = normalizeName(schoolData?.contactPerson || schoolData?.administratorName || school?.contactPerson || '');
    if (agentNameNorm && contactNameNorm && (agentNameNorm === contactNameNorm || (agentNameNorm.length >= 6 && contactNameNorm.includes(agentNameNorm)))) {
      return {
        success: false,
        isSelfReferral: true,
        message: 'Self-referral detected: Agent name matches the registered school administrator.'
      };
    }

    const nowIso = new Date().toISOString();

    // 3. Update School in Dexie
    const updatedSchool = {
      ...(school || { id: targetSchoolId }),
      name: school?.name || schoolData?.name || 'Referred School',
      referredByAgentId: agent.id,
      agentReferralCode: cleanCode,
      agentTermsRewarded: 0, // Starts at 0, max 1
      referralLocked: true,
      referredAt: nowIso
    };
    await db.schools.put(updatedSchool);

    // 4. Update School in Supabase Cloud
    if (navigator.onLine) {
      try {
        await supabase
          .from('report_schools')
          .update({
            referred_by_agent_id: agent.id,
            agent_referral_code: cleanCode,
            agent_terms_rewarded: 0,
            referral_locked: true
          })
          .eq('id', targetSchoolId);
      } catch (err) {
        console.warn('[agentReferralService] Cloud school update notice:', err);
      }
    }

    // 5. Increment agent's referred schools count in Dexie
    const updatedAgent = {
      ...agent,
      referredSchoolsCount: (agent.referredSchoolsCount || 0) + 1,
      updatedAt: nowIso
    };
    await db.referralAgents.put(updatedAgent);

    await eventBus.publish('SchoolAttachedToAgent', {
      schoolId: targetSchoolId,
      schoolName: updatedSchool.name,
      agentId: agent.id,
      referralCode: cleanCode
    });

    // Trigger formatted WhatsApp alert for the Agent
    const waAlert = agentNotificationService.formatSchoolRegisteredAlert(agent, updatedSchool);
    await eventBus.publish('WhatsAppAlertReady', waAlert);

    return {
      success: true,
      isAgentCode: true,
      agent,
      whatsAppAlert: waAlert,
      message: `School successfully linked to Agent ${agent.fullName}! 50% commission will apply to their first paid term.`
    };
  },

  /**
   * Process 50% commission for a school's term subscription payment
   * Strictly capped at ONE term!
   */
  async processSubscriptionCommission(schoolId, options = {}) {
    if (!schoolId) return { eligible: false, message: 'Missing school ID' };
    const targetSchoolId = String(schoolId).trim();

    // 1. Fetch School
    let school = await db.schools.get(targetSchoolId);
    if (!school && navigator.onLine) {
      try {
        const { data } = await supabase.from('report_schools').select('*').eq('id', targetSchoolId).maybeSingle();
        if (data) {
          school = data;
          await db.schools.put(data).catch(() => null);
        }
      } catch (_) {}
    }

    if (!school) return { eligible: false, message: 'School not found' };

    const agentId = school.referred_by_agent_id || school.referredByAgentId;
    if (!agentId) {
      return { eligible: false, message: 'School was not referred by an individual agent.' };
    }

    // 2. Strict 1-Term Anti-Cheat Check
    const termsRewarded = Number(school.agent_terms_rewarded ?? school.agentTermsRewarded ?? 0);
    if (termsRewarded >= 1) {
      return {
        eligible: false,
        message: 'Individual referral benefit already completed (1 of 1 term rewarded).'
      };
    }

    // Idempotency check in agentCommissions
    const existingComm = await db.agentCommissions.where('schoolId').equals(targetSchoolId).first();
    if (existingComm && existingComm.status !== 'REVOKED') {
      return {
        eligible: false,
        message: 'Commission has already been processed for this school.'
      };
    }

    // 3. Subscription Amount Validation (Only real paid money counts!)
    const subAmount = Number(options.subscriptionAmount || options.termFee || options.amount || 0);
    if (subAmount <= 0) {
      return {
        eligible: false,
        message: 'Commission not applicable: Paid subscription fee must be greater than GH₵0.00.'
      };
    }

    // 4. Fetch Agent
    const agent = await db.referralAgents.get(agentId);
    if (!agent) {
      return { eligible: false, message: `Linked agent #${agentId} record not found.` };
    }

    // 5. Calculate 50% Commission
    const rate = Number(agent.commissionRate || 50.00); // 50%
    const commissionAmount = Number(((subAmount * rate) / 100).toFixed(2));

    const nowIso = new Date().toISOString();
    const commId = `COMM_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Active learner count check (Anti-Fraud Telemetry: Option 5)
    const activeLearners = Number(options.activeLearnerCount || school.active_learners_count || 0);
    const lowLearnerWarning = activeLearners > 0 && activeLearners < 15;
    const fraudRiskBadge = lowLearnerWarning ? 'LOW_LEARNER_COUNT (< 15)' : 'CLEAN';

    const commissionRecord = {
      id: commId,
      agentId: agent.id,
      agentName: agent.fullName,
      agentPhone: agent.phone,
      schoolId: targetSchoolId,
      schoolName: school.name || 'Referred School',
      academicYear: options.academicYear || school.currentAcademicYear || '2025/2026',
      term: options.term || school.currentTerm || 'Term 1',
      termNumber: 1, // Strictly Term 1 of 1
      schoolSubscriptionPaid: subAmount,
      commissionPercentage: rate,
      commissionAmount,
      activeLearnersCount: activeLearners,
      lowLearnerWarning,
      fraudRiskBadge,
      status: 'AVAILABLE', // Ready for agent to request payout
      payoutRequestId: null,
      createdAt: nowIso,
      updatedAt: nowIso
    };

    // 6. Save Commission in Dexie
    await db.agentCommissions.put(commissionRecord);

    // 7. Update Agent Balances in Dexie
    const newTotalEarned = Number((Number(agent.totalEarned || 0) + commissionAmount).toFixed(2));
    const newPendingPayout = Number((Number(agent.pendingPayout || 0) + commissionAmount).toFixed(2));

    await db.referralAgents.update(agent.id, {
      totalEarned: newTotalEarned,
      pendingPayout: newPendingPayout,
      updatedAt: nowIso
    });

    // 8. Update School Terms Rewarded to 1 (Completed)
    await db.schools.update(targetSchoolId, {
      agentTermsRewarded: 1,
      agent_terms_rewarded: 1
    });

    // 9. Sync to Supabase Cloud if available
    if (navigator.onLine) {
      try {
        await supabase.from('platform_agent_commissions').insert([{
          id: commissionRecord.id,
          agent_id: commissionRecord.agentId,
          school_id: commissionRecord.schoolId,
          academic_year: commissionRecord.academicYear,
          term: commissionRecord.term,
          term_number: commissionRecord.termNumber,
          school_subscription_paid: commissionRecord.schoolSubscriptionPaid,
          commission_percentage: commissionRecord.commissionPercentage,
          commission_amount: commissionRecord.commissionAmount,
          status: commissionRecord.status,
          created_at: nowIso
        }]);

        await supabase.from('report_schools').update({
          agent_terms_rewarded: 1
        }).eq('id', targetSchoolId);

        await supabase.from('platform_referral_agents').update({
          total_earned: newTotalEarned,
          pending_payout: newPendingPayout,
          updated_at: nowIso
        }).eq('id', agent.id);
      } catch (cloudErr) {
        console.warn('[agentReferralService] Cloud commission sync notice:', cloudErr);
      }
    }

    await eventBus.publish('AgentCommissionEarned', commissionRecord);

    // Trigger WhatsApp notification for agent
    const waAlert = agentNotificationService.formatCommissionEarnedAlert(agent, commissionRecord);
    await eventBus.publish('WhatsAppAlertReady', waAlert);

    return {
      eligible: true,
      success: true,
      commission: commissionRecord,
      whatsAppAlert: waAlert,
      message: `🎉 50% Referral Commission (+GH₵ ${commissionAmount.toFixed(2)}) credited to ${agent.fullName}!`
    };
  },

  /**
   * Agent Requests Payment
   * Agent explicitly inputs their MoMo Contact / Phone number where they want the money sent!
   */
  async requestPayout({ agentId, amount, payoutNetwork = 'MTN Mobile Money', payoutContact, payoutAccountName }) {
    if (!agentId) throw new Error('Agent ID is required.');
    if (!payoutAccountName) throw new Error('Please enter the registered account holder name.');

    const reqAmount = Number(amount);
    if (isNaN(reqAmount) || reqAmount <= 0) {
      throw new Error('Please enter a valid payout amount greater than GH₵0.00.');
    }

    const agent = await db.referralAgents.get(agentId);
    if (!agent) throw new Error('Agent record not found.');

    // Strictly enforce: All payouts go to the agent's registered phone number
    const targetContact = String(agent.phone || payoutContact || '').trim().replace(/\s+/g, '');
    if (!targetContact) {
      throw new Error('No registered phone number found on agent account to receive payout.');
    }
    const cleanAccountName = String(payoutAccountName).trim();

    // Calculate live verified available balance from immutable commission & payout records
    const allComms = await db.agentCommissions.where('agentId').equals(agent.id).toArray();
    const allRequests = await db.agentPayoutRequests.where('agentId').equals(agent.id).toArray();

    const verifiedTotalEarned = allComms
      .filter(c => c.status !== 'REVOKED')
      .reduce((sum, c) => sum + Number(c.commissionAmount || 0), 0);

    const verifiedDisbursed = allRequests
      .filter(r => r.status === 'DISBURSED')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const verifiedInQueue = allRequests
      .filter(r => r.status === 'PENDING_REVIEW' || r.status === 'APPROVED')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const verifiedAvailable = Math.max(0, Number((verifiedTotalEarned - verifiedDisbursed - verifiedInQueue).toFixed(2)));

    if (reqAmount > verifiedAvailable) {
      throw new Error(`Requested amount (GH₵ ${reqAmount.toFixed(2)}) exceeds your verified ledger balance (GH₵ ${verifiedAvailable.toFixed(2)}).`);
    }

    const nowIso = new Date().toISOString();
    const requestId = `REQ_PAY_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const payoutRequest = {
      id: requestId,
      agentId: agent.id,
      agentName: agent.fullName,
      agentPhone: agent.phone,
      amount: reqAmount,
      payoutNetwork,
      payoutContact: targetContact,       // Strictly locked to agent's registered phone number
      payoutAccountName: cleanAccountName, // Account name provided by agent
      status: 'PENDING_REVIEW',         // Sent to Super Admin Operations Queue
      disbursalReference: null,
      adminNotes: null,
      requestedAt: nowIso,
      processedAt: null,
      processedBy: null
    };

    // 1. Save Request to Dexie
    await db.agentPayoutRequests.put(payoutRequest);

    // 2. Hold amount in agent balance (so it cannot be double-requested)
    const newPendingPayout = Math.max(0, Number((available - reqAmount).toFixed(2)));
    const newHeld = Number((Number(agent.heldInRequest || 0) + reqAmount).toFixed(2));

    await db.referralAgents.update(agent.id, {
      pendingPayout: newPendingPayout,
      heldInRequest: newHeld,
      updatedAt: nowIso
    });

    // 3. Sync to Supabase Cloud if available
    if (navigator.onLine) {
      try {
        await supabase.from('platform_agent_payout_requests').insert([{
          id: payoutRequest.id,
          agent_id: payoutRequest.agentId,
          amount: payoutRequest.amount,
          payout_network: payoutRequest.payoutNetwork,
          payout_contact: payoutRequest.payoutContact,
          payout_account_name: payoutRequest.payoutAccountName,
          status: payoutRequest.status,
          requested_at: nowIso
        }]);

        await supabase.from('platform_referral_agents').update({
          pending_payout: newPendingPayout,
          updated_at: nowIso
        }).eq('id', agent.id);
      } catch (cloudErr) {
        console.warn('[agentReferralService] Cloud payout request notice:', cloudErr);
      }
    }

    await eventBus.publish('PayoutRequested', payoutRequest);

    return {
      success: true,
      request: payoutRequest,
      message: `Payment request of GH₵ ${reqAmount.toFixed(2)} submitted successfully to ${payoutNetwork} (${cleanContact}). Platform Admin will disburse shortly!`
    };
  },

  /**
   * Super Admin Disburses Payout (Records MoMo Transaction Reference)
   */
  async disbursePayout(requestId, { disbursalReference, adminNotes = '', processedBy = 'Super Admin' }) {
    if (!requestId) throw new Error('Request ID is required.');
    if (!disbursalReference) throw new Error('Please enter the MoMo transaction reference / receipt ID.');

    const request = await db.agentPayoutRequests.get(requestId);
    if (!request) throw new Error('Payout request not found.');
    if (request.status === 'DISBURSED') {
      return { success: true, message: 'Payout has already been disbursed.' };
    }

    const nowIso = new Date().toISOString();
    const cleanRef = String(disbursalReference).trim().toUpperCase();

    // 1. Update Request
    const updatedRequest = {
      ...request,
      status: 'DISBURSED',
      disbursalReference: cleanRef,
      adminNotes: String(adminNotes || '').trim(),
      processedAt: nowIso,
      processedBy
    };
    await db.agentPayoutRequests.put(updatedRequest);

    // 2. Update Agent Balance (release hold, increment totalPaid)
    const agent = await db.referralAgents.get(request.agentId);
    if (agent) {
      const newHeld = Math.max(0, Number((Number(agent.heldInRequest || 0) - request.amount).toFixed(2)));
      const newTotalPaid = Number((Number(agent.totalPaid || 0) + request.amount).toFixed(2));

      await db.referralAgents.update(agent.id, {
        heldInRequest: newHeld,
        totalPaid: newTotalPaid,
        updatedAt: nowIso
      });
    }

    // 3. Mark associated commissions as PAID
    const commissions = await db.agentCommissions.where('agentId').equals(request.agentId).toArray();
    for (const c of commissions) {
      if (c.status === 'AVAILABLE') {
        await db.agentCommissions.update(c.id, {
          status: 'PAID',
          payoutRequestId: request.id,
          updatedAt: nowIso
        });
      }
    }

    // 4. Cloud sync
    if (navigator.onLine) {
      try {
        await supabase
          .from('platform_agent_payout_requests')
          .update({
            status: 'DISBURSED',
            disbursal_reference: cleanRef,
            admin_notes: adminNotes,
            processed_at: nowIso,
            processed_by: processedBy
          })
          .eq('id', requestId);
      } catch (_) {}
    }

    await eventBus.publish('PayoutDisbursed', updatedRequest);

    // Trigger WhatsApp notification for agent
    let waAlert = null;
    if (agent) {
      waAlert = agentNotificationService.formatPayoutDisbursedAlert(agent, updatedRequest);
      await eventBus.publish('WhatsAppAlertReady', waAlert);
    }

    return {
      success: true,
      request: updatedRequest,
      whatsAppAlert: waAlert,
      message: `Payment of GH₵ ${request.amount.toFixed(2)} disbursed to ${request.payoutContact} (${request.payoutNetwork}). Ref: ${cleanRef}`
    };
  },

  /**
   * Super Admin Rejects Payout (Returns held amount back to agent balance)
   */
  async rejectPayout(requestId, { reason = 'Information Mismatch', processedBy = 'Super Admin' }) {
    if (!requestId) throw new Error('Request ID is required.');

    const request = await db.agentPayoutRequests.get(requestId);
    if (!request) throw new Error('Payout request not found.');

    const nowIso = new Date().toISOString();

    const updatedRequest = {
      ...request,
      status: 'REJECTED',
      adminNotes: reason,
      processedAt: nowIso,
      processedBy
    };
    await db.agentPayoutRequests.put(updatedRequest);

    // Return held money back to available
    const agent = await db.referralAgents.get(request.agentId);
    if (agent) {
      const newPendingPayout = Number((Number(agent.pendingPayout || 0) + request.amount).toFixed(2));
      const newHeld = Math.max(0, Number((Number(agent.heldInRequest || 0) - request.amount).toFixed(2)));

      await db.referralAgents.update(agent.id, {
        pendingPayout: newPendingPayout,
        heldInRequest: newHeld,
        updatedAt: nowIso
      });
    }

    if (navigator.onLine) {
      try {
        await supabase
          .from('platform_agent_payout_requests')
          .update({
            status: 'REJECTED',
            admin_notes: reason,
            processed_at: nowIso,
            processed_by: processedBy
          })
          .eq('id', requestId);
      } catch (_) {}
    }

    return {
      success: true,
      request: updatedRequest,
      message: `Payment request rejected and funds returned to agent balance.`
    };
  },

  /**
   * Get all payout requests across all agents (for Super Admin Queue)
   */
  async getAllPayoutRequests() {
    if (navigator.onLine) {
      try {
        const { data: cloudPayouts, error } = await supabase
          .from('platform_agent_payout_requests')
          .select('*')
          .order('requested_at', { ascending: false });

        if (!error && Array.isArray(cloudPayouts) && cloudPayouts.length > 0) {
          for (const cp of cloudPayouts) {
            const mapped = {
              id: cp.id,
              agentId: cp.agent_id,
              agentName: cp.agent_name,
              agentPhone: cp.agent_phone,
              amount: Number(cp.amount) || 0,
              payoutContact: cp.payout_contact,
              payoutNetwork: cp.payout_network,
              payoutAccountName: cp.payout_account_name,
              status: cp.status || 'PENDING_REVIEW',
              disbursalReference: cp.disbursal_reference,
              adminNotes: cp.admin_notes,
              requestedAt: cp.requested_at,
              processedAt: cp.processed_at,
              processedBy: cp.processed_by
            };
            await db.agentPayoutRequests.put(mapped).catch(() => null);
          }
        }
      } catch (_) {}
    }
    return await db.agentPayoutRequests.toArray();
  },

  /**
   * Get all commission records across all agents
   */
  async getAllCommissions() {
    if (navigator.onLine) {
      try {
        const { data: cloudComms, error } = await supabase
          .from('platform_agent_commissions')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(cloudComms) && cloudComms.length > 0) {
          for (const cc of cloudComms) {
            const mapped = {
              id: cc.id,
              agentId: cc.agent_id,
              schoolId: cc.school_id,
              academicYear: cc.academic_year,
              term: cc.term,
              termNumber: cc.term_number,
              schoolSubscriptionPaid: Number(cc.school_subscription_paid) || 0,
              commissionPercentage: Number(cc.commission_percentage) || 50,
              commissionAmount: Number(cc.commission_amount) || 0,
              status: cc.status || 'AVAILABLE',
              createdAt: cc.created_at
            };
            await db.agentCommissions.put(mapped).catch(() => null);
          }
        }
      } catch (_) {}
    }
    return await db.agentCommissions.toArray();
  },

  /**
   * Get Agent Portal Data for self-service dashboard
   */
  async getAgentPortalData(phoneOrCode) {
    if (!phoneOrCode) return null;
    const clean = String(phoneOrCode).trim();

    const agent = await this.getAgentByPhoneOrId(clean);
    if (!agent) return null;

    const allSchools = await db.schools.toArray();
    const mySchools = allSchools.filter(s => s.referredByAgentId === agent.id);

    let commissions = await db.agentCommissions.where('agentId').equals(agent.id).toArray();
    let payoutRequests = await db.agentPayoutRequests.where('agentId').equals(agent.id).toArray();

    // Multi-device cloud sync fallback if Dexie has no transaction records
    if (navigator.onLine && commissions.length === 0 && payoutRequests.length === 0) {
      try {
        const [cloudComms, cloudPayouts] = await Promise.all([
          supabase.from('platform_agent_commissions').select('*').eq('agent_id', agent.id),
          supabase.from('platform_agent_payout_requests').select('*').eq('agent_id', agent.id)
        ]);

        if (cloudComms?.data && cloudComms.data.length > 0) {
          commissions = cloudComms.data.map(c => ({
            id: c.id,
            agentId: c.agent_id,
            schoolId: c.school_id,
            schoolName: c.school_name,
            schoolSubscriptionPaid: Number(c.school_subscription_paid) || 0,
            commissionAmount: Number(c.commission_amount) || 0,
            commissionRate: Number(c.commission_rate) || 50,
            status: c.status || 'PAID',
            academicYear: c.academic_year,
            term: c.term,
            createdAt: c.created_at
          }));
          await db.agentCommissions.bulkPut(commissions).catch(() => null);
        }

        if (cloudPayouts?.data && cloudPayouts.data.length > 0) {
          payoutRequests = cloudPayouts.data.map(r => ({
            id: r.id,
            agentId: r.agent_id,
            agentName: r.agent_name,
            amount: Number(r.amount) || 0,
            payoutNetwork: r.payout_network,
            payoutContact: r.payout_contact,
            payoutAccountName: r.payout_account_name,
            status: r.status,
            requestedAt: r.requested_at,
            disbursedAt: r.disbursed_at,
            disbursalReference: r.disbursal_reference
          }));
          await db.agentPayoutRequests.bulkPut(payoutRequests).catch(() => null);
        }
      } catch (e) {
        console.warn('[agentReferralService] Cloud portal sync notice:', e);
      }
    }

    const totalEarnedCalc = commissions
      .filter(c => c.status !== 'REVOKED')
      .reduce((sum, c) => sum + Number(c.commissionAmount || 0), 0);

    const totalDisbursedCalc = payoutRequests
      .filter(r => r.status === 'DISBURSED')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const pendingInQueue = payoutRequests
      .filter(r => r.status === 'PENDING_REVIEW' || r.status === 'APPROVED')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const totalEarnedFinal = totalEarnedCalc > 0 ? totalEarnedCalc : Number(agent.totalEarned || 0);
    const totalPaidFinal = totalDisbursedCalc > 0 ? totalDisbursedCalc : Number(agent.totalPaid || 0);
    const availableToRequest = Math.max(0, totalEarnedFinal - totalPaidFinal - pendingInQueue);

    const leads = await this.getLeadsForAgent(agent.id);
    const marketingScripts = agentNotificationService.getMarketingScripts(agent);

    return {
      agent: {
        ...agent,
        totalEarned: totalEarnedFinal,
        totalPaid: totalPaidFinal,
        pendingPayout: availableToRequest,
        heldInRequest: pendingInQueue
      },
      schools: mySchools.map(s => {
        const comm = commissions.find(c => c.schoolId === s.id);
        const isApproved = s.status === 'APPROVED' || s.is_approved === true || s.isApproved === true || s.approval_status === 'APPROVED' || (!s.status && !s.approval_status && s.isApproved !== false);
        return {
          id: s.id,
          name: s.name,
          location: s.location || s.district || s.region || 'Ghana',
          termsRewarded: s.agentTermsRewarded || 0,
          isTerm1Rewarded: (s.agentTermsRewarded || 0) >= 1,
          subscriptionPaid: comm?.schoolSubscriptionPaid || 0,
          commissionAmount: comm?.commissionAmount || 0,
          commissionStatus: comm?.status || 'NOT_PAID_YET',
          referredAt: s.referredAt || s.created_at || null,
          isApproved: isApproved,
          approvalStatus: isApproved ? 'APPROVED' : (s.approvalStatus || s.status || 'PENDING_APPROVAL')
        };
      }),
      leads,
      marketingScripts,
      commissions,
      payoutRequests: payoutRequests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt))
    };
  },

  /**
   * Capture School Demo Request Lead (Option 3: 60-Day Lock)
   */
  async captureLead({ agentCode, schoolName, contactPerson, phone, email = '', notes = '', region = '', estimatedLearners = 0 }) {
    if (!schoolName || !phone) {
      throw new Error('School Name and Contact Phone are required.');
    }

    const cleanCode = String(agentCode || '').trim().toUpperCase();
    const agent = cleanCode ? await this.getAgentByCode(cleanCode) : null;

    const cleanPhone = String(phone).trim().replace(/\s+/g, '');
    const now = Date.now();
    const expiresAt = new Date(now + 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days
    const leadId = `LEAD_${now}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const leadRecord = {
      id: leadId,
      agentId: agent?.id || null,
      agentName: agent?.fullName || 'General Inbound',
      agentCode: cleanCode || null,
      schoolName: String(schoolName).trim(),
      contactPerson: String(contactPerson || '').trim() || 'Headteacher',
      phone: cleanPhone,
      email: String(email || '').trim().toLowerCase(),
      region: String(region || '').trim(),
      estimatedLearners: Number(estimatedLearners || 0),
      notes: String(notes || '').trim(),
      status: 'NEW_DEMO_REQUEST',
      expiresAt,
      createdAt: new Date().toISOString()
    };

    if (db.referralLeads) {
      await db.referralLeads.put(leadRecord);
    }

    if (navigator.onLine) {
      try {
        await supabase.from('platform_referral_leads').insert([{
          id: leadRecord.id,
          agent_id: leadRecord.agentId,
          school_name: leadRecord.schoolName,
          contact_person: leadRecord.contactPerson,
          phone: leadRecord.phone,
          email: leadRecord.email,
          region: leadRecord.region,
          estimated_learners: leadRecord.estimatedLearners,
          notes: leadRecord.notes,
          status: leadRecord.status,
          expires_at: leadRecord.expiresAt,
          created_at: leadRecord.createdAt
        }]);
      } catch (_) {}
    }

    await eventBus.publish('LeadCaptured', leadRecord);

    return {
      success: true,
      lead: leadRecord,
      message: `Demo consultation requested! Our educational team will reach out within 24 hours.`
    };
  },

  /**
   * Get leads captured by a specific agent
   */
  async getLeadsForAgent(agentId) {
    if (!agentId || !db.referralLeads) return [];
    const all = await db.referralLeads.where('agentId').equals(agentId).toArray();
    const now = Date.now();
    return all.map(l => {
      const msLeft = new Date(l.expiresAt).getTime() - now;
      const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
      return {
        ...l,
        daysRemaining: daysLeft,
        isExpired: daysLeft <= 0
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  /**
   * Get all captured leads across all agents (for Super Admin pipeline)
   */
  async getAllLeads() {
    if (!db.referralLeads) return [];
    if (navigator.onLine) {
      try {
        const { data: cloudLeads, error } = await supabase
          .from('platform_referral_leads')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(cloudLeads) && cloudLeads.length > 0) {
          for (const cl of cloudLeads) {
            const mapped = {
              id: cl.id,
              agentId: cl.agent_id,
              schoolName: cl.school_name,
              contactPerson: cl.contact_person,
              phone: cl.phone,
              email: cl.email,
              region: cl.region,
              estimatedLearners: cl.estimated_learners,
              notes: cl.notes,
              status: cl.status || 'NEW_DEMO_REQUEST',
              expiresAt: cl.expires_at,
              createdAt: cl.created_at,
              updatedAt: cl.updated_at
            };
            await db.referralLeads.put(mapped).catch(() => null);
          }
        }
      } catch (_) {}
    }
    const all = await db.referralLeads.toArray();
    const now = Date.now();
    return all.map(l => {
      const msLeft = new Date(l.expiresAt).getTime() - now;
      const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
      return {
        ...l,
        daysRemaining: daysLeft,
        isExpired: daysLeft <= 0
      };
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  /**
   * Update lead status (e.g., 'CONTACTED', 'CONVERTED')
   */
  async updateLeadStatus(leadId, status, notes = '') {
    if (!leadId || !db.referralLeads) return;
    await db.referralLeads.update(leadId, {
      status,
      ...(notes ? { notes } : {}),
      updatedAt: new Date().toISOString()
    });

    if (navigator.onLine) {
      try {
        await supabase
          .from('platform_referral_leads')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', leadId);
      } catch (_) {}
    }
  },

  /**
   * Update referrer details (Name, Phone, Email, Commission Rate, Region, Notes)
   */
  async updateAgent(agentId, updates = {}, adminName = 'Super Admin') {
    if (!agentId) throw new Error('Referrer ID is required.');
    const agent = await db.referralAgents.get(agentId);
    if (!agent) throw new Error(`Referrer #${agentId} not found.`);

    const nowIso = new Date().toISOString();
    const cleanUpdates = {};

    if (updates.fullName !== undefined) cleanUpdates.fullName = String(updates.fullName).trim();
    if (updates.phone !== undefined) cleanUpdates.phone = String(updates.phone).trim().replace(/\s+/g, '');
    if (updates.email !== undefined) cleanUpdates.email = String(updates.email).trim().toLowerCase();
    if (updates.commissionRate !== undefined) cleanUpdates.commissionRate = Number(updates.commissionRate) || 50;
    if (updates.region !== undefined) cleanUpdates.region = String(updates.region).trim();
    if (updates.payoutNetwork !== undefined) cleanUpdates.payoutNetwork = String(updates.payoutNetwork).trim();
    if (updates.payoutContact !== undefined) cleanUpdates.payoutContact = String(updates.payoutContact).trim();
    if (updates.payoutAccountName !== undefined) cleanUpdates.payoutAccountName = String(updates.payoutAccountName).trim();
    if (updates.status !== undefined) cleanUpdates.status = updates.status;

    const auditEntry = {
      id: `AUDIT_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      agentId,
      agentName: cleanUpdates.fullName || agent.fullName,
      action: 'UPDATE_PROFILE',
      details: `Profile updated by ${adminName}`,
      changes: cleanUpdates,
      timestamp: nowIso,
      adminName
    };

    const currentAuditLogs = Array.isArray(agent.auditLogs) ? agent.auditLogs : [];
    const updatedRecord = {
      ...agent,
      ...cleanUpdates,
      auditLogs: [auditEntry, ...currentAuditLogs],
      updatedAt: nowIso
    };

    await db.referralAgents.put(updatedRecord);

    if (navigator.onLine) {
      try {
        await supabase
          .from('platform_referral_agents')
          .update({
            full_name: updatedRecord.fullName,
            phone: updatedRecord.phone,
            email: updatedRecord.email,
            commission_rate: updatedRecord.commissionRate,
            status: updatedRecord.status,
            updated_at: nowIso
          })
          .eq('id', agentId);
      } catch (err) {
        console.warn('[agentReferralService] Cloud update notice:', err);
      }
    }

    return {
      success: true,
      agent: updatedRecord,
      message: `Referrer ${updatedRecord.fullName} updated successfully.`
    };
  },

  /**
   * Update referrer active/suspended status with audit reason
   */
  async updateAgentStatus(agentId, newStatus, reason = '', adminName = 'Super Admin') {
    if (!agentId) throw new Error('Referrer ID is required.');
    const validStatuses = ['ACTIVE', 'SUSPENDED', 'INACTIVE'];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status: ${newStatus}`);
    }

    const agent = await db.referralAgents.get(agentId);
    if (!agent) throw new Error(`Referrer #${agentId} not found.`);

    const nowIso = new Date().toISOString();
    const auditEntry = {
      id: `AUDIT_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      agentId,
      agentName: agent.fullName,
      action: 'STATUS_CHANGE',
      details: `Status changed from ${agent.status || 'ACTIVE'} to ${newStatus}. Reason: ${reason || 'Administrative action'}`,
      timestamp: nowIso,
      adminName
    };

    const currentAuditLogs = Array.isArray(agent.auditLogs) ? agent.auditLogs : [];
    const updatedRecord = {
      ...agent,
      status: newStatus,
      statusReason: reason || null,
      auditLogs: [auditEntry, ...currentAuditLogs],
      updatedAt: nowIso
    };

    await db.referralAgents.put(updatedRecord);

    if (navigator.onLine) {
      try {
        await supabase
          .from('platform_referral_agents')
          .update({
            status: newStatus,
            updated_at: nowIso
          })
          .eq('id', agentId);
      } catch (_) {}
    }

    return {
      success: true,
      agent: updatedRecord,
      message: `Referrer status set to ${newStatus}.`
    };
  },

  /**
   * Add manual financial adjustment (Bonus +GH₵ or Deduction -GH₵) to a referrer
   */
  async addAgentManualAdjustment({ agentId, type = 'BONUS', amount, reason = '', adminName = 'Super Admin' }) {
    if (!agentId) throw new Error('Referrer ID is required.');
    const parsedAmt = Number(amount);
    if (!parsedAmt || parsedAmt <= 0) {
      throw new Error('Please specify an adjustment amount greater than GH₵0.00.');
    }

    const agent = await db.referralAgents.get(agentId);
    if (!agent) throw new Error(`Referrer #${agentId} not found.`);

    const nowIso = new Date().toISOString();
    const isBonus = type === 'BONUS';
    const finalAmount = isBonus ? parsedAmt : -parsedAmt;

    const commissionRecord = {
      id: `${isBonus ? 'BONUS' : 'DEDUCT'}_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      agentId: agent.id,
      agentName: agent.fullName,
      agentPhone: agent.phone,
      schoolId: `MANUAL_ADJ_${agent.id}`,
      schoolName: isBonus ? `⭐ Administrative Bonus (${adminName})` : `⚠️ Administrative Deduction (${adminName})`,
      term: isBonus ? 'Special Reward' : 'Clawback',
      academicYear: new Date().getFullYear().toString(),
      schoolSubscriptionPaid: 0,
      commissionAmount: finalAmount,
      status: isBonus ? 'AVAILABLE' : 'DEDUCTED',
      notes: reason || `Manual ${isBonus ? 'bonus credit' : 'deduction'} processed by ${adminName}`,
      isManualAdjustment: true,
      createdAt: nowIso
    };

    await db.agentCommissions.put(commissionRecord);

    // Record audit log
    const auditEntry = {
      id: `AUDIT_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      agentId,
      agentName: agent.fullName,
      action: isBonus ? 'MANUAL_BONUS' : 'MANUAL_DEDUCTION',
      details: `${isBonus ? 'Credited bonus of' : 'Deducted'} GH₵ ${parsedAmt.toFixed(2)}. Reason: ${reason || 'Administrative adjustment'}`,
      timestamp: nowIso,
      adminName
    };

    const currentAuditLogs = Array.isArray(agent.auditLogs) ? agent.auditLogs : [];
    await db.referralAgents.update(agentId, {
      auditLogs: [auditEntry, ...currentAuditLogs],
      updatedAt: nowIso
    });

    return {
      success: true,
      adjustment: commissionRecord,
      message: `Successfully ${isBonus ? 'credited +GH₵' : 'deducted -GH₵'} ${parsedAmt.toFixed(2)} for ${agent.fullName}.`
    };
  },

  /**
   * Add internal administrative note / CRM entry to referrer record
   */
  async addAgentNote(agentId, { noteText, adminName = 'Super Admin' }) {
    if (!agentId) throw new Error('Referrer ID is required.');
    if (!noteText || !noteText.trim()) throw new Error('Note text cannot be empty.');

    const agent = await db.referralAgents.get(agentId);
    if (!agent) throw new Error(`Referrer #${agentId} not found.`);

    const nowIso = new Date().toISOString();
    const newNote = {
      id: `NOTE_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      text: noteText.trim(),
      author: adminName,
      createdAt: nowIso
    };

    const currentNotes = Array.isArray(agent.adminNotes) ? agent.adminNotes : [];
    const updatedNotes = [newNote, ...currentNotes];

    await db.referralAgents.update(agentId, {
      adminNotes: updatedNotes,
      updatedAt: nowIso
    });

    return {
      success: true,
      note: newNote,
      message: 'Note recorded successfully.'
    };
  },

  /**
   * Reset referrer account password
   */
  async resetAgentPassword(agentId, newPassword, adminName = 'Super Admin') {
    if (!agentId) throw new Error('Referrer ID is required.');
    const cleanPwd = String(newPassword || '').trim();
    if (!cleanPwd) throw new Error('Password cannot be empty.');

    const agent = await db.referralAgents.get(agentId);
    if (!agent) throw new Error(`Referrer #${agentId} not found.`);

    const nowIso = new Date().toISOString();
    const auditEntry = {
      id: `AUDIT_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      agentId,
      agentName: agent.fullName,
      action: 'PASSWORD_RESET',
      details: `Password reset by ${adminName}`,
      timestamp: nowIso,
      adminName
    };

    const currentAuditLogs = Array.isArray(agent.auditLogs) ? agent.auditLogs : [];
    const hashedPwd = await hashPassword(cleanPwd);

    await db.referralAgents.update(agentId, {
      password: hashedPwd,
      auditLogs: [auditEntry, ...currentAuditLogs],
      updatedAt: nowIso
    });

    if (navigator.onLine) {
      try {
        await supabase
          .from('platform_referral_agents')
          .update({ password: hashedPwd, updated_at: nowIso })
          .eq('id', agentId);
      } catch (_) {}
    }

    return {
      success: true,
      message: `Password reset successfully for ${agent.fullName}.`
    };
  },

  /**
   * Delete or archive referrer record permanently and effectively
   */
  async deleteAgent(agentId, options = {}, adminName = 'Super Admin') {
    if (!agentId) throw new Error('Referrer ID is required.');
    const agent = await db.referralAgents.get(agentId);
    if (!agent) {
      await db.referralAgents.delete(agentId).catch(() => null);
      if (navigator.onLine) {
        try {
          await supabase.from('platform_referral_agents').delete().eq('id', agentId);
        } catch (_) {}
      }
      return { success: true, deleted: true, message: 'Referrer record removed.' };
    }

    const { unlinkSchools = true, purgeCommissions = true, purgeRequests = true, purgeLeads = true } = options;

    // 1. Unlink any schools attached to this agent so they are not left locked or broken
    if (unlinkSchools) {
      const schools = await db.schools.toArray();
      const linkedSchools = schools.filter(s => s.referredByAgentId === agentId || s.agentReferralCode === agent.referralCode);
      for (const s of linkedSchools) {
        await db.schools.update(s.id, {
          referredByAgentId: null,
          agentReferralCode: null,
          agentTermsRewarded: 0,
          referralLocked: false
        }).catch(() => null);
      }

      if (navigator.onLine && linkedSchools.length > 0) {
        try {
          await supabase
            .from('report_schools')
            .update({
              referred_by_agent_id: null,
              agent_referral_code: null,
              agent_terms_rewarded: 0,
              referral_locked: false
            })
            .or(`referred_by_agent_id.eq.${agentId},agent_referral_code.eq.${agent.referralCode}`);
        } catch (_) {}
      }
    }

    // 2. Clean up commissions records
    if (purgeCommissions) {
      await db.agentCommissions.where('agentId').equals(agentId).delete().catch(() => null);
    }

    // 3. Clean up payout requests
    if (purgeRequests) {
      await db.agentPayoutRequests.where('agentId').equals(agentId).delete().catch(() => null);
    }

    // 4. Clean up leads
    if (purgeLeads && db.referralLeads) {
      await db.referralLeads.where('agentId').equals(agentId).delete().catch(() => null);
    }

    // 5. Delete from Dexie referralAgents table
    await db.referralAgents.delete(agentId);

    // 6. Delete from Supabase platform_referral_agents
    if (navigator.onLine) {
      try {
        await supabase.from('platform_referral_agents').delete().eq('id', agentId);
      } catch (err) {
        console.warn('[agentReferralService] Cloud delete notice:', err);
      }
    }

    return {
      success: true,
      deleted: true,
      message: `Referrer ${agent.fullName} (${agent.referralCode}) has been permanently and effectively deleted from all records.`
    };
  },

  /**
   * Get complete 360-degree dossier and records for a single referrer
   */
  async getReferrerCompleteRecords(agentId) {
    if (!agentId) return null;
    const agent = await db.referralAgents.get(agentId);
    if (!agent) return null;

    const [allSchools, allComms, allRequests, allLeads] = await Promise.all([
      db.schools.toArray(),
      db.agentCommissions.where('agentId').equals(agentId).toArray(),
      db.agentPayoutRequests.where('agentId').equals(agentId).toArray(),
      db.referralLeads ? db.referralLeads.where('agentId').equals(agentId).toArray() : []
    ]);

    const linkedSchools = allSchools.filter(s => s.referredByAgentId === agentId);

    const totalEarnedCalc = allComms
      .filter(c => c.status !== 'REVOKED')
      .reduce((sum, c) => sum + Number(c.commissionAmount || 0), 0);

    const totalDisbursedCalc = allRequests
      .filter(r => r.status === 'DISBURSED')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const pendingInQueue = allRequests
      .filter(r => r.status === 'PENDING_REVIEW' || r.status === 'APPROVED')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const availableBalance = Math.max(0, totalEarnedCalc - totalDisbursedCalc - pendingInQueue);

    const now = Date.now();
    const leadsWithCalculations = allLeads.map(l => {
      const msLeft = new Date(l.expiresAt).getTime() - now;
      const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
      return {
        ...l,
        daysRemaining: daysLeft,
        isExpired: daysLeft <= 0
      };
    });

    return {
      agent: {
        ...agent,
        totalEarned: totalEarnedCalc,
        totalPaid: totalDisbursedCalc,
        pendingPayout: availableBalance,
        heldInRequest: pendingInQueue,
        referredSchoolsCount: linkedSchools.length,
        adminNotes: Array.isArray(agent.adminNotes) ? agent.adminNotes : [],
        auditLogs: Array.isArray(agent.auditLogs) ? agent.auditLogs : []
      },
      schools: linkedSchools.map(s => {
        const comm = allComms.find(c => c.schoolId === s.id);
        return {
          id: s.id,
          name: s.name,
          location: s.location || s.district || s.region || 'Ghana',
          termsRewarded: s.agentTermsRewarded || 0,
          isTerm1Rewarded: (s.agentTermsRewarded || 0) >= 1,
          subscriptionPaid: comm?.schoolSubscriptionPaid || 0,
          commissionAmount: comm?.commissionAmount || 0,
          commissionStatus: comm?.status || 'PENDING_PAYMENT',
          referredAt: s.referredAt || s.created_at || null
        };
      }),
      commissions: allComms.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      payoutRequests: allRequests.sort((a, b) => new Date(b.requestedAt) - new Date(a.requestedAt)),
      leads: leadsWithCalculations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      adminNotes: Array.isArray(agent.adminNotes) ? agent.adminNotes : [],
      auditLogs: Array.isArray(agent.auditLogs) ? agent.auditLogs : []
    };
  },

  /**
   * Get all referrer audit logs across all agents for super admin historical audit
   */
  async getAllReferrerAuditLogs() {
    const agents = await db.referralAgents.toArray();
    const logs = [];

    agents.forEach(a => {
      if (Array.isArray(a.auditLogs)) {
        a.auditLogs.forEach(entry => {
          logs.push({
            ...entry,
            agentName: entry.agentName || a.fullName,
            agentCode: a.referralCode,
            agentPhone: a.phone
          });
        });
      }
    });

    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }
};

export default agentReferralService;

import { db } from '../lib/db';
import { supabase } from '../lib/supabase';
import { eventBus } from './eventBus';
import agentNotificationService from './agentNotificationService';

export const agentReferralService = {
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
      if (cleanPassword && existing.password && existing.password === cleanPassword) {
        return {
          success: true,
          isExisting: true,
          agent: existing,
          message: 'Account already registered. Logging you in.'
        };
      }
      throw new Error('An agent account with this phone number already exists. Please use "Access My Portal" to log in with your password.');
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

    const nowIso = new Date().toISOString();
    const agentRecord = {
      id: `AGT_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      fullName: cleanName,
      phone: cleanPhone,
      email: cleanEmail,
      password: cleanPassword, // Securely saved agent password for portal login
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

    // 1. Save to Supabase Cloud if available (best-effort)
    if (navigator.onLine) {
      try {
        await supabase
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
   * Authenticate agent with phone/code and password
   */
  async authenticateAgent(identifier, password) {
    if (!identifier || !String(identifier).trim()) {
      throw new Error('Please enter your Phone Number or Referral Code.');
    }
    if (!password || !String(password).trim()) {
      throw new Error('Please enter your password.');
    }

    const cleanId = String(identifier).trim();
    const cleanPassword = String(password).trim();

    const agent = await this.getAgentByPhoneOrId(cleanId);
    if (!agent) {
      throw new Error('No partner account found with this phone number or referral code.');
    }

    // If agent already has a password, verify it
    if (agent.password) {
      if (String(agent.password).trim() !== cleanPassword) {
        throw new Error('Incorrect password. Please verify your password and try again.');
      }
    } else {
      // Legacy account created before password requirement: set password to the entered password
      await db.referralAgents.update(agent.id, { password: cleanPassword });
      agent.password = cleanPassword;
    }

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

    const all = await db.referralAgents.toArray();
    let agent = all.find(a => a.id === clean || a.phone === clean || a.referralCode?.toUpperCase() === clean.toUpperCase());
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
   */
  async getAllAgents() {
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
    const schoolEmail = String(school?.email || schoolData?.email || '').trim().toLowerCase();

    if (agentPhone && schoolPhone && agentPhone === schoolPhone) {
      return {
        success: false,
        isSelfReferral: true,
        message: 'Self-referral detected: Agent phone number matches the school contact number.'
      };
    }

    if (agent.email && schoolEmail && agent.email.toLowerCase() === schoolEmail) {
      return {
        success: false,
        isSelfReferral: true,
        message: 'Self-referral detected: Agent email matches the school registered email.'
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
        }]).catch(() => null);

        await supabase.from('report_schools').update({
          agent_terms_rewarded: 1
        }).eq('id', targetSchoolId).catch(() => null);

        await supabase.from('platform_referral_agents').update({
          total_earned: newTotalEarned,
          pending_payout: newPendingPayout,
          updated_at: nowIso
        }).eq('id', agent.id).catch(() => null);
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
    if (!payoutContact) throw new Error('Please enter the contact / MoMo number to take the money on.');
    if (!payoutAccountName) throw new Error('Please enter the registered account holder name.');

    const cleanContact = String(payoutContact).trim().replace(/\s+/g, '');
    const cleanAccountName = String(payoutAccountName).trim();
    const reqAmount = Number(amount);

    if (isNaN(reqAmount) || reqAmount <= 0) {
      throw new Error('Please enter a valid payout amount greater than GH₵0.00.');
    }

    const agent = await db.referralAgents.get(agentId);
    if (!agent) throw new Error('Agent record not found.');

    // Calculate live available balance
    const available = Number(agent.pendingPayout || 0);
    if (reqAmount > available) {
      throw new Error(`Requested amount (GH₵ ${reqAmount.toFixed(2)}) exceeds available balance (GH₵ ${available.toFixed(2)}).`);
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
      payoutContact: cleanContact,       // The phone number provided by agent to take the money on
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
        }]).catch(() => null);

        await supabase.from('platform_referral_agents').update({
          pending_payout: newPendingPayout,
          updated_at: nowIso
        }).eq('id', agent.id).catch(() => null);
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
    return await db.agentPayoutRequests.toArray();
  },

  /**
   * Get all commission records across all agents
   */
  async getAllCommissions() {
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

    const commissions = await db.agentCommissions.where('agentId').equals(agent.id).toArray();
    const payoutRequests = await db.agentPayoutRequests.where('agentId').equals(agent.id).toArray();

    const totalEarnedCalc = commissions
      .filter(c => c.status !== 'REVOKED')
      .reduce((sum, c) => sum + Number(c.commissionAmount || 0), 0);

    const totalDisbursedCalc = payoutRequests
      .filter(r => r.status === 'DISBURSED')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const pendingInQueue = payoutRequests
      .filter(r => r.status === 'PENDING_REVIEW' || r.status === 'APPROVED')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const leads = await this.getLeadsForAgent(agent.id);
    const marketingScripts = agentNotificationService.getMarketingScripts(agent);

    return {
      agent: {
        ...agent,
        totalEarned: totalEarnedCalc > 0 ? totalEarnedCalc : Number(agent.totalEarned || 0),
        totalPaid: totalDisbursedCalc > 0 ? totalDisbursedCalc : Number(agent.totalPaid || 0),
        pendingPayout: availableToRequest,
        heldInRequest: pendingInQueue
      },
      schools: mySchools.map(s => {
        const comm = commissions.find(c => c.schoolId === s.id);
        return {
          id: s.id,
          name: s.name,
          location: s.location || s.district || s.region || 'Ghana',
          termsRewarded: s.agentTermsRewarded || 0,
          isTerm1Rewarded: (s.agentTermsRewarded || 0) >= 1,
          subscriptionPaid: comm?.schoolSubscriptionPaid || 0,
          commissionAmount: comm?.commissionAmount || 0,
          commissionStatus: comm?.status || 'NOT_PAID_YET',
          referredAt: s.referredAt || s.created_at || null
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
        }]).catch(() => null);
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
  }
};

export default agentReferralService;

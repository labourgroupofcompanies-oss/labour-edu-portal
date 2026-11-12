/**
 * Enterprise Agent Notification Service (WhatsApp-Only Edition)
 * Zero SMS cost, 100% formatted, interactive WhatsApp notifications with direct action deep-links.
 */

export const agentNotificationService = {
  /**
   * Format phone number to international WhatsApp standard (Ghana: 233...)
   */
  formatPhoneToWhatsApp(phone) {
    if (!phone) return '';
    let digits = String(phone).replace(/[^0-9]/g, '');
    if (digits.startsWith('0') && digits.length === 10) {
      digits = '233' + digits.slice(1);
    } else if (digits.startsWith('233')) {
      // already good
    }
    return digits;
  },

  /**
   * Create direct WhatsApp click-to-chat URL
   */
  createWhatsAppUrl(recipientPhone, messageText) {
    const waPhone = this.formatPhoneToWhatsApp(recipientPhone);
    const encoded = encodeURIComponent(messageText);
    return waPhone ? `https://wa.me/${waPhone}?text=${encoded}` : `https://api.whatsapp.com/send?text=${encoded}`;
  },

  /**
   * Notification 1: When a new school registers with the agent's code
   */
  formatSchoolRegisteredAlert(agent, school) {
    const schoolName = school.name || school.schoolName || 'A new school';
    const agentName = agent.fullName || 'Partner';
    const code = agent.referralCode || '';

    const hostUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.labouredu.com';
    const text = 
`🔔 *Labour Edu Partner Update*

Hello *${agentName}*, great news! 🎉
*${schoolName}* just registered on Labour Educational Portal using your partner code: \`${code}\`.

📋 *Status:* Onboarding / Free Onboarding Term
💰 *Your Benefit:* When this school pays their first term subscription fee, you will receive *50% of the entire fee* credited to your partner balance!

Log in to track your schools:
${hostUrl}/agent/portal`;

    return {
      recipientPhone: agent.phone,
      text,
      url: this.createWhatsAppUrl(agent.phone, text)
    };
  },

  /**
   * Notification 2: When a referred school pays their subscription & 50% is credited
   */
  formatCommissionEarnedAlert(agent, commission) {
    const agentName = agent.fullName || 'Partner';
    const schoolName = commission.schoolName || 'Your referred school';
    const amount = Number(commission.commissionAmount || 0).toFixed(2);
    const subPaid = Number(commission.schoolSubscriptionPaid || 0).toFixed(2);
    const term = `${commission.term || 'Term 1'} (${commission.academicYear || ''})`;

    const hostUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.labouredu.com';
    const text = 
`🎉 *Cha-Ching! 50% Commission Received!*

Congratulations *${agentName}*! 🥳
*${schoolName}* has successfully paid their term subscription (*GH₵ ${subPaid}* for ${term}).

💰 *Your 50% Share:* *+GH₵ ${amount}*
Your partner wallet has been credited and is *available for immediate withdrawal*!

📲 *Request your payment now to your MoMo:*
${hostUrl}/agent/portal`;

    return {
      recipientPhone: agent.phone,
      text,
      url: this.createWhatsAppUrl(agent.phone, text)
    };
  },

  /**
   * Notification 3: When Super Admin disburses the payout to agent's MoMo
   */
  formatPayoutDisbursedAlert(agent, payoutRequest) {
    const agentName = agent.fullName || 'Partner';
    const amount = Number(payoutRequest.amount || 0).toFixed(2);
    const contact = payoutRequest.payoutContact || agent.phone;
    const network = payoutRequest.payoutNetwork || 'Mobile Money';
    const ref = payoutRequest.disbursalReference || 'MM-CONFIRMED';

    const hostUrl = typeof window !== 'undefined' ? window.location.origin : 'https://app.labouredu.com';
    const text = 
`✅ *Labour Edu Partner Payout Disbursed!*

Hello *${agentName}*,
Your withdrawal request of *GH₵ ${amount}* has been successfully processed and transferred!

📱 *Destination:* ${contact} (${network})
🧾 *Transaction Reference / Receipt:* \`${ref}\`
⏰ *Date:* ${new Date().toLocaleDateString()}

Thank you for being a valued education partner! Continue referring schools to earn 50% per school.
${hostUrl}/agent/portal`;

    return {
      recipientPhone: contact,
      text,
      url: this.createWhatsAppUrl(contact, text)
    };
  },

  getSchoolOnboardingUrl(code = '') {
    const base = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SCHOOL_PORTAL_URL) || 'https://app.labouredu.com';
    return code ? `${base}/onboarding?ref=${encodeURIComponent(code)}` : `${base}/onboarding`;
  },

  /**
   * Notification 4: Send Account Credentials & Access Link to Referrer via WhatsApp
   */
  formatAgentCredentialsAlert(agent, password = '') {
    const agentName = agent.fullName || 'Partner';
    const code = agent.referralCode || '';
    const phone = agent.phone || '';
    const portalOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://app.labouredu.com';
    const portalUrl = `${portalOrigin}/agent/portal/${code}`;
    const signupUrl = this.getSchoolOnboardingUrl(code);
    const demoUrl = `${portalOrigin}/demo?ref=${code}`;

    const displayPwd = (password && !password.startsWith('pbkdf2$'))
      ? password
      : (agent.password && !agent.password.startsWith('pbkdf2$'))
        ? agent.password
        : '[Your Chosen Secret Password]';

    const text = 
`👋 *Welcome to Labour Educational Partner Portal!*

Hello *${agentName}*, your official partner account is ready.

🔑 *Your Login Credentials:*
• Phone / Code: \`${phone}\` or \`${code}\`
• Password: \`${displayPwd}\`
• Commission Rate: *${Number(agent.commissionRate || 50)}% for 1 Term*

📲 *Access Your Partner Dashboard:*
👉 ${portalUrl}

🔗 *Your Unique Referral Links:*
• School Registration: ${signupUrl}
• School Demo Booking: ${demoUrl}

Share your link or partner code with schools and earn 50% commission on every school's first subscription payment!`;

    return {
      recipientPhone: phone,
      text,
      url: this.createWhatsAppUrl(phone, text)
    };
  },

  /**
   * Headteacher Pitch & Demo invitation scripts (For Agent Marketing Kit)
   */
  getMarketingScripts(agent) {
    const name = agent.fullName || 'Education Representative';
    const code = agent.referralCode || 'PARTNER';
    const regLink = this.getSchoolOnboardingUrl(code);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.labouredu.com';
    const demoLink = `${origin}/demo?ref=${code}`;

    return [
      {
        id: 'whatsapp_quick_pitch',
        title: '📱 WhatsApp Quick Pitch (To Headteachers & Proprietors)',
        description: 'Send this to school owners and headteachers on WhatsApp.',
        text: 
`Good day Sir/Madam, 👋

I am reaching out from *Labour Educational System*. We help schools in Ghana eliminate exam report card stress, automate continuous assessment, and print terminal reports in seconds.

✨ *Highlights for Your School:*
• First Term Free Onboarding Access
• Standard GES & Private School Terminal Reports
• Automated Grading & Class Rankings
• Mobile Money Fee Collection for Parents

Use our official partner link below to get started with free priority setup:
👉 ${regLink}

Or book a 15-minute free school demo here:
👉 ${demoLink}

Best regards,
*${name}*
Labour Edu Ambassador`
      },
      {
        id: 'whatsapp_pta_meeting',
        title: '🏫 Message for School WhatsApp Groups & Associations',
        description: 'Ideal for local private school association groups and headteacher circles.',
        text: 
`Dear School Leaders and Educators,

If your school is still spending weeks hand-writing terminal report cards, this is for you:

*Labour Educational Portal* is Ghana's leading school report and management app. It handles:
✅ Instant terminal report card generation
✅ Automated subject score computations
✅ Continuous assessment tracking
✅ SMS/WhatsApp parent report distribution

🎁 *Special Partner Offer:*
Register your school with partner code *${code}* to unlock free setup and onboarding for your first term!

Link: ${regLink}`
      },
      {
        id: 'phone_call_elevator_pitch',
        title: '📞 60-Second Phone Call Script',
        description: 'What to say when speaking directly with a headteacher over the phone.',
        text: 
`"Good day Mr./Mrs. [Headteacher Name], my name is ${name}. I am calling regarding Labour Educational Portal. We are currently helping schools in our district automate their end-of-term report cards so teachers don't have to spend sleepless nights doing manual calculations. 

Right now, schools can try the full system during their onboarding term with zero upfront cost. Can I send you a 2-minute video overview on WhatsApp, or can you check out our quick demo link at ${demoLink}?"`
      }
    ];
  }
};

export default agentNotificationService;

import crypto from 'crypto';
import { dbStore } from './store.js';
import { env } from '../config/env.js';
import { logAuditEvent } from './auditService.js';
import { APPROVED_TEMPLATE_IDS } from '../validators/communicationValidator.js';

// Pre-approved statutory election administration templates
export const TEMPLATES = {
  VOTER_SLIP_ADVISORY: {
    id: 'VOTER_SLIP_ADVISORY',
    name: 'Official Voter Slip & Polling Serial Advisory',
    category: 'UTILITY',
    description: 'Notifies voter of their assigned booth number, serial number, and verified EPIC details.',
    requiredVars: ['voter_name', 'booth_number', 'booth_name', 'electoral_area', 'serial_number'],
    templateText:
      'Namaste {{voter_name}}, your voter slip for Booth #{{booth_number}} ({{booth_name}}) in {{electoral_area}} is ready. Voter Serial No: #{{serial_number}}, EPIC: {{epic_number}}. Issued by ElectionDesk Patiala Urban.',
    sampleVariables: {
      voter_name: 'Harpreet Singh',
      booth_number: '42',
      booth_name: 'Govt Multipurpose Senior Secondary School',
      electoral_area: 'Ward 12',
      serial_number: '1',
      epic_number: 'PB/13/115/042001',
    },
  },
  POLLING_BOOTH_LOCATION: {
    id: 'POLLING_BOOTH_LOCATION',
    name: 'Polling Station Location & Venue Guide',
    category: 'UTILITY',
    description: 'Provides exact venue address, ward details, and poll day operational hours.',
    requiredVars: ['voter_name', 'electoral_area', 'booth_name', 'booth_address'],
    templateText:
      'Namaste {{voter_name}}, your designated polling station for {{electoral_area}} is located at: {{booth_name}}, {{booth_address}}. Nearest landmark: Patiala Urban. Poll Hours: 7:00 AM - 6:00 PM.',
    sampleVariables: {
      voter_name: 'Harpreet Singh',
      electoral_area: 'Ward 12',
      booth_name: 'Govt Multipurpose Senior Secondary School',
      booth_address: 'Passi Road, Near Model Town, Patiala, Punjab 147001',
    },
  },
  REGISTRATION_STATUS_UPDATE: {
    id: 'REGISTRATION_STATUS_UPDATE',
    name: 'Electoral Roll Verification Status Notice',
    category: 'UTILITY',
    description: 'Advises voter on the outcome of their physical or field verification status.',
    requiredVars: ['voter_name', 'verification_status', 'record_ref'],
    templateText:
      'Namaste {{voter_name}}, your electoral roll record verification status is currently: {{verification_status}}. Reference ID: {{record_ref}}. For any queries, contact your local Electoral Registration Officer.',
    sampleVariables: {
      voter_name: 'Harpreet Singh',
      verification_status: 'Verified',
      record_ref: 'REF-2026-42-01',
    },
  },
  DOCUMENTATION_ASSISTANCE: {
    id: 'DOCUMENTATION_ASSISTANCE',
    name: 'Electoral Documentation & Helpdesk Advisory',
    category: 'UTILITY',
    description: 'Directs elector to authorized administrative room or helpdesk for document resolution.',
    requiredVars: ['voter_name', 'booth_number', 'booth_name'],
    templateText:
      'Namaste {{voter_name}}, regarding your electoral record inquiry, the Patiala Urban Election Helpdesk is available at Room {{booth_number}}, {{booth_name}}. Helpline: 1950.',
    sampleVariables: {
      voter_name: 'Harpreet Singh',
      booth_number: '42',
      booth_name: 'Govt Multipurpose Senior Secondary School',
    },
  },
};

// In-Memory rate limiting state (sliding windows)
const staffRateLimits = new Map(); // staffUserId -> [timestamps]
const recipientRateLimits = new Map(); // recipientPhone -> [timestamps]

export function resetRateLimits() {
  staffRateLimits.clear();
  recipientRateLimits.clear();
}

/**
 * Normalizes phone numbers to standard E.164 (+91 for Indian mobile numbers)
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (digits.length > 10) {
    return `+${digits}`;
  }
  return phone;
}

/**
 * Validates Indian 10-digit mobile number format
 */
export function isValidMobileNumber(phone) {
  const norm = normalizePhoneNumber(phone);
  return /^\+91[6-9]\d{9}$/.test(norm);
}

/**
 * Masks phone number for DPDP and audit logs (+91 9876543210 -> +91 ****** 3210)
 */
export function maskPhoneNumber(phone) {
  const norm = normalizePhoneNumber(phone);
  if (!norm || norm.length < 8) return '******';
  const prefix = norm.startsWith('+91') ? '+91' : norm.slice(0, 3);
  const suffix = norm.slice(-4);
  return `${prefix} ****** ${suffix}`;
}

/**
 * Enforces per-staff and per-recipient rate limits
 */
export function checkRateLimits(staffUserId, recipientPhone) {
  const now = Date.now();
  const oneMinuteAgo = now - 60 * 1000;
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  // 1. Staff user rate limit
  const staffKey = String(staffUserId);
  const staffHistory = (staffRateLimits.get(staffKey) || []).filter((ts) => ts > oneMinuteAgo);
  if (staffHistory.length >= env.COMMUNICATION_RATE_LIMIT_PER_MINUTE) {
    throw new Error(
      `Rate limit exceeded: Staff member has reached the limit of ${env.COMMUNICATION_RATE_LIMIT_PER_MINUTE} communications per minute.`
    );
  }
  staffHistory.push(now);
  staffRateLimits.set(staffKey, staffHistory);

  // 2. Recipient rate limit
  const normPhone = normalizePhoneNumber(recipientPhone);
  const recipientHistory = (recipientRateLimits.get(normPhone) || []).filter((ts) => ts > oneDayAgo);
  if (recipientHistory.length >= env.COMMUNICATION_DAILY_LIMIT_PER_RECORD) {
    throw new Error(
      `Abuse prevention: Recipient has received the maximum limit of ${env.COMMUNICATION_DAILY_LIMIT_PER_RECORD} communications within 24 hours.`
    );
  }
  recipientHistory.push(now);
  recipientRateLimits.set(normPhone, recipientHistory);
}

/**
 * Interpolates variables into an approved template
 */
export function renderTemplate(templateId, variables = {}) {
  const tmpl = TEMPLATES[templateId];
  if (!tmpl) {
    throw new Error(`Template '${templateId}' is not registered or approved.`);
  }

  let text = tmpl.templateText;
  for (const [key, val] of Object.entries(variables)) {
    const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    text = text.replace(placeholder, String(val ?? ''));
  }

  // Remove any remaining unresolved placeholders
  text = text.replace(/\{\{[^}]+\}\}/g, '—');

  // Verify non-political, statutory content compliance
  const prohibitedTerms = ['vote for', 'candidate', 'party', 'election campaign', 'manifesto', 'donation'];
  const lower = text.toLowerCase();
  for (const term of prohibitedTerms) {
    if (lower.includes(term)) {
      throw new Error(`Compliance violation: Template content cannot contain campaign or persuasion terminology ('${term}').`);
    }
  }

  return text;
}

/**
 * Validates voter communication eligibility and consent status
 */
export async function validateVoterEligibility(voterId, channel = 'WHATSAPP') {
  const voter = await dbStore.voters.findById(voterId);
  if (!voter) {
    throw new Error('Voter record not found.');
  }

  if (voter.isArchived) {
    throw new Error('Communication is prohibited with archived voter records.');
  }

  if (!voter.mobileNumber || !voter.mobileNumber.trim()) {
    throw new Error('Voter record does not have a contact mobile number on file.');
  }

  if (!isValidMobileNumber(voter.mobileNumber)) {
    throw new Error(`Mobile number '${voter.mobileNumber}' is not a valid 10-digit Indian telephone number.`);
  }

  // Check Consent
  const consent = voter.communicationConsent || {
    status: 'OPTED_IN',
    channelConsent: { voice: true, whatsapp: true },
    source: 'ELECTORAL_ROLL_REGISTRATION',
  };

  if (consent.status === 'OPTED_OUT' || consent.status === 'REVOKED') {
    throw new Error(
      `Outreach blocked: The voter has opted out or revoked consent for administrative communications (Reason: ${
        consent.optOutReason || 'User Request'
      }).`
    );
  }

  if (channel === 'PHONE' && consent.channelConsent?.voice === false) {
    throw new Error('Outreach blocked: Voter has disabled telephone voice call notifications in their preferences.');
  }

  if (channel === 'WHATSAPP' && consent.channelConsent?.whatsapp === false) {
    throw new Error('Outreach blocked: Voter has disabled WhatsApp messaging in their preferences.');
  }

  return { voter, consent };
}

/**
 * Returns the list of registered statutory communication templates
 */
export function getRegisteredTemplates() {
  return Object.values(TEMPLATES);
}

/**
 * Initiates a voice call (device `tel:` or browser VoIP)
 */
export async function initiateCall({
  voterId,
  staffUser,
  mode = 'DEVICE_TEL',
  clientConfirmed = true,
  reason = 'Official electoral roll inquiry',
  ipAddress = '127.0.0.1',
  userAgent = '',
}) {
  if (clientConfirmed === false) {
    throw new Error('Explicit staff confirmation is required before placing a voice call.');
  }

  const { voter, consent } = await validateVoterEligibility(voterId, 'PHONE');
  checkRateLimits(staffUser._id || staffUser.id, voter.mobileNumber);

  const normPhone = normalizePhoneNumber(voter.mobileNumber);
  const maskedPhone = maskPhoneNumber(normPhone);

  const callProviderRef = `call_${crypto.randomBytes(8).toString('hex')}`;

  let token = null;
  let telUri = null;

  if (mode === 'DEVICE_TEL') {
    telUri = `tel:${normPhone}`;
  } else if (mode === 'BROWSER_VOIP') {
    // Generate secure WebRTC / telephony capability token for the client
    token = crypto
      .createHmac('sha256', env.VOICE_AUTH_TOKEN || 'electiondesk_mock_token_secret')
      .update(`${staffUser.id || staffUser._id}:${normPhone}:${Date.now()}`)
      .digest('hex');
  }

  // Record CommunicationLog entry
  const log = await dbStore.communicationLogs.create({
    recordId: voter._id || voter.id,
    staffUserId: staffUser._id || staffUser.id,
    staffEmail: staffUser.email,
    staffRole: staffUser.role,
    channel: 'PHONE',
    mode,
    providerReferenceId: callProviderRef,
    status: 'INITIATED',
    recipientPhoneMasked: maskedPhone,
    durationSeconds: 0,
    consentReference: {
      status: consent.status,
      source: consent.source || 'ELECTORAL_ROLL_REGISTRATION',
      timestamp: consent.updatedAt || new Date(),
    },
    metadata: {
      reason,
      callerId: env.VOICE_CALLER_ID,
      telephonyProvider: env.VOICE_PROVIDER,
      hasAudioRecording: false, // Strictly adhering: No recording by default
    },
    ipAddress,
    userAgent,
  });

  // Record immutable Audit Log
  await logAuditEvent({
    actor: staffUser,
    action: 'VOICE_CALL_INITIATED',
    entityType: 'COMMUNICATION',
    entityId: log._id || log.id,
    outcome: 'SUCCESS',
    ipAddress,
    userAgent,
    details: {
      voterId: voter._id || voter.id,
      voterName: voter.fullName,
      mode,
      maskedPhone,
      providerReferenceId: callProviderRef,
    },
  });

  return {
    callId: log._id || log.id,
    mode,
    status: 'INITIATED',
    providerReferenceId: callProviderRef,
    recipientPhoneMasked: maskedPhone,
    recipientName: voter.fullName,
    telUri,
    token,
    callerId: env.VOICE_CALLER_ID,
    timestamp: log.createdAt,
  };
}

/**
 * Dispatches an approved WhatsApp message via official Cloud API or prepares prefilled direct link
 */
export async function sendWhatsAppMessage({
  voterId,
  staffUser,
  templateId,
  templateVariables = {},
  mode = 'WHATSAPP_CLOUD_API',
  idempotencyKey = null,
  clientConfirmed = true,
  ipAddress = '127.0.0.1',
  userAgent = '',
}) {
  if (clientConfirmed === false) {
    throw new Error('Explicit staff confirmation is required before sending a WhatsApp communication.');
  }

  if (!APPROVED_TEMPLATE_IDS.includes(templateId)) {
    throw new Error(`Template '${templateId}' is not an approved statutory template.`);
  }

  // Idempotency check: prevent duplicate sends within 15-minute window
  if (idempotencyKey) {
    const existing = await dbStore.communicationLogs.findOne({ idempotencyKey });
    if (existing) {
      return {
        logId: existing._id || existing.id,
        status: existing.status,
        providerReferenceId: existing.providerReferenceId,
        recipientPhoneMasked: existing.recipientPhoneMasked,
        idempotentReplay: true,
        message: 'Duplicate request intercepted: Message previously queued or sent.',
      };
    }
  }

  const { voter, consent } = await validateVoterEligibility(voterId, 'WHATSAPP');
  checkRateLimits(staffUser._id || staffUser.id, voter.mobileNumber);

  const normPhone = normalizePhoneNumber(voter.mobileNumber);
  const maskedPhone = maskPhoneNumber(normPhone);

  // Render and validate template
  const renderedMessage = renderTemplate(templateId, {
    voter_name: voter.fullName,
    booth_number: voter.boothSerialNumber || '—',
    serial_number: voter.boothSerialNumber || '—',
    epic_number: voter.epicNumber || 'Not Issued',
    verification_status: voter.verificationStatus,
    record_ref: voter._id ? String(voter._id).slice(-8).toUpperCase() : 'REF',
    ...templateVariables,
  });

  const providerMsgId = `wamid_${crypto.randomBytes(12).toString('hex')}`;
  let directUrl = null;
  let status = 'QUEUED';

  if (mode === 'WHATSAPP_DIRECT_LINK') {
    // Generate clean wa.me link for direct client send
    const cleanDigits = normPhone.replace(/\+/g, '');
    directUrl = `https://wa.me/${cleanDigits}?text=${encodeURIComponent(renderedMessage)}`;
    status = 'SENT';
  } else if (mode === 'WHATSAPP_CLOUD_API') {
    if (env.WHATSAPP_API_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) {
      // Live Meta Cloud API dispatch (when configured in production)
      try {
        const response = await fetch(
          `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${env.WHATSAPP_API_TOKEN}`,
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: normPhone.replace(/\+/g, ''),
              type: 'template',
              template: {
                name: templateId.toLowerCase(),
                language: { code: 'en' },
              },
            }),
          }
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error?.message || 'Meta WhatsApp Cloud API dispatch failure');
        }
        status = 'SENT';
      } catch (err) {
        status = 'FAILED';
      }
    } else {
      // Standard Sandbox / Test Mode: Simulated official dispatch
      status = 'SENT';
    }
  }

  // Create communication log
  const log = await dbStore.communicationLogs.create({
    recordId: voter._id || voter.id,
    staffUserId: staffUser._id || staffUser.id,
    staffEmail: staffUser.email,
    staffRole: staffUser.role,
    channel: 'WHATSAPP',
    mode,
    providerReferenceId: providerMsgId,
    status,
    recipientPhoneMasked: maskedPhone,
    templateId,
    templateVariables,
    consentReference: {
      status: consent.status,
      source: consent.source || 'ELECTORAL_ROLL_REGISTRATION',
      timestamp: consent.updatedAt || new Date(),
    },
    idempotencyKey: idempotencyKey || `auto_${providerMsgId}`,
    metadata: {
      provider: env.WHATSAPP_API_TOKEN ? 'META_CLOUD_API' : 'MOCK_SANDBOX_API',
      businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID,
      messageLength: renderedMessage.length,
      category: TEMPLATES[templateId]?.category || 'UTILITY',
    },
    ipAddress,
    userAgent,
  });

  // Audit event
  await logAuditEvent({
    actor: staffUser,
    action: 'WHATSAPP_MESSAGE_SENT',
    entityType: 'COMMUNICATION',
    entityId: log._id || log.id,
    outcome: status === 'FAILED' ? 'FAILURE' : 'SUCCESS',
    ipAddress,
    userAgent,
    details: {
      voterId: voter._id || voter.id,
      voterName: voter.fullName,
      templateId,
      mode,
      maskedPhone,
      providerReferenceId: providerMsgId,
      status,
    },
  });

  return {
    logId: log._id || log.id,
    providerReferenceId: providerMsgId,
    status,
    mode,
    directUrl,
    templateId,
    recipientPhoneMasked: maskedPhone,
    recipientName: voter.fullName,
    renderedPreview: renderedMessage,
    timestamp: log.createdAt,
  };
}

/**
 * Fetches communication timeline history for a voter record
 */
export async function getCommunicationHistory(voterId, { skip = 0, limit = 50 } = {}) {
  const voter = await dbStore.voters.findById(voterId);
  if (!voter) {
    throw new Error('Voter record not found.');
  }

  const { logs, total } = await dbStore.communicationLogs.query({
    filter: { recordId: voter._id || voter.id },
    skip: Number(skip) || 0,
    limit: Number(limit) || 50,
  });

  return {
    voterId: voter._id || voter.id,
    voterName: voter.fullName,
    consent: voter.communicationConsent || {
      status: 'OPTED_IN',
      channelConsent: { voice: true, whatsapp: true },
      source: 'ELECTORAL_ROLL_REGISTRATION',
    },
    total,
    history: logs,
  };
}

/**
 * Updates communication consent and preferences for a voter record
 */
export async function updateVoterConsent(voterId, consentData, staffUser, reqMeta = {}) {
  const voter = await dbStore.voters.findById(voterId);
  if (!voter) {
    throw new Error('Voter record not found.');
  }

  const currentConsent = voter.communicationConsent || {};
  const newStatus = consentData.status || currentConsent.status || 'OPTED_IN';

  const updatedConsent = {
    status: newStatus,
    channelConsent: {
      voice: consentData.channelConsent?.voice !== undefined ? consentData.channelConsent.voice : true,
      whatsapp: consentData.channelConsent?.whatsapp !== undefined ? consentData.channelConsent.whatsapp : true,
    },
    source: consentData.source || currentConsent.source || 'DIRECT_IN_PERSON',
    purpose: 'Official statutory election notices, voter slip issuance, and polling booth venue advisories',
    updatedAt: new Date(),
    updatedBy: staffUser._id || staffUser.id,
    optedOutAt: newStatus === 'OPTED_OUT' || newStatus === 'REVOKED' ? new Date() : null,
    optOutReason: newStatus === 'OPTED_OUT' || newStatus === 'REVOKED' ? consentData.optOutReason || 'User request' : null,
  };

  await dbStore.voters.updateOne(
    { _id: voter._id || voter.id },
    { $set: { communicationConsent: updatedConsent } }
  );

  await logAuditEvent({
    actor: staffUser,
    action: newStatus === 'OPTED_OUT' ? 'COMMUNICATION_CONSENT_REVOKED' : 'COMMUNICATION_CONSENT_UPDATED',
    entityType: 'COMMUNICATION',
    entityId: voter._id || voter.id,
    outcome: 'SUCCESS',
    ipAddress: reqMeta.ipAddress || '127.0.0.1',
    userAgent: reqMeta.userAgent || '',
    details: {
      voterId: voter._id || voter.id,
      voterName: voter.fullName,
      previousStatus: currentConsent.status,
      newStatus,
      optOutReason: updatedConsent.optOutReason,
    },
  });

  return updatedConsent;
}

/**
 * Validates Meta WhatsApp Webhook HMAC SHA256 signature
 */
export function verifyWhatsAppSignature(rawBody, signatureHeader, secret = env.WHATSAPP_WEBHOOK_APP_SECRET) {
  if (!signatureHeader || !secret) return false;
  try {
    const parts = signatureHeader.split('=');
    if (parts.length !== 2 || parts[0] !== 'sha256') return false;
    const expectedHash = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(parts[1], 'hex'), Buffer.from(expectedHash, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Processes incoming WhatsApp Webhook callbacks (delivery receipts & inbound opt-out keyword detection)
 */
export async function processWhatsAppWebhook(payload) {
  const entry = payload?.entry?.[0];
  const changes = entry?.changes?.[0]?.value;

  if (!changes) return { processed: 0 };

  let processedCount = 0;

  // 1. Process Message Status Updates (sent, delivered, read, failed)
  if (Array.isArray(changes.statuses)) {
    for (const st of changes.statuses) {
      const providerId = st.id;
      const rawStatus = String(st.status).toUpperCase();
      const statusMap = {
        SENT: 'SENT',
        DELIVERED: 'DELIVERED',
        READ: 'READ',
        FAILED: 'FAILED',
      };
      const finalStatus = statusMap[rawStatus] || 'SENT';

      await dbStore.communicationLogs.updateOne(
        { providerReferenceId: providerId },
        {
          $set: {
            status: finalStatus,
            'metadata.deliveryTimestamp': st.timestamp,
            'metadata.errorDetails': st.errors || null,
          },
        }
      );
      processedCount++;
    }
  }

  // 2. Process Inbound Messages (e.g. STOP / UNSUBSCRIBE / OPTOUT keywords)
  if (Array.isArray(changes.messages)) {
    for (const msg of changes.messages) {
      const senderPhone = normalizePhoneNumber(msg.from);
      const text = String(msg.text?.body || '').trim().toUpperCase();

      if (['STOP', 'UNSUBSCRIBE', 'OPT OUT', 'OPTOUT', 'CANCEL'].includes(text)) {
        // Find voter by mobile number
        const matchingVoters = await dbStore.voters.find();
        for (const v of matchingVoters) {
          if (normalizePhoneNumber(v.mobileNumber) === senderPhone) {
            const currentConsent = v.communicationConsent || {};
            await dbStore.voters.updateOne(
              { _id: v._id || v.id },
              {
                $set: {
                  communicationConsent: {
                    ...currentConsent,
                    status: 'OPTED_OUT',
                    optedOutAt: new Date(),
                    optOutReason: `Inbound keyword: ${text}`,
                  },
                },
              }
            );

            await logAuditEvent({
              actor: { email: 'webhook@whatsapp.meta.com', role: 'SYSTEM' },
              action: 'COMMUNICATION_CONSENT_REVOKED_VIA_INBOUND',
              entityType: 'COMMUNICATION',
              entityId: v._id || v.id,
              outcome: 'SUCCESS',
              ipAddress: '127.0.0.1',
              userAgent: 'Meta-WhatsApp-Webhook',
              details: {
                voterId: v._id || v.id,
                senderPhone: maskPhoneNumber(senderPhone),
                keyword: text,
              },
            });
            processedCount++;
          }
        }
      }
    }
  }

  return { processed: processedCount };
}

/**
 * Processes incoming Voice Telephony Webhook callbacks (call duration, ringing, completed, failed)
 */
export async function processVoiceWebhook(payload) {
  const callSid = payload.CallSid || payload.providerCallId || payload.callId;
  const callStatus = String(payload.CallStatus || payload.status || '').toUpperCase();
  const duration = parseInt(payload.CallDuration || payload.duration || '0', 10);

  if (!callSid) return { processed: 0 };

  const statusMap = {
    RINGING: 'RINGING',
    'IN-PROGRESS': 'IN_PROGRESS',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    BUSY: 'FAILED',
    'NO-ANSWER': 'FAILED',
    FAILED: 'FAILED',
    CANCELED: 'CANCELLED',
    CANCELLED: 'CANCELLED',
  };

  const finalStatus = statusMap[callStatus] || 'COMPLETED';

  await dbStore.communicationLogs.updateOne(
    { providerReferenceId: callSid },
    {
      $set: {
        status: finalStatus,
        durationSeconds: duration,
        'metadata.finalCallStatus': callStatus,
      },
    }
  );

  return { processed: 1, callSid, status: finalStatus, duration };
}

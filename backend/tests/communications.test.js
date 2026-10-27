import { describe, it, expect, beforeEach } from 'vitest';
import { dbStore } from '../src/services/store.js';
import { seedDatabase } from './helpers/testFixtures.js';
import {
  initiateCall,
  sendWhatsAppMessage,
  getCommunicationHistory,
  updateVoterConsent,
  renderTemplate,
  maskPhoneNumber,
  normalizePhoneNumber,
  processWhatsAppWebhook,
  processVoiceWebhook,
  getRegisteredTemplates,
  resetRateLimits,
} from '../src/services/communicationService.js';
import { requireRole } from '../src/middleware/rbacMiddleware.js';
import { UserRole } from '../src/models/User.js';
import { handleWhatsAppWebhookGet } from '../src/controllers/webhookController.js';

describe('Calling and WhatsApp Integration Module (Security, RBAC, Consent, Webhooks)', () => {
  let app;
  let request;
  let superAdminUser;
  let operatorUser;
  let readOnlyUser;
  let auditorUser;
  let testVoter;

  beforeEach(async () => {
    dbStore.clearMemoryStore();
    resetRateLimits();
    await seedDatabase({ seedVoters: false });

    superAdminUser = await dbStore.users.findOne({ email: 'superadmin@electiondesk.gov' });
    operatorUser = await dbStore.users.findOne({ email: 'operator@electiondesk.gov' });
    readOnlyUser = await dbStore.users.findOne({ email: 'readonly@electiondesk.gov' });
    auditorUser = await dbStore.users.findOne({ email: 'auditor@electiondesk.gov' });

    // Create a verified voter with phone number for communications testing
    testVoter = await dbStore.voters.create({
      boothSerialNumber: 42,
      epicNumber: 'PB/13/115/042001',
      fullName: 'Gurpreet Singh',
      relativeName: 'Balwant Singh',
      relationType: 'Father',
      gender: 'Male',
      age: 38,
      mobileNumber: '9876543210',
      address: {
        houseNumber: '104-B',
        street: 'Passi Road',
        locality: 'Model Town',
        villageWard: 'Ward 12',
        city: 'Patiala',
        district: 'Patiala',
        state: 'Punjab',
        pinCode: '147001',
      },
      familyRole: 'FH',
      communicationConsent: {
        status: 'OPTED_IN',
        channelConsent: { voice: true, whatsapp: true },
        source: 'ELECTORAL_ROLL_REGISTRATION',
        updatedAt: new Date(),
      },
    });
  });

  // A. CALLING TESTS
  describe('A. Calling Capabilities', () => {
    it('initiates device calling (DEVICE_TEL) and returns valid tel: URI with masked phone', async () => {
      const result = await initiateCall({
        voterId: testVoter._id,
        staffUser: operatorUser,
        mode: 'DEVICE_TEL',
        clientConfirmed: true,
      });

      expect(result.callId).toBeDefined();
      expect(result.mode).toBe('DEVICE_TEL');
      expect(result.status).toBe('INITIATED');
      expect(result.telUri).toBe('tel:+919876543210');
      expect(result.recipientPhoneMasked).toBe('+91 ****** 3210');

      // Verify CommunicationLog record
      const log = await dbStore.communicationLogs.findById(result.callId);
      expect(log).toBeDefined();
      expect(log.channel).toBe('PHONE');
      expect(log.mode).toBe('DEVICE_TEL');
      expect(log.staffEmail).toBe('operator@electiondesk.gov');
    });

    it('initiates browser VoIP calling (BROWSER_VOIP) and generates secure provider capability token', async () => {
      const result = await initiateCall({
        voterId: testVoter._id,
        staffUser: superAdminUser,
        mode: 'BROWSER_VOIP',
        clientConfirmed: true,
        reason: 'Polling booth change verification',
      });

      expect(result.callId).toBeDefined();
      expect(result.mode).toBe('BROWSER_VOIP');
      expect(result.status).toBe('INITIATED');
      expect(result.token).toBeDefined();
      expect(result.callerId).toBeDefined();
      expect(result.providerReferenceId).toMatch(/^call_/);
    });

    it('NEGATIVE: rejects call initiation without explicit user confirmation', async () => {
      await expect(
        initiateCall({
          voterId: testVoter._id,
          staffUser: operatorUser,
          mode: 'DEVICE_TEL',
          clientConfirmed: false,
        })
      ).rejects.toThrow('Explicit staff confirmation is required');
    });

    it('NEGATIVE: rejects calling when voter has invalid or missing phone number', async () => {
      const voterNoPhone = await dbStore.voters.create({
        boothSerialNumber: 43,
        epicNumber: 'PB/13/115/042002',
        fullName: 'Amarjit Kaur',
        relativeName: 'Gurpreet Singh',
        relationType: 'Husband',
        gender: 'Female',
        age: 34,
        mobileNumber: '',
        address: testVoter.address,
        familyRole: 'FM',
      });

      await expect(
        initiateCall({
          voterId: voterNoPhone._id,
          staffUser: operatorUser,
          mode: 'DEVICE_TEL',
          clientConfirmed: true,
        })
      ).rejects.toThrow('does not have a contact mobile number');
    });

    it('NEGATIVE: rejects calling when voter record is archived', async () => {
      await dbStore.voters.updateOne(
        { _id: testVoter._id },
        { $set: { isArchived: true, archivedReason: 'Voter moved overseas' } }
      );

      await expect(
        initiateCall({
          voterId: testVoter._id,
          staffUser: operatorUser,
          mode: 'DEVICE_TEL',
          clientConfirmed: true,
        })
      ).rejects.toThrow('prohibited with archived voter records');
    });
  });

  // B & C. WHATSAPP & COMPOSER TESTS
  describe('B & C. WhatsApp Messaging & Message Composer', () => {
    it('dispatches approved WhatsApp template (VOTER_SLIP_ADVISORY) via official cloud API mode', async () => {
      const result = await sendWhatsAppMessage({
        voterId: testVoter._id,
        staffUser: operatorUser,
        templateId: 'VOTER_SLIP_ADVISORY',
        templateVariables: {
          booth_number: '42',
          booth_name: 'Govt Multipurpose Senior Secondary School',
          electoral_area: 'Ward 12',
        },
        mode: 'WHATSAPP_CLOUD_API',
        clientConfirmed: true,
      });

      expect(result.logId).toBeDefined();
      expect(result.providerReferenceId).toMatch(/^wamid_/);
      expect(result.status).toBe('SENT');
      expect(result.recipientPhoneMasked).toBe('+91 ****** 3210');
      expect(result.renderedPreview).toContain('Gurpreet Singh');
      expect(result.renderedPreview).toContain('Booth #42');

      const log = await dbStore.communicationLogs.findById(result.logId);
      expect(log.channel).toBe('WHATSAPP');
      expect(log.templateId).toBe('VOTER_SLIP_ADVISORY');
    });

    it('generates direct wa.me link with prefilled statutory text (WHATSAPP_DIRECT_LINK)', async () => {
      const result = await sendWhatsAppMessage({
        voterId: testVoter._id,
        staffUser: operatorUser,
        templateId: 'POLLING_BOOTH_LOCATION',
        templateVariables: {
          electoral_area: 'Ward 12',
          booth_name: 'Govt Multipurpose Senior Secondary School',
          booth_address: 'Passi Road, Patiala',
        },
        mode: 'WHATSAPP_DIRECT_LINK',
        clientConfirmed: true,
      });

      expect(result.mode).toBe('WHATSAPP_DIRECT_LINK');
      expect(result.directUrl).toContain('https://wa.me/919876543210?text=');
      expect(result.directUrl).toContain(encodeURIComponent('Passi Road, Patiala'));
    });

    it('NEGATIVE: rejects unapproved or unregistered message templates', async () => {
      await expect(
        sendWhatsAppMessage({
          voterId: testVoter._id,
          staffUser: operatorUser,
          templateId: 'UNAPPROVED_PROMOTIONAL_TEMPLATE',
          clientConfirmed: true,
        })
      ).rejects.toThrow('not an approved statutory template');
    });

    it('NEGATIVE: enforces non-partisan compliance and rejects campaign terms in messages', () => {
      expect(() => {
        renderTemplate('VOTER_SLIP_ADVISORY', {
          voter_name: 'Test Voter',
          booth_number: '42',
          booth_name: 'School',
          electoral_area: 'Ward 12',
          serial_number: '1',
          epic_number: 'Vote for candidate A',
        });
      }).toThrow('Compliance violation: Template content cannot contain campaign or persuasion terminology');
    });

    it('NEGATIVE: rejects message sending without explicit staff confirmation', async () => {
      await expect(
        sendWhatsAppMessage({
          voterId: testVoter._id,
          staffUser: operatorUser,
          templateId: 'VOTER_SLIP_ADVISORY',
          clientConfirmed: false,
        })
      ).rejects.toThrow('Explicit staff confirmation is required');
    });
  });

  // CONSENT & SUPPRESSION TESTS
  describe('Consent & Suppression Controls', () => {
    it('blocks communication outreach when voter has OPTED_OUT', async () => {
      await updateVoterConsent(
        testVoter._id,
        { status: 'OPTED_OUT', optOutReason: 'Voter requested DND at registration counter' },
        superAdminUser
      );

      // Attempt call
      await expect(
        initiateCall({
          voterId: testVoter._id,
          staffUser: operatorUser,
          mode: 'DEVICE_TEL',
          clientConfirmed: true,
        })
      ).rejects.toThrow('Outreach blocked: The voter has opted out or revoked consent');

      // Attempt WhatsApp
      await expect(
        sendWhatsAppMessage({
          voterId: testVoter._id,
          staffUser: operatorUser,
          templateId: 'VOTER_SLIP_ADVISORY',
          clientConfirmed: true,
        })
      ).rejects.toThrow('Outreach blocked: The voter has opted out or revoked consent');
    });

    it('respects channel-specific consent toggles (e.g. voice enabled, whatsapp disabled)', async () => {
      await updateVoterConsent(
        testVoter._id,
        {
          status: 'OPTED_IN',
          channelConsent: { voice: true, whatsapp: false },
        },
        superAdminUser
      );

      // Call should succeed
      const call = await initiateCall({
        voterId: testVoter._id,
        staffUser: operatorUser,
        mode: 'DEVICE_TEL',
        clientConfirmed: true,
      });
      expect(call.status).toBe('INITIATED');

      // WhatsApp should be blocked
      await expect(
        sendWhatsAppMessage({
          voterId: testVoter._id,
          staffUser: operatorUser,
          templateId: 'VOTER_SLIP_ADVISORY',
          clientConfirmed: true,
        })
      ).rejects.toThrow('Voter has disabled WhatsApp messaging');
    });

    it('allows communication after voter re-opts in', async () => {
      // First opt out
      await updateVoterConsent(testVoter._id, { status: 'OPTED_OUT' }, superAdminUser);

      // Then re-opt in
      await updateVoterConsent(
        testVoter._id,
        { status: 'OPTED_IN', channelConsent: { voice: true, whatsapp: true }, source: 'PHYSICAL_FORM_6' },
        superAdminUser
      );

      const msg = await sendWhatsAppMessage({
        voterId: testVoter._id,
        staffUser: operatorUser,
        templateId: 'REGISTRATION_STATUS_UPDATE',
        clientConfirmed: true,
      });
      expect(msg.status).toBe('SENT');
    });
  });

  // IDEMPOTENCY CONTROLS
  describe('Idempotency & Duplicate Prevention', () => {
    it('prevents accidental duplicate WhatsApp sends using idempotencyKey', async () => {
      const idempotencyKey = 'idem_unique_test_key_123456';

      const firstSend = await sendWhatsAppMessage({
        voterId: testVoter._id,
        staffUser: operatorUser,
        templateId: 'VOTER_SLIP_ADVISORY',
        idempotencyKey,
        clientConfirmed: true,
      });
      expect(firstSend.status).toBe('SENT');
      expect(firstSend.idempotentReplay).toBeUndefined();

      // Second identical request with same idempotencyKey
      const secondSend = await sendWhatsAppMessage({
        voterId: testVoter._id,
        staffUser: operatorUser,
        templateId: 'VOTER_SLIP_ADVISORY',
        idempotencyKey,
        clientConfirmed: true,
      });

      expect(secondSend.idempotentReplay).toBe(true);
      expect(secondSend.logId).toBe(firstSend.logId);
      expect(secondSend.providerReferenceId).toBe(firstSend.providerReferenceId);
    });
  });

  // RBAC ACCESS CONTROLS
  describe('RBAC & Role-Based Permissions', () => {
    it('allows SUPER_ADMIN, DATA_ADMIN, and DATA_ENTRY_OPERATOR to initiate communications', async () => {
      const mw = requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN, UserRole.DATA_ENTRY_OPERATOR);

      for (const user of [superAdminUser, operatorUser]) {
        let nextCalled = false;
        const req = { user, ip: '127.0.0.1', headers: {}, originalUrl: '/api/v1/communications/calls' };
        const res = { status: () => res, json: () => res };
        await mw(req, res, () => { nextCalled = true; });
        expect(nextCalled).toBe(true);
      }
    });

    it('NEGATIVE: blocks READ_ONLY role from initiating communications (403 Forbidden)', async () => {
      const mw = requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN, UserRole.DATA_ENTRY_OPERATOR);
      let nextCalled = false;
      let statusCode = null;

      const req = { user: readOnlyUser, ip: '127.0.0.1', headers: {}, originalUrl: '/api/v1/communications/calls' };
      const res = {
        status(code) { statusCode = code; return this; },
        json(body) { return this; },
      };

      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(403);
    });

    it('NEGATIVE: blocks unauthenticated requests (401 Unauthorized)', async () => {
      const mw = requireRole(UserRole.SUPER_ADMIN, UserRole.DATA_ADMIN);
      let nextCalled = false;
      let statusCode = null;

      const req = { user: null, ip: '127.0.0.1', headers: {}, originalUrl: '/api/v1/communications/calls' };
      const res = {
        status(code) { statusCode = code; return this; },
        json(body) { return this; },
      };

      await mw(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(false);
      expect(statusCode).toBe(401);
    });
  });

  // WEBHOOKS TESTS
  describe('Webhooks & Provider Verification', () => {
    it('Meta WhatsApp Webhook verification: returns challenge on valid token', async () => {
      let statusCode = null;
      let responseText = null;
      const req = {
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'electiondesk_wa_verify_token_2026',
          'hub.challenge': 'CHALLENGE_ACCEPTED_123',
        },
      };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        send(text) {
          responseText = text;
          return this;
        },
      };

      await handleWhatsAppWebhookGet(req, res);
      expect(statusCode).toBe(200);
      expect(responseText).toBe('CHALLENGE_ACCEPTED_123');
    });

    it('Meta WhatsApp Webhook verification: rejects invalid verify token (403 Forbidden)', async () => {
      let statusCode = null;
      let responseText = null;
      const req = {
        query: {
          'hub.mode': 'subscribe',
          'hub.verify_token': 'WRONG_TOKEN',
          'hub.challenge': 'CHALLENGE_123',
        },
      };
      const res = {
        status(code) {
          statusCode = code;
          return this;
        },
        send(text) {
          responseText = text;
          return this;
        },
      };

      await handleWhatsAppWebhookGet(req, res);
      expect(statusCode).toBe(403);
      expect(responseText).toBe('Verification token mismatch');
    });

    it('processes WhatsApp delivery receipts and updates log status to DELIVERED and READ', async () => {
      const msg = await sendWhatsAppMessage({
        voterId: testVoter._id,
        staffUser: operatorUser,
        templateId: 'VOTER_SLIP_ADVISORY',
        clientConfirmed: true,
      });

      // Simulate incoming Meta delivery status callback
      await processWhatsAppWebhook({
        entry: [
          {
            changes: [
              {
                value: {
                  statuses: [
                    {
                      id: msg.providerReferenceId,
                      status: 'delivered',
                      timestamp: '1729900000',
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      const updatedLog = await dbStore.communicationLogs.findById(msg.logId);
      expect(updatedLog.status).toBe('DELIVERED');
    });

    it('inbound opt-out detection: automatically marks voter OPTED_OUT when recipient texts STOP', async () => {
      // Recipient texts STOP
      await processWhatsAppWebhook({
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: '919876543210',
                      text: { body: 'STOP' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      });

      const voter = await dbStore.voters.findById(testVoter._id);
      expect(voter.communicationConsent.status).toBe('OPTED_OUT');
      expect(voter.communicationConsent.optOutReason).toContain('Inbound keyword: STOP');
    });

    it('processes voice telephony status callbacks and records duration', async () => {
      const call = await initiateCall({
        voterId: testVoter._id,
        staffUser: operatorUser,
        mode: 'BROWSER_VOIP',
        clientConfirmed: true,
      });

      await processVoiceWebhook({
        CallSid: call.providerReferenceId,
        CallStatus: 'completed',
        CallDuration: '47',
      });

      const updatedCall = await dbStore.communicationLogs.findById(call.callId);
      expect(updatedCall.status).toBe('COMPLETED');
      expect(updatedCall.durationSeconds).toBe(47);
    });
  });

  // COMMUNICATION HISTORY & TEMPLATES TESTS
  describe('Communication History & Templates', () => {
    it('returns communication timeline history for a voter record', async () => {
      await initiateCall({
        voterId: testVoter._id,
        staffUser: operatorUser,
        mode: 'DEVICE_TEL',
        clientConfirmed: true,
      });

      await sendWhatsAppMessage({
        voterId: testVoter._id,
        staffUser: operatorUser,
        templateId: 'POLLING_BOOTH_LOCATION',
        clientConfirmed: true,
      });

      const history = await getCommunicationHistory(testVoter._id);
      expect(history.voterId).toBe(testVoter._id);
      expect(history.total).toBe(2);
      expect(history.history.length).toBe(2);
      expect(history.consent.status).toBe('OPTED_IN');
    });

    it('returns registered statutory election templates with descriptions and required variables', () => {
      const templates = getRegisteredTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(4);
      const ids = templates.map((t) => t.id);
      expect(ids).toContain('VOTER_SLIP_ADVISORY');
      expect(ids).toContain('POLLING_BOOTH_LOCATION');
      expect(ids).toContain('REGISTRATION_STATUS_UPDATE');
      expect(ids).toContain('DOCUMENTATION_ASSISTANCE');
    });
  });
});

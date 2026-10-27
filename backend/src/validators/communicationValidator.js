import { z } from 'zod';

export const APPROVED_TEMPLATE_IDS = [
  'VOTER_SLIP_ADVISORY',
  'POLLING_BOOTH_LOCATION',
  'REGISTRATION_STATUS_UPDATE',
  'DOCUMENTATION_ASSISTANCE',
];

export const initiateCallSchema = z.object({
  voterId: z.string().min(1, 'Voter record ID is required'),
  mode: z.enum(['DEVICE_TEL', 'BROWSER_VOIP']).default('DEVICE_TEL'),
  clientConfirmed: z.boolean().default(true).optional(),
  reason: z.string().max(200).optional().default('Official electoral roll inquiry & verification'),
});

export const sendWhatsAppMessageSchema = z.object({
  voterId: z.string().min(1, 'Voter record ID is required'),
  templateId: z.enum(APPROVED_TEMPLATE_IDS, {
    errorMap: () => ({
      message: `Invalid template. Must be an approved statutory template: ${APPROVED_TEMPLATE_IDS.join(', ')}`,
    }),
  }),
  templateVariables: z.record(z.union([z.string(), z.number()])).default({}),
  mode: z.enum(['WHATSAPP_CLOUD_API', 'WHATSAPP_DIRECT_LINK']).default('WHATSAPP_CLOUD_API'),
  idempotencyKey: z
    .string()
    .min(8)
    .max(128)
    .optional(),
  clientConfirmed: z.boolean().default(true).optional(),
});

export const updateConsentSchema = z.object({
  status: z.enum(['OPTED_IN', 'OPTED_OUT', 'REVOKED'], {
    errorMap: () => ({ message: 'Status must be OPTED_IN, OPTED_OUT, or REVOKED' }),
  }),
  channelConsent: z
    .object({
      voice: z.boolean().optional(),
      whatsapp: z.boolean().optional(),
    })
    .optional(),
  source: z.string().min(2).max(100).optional().default('DIRECT_IN_PERSON'),
  optOutReason: z.string().max(300).optional().nullable(),
});

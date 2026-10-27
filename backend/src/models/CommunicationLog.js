import mongoose from 'mongoose';

const communicationLogSchema = new mongoose.Schema(
  {
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Voter',
      required: true,
      index: true,
    },
    staffUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    staffEmail: {
      type: String,
      required: true,
      trim: true,
    },
    staffRole: {
      type: String,
      required: true,
      trim: true,
    },
    channel: {
      type: String,
      enum: ['PHONE', 'WHATSAPP'],
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: ['DEVICE_TEL', 'BROWSER_VOIP', 'WHATSAPP_CLOUD_API', 'WHATSAPP_DIRECT_LINK'],
      required: true,
    },
    providerReferenceId: {
      type: String,
      default: '',
      index: true,
    },
    status: {
      type: String,
      enum: [
        'INITIATED',
        'RINGING',
        'IN_PROGRESS',
        'COMPLETED',
        'QUEUED',
        'SENT',
        'DELIVERED',
        'READ',
        'FAILED',
        'CANCELLED',
        'OPTED_OUT',
      ],
      default: 'INITIATED',
      index: true,
    },
    recipientPhoneMasked: {
      type: String,
      required: true,
      trim: true,
    },
    templateId: {
      type: String,
      default: null,
      trim: true,
    },
    templateVariables: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    consentReference: {
      status: { type: String, default: 'OPTED_IN' },
      source: { type: String, default: 'ELECTORAL_ROLL_REGISTRATION' },
      timestamp: { type: Date, default: Date.now },
    },
    idempotencyKey: {
      type: String,
      default: null,
      index: { unique: true, sparse: true },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
    },
    userAgent: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

communicationLogSchema.index({ recordId: 1, createdAt: -1 });
communicationLogSchema.index({ staffUserId: 1, createdAt: -1 });
communicationLogSchema.index({ channel: 1, status: 1 });

export const CommunicationLogModel =
  mongoose.models.CommunicationLog || mongoose.model('CommunicationLog', communicationLogSchema);

export default CommunicationLogModel;

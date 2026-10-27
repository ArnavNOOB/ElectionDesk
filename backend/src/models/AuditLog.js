import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
      immutable: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    actorEmail: {
      type: String,
      default: 'SYSTEM',
    },
    actorRole: {
      type: String,
      default: 'ANONYMOUS',
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ['VOTER', 'POLLING_STATION', 'USER', 'PHOTO', 'IMPORT_JOB', 'EXPORT_JOB', 'SECURITY', 'SYSTEM'],
      index: true,
    },
    entityId: {
      type: String,
      default: null,
      index: true,
    },
    outcome: {
      type: String,
      enum: ['SUCCESS', 'FAILURE', 'DENIED'],
      default: 'SUCCESS',
      index: true,
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
    },
    userAgent: {
      type: String,
      default: '',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    previousHash: {
      type: String,
      default: 'GENESIS_HASH_000000000000000000000000000000000000000000000000000000000000',
    },
    recordHash: {
      type: String,
      required: true,
      index: true,
    },
  },
  {
    timestamps: false, // Explicit immutable timestamp used
  }
);

export const AuditLogModel = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
export default AuditLogModel;

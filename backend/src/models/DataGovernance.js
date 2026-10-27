import mongoose from 'mongoose';

const dataGovernanceSchema = new mongoose.Schema(
  {
    policyName: {
      type: String,
      required: true,
      unique: true,
    },
    retentionDays: {
      type: Number,
      default: 365 * 5, // 5 years standard retention
    },
    archivedPurgeDays: {
      type: Number,
      default: 90, // 90 days after archival
    },
    dpdpCompliant: {
      type: Boolean,
      default: true,
    },
    dpdpNoticeVersion: {
      type: String,
      default: 'v2026.1',
    },
    lastAuditReviewDate: {
      type: Date,
      default: Date.now,
    },
    anonymizeExports: {
      type: Boolean,
      default: true,
    },
    lawfulBasis: {
      type: String,
      default: 'Statutory mandate under Electoral Law & DPDP Act 2023',
    },
    dataProtectionOfficer: {
      name: { type: String, default: 'Chief Electoral Data Protection Officer' },
      email: { type: String, default: 'dpo@electiondesk.gov' },
    },
  },
  {
    timestamps: true,
  }
);

export const DataGovernanceModel =
  mongoose.models.DataGovernance || mongoose.model('DataGovernance', dataGovernanceSchema);
export default DataGovernanceModel;

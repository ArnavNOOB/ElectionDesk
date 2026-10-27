import mongoose from 'mongoose';

export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  DATA_ADMIN: 'DATA_ADMIN',
  DATA_ENTRY_OPERATOR: 'DATA_ENTRY_OPERATOR',
  AUDITOR: 'AUDITOR',
  READ_ONLY: 'READ_ONLY',
};

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.READ_ONLY,
      index: true,
    },
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      default: null,
    },
    mfaBackupCodes: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    sessionVersion: {
      type: Number,
      default: 1,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    assignedConstituencies: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const UserModel = mongoose.models.User || mongoose.model('User', userSchema);
export default UserModel;

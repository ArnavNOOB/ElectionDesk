import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema(
  {
    houseNumber: { type: String, default: '', trim: true },
    street: { type: String, default: '', trim: true },
    locality: { type: String, default: '', trim: true },
    villageWard: { type: String, default: '12', trim: true },
    city: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pinCode: {
      type: String,
      required: true,
      trim: true,
      match: [/^[1-9][0-9]{5}$/, 'Invalid Indian 6-digit PIN code'],
    },
    country: { type: String, default: 'India' },
    formattedAddress: { type: String, default: '' },
    placeId: { type: String, default: null },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    verified: { type: Boolean, default: false },
    lastVerifiedAt: { type: Date, default: null },
  },
  { _id: false }
);

const voterSchema = new mongoose.Schema(
  {
    boothSerialNumber: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },
    epicNumber: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
      index: true,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    relativeName: {
      type: String,
      default: '',
      trim: true,
    },
    relationType: {
      type: String,
      enum: ['Father', 'Mother', 'Husband', 'Other'],
      default: 'Father',
    },
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Third Gender'],
      required: true,
      index: true,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    age: {
      type: Number,
      required: true,
      min: 18,
      max: 120,
      index: true,
    },
    address: {
      type: addressSchema,
      required: true,
    },
    pollingStationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PollingStation',
      required: false,
      index: true,
    },
    familyRole: {
      type: String,
      enum: ['FH', 'FM', 'SM'],
      default: 'SM',
      required: true,
      index: true,
    },
    familyHeadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Voter',
      default: null,
      index: true,
    },
    mobileNumber: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    verificationStatus: {
      type: String,
      default: 'Verified',
      index: true,
    },
    isDuplicate: {
      type: Boolean,
      default: false,
      index: true,
    },
    duplicateFlags: {
      type: [String],
      default: [],
      index: true,
    },
    dataQualityFlags: {
      type: [String],
      default: [],
    },
    photoKey: {
      type: String,
      default: null,
    },
    communicationConsent: {
      status: {
        type: String,
        enum: ['OPTED_IN', 'OPTED_OUT', 'REVOKED', 'UNSPECIFIED'],
        default: 'OPTED_IN',
        index: true,
      },
      channelConsent: {
        voice: { type: Boolean, default: true },
        whatsapp: { type: Boolean, default: true },
      },
      source: {
        type: String,
        default: 'ELECTORAL_ROLL_REGISTRATION',
      },
      purpose: {
        type: String,
        default: 'Official statutory election notices, voter slip issuance, and polling booth venue advisories',
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      optedOutAt: {
        type: Date,
        default: null,
      },
      optOutReason: {
        type: String,
        default: null,
      },
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
    archivedReason: {
      type: String,
      default: null,
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for searching, booth uniqueness, and filtering
voterSchema.index({ pollingStationId: 1, boothSerialNumber: 1 });
voterSchema.index({ familyRole: 1, familyHeadId: 1 });
voterSchema.index({ fullName: 'text', epicNumber: 'text' });
voterSchema.index({ 'address.city': 1, 'address.pinCode': 1 });
voterSchema.index({ isArchived: 1, verificationStatus: 1 });
voterSchema.index({ isArchived: 1, isDuplicate: 1 });
voterSchema.index({ isArchived: 1, duplicateFlags: 1 });

export const VoterModel = mongoose.models.Voter || mongoose.model('Voter', voterSchema);
export default VoterModel;

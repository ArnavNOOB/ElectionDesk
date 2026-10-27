import mongoose from 'mongoose';

const pollingStationSchema = new mongoose.Schema(
  {
    officialBoothNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    stationName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    electoralArea: {
      type: String,
      required: true,
      trim: true,
      default: 'Ward 12',
      index: true,
    },
    assemblyConstituency: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    parliamentaryConstituency: {
      type: String,
      required: true,
      trim: true,
    },
    district: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    sourceReference: {
      type: String,
      default: 'Official Electoral Roll Rollout 2026',
    },
    lastVerifiedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['Active', 'Inactive', 'Under_Review'],
      default: 'Active',
      index: true,
    },
    voterCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const PollingStationModel = mongoose.models.PollingStation || mongoose.model('PollingStation', pollingStationSchema);
export default PollingStationModel;

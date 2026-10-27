import mongoose from 'mongoose';

const privateVoterPhotoSchema = new mongoose.Schema(
  {
    voterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Voter',
      required: true,
      index: true,
    },
    storageObjectKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
      enum: ['image/jpeg', 'image/png', 'image/webp'],
    },
    fileSize: {
      type: Number,
      required: true,
    },
    sha256Hash: {
      type: String,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    retentionStatus: {
      type: String,
      enum: ['Active', 'Scheduled_Purge', 'Purged'],
      default: 'Active',
      index: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

export const PrivateVoterPhotoModel =
  mongoose.models.PrivateVoterPhoto || mongoose.model('PrivateVoterPhoto', privateVoterPhotoSchema);
export default PrivateVoterPhotoModel;

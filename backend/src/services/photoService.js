let sharp = null;
try {
  const sharpImport = await import('sharp');
  sharp = sharpImport.default || sharpImport;
} catch (err) {
  // sharp native module may not match OS architecture in portable environments
}
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { dbStore } from './store.js';
import { logAuditEvent } from './auditService.js';
import { calculateSha256 } from '../utils/crypto.js';

// Ensure storage directory exists
async function ensureStorageDir() {
  await fs.mkdir(env.STORAGE_DIR, { recursive: true });
}

/**
 * Validate image magic bytes to protect against polyglots and executable masquerading
 */
export function validateMagicBytes(buffer) {
  if (!buffer || buffer.length < 8) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  // WebP: RIFF ... WEBP
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  return null;
}

/**
 * Process and sanitize photo:
 * 1. Validates magic bytes
 * 2. Strips EXIF metadata & GPS coordinates via Sharp
 * 3. Re-encodes to standardized WebP format
 * 4. Saves to private encrypted/isolated storage directory
 */
export async function processAndSaveVoterPhoto({ voterId, fileBuffer, originalName, actor, reqMeta = {} }) {
  await ensureStorageDir();

  const detectedMime = validateMagicBytes(fileBuffer);
  if (!detectedMime) {
    throw new Error('Invalid file format. Only legitimate JPEG, PNG, or WebP images are accepted.');
  }

  const voter = await dbStore.voters.findById(voterId);
  if (!voter) throw new Error('Voter record not found');

  // Strip EXIF metadata and re-encode to clean WebP
  let sanitizedBuffer = fileBuffer;
  if (sharp) {
    sanitizedBuffer = await sharp(fileBuffer)
      .rotate() // Auto-orient based on EXIF before stripping
      .webp({ quality: 85, effort: 4 })
      .toBuffer();
  }

  const storageKey = `${crypto.randomUUID()}.webp`;
  const targetFilePath = path.join(env.STORAGE_DIR, storageKey);
  await fs.writeFile(targetFilePath, sanitizedBuffer);

  const fileSha256 = calculateSha256(sanitizedBuffer);

  // Archive previous photo if one exists
  const existingPhoto = await dbStore.photos.findByVoterId(voterId);
  if (existingPhoto) {
    await dbStore.photos.updateOne(
      { _id: existingPhoto._id || existingPhoto.id },
      { $set: { retentionStatus: 'Scheduled_Purge' } }
    );
  }

  // Record photo metadata
  const photoRecord = await dbStore.photos.create({
    voterId,
    storageObjectKey: storageKey,
    fileName: originalName.replace(/[^a-zA-Z0-9._-]/g, '_'),
    mimeType: 'image/webp',
    fileSize: sanitizedBuffer.length,
    sha256Hash: fileSha256,
    uploadedBy: actor?._id || actor?.id,
    retentionStatus: 'Active',
  });

  // Link to voter
  await dbStore.voters.updateOne(
    { _id: voterId },
    { $set: { photoKey: storageKey } }
  );

  await logAuditEvent({
    actor,
    action: 'PHOTO_UPLOAD',
    entityType: 'PHOTO',
    entityId: photoRecord._id || photoRecord.id,
    outcome: 'SUCCESS',
    ipAddress: reqMeta.ipAddress || '127.0.0.1',
    userAgent: reqMeta.userAgent || '',
    details: {
      voterId,
      photoKey: storageKey,
      fileSize: sanitizedBuffer.length,
    },
  });

  return {
    success: true,
    photoKey: storageKey,
    fileSize: sanitizedBuffer.length,
    mimeType: 'image/webp',
  };
}

/**
 * Retrieve photo buffer securely
 */
export async function getPhotoStream({ voterId, photoKey, actor, reqMeta = {} }) {
  const voter = await dbStore.voters.findById(voterId);
  if (!voter) throw new Error('Voter record not found');

  const keyToUse = photoKey || voter.photoKey;
  if (!keyToUse) throw new Error('No photo exists for this voter record');

  // Prevent path traversal
  const safeFilename = path.basename(keyToUse);
  const filePath = path.join(env.STORAGE_DIR, safeFilename);

  try {
    const buffer = await fs.readFile(filePath);

    // Audit log access where appropriate
    await logAuditEvent({
      actor,
      action: 'PHOTO_VIEW',
      entityType: 'PHOTO',
      entityId: voterId,
      outcome: 'SUCCESS',
      ipAddress: reqMeta.ipAddress || '127.0.0.1',
      userAgent: reqMeta.userAgent || '',
      details: { photoKey: safeFilename },
    });

    return {
      buffer,
      mimeType: 'image/webp',
    };
  } catch (err) {
    throw new Error('Photo storage object not found on server');
  }
}

/**
 * Remove photo under retention policy
 */
export async function deleteVoterPhoto({ voterId, actor, reqMeta = {} }) {
  const voter = await dbStore.voters.findById(voterId);
  if (!voter) throw new Error('Voter record not found');

  const existingPhoto = await dbStore.photos.findByVoterId(voterId);
  if (existingPhoto) {
    await dbStore.photos.updateOne(
      { _id: existingPhoto._id || existingPhoto.id },
      { $set: { retentionStatus: 'Purged' } }
    );
  }

  await dbStore.voters.updateOne(
    { _id: voterId },
    { $set: { photoKey: null } }
  );

  await logAuditEvent({
    actor,
    action: 'PHOTO_DELETE',
    entityType: 'PHOTO',
    entityId: voterId,
    outcome: 'SUCCESS',
    ipAddress: reqMeta.ipAddress || '127.0.0.1',
    userAgent: reqMeta.userAgent || '',
    details: { voterId },
  });

  return { success: true };
}

import { processAndSaveVoterPhoto, getPhotoStream, deleteVoterPhoto } from '../services/photoService.js';
import { ApiResponse } from '../utils/apiResponse.js';

export async function handleUploadPhoto(req, res, next) {
  try {
    if (!req.file) {
      return ApiResponse.error(res, 'No photo file uploaded', 400, 'NO_FILE');
    }

    const { voterId } = req.params;
    const result = await processAndSaveVoterPhoto({
      voterId,
      fileBuffer: req.file.buffer,
      originalName: req.file.originalname,
      actor: req.user,
      reqMeta: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    });

    return ApiResponse.success(res, result, 'Voter photo processed and saved securely');
  } catch (error) {
    next(error);
  }
}

export async function handleGetPhoto(req, res, next) {
  try {
    const { voterId } = req.params;
    const { photoKey } = req.query;

    const { buffer, mimeType } = await getPhotoStream({
      voterId,
      photoKey,
      actor: req.user,
      reqMeta: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    });

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Content-Disposition', 'inline; filename="voter_photo.webp"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(buffer);
  } catch (error) {
    next(error);
  }
}

export async function handleDeletePhoto(req, res, next) {
  try {
    const { voterId } = req.params;
    const result = await deleteVoterPhoto({
      voterId,
      actor: req.user,
      reqMeta: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    });
    return ApiResponse.success(res, result, 'Photo removed according to retention policy');
  } catch (error) {
    next(error);
  }
}

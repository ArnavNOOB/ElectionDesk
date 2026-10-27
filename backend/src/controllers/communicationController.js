import { ApiResponse } from '../utils/apiResponse.js';
import {
  initiateCallSchema,
  sendWhatsAppMessageSchema,
  updateConsentSchema,
} from '../validators/communicationValidator.js';
import {
  initiateCall,
  sendWhatsAppMessage,
  getCommunicationHistory,
  getRegisteredTemplates,
  updateVoterConsent,
} from '../services/communicationService.js';
import { dbStore } from '../services/store.js';

export async function handleInitiateCall(req, res, next) {
  try {
    const validated = initiateCallSchema.parse(req.body);
    const result = await initiateCall({
      ...validated,
      staffUser: req.user,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
    });
    return ApiResponse.success(res, result, 'Voice call initiated successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function handleGetCall(req, res, next) {
  try {
    const { id } = req.params;
    let log = await dbStore.communicationLogs.findById(id);
    if (!log) {
      log = await dbStore.communicationLogs.findOne({ providerReferenceId: id });
    }
    if (!log) {
      return ApiResponse.error(res, 'Call record not found', 404, 'NOT_FOUND');
    }
    return ApiResponse.success(res, log, 'Call details retrieved');
  } catch (error) {
    next(error);
  }
}

export async function handleSendWhatsAppMessage(req, res, next) {
  try {
    const validated = sendWhatsAppMessageSchema.parse(req.body);
    const result = await sendWhatsAppMessage({
      ...validated,
      staffUser: req.user,
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
    });
    return ApiResponse.success(res, result, 'WhatsApp communication processed successfully', 201);
  } catch (error) {
    next(error);
  }
}

export async function handleGetHistory(req, res, next) {
  try {
    const { recordId } = req.params;
    const { skip, limit } = req.query;
    const history = await getCommunicationHistory(recordId, { skip, limit });
    return ApiResponse.success(res, history, 'Communication history retrieved');
  } catch (error) {
    next(error);
  }
}

export async function handleGetTemplates(req, res, next) {
  try {
    const templates = getRegisteredTemplates();
    return ApiResponse.success(res, templates, 'Approved templates retrieved');
  } catch (error) {
    next(error);
  }
}

export async function handleUpdateConsent(req, res, next) {
  try {
    const { recordId } = req.params;
    const validated = updateConsentSchema.parse(req.body);
    const updated = await updateVoterConsent(recordId, validated, req.user, {
      ipAddress: req.ip || '127.0.0.1',
      userAgent: req.headers['user-agent'] || '',
    });
    return ApiResponse.success(res, updated, 'Communication consent preferences updated successfully');
  } catch (error) {
    next(error);
  }
}

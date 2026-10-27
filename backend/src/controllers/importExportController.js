import {
  previewSpreadsheetImport,
  commitSpreadsheetImport,
  generateSampleXlsx,
  exportVotersToCsv,
  exportVotersToXlsx,
} from '../services/importExportService.js';
import { ApiResponse } from '../utils/apiResponse.js';

export async function handlePreviewImport(req, res, next) {
  try {
    if (!req.file) {
      return ApiResponse.error(res, 'No spreadsheet file uploaded (.xlsx, .xls, .csv)', 400, 'NO_FILE');
    }

    const preview = await previewSpreadsheetImport(req.file.buffer, req.file.originalname);
    return ApiResponse.success(res, preview, 'Spreadsheet schema validation and preview generated');
  } catch (error) {
    next(error);
  }
}

export async function handleDownloadTemplate(req, res, next) {
  try {
    const buffer = generateSampleXlsx();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="ElectionDesk_Sample_Voters_Import.xlsx"'
    );
    return res.send(buffer);
  } catch (error) {
    next(error);
  }
}

export async function handleCommitImport(req, res, next) {
  try {
    const { rows } = req.body;
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return ApiResponse.error(res, 'No validated rows provided for commit', 400, 'NO_ROWS');
    }

    const result = await commitSpreadsheetImport(rows, req.user, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return ApiResponse.success(res, result, `Successfully imported ${result.importedCount} voter records`);
  } catch (error) {
    next(error);
  }
}

export async function handleExportVoters(req, res, next) {
  try {
    const { verificationStatus, pollingStationId, format = 'csv' } = req.query;
    const filter = {};
    if (verificationStatus) filter.verificationStatus = verificationStatus;
    if (pollingStationId) filter.pollingStationId = pollingStationId;

    if (format.toLowerCase() === 'xlsx') {
      const { buffer, rowCount } = await exportVotersToXlsx({
        filter,
        actor: req.user,
        reqMeta: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
      });

      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="ElectionDesk_Voters_Export_${Date.now()}.xlsx"`
      );
      res.setHeader('X-Total-Rows', rowCount);
      return res.send(buffer);
    }

    const { csvContent, rowCount } = await exportVotersToCsv({
      filter,
      actor: req.user,
      reqMeta: { ipAddress: req.ip, userAgent: req.headers['user-agent'] },
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ElectionDesk_Voters_Export_${Date.now()}.csv"`
    );
    res.setHeader('X-Total-Rows', rowCount);
    return res.send(csvContent);
  } catch (error) {
    next(error);
  }
}

import multer from 'multer';

// Memory storage keeps file buffer in RAM for magic byte & sharp verification
const storage = multer.memoryStorage();

export const uploadPhoto = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
  },
});

export const uploadSpreadsheet = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit for spreadsheet datasets
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'text/csv',
      'text/plain',
      'application/octet-stream',
    ];

    const lowerName = (file.originalname || '').toLowerCase();
    const isAllowedExt =
      lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv');

    if (allowedMimes.includes(file.mimetype) || isAllowedExt) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only Excel (.xlsx, .xls) and CSV (.csv) spreadsheets are allowed.'));
    }
  },
});

// Backwards-compatibility alias
export const uploadCsv = uploadSpreadsheet;

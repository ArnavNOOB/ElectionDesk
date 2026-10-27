/**
 * Standard API Response Formatter
 */
export const ApiResponse = {
  success(res, data = null, message = 'Success', statusCode = 200, meta = undefined) {
    const payload = {
      success: true,
      message,
      data,
    };
    if (meta) payload.meta = meta;
    return res.status(statusCode).json(payload);
  },

  error(res, message = 'Internal Server Error', statusCode = 500, code = 'ERROR', details = null) {
    const payload = {
      success: false,
      error: {
        code,
        message,
      },
    };
    if (details) {
      payload.error.details = details;
    }
    return res.status(statusCode).json(payload);
  },
};

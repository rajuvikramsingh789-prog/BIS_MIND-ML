function errorHandler(err, req, res, next) {
    console.error('Unhandled API Error:', err);

    const statusCode = err.statusCode || 500;
    const response = {
        error: err.message || 'Internal Server Error',
        timestamp: new Date().toISOString()
    };

    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
}

module.exports = errorHandler;

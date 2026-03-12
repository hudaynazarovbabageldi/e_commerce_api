class ApiError extends Error {
    constructor(
        statusCode,
        message,
        isOperational = true,
        stack = '',
        errors = null,
    ) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.errors = errors; // Store validation errors

        if (stack) {
            this.stack = stack;
        } else {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

module.exports = { ApiError };

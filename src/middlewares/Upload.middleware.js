const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { ApiError } = require('../utils/ApiError');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Ensure upload directory exists
 */
const ensureUploadDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

/**
 * Generate unique filename
 */
const generateFilename = (originalname) => {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(originalname);
    const basename = path.basename(originalname, ext);
    const sanitizedBasename = basename.replace(/[^a-zA-Z0-9]/g, '_');

    return `${sanitizedBasename}_${timestamp}_${randomString}${ext}`;
};

/**
 * Disk storage configuration
 */
const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'uploads');
        ensureUploadDir(uploadDir);
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const filename = generateFilename(file.originalname);
        cb(null, filename);
    },
});

/**
 * Memory storage configuration (for S3/cloud uploads)
 */
const memoryStorage = multer.memoryStorage();

/**
 * File filter for images
 */
const imageFileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new ApiError(
                400,
                'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.',
            ),
            false,
        );
    }
};

/**
 * File filter for documents
 */
const documentFileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new ApiError(
                400,
                'Invalid file type. Only PDF, Word, Excel, and text documents are allowed.',
            ),
            false,
        );
    }
};

/**
 * File filter for videos
 */
const videoFileFilter = (req, file, cb) => {
    const allowedMimeTypes = [
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/x-msvideo',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new ApiError(
                400,
                'Invalid file type. Only MP4, MPEG, MOV, and AVI videos are allowed.',
            ),
            false,
        );
    }
};

/**
 * Generic file filter
 */
const createFileFilter = (allowedTypes = []) => {
    return (req, file, cb) => {
        if (allowedTypes.length === 0 || allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(
                new ApiError(
                    400,
                    `Invalid file type. Allowed types: ${allowedTypes.join(', ')}`,
                ),
                false,
            );
        }
    };
};

/**
 * Single image upload
 * Max size: 5MB
 */
const uploadSingleImage = multer({
    storage: diskStorage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
    fileFilter: imageFileFilter,
}).single('image');

/**
 * Multiple images upload
 * Max: 10 files, 5MB each
 */
const uploadMultipleImages = multer({
    storage: diskStorage,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 10,
    },
    fileFilter: imageFileFilter,
}).array('images', 10);

/**
 * Single document upload
 * Max size: 10MB
 */
const uploadSingleDocument = multer({
    storage: diskStorage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
    },
    fileFilter: documentFileFilter,
}).single('document');

/**
 * Multiple documents upload
 * Max: 5 files, 10MB each
 */
const uploadMultipleDocuments = multer({
    storage: diskStorage,
    limits: {
        fileSize: 10 * 1024 * 1024,
        files: 5,
    },
    fileFilter: documentFileFilter,
}).array('documents', 5);

/**
 * Avatar upload
 * Max size: 2MB
 */
const uploadAvatar = multer({
    storage: diskStorage,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
    },
    fileFilter: imageFileFilter,
}).single('avatar');

/**
 * Product images upload
 * Max: 6 images, 5MB each
 */
const uploadProductImages = multer({
    storage: diskStorage,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 6,
    },
    fileFilter: imageFileFilter,
}).array('productImages', 6);

/**
 * Video upload
 * Max size: 100MB
 */
const uploadVideo = multer({
    storage: diskStorage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB
    },
    fileFilter: videoFileFilter,
}).single('video');

/**
 * Mixed file upload (different field names)
 */
const uploadMixed = multer({
    storage: diskStorage,
    limits: {
        fileSize: 10 * 1024 * 1024,
    },
}).fields([
    { name: 'avatar', maxCount: 1 },
    { name: 'coverImage', maxCount: 1 },
    { name: 'documents', maxCount: 5 },
]);

/**
 * Create custom upload middleware
 * @param {Object} options - Upload options
 * @returns {Function} Multer middleware
 */
const createUploadMiddleware = (options = {}) => {
    const {
        fieldName = 'file',
        maxFiles = 1,
        maxSize = 5 * 1024 * 1024,
        allowedMimeTypes = [],
        storage = diskStorage,
        destination = 'uploads',
    } = options;

    const uploadConfig = {
        storage: storage === 'memory' ? memoryStorage : diskStorage,
        limits: {
            fileSize: maxSize,
            files: maxFiles,
        },
        fileFilter: createFileFilter(allowedMimeTypes),
    };

    if (maxFiles === 1) {
        return multer(uploadConfig).single(fieldName);
    } else {
        return multer(uploadConfig).array(fieldName, maxFiles);
    }
};

/**
 * Upload error handler
 */
const handleUploadError = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        let message = 'File upload error';

        switch (err.code) {
            case 'LIMIT_FILE_SIZE':
                message = `File size exceeds the maximum allowed size`;
                break;
            case 'LIMIT_FILE_COUNT':
                message = 'Too many files uploaded';
                break;
            case 'LIMIT_UNEXPECTED_FILE':
                message = `Unexpected field: ${err.field}`;
                break;
            case 'LIMIT_FIELD_KEY':
                message = 'Field name is too long';
                break;
            case 'LIMIT_FIELD_VALUE':
                message = 'Field value is too long';
                break;
            case 'LIMIT_FIELD_COUNT':
                message = 'Too many fields';
                break;
            case 'LIMIT_PART_COUNT':
                message = 'Too many parts';
                break;
        }

        logger.logError('File upload error', {
            error: err.message,
            code: err.code,
            field: err.field,
            userId: req.user?.id,
        });

        return res.status(400).json({
            success: false,
            statusCode: 400,
            message,
        });
    }

    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({
            success: false,
            statusCode: err.statusCode,
            message: err.message,
        });
    }

    next(err);
};

/**
 * Validate uploaded file
 */
const validateUploadedFile = (req, res, next) => {
    if (!req.file && !req.files) {
        throw new ApiError(400, 'No file uploaded');
    }

    const files = req.files || [req.file];

    for (const file of files) {
        if (!file) continue;

        // Additional validation can be done here
        logger.logInfo('File uploaded', {
            filename: file.filename,
            originalname: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            userId: req.user?.id,
        });
    }

    next();
};

/**
 * Process uploaded file (e.g., image optimization)
 */
const processUploadedFile = async (req, res, next) => {
    if (!req.file && !req.files) {
        return next();
    }

    try {
        const files = req.files || [req.file];

        for (const file of files) {
            if (!file) continue;

            // Example: Image optimization with sharp
            if (file.mimetype.startsWith('image/')) {
                // const sharp = require('sharp');
                // const optimizedPath = file.path.replace(/\.(jpg|jpeg|png)$/, '_optimized.$1');
                // await sharp(file.path)
                //   .resize(1920, 1080, { fit: 'inside', withoutEnlargement: true })
                //   .jpeg({ quality: 85 })
                //   .toFile(optimizedPath);

                logger.logInfo('Image processed', {
                    filename: file.filename,
                    originalSize: file.size,
                });
            }
        }

        next();
    } catch (error) {
        logger.logError('File processing error', { error: error.message });
        next(new ApiError(500, 'Failed to process uploaded file'));
    }
};

/**
 * Delete uploaded file
 */
const deleteFile = (filepath) => {
    return new Promise((resolve, reject) => {
        fs.unlink(filepath, (err) => {
            if (err) {
                logger.logError('File deletion error', {
                    filepath,
                    error: err.message,
                });
                reject(err);
            } else {
                logger.logInfo('File deleted', { filepath });
                resolve();
            }
        });
    });
};

/**
 * Cleanup uploaded files on error
 */
const cleanupOnError = (err, req, res, next) => {
    if (err) {
        const files = req.files || (req.file ? [req.file] : []);

        // Delete uploaded files
        Promise.all(
            files.map((file) => {
                if (file.path) {
                    return deleteFile(file.path).catch(() => {});
                }
                return Promise.resolve();
            }),
        ).finally(() => {
            next(err);
        });
    } else {
        next();
    }
};

/**
 * Get file URL
 */
const getFileUrl = (filename) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/uploads/${filename}`;
};

/**
 * Attach file URLs to request
 */
const attachFileUrls = (req, res, next) => {
    if (req.file) {
        req.file.url = getFileUrl(req.file.filename);
    }

    if (req.files) {
        if (Array.isArray(req.files)) {
            req.files.forEach((file) => {
                file.url = getFileUrl(file.filename);
            });
        } else {
            // Handle multer fields
            Object.keys(req.files).forEach((fieldname) => {
                req.files[fieldname].forEach((file) => {
                    file.url = getFileUrl(file.filename);
                });
            });
        }
    }

    next();
};

/**
 * Check file exists
 */
const checkFileExists = (filepath) => {
    return fs.existsSync(filepath);
};

/**
 * Get file info
 */
const getFileInfo = (filepath) => {
    if (!checkFileExists(filepath)) {
        throw new ApiError(404, 'File not found');
    }

    const stats = fs.statSync(filepath);

    return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        extension: path.extname(filepath),
        basename: path.basename(filepath),
    };
};

/**
 * Serve uploaded file
 */
const serveFile = (req, res, next) => {
    const filename = req.params.filename;
    const filepath = path.join(process.cwd(), 'uploads', filename);

    if (!checkFileExists(filepath)) {
        throw new ApiError(404, 'File not found');
    }

    res.sendFile(filepath, (err) => {
        if (err) {
            logger.logError('File serve error', {
                filepath,
                error: err.message,
            });
            next(err);
        }
    });
};

module.exports = {
    // Predefined upload middlewares
    uploadSingleImage,
    uploadMultipleImages,
    uploadSingleDocument,
    uploadMultipleDocuments,
    uploadAvatar,
    uploadProductImages,
    uploadVideo,
    uploadMixed,

    // Custom upload creator
    createUploadMiddleware,

    // Error handling
    handleUploadError,
    cleanupOnError,

    // Validation and processing
    validateUploadedFile,
    processUploadedFile,
    attachFileUrls,

    // File management
    deleteFile,
    checkFileExists,
    getFileInfo,
    serveFile,
    getFileUrl,
    generateFilename,
    ensureUploadDir,
};

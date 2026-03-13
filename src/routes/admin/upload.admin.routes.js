const express = require('express');
const router = express.Router();
const {
    uploadSingleImage,
    handleUploadError,
    validateUploadedFile,
    attachFileUrls,
    processUploadedFile,
} = require('../../middlewares/upload.middleware');

// Unique admin upload endpoint for all file types
const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    'video/mp4',
    'video/mpeg',
    'video/quicktime',
    'video/x-msvideo',
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/ogg',
    'audio/webm',
];

const {
    createUploadMiddleware,
} = require('../../middlewares/upload.middleware');

router.post(
    '/',
    createUploadMiddleware({
        fieldName: 'file',
        maxFiles: 10,
        maxSize: 100 * 1024 * 1024, // 100MB
        allowedMimeTypes,
    }),
    handleUploadError,
    validateUploadedFile,
    processUploadedFile,
    attachFileUrls,
    (req, res) => {
        const files = req.files || [req.file];
        const result = files.map((file) => {
            if (file && file.mimetype && file.mimetype.startsWith('image/')) {
                return {
                    ...file,
                    webpUrl: file.optimizedUrl,
                    webpPath: file.optimizedPath,
                };
            }
            return file;
        });
        res.json({ success: true, files: result });
    },
);

module.exports = router;

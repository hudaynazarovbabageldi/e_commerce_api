const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../../utils/asyncHandler');
const {
    uploadAvatar,
    handleUploadError,
    validateUploadedFile,
    attachFileUrls,
    processUploadedFile,
} = require('../../middlewares/upload.middleware');

// Unique client upload endpoint for all file types
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
const {
    startMultipartUpload,
    uploadPart,
    completeMultipartUpload,
    abortMultipartUpload,
    uploadStreamDirect,
    getPresignedUrl,
} = require('../../services/multipart-upload.service');

router.post(
    '/multipart/init',
    asyncHandler(async (req, res) => {
        const payload = await startMultipartUpload({
            filename: req.body?.filename,
            contentType: req.body?.contentType,
            size: req.body?.size,
            userId: req.user?.id,
            folder: 'client',
        });

        res.status(201).json({
            success: true,
            message: 'Multipart upload initialized',
            data: payload,
        });
    }),
);

router.put(
    '/multipart/:uploadId/parts/:partNumber',
    asyncHandler(async (req, res) => {
        const payload = await uploadPart({
            uploadId: req.params.uploadId,
            partNumber: req.params.partNumber,
            stream: req,
            contentLength: req.headers['content-length'],
        });

        res.status(200).json({
            success: true,
            message: 'Part uploaded',
            data: payload,
        });
    }),
);

router.post(
    '/multipart/:uploadId/complete',
    asyncHandler(async (req, res) => {
        const payload = await completeMultipartUpload({
            uploadId: req.params.uploadId,
            parts: req.body?.parts,
        });

        res.status(200).json({
            success: true,
            message: 'Multipart upload completed',
            data: payload,
        });
    }),
);

router.delete(
    '/multipart/:uploadId',
    asyncHandler(async (req, res) => {
        const payload = await abortMultipartUpload({
            uploadId: req.params.uploadId,
        });

        res.status(200).json({
            success: true,
            message: 'Multipart upload aborted',
            data: payload,
        });
    }),
);

router.put(
    '/stream',
    asyncHandler(async (req, res) => {
        const payload = await uploadStreamDirect({
            filename: req.query?.filename || req.headers['x-file-name'],
            contentType: req.headers['content-type'],
            stream: req,
            contentLength: req.headers['content-length'],
            userId: req.user?.id,
            folder: 'client',
        });

        res.status(201).json({
            success: true,
            message: 'Stream upload completed',
            data: payload,
        });
    }),
);

router.get(
    '/presigned',
    asyncHandler(async (req, res) => {
        const payload = await getPresignedUrl({
            objectName: req.query.objectName,
            expirySeconds: req.query.expiry ? Number(req.query.expiry) : 3600,
        });

        res.json({
            success: true,
            message: 'Presigned URL generated',
            data: payload,
        });
    }),
);

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

const crypto = require('crypto');
const path = require('path');
const { getRedisClient } = require('../config/redis');
const {
    minioConfig,
    getMinioClient,
    ensureBucketExists,
    buildObjectUrl,
} = require('../config/minio');
const { ApiError } = require('../utils/ApiError');
const logger = require('../utils/logger');

const SESSION_PREFIX = 'upload:session:';
const SESSION_TTL_SECONDS =
    Number(process.env.UPLOAD_SESSION_TTL_SECONDS) || 60 * 60 * 6;

const memoryStore = new Map();

const sanitizeFileName = (value = 'file') =>
    value.replace(/[^a-zA-Z0-9._-]/g, '_');

const createObjectName = (originalName = 'file.bin') => {
    const ext = path.extname(originalName);
    const base = path.basename(originalName, ext);
    const safeBase = sanitizeFileName(base);
    const random = crypto.randomBytes(8).toString('hex');

    return `${new Date().toISOString().slice(0, 10)}/${safeBase}_${Date.now()}_${random}${ext}`;
};

const getSessionKey = (uploadId) => `${SESSION_PREFIX}${uploadId}`;

const setMemorySession = (uploadId, session) => {
    memoryStore.set(uploadId, {
        expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
        session,
    });
};

const getMemorySession = (uploadId) => {
    const item = memoryStore.get(uploadId);
    if (!item) return null;

    if (Date.now() > item.expiresAt) {
        memoryStore.delete(uploadId);
        return null;
    }

    return item.session;
};

const deleteMemorySession = (uploadId) => {
    memoryStore.delete(uploadId);
};

const persistSession = async (session) => {
    const redis = getRedisClient();
    const payload = JSON.stringify(session);

    if (redis && redis.isReady) {
        await redis.set(getSessionKey(session.uploadId), payload, {
            EX: SESSION_TTL_SECONDS,
        });
        return;
    }

    setMemorySession(session.uploadId, session);
};

const readSession = async (uploadId) => {
    const redis = getRedisClient();

    if (redis && redis.isReady) {
        const raw = await redis.get(getSessionKey(uploadId));
        return raw ? JSON.parse(raw) : null;
    }

    return getMemorySession(uploadId);
};

const removeSession = async (uploadId) => {
    const redis = getRedisClient();

    if (redis && redis.isReady) {
        await redis.del(getSessionKey(uploadId));
        return;
    }

    deleteMemorySession(uploadId);
};

const assertMinioEnabled = () => {
    if (!minioConfig.enabled) {
        throw new ApiError(503, 'MinIO upload is disabled');
    }
};

const isMinioUnavailableError = (error) => {
    const unavailableCodes = [
        'ECONNREFUSED',
        'ENOTFOUND',
        'EAI_AGAIN',
        'ETIMEDOUT',
        'ECONNRESET',
        'EHOSTUNREACH',
    ];

    return unavailableCodes.includes(error?.code);
};

const runMinioOperation = async (operationName, callback) => {
    try {
        return await callback();
    } catch (error) {
        logger.logError(`MinIO operation failed: ${operationName}`, {
            error: error.message,
            code: error.code,
            endpoint: `${minioConfig.endPoint}:${minioConfig.port}`,
            bucket: minioConfig.bucket,
        });

        if (isMinioUnavailableError(error)) {
            throw new ApiError(
                503,
                `MinIO is unavailable at ${minioConfig.endPoint}:${minioConfig.port}. Please start MinIO and try again.`,
            );
        }

        throw error;
    }
};

const startMultipartUpload = async ({
    filename,
    contentType,
    size,
    userId,
    folder = 'general',
}) => {
    assertMinioEnabled();

    if (!filename) throw new ApiError(400, 'filename is required');
    if (!contentType) throw new ApiError(400, 'contentType is required');
    if (!size || Number(size) <= 0)
        throw new ApiError(400, 'size must be greater than 0');

    const fileSize = Number(size);
    if (fileSize > minioConfig.maxFileSize) {
        throw new ApiError(400, 'File size exceeds the maximum allowed size');
    }

    await runMinioOperation('ensureBucketExists', () => ensureBucketExists());
    const client = getMinioClient();

    const objectName = `${sanitizeFileName(folder)}/${createObjectName(filename)}`;
    const uploadId = await runMinioOperation('initiateNewMultipartUpload', () =>
        client.initiateNewMultipartUpload(minioConfig.bucket, objectName, {
            'Content-Type': contentType,
            'x-amz-meta-user-id': String(userId || ''),
            'x-amz-meta-original-name': filename,
        }),
    );

    const session = {
        uploadId,
        objectName,
        bucket: minioConfig.bucket,
        filename,
        contentType,
        size: fileSize,
        userId: userId || null,
        folder,
        parts: {},
        createdAt: new Date().toISOString(),
    };

    await persistSession(session);

    return {
        uploadId,
        objectName,
        bucket: minioConfig.bucket,
        maxPartSize: minioConfig.maxPartSize,
    };
};

const uploadPart = async ({ uploadId, partNumber, stream, contentLength }) => {
    console.log('uploadId: ', uploadId, partNumber, contentLength);
    assertMinioEnabled();

    const numericPart = Number(partNumber);
    if (!numericPart || numericPart < 1 || numericPart > 10000) {
        throw new ApiError(400, 'partNumber must be between 1 and 10000');
    }

    const session = await readSession(uploadId);
    if (!session)
        throw new ApiError(404, 'Upload session not found or expired');

    if (!contentLength || Number(contentLength) <= 0) {
        throw new ApiError(400, 'Chunk content-length is required');
    }

    if (Number(contentLength) > minioConfig.maxPartSize) {
        throw new ApiError(
            400,
            `Chunk exceeds max part size (${minioConfig.maxPartSize} bytes)`,
        );
    }

    const client = getMinioClient();

    // The minio v8 SDK's uploadPart calls makeRequestAsync which requires a
    // Buffer/string payload (not a stream). Collect the stream into a Buffer first.
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const { etag } = await runMinioOperation('uploadPart', () =>
        client.uploadPart(
            {
                bucketName: session.bucket,
                objectName: session.objectName,
                uploadID: uploadId,
                partNumber: numericPart,
                headers: { 'content-length': buffer.length },
            },
            buffer,
        ),
    );

    session.parts[String(numericPart)] = etag;
    await persistSession(session);

    return {
        uploadId,
        partNumber: numericPart,
        etag,
    };
};

const completeMultipartUpload = async ({ uploadId, parts }) => {
    assertMinioEnabled();

    const session = await readSession(uploadId);
    if (!session)
        throw new ApiError(404, 'Upload session not found or expired');

    const client = getMinioClient();

    let multipartParts = [];

    if (Array.isArray(parts) && parts.length > 0) {
        multipartParts = parts
            .map((item) => ({
                part: Number(item.partNumber ?? item.PartNumber),
                etag: item.etag ?? item.ETag,
            }))
            .filter((item) => item.part && item.etag)
            .sort((a, b) => a.part - b.part);
    }

    // Fall back to session.parts if no valid parts were provided
    if (multipartParts.length === 0) {
        multipartParts = Object.entries(session.parts)
            .map(([part, etag]) => ({ part: Number(part), etag }))
            .sort((a, b) => a.part - b.part);
    }

    if (multipartParts.length === 0) {
        throw new ApiError(400, 'No uploaded parts found to complete');
    }

    await runMinioOperation('completeMultipartUpload', () =>
        client.completeMultipartUpload(
            session.bucket,
            session.objectName,
            uploadId,
            multipartParts,
        ),
    );

    await removeSession(uploadId);

    return {
        uploadId,
        bucket: session.bucket,
        objectName: session.objectName,
        filename: session.filename,
        contentType: session.contentType,
        url: buildObjectUrl(session.objectName),
    };
};

const abortMultipartUpload = async ({ uploadId }) => {
    assertMinioEnabled();

    const session = await readSession(uploadId);
    if (!session)
        throw new ApiError(404, 'Upload session not found or expired');

    const client = getMinioClient();

    await runMinioOperation('abortMultipartUpload', () =>
        client.abortMultipartUpload(
            session.bucket,
            session.objectName,
            uploadId,
        ),
    );
    await removeSession(uploadId);

    return {
        uploadId,
        aborted: true,
    };
};

const uploadStreamDirect = async ({
    filename,
    contentType,
    stream,
    contentLength,
    userId,
    folder = 'general',
}) => {
    assertMinioEnabled();

    if (!filename)
        throw new ApiError(
            400,
            'filename is required (query param or x-file-name header)',
        );

    const length = Number(contentLength || 0);
    if (!length || length <= 0) {
        throw new ApiError(
            400,
            'content-length header is required for stream upload',
        );
    }

    if (length > minioConfig.maxFileSize) {
        throw new ApiError(400, 'File size exceeds the maximum allowed size');
    }

    await runMinioOperation('ensureBucketExists', () => ensureBucketExists());
    const client = getMinioClient();

    const objectName = `${sanitizeFileName(folder)}/${createObjectName(filename)}`;

    await runMinioOperation('putObject', () =>
        client.putObject(minioConfig.bucket, objectName, stream, length, {
            'Content-Type': contentType || 'application/octet-stream',
            'x-amz-meta-user-id': String(userId || ''),
            'x-amz-meta-original-name': filename,
        }),
    );

    logger.logInfo('Uploaded stream to MinIO', {
        bucket: minioConfig.bucket,
        objectName,
        filename,
        contentLength: length,
        userId,
    });

    return {
        bucket: minioConfig.bucket,
        objectName,
        filename,
        url: buildObjectUrl(objectName),
    };
};

const getPresignedUrl = async ({ objectName, expirySeconds = 3600 }) => {
    assertMinioEnabled();

    if (!objectName) throw new ApiError(400, 'objectName is required');

    const client = getMinioClient();

    const url = await runMinioOperation('presignedGetObject', () =>
        client.presignedGetObject(
            minioConfig.bucket,
            objectName,
            expirySeconds,
        ),
    );

    return { url, expiresIn: expirySeconds };
};

module.exports = {
    startMultipartUpload,
    uploadPart,
    completeMultipartUpload,
    abortMultipartUpload,
    uploadStreamDirect,
    getPresignedUrl,
};

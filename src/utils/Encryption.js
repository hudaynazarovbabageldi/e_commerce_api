const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { ApiError } = require('./ApiError');

// Salt rounds for bcrypt (higher = more secure but slower)
const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 * @param {String} password - Plain text password
 * @param {Number} saltRounds - Number of salt rounds (default: 10)
 * @returns {Promise<String>} Hashed password
 */
const hashPassword = async (password, saltRounds = SALT_ROUNDS) => {
    try {
        if (!password || typeof password !== 'string') {
            throw new ApiError(400, 'Valid password is required');
        }

        if (password.length < 8) {
            throw new ApiError(
                400,
                'Password must be at least 8 characters long',
            );
        }

        const salt = await bcrypt.genSalt(saltRounds);
        const hashedPassword = await bcrypt.hash(password, salt);

        return hashedPassword;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(500, 'Failed to hash password');
    }
};

/**
 * Compare plain text password with hashed password
 * @param {String} password - Plain text password
 * @param {String} hashedPassword - Hashed password
 * @returns {Promise<Boolean>} True if passwords match
 */
const comparePassword = async (password, hashedPassword) => {
    try {
        if (!password || !hashedPassword) {
            return false;
        }

        return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
        throw new ApiError(500, 'Failed to compare passwords');
    }
};

/**
 * Validate password strength
 * @param {String} password - Password to validate
 * @returns {Object} Validation result with isValid and errors
 */
const validatePasswordStrength = (password) => {
    const errors = [];

    if (!password) {
        return { isValid: false, errors: ['Password is required'] };
    }

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
        errors.push('Password must not exceed 128 characters');
    }

    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
        errors.push('Password must contain at least one special character');
    }

    // Check for common weak passwords
    const weakPasswords = [
        'password',
        'password123',
        '12345678',
        'qwerty',
        'abc123',
        'letmein',
        'monkey',
        '1234567890',
        'Password1',
        'Password123',
    ];

    if (weakPasswords.includes(password.toLowerCase())) {
        errors.push(
            'This password is too common. Please choose a stronger password',
        );
    }

    return {
        isValid: errors.length === 0,
        errors,
    };
};

/**
 * Generate a random secure token
 * @param {Number} length - Token length in bytes (default: 32)
 * @returns {String} Hexadecimal token
 */
const generateSecureToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

/**
 * Generate a random numeric OTP
 * @param {Number} length - OTP length (default: 6)
 * @returns {String} Numeric OTP
 */
const generateOTP = (length = 6) => {
    const digits = '0123456789';
    let otp = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = crypto.randomInt(0, digits.length);
        otp += digits[randomIndex];
    }

    return otp;
};

/**
 * Hash data using SHA-256
 * @param {String} data - Data to hash
 * @returns {String} Hashed data
 */
const hashSHA256 = (data) => {
    return crypto.createHash('sha256').update(data).digest('hex');
};

/**
 * Create HMAC signature
 * @param {String} data - Data to sign
 * @param {String} secret - Secret key
 * @returns {String} HMAC signature
 */
const createHMAC = (data, secret) => {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
};

/**
 * Verify HMAC signature
 * @param {String} data - Original data
 * @param {String} signature - HMAC signature to verify
 * @param {String} secret - Secret key
 * @returns {Boolean} True if signature is valid
 */
const verifyHMAC = (data, signature, secret) => {
    const expectedSignature = createHMAC(data, secret);
    return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
    );
};

/**
 * Encrypt data using AES-256-GCM
 * @param {String} text - Text to encrypt
 * @param {String} secretKey - Secret key (32 bytes)
 * @returns {Object} Encrypted data with iv and authTag
 */
const encrypt = (text, secretKey) => {
    try {
        // Ensure secret key is 32 bytes
        const key = crypto.scryptSync(secretKey, 'salt', 32);
        const iv = crypto.randomBytes(16);

        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const authTag = cipher.getAuthTag();

        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
        };
    } catch (error) {
        throw new ApiError(500, 'Encryption failed');
    }
};

/**
 * Decrypt data using AES-256-GCM
 * @param {String} encrypted - Encrypted text
 * @param {String} iv - Initialization vector
 * @param {String} authTag - Authentication tag
 * @param {String} secretKey - Secret key (32 bytes)
 * @returns {String} Decrypted text
 */
const decrypt = (encrypted, iv, authTag, secretKey) => {
    try {
        const key = crypto.scryptSync(secretKey, 'salt', 32);

        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            key,
            Buffer.from(iv, 'hex'),
        );

        decipher.setAuthTag(Buffer.from(authTag, 'hex'));

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        throw new ApiError(500, 'Decryption failed');
    }
};

/**
 * Mask sensitive data for logging
 * @param {String} data - Data to mask
 * @param {Number} visibleChars - Number of visible characters at start and end
 * @returns {String} Masked data
 */
const maskSensitiveData = (data, visibleChars = 4) => {
    if (!data || data.length <= visibleChars * 2) {
        return '****';
    }

    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    const maskLength = data.length - visibleChars * 2;

    return `${start}${'*'.repeat(Math.min(maskLength, 8))}${end}`;
};

/**
 * Mask email address
 * @param {String} email - Email to mask
 * @returns {String} Masked email
 */
const maskEmail = (email) => {
    if (!email || !email.includes('@')) {
        return '****@****.***';
    }

    const [localPart, domain] = email.split('@');
    const maskedLocal =
        localPart.length > 2
            ? localPart[0] +
              '*'.repeat(localPart.length - 2) +
              localPart[localPart.length - 1]
            : '***';

    const [domainName, tld] = domain.split('.');
    const maskedDomain =
        domainName.length > 2
            ? domainName[0] +
              '*'.repeat(domainName.length - 2) +
              domainName[domainName.length - 1]
            : '***';

    return `${maskedLocal}@${maskedDomain}.${tld}`;
};

/**
 * Mask credit card number
 * @param {String} cardNumber - Card number to mask
 * @returns {String} Masked card number
 */
const maskCardNumber = (cardNumber) => {
    if (!cardNumber) {
        return '****-****-****-****';
    }

    const cleaned = cardNumber.replace(/\s+/g, '');

    if (cleaned.length < 12) {
        return '****-****-****-****';
    }

    const last4 = cleaned.slice(-4);
    return `****-****-****-${last4}`;
};

/**
 * Generate API key
 * @param {String} prefix - Optional prefix for the key
 * @returns {String} API key
 */
const generateApiKey = (prefix = 'sk') => {
    const randomPart = generateSecureToken(24);
    return `${prefix}_${randomPart}`;
};

/**
 * Hash API key for storage
 * @param {String} apiKey - API key to hash
 * @returns {String} Hashed API key
 */
const hashApiKey = (apiKey) => {
    return hashSHA256(apiKey);
};

/**
 * Generate random alphanumeric string
 * @param {Number} length - String length
 * @returns {String} Random string
 */
const generateRandomString = (length = 16) => {
    const characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = crypto.randomInt(0, characters.length);
        result += characters[randomIndex];
    }

    return result;
};

/**
 * Sanitize user input to prevent XSS
 * @param {String} input - User input
 * @returns {String} Sanitized input
 */
const sanitizeInput = (input) => {
    if (typeof input !== 'string') {
        return input;
    }

    return input
        .replace(/[<>]/g, '') // Remove < and > // <script> console.log(mdjns)</script>
        .trim(); //
};

module.exports = {
    // Password functions
    hashPassword,
    comparePassword,
    validatePasswordStrength,

    // Token generation
    generateSecureToken,
    generateOTP,
    generateApiKey,
    generateRandomString,

    // Hashing
    hashSHA256,
    hashApiKey,

    // HMAC
    createHMAC,
    verifyHMAC,

    // Encryption/Decryption
    encrypt,
    decrypt,

    // Masking
    maskSensitiveData,
    maskEmail,
    maskCardNumber,

    // Sanitization
    sanitizeInput,
};

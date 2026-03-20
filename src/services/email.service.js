const logger = require('../utils/logger');
const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.isDevelopment = process.env.NODE_ENV === 'development';
        this.useMailtrap =
            this.isDevelopment &&
            !!process.env.MAILTRAP_USER &&
            !!process.env.MAILTRAP_PASS;

        if (this.useMailtrap) {
            const mailtrapPort = Number(process.env.MAILTRAP_PORT) || 2525;

            this.transporter = nodemailer.createTransport({
                host: process.env.MAILTRAP_HOST || 'sandbox.smtp.mailtrap.io',
                port: mailtrapPort,
                secure: process.env.MAILTRAP_SECURE === 'true',
                auth: {
                    user: process.env.MAILTRAP_USER,
                    pass: process.env.MAILTRAP_PASS,
                },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
            });
        } else {
            const smtpPort = Number(process.env.SMTP_PORT) || 587;
            const smtpSecure =
                process.env.SMTP_SECURE === 'true' || smtpPort === 465;

            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: smtpPort,
                secure: smtpSecure,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
            });
        }
    }

    async sendEmail(to, subject, html, text) {
        try {
            if (this.useMailtrap) {
                if (!process.env.MAILTRAP_USER || !process.env.MAILTRAP_PASS) {
                    throw new Error(
                        'Mailtrap configuration is missing (MAILTRAP_USER/MAILTRAP_PASS)',
                    );
                }
            } else if (
                !process.env.SMTP_HOST ||
                !process.env.SMTP_USER ||
                !process.env.SMTP_PASS
            ) {
                throw new Error(
                    'SMTP configuration is missing (SMTP_HOST/SMTP_USER/SMTP_PASS)',
                );
            }

            const fromEmail = this.useMailtrap
                ? process.env.MAILTRAP_FROM_EMAIL || process.env.SMTP_USER
                : process.env.SMTP_USER;
            const fromName = process.env.MAIL_FROM_NAME || 'My App';

            const info = await this.transporter.sendMail({
                from: `"${fromName}" <${fromEmail}>`,
                to,
                subject,
                text,
                html,
            });

            logger.logInfo('Email sent', {
                to,
                subject,
                messageId: info.messageId,
                provider: this.useMailtrap ? 'mailtrap' : 'smtp',
            });
        } catch (error) {
            logger.logError('Failed to send email', {
                to,
                subject,
                error: error.message,
            });

            const smtpError = new Error(
                'Email service unavailable. Please try again later.',
            );
            smtpError.code = 'EMAIL_SERVICE_UNAVAILABLE';
            smtpError.originalMessage = error.message;
            throw smtpError;
        }
    }

    async sendVerificationEmail(email, verificationToken, firstName) {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
        const subject = 'Verify Your Email Address';
        const html = `
      <h1>Welcome, ${firstName}!</h1>
      <p>Please verify your email by clicking: <a href="${verificationUrl}">Verify Email</a></p>
      <p>Link expires in 24 hours.</p>
    `;
        const text = `Welcome, ${firstName}! Verify at: ${verificationUrl}`;
        await this.sendEmail(email, subject, html, text);
    }

    async sendPasswordResetEmail(email, resetToken, firstName) {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        const subject = 'Reset Your Password';
        const html = `
      <h1>Password Reset Request</h1>
      <p>Hi ${firstName}, reset your password: <a href="${resetUrl}">Reset Password</a></p>
      <p>Link expires in 1 hour.</p>
    `;
        const text = `Hi ${firstName}, reset at: ${resetUrl}`;
        await this.sendEmail(email, subject, html, text);
    }

    async sendPasswordResetConfirmationEmail(email, firstName) {
        const subject = 'Password Reset Successful';
        const html = `<h1>Password Reset Successful</h1><p>Hi ${firstName}, your password was reset.</p>`;
        const text = `Hi ${firstName}, your password was successfully reset.`;
        await this.sendEmail(email, subject, html, text);
    }

    async sendPasswordChangedEmail(email, firstName) {
        const subject = 'Password Changed';
        const html = `<h1>Password Changed</h1><p>Hi ${firstName}, your password was changed.</p>`;
        const text = `Hi ${firstName}, your password was changed.`;
        await this.sendEmail(email, subject, html, text);
    }

    async sendWelcomeEmail(email, firstName) {
        const subject = 'Welcome to Our Store!';
        const html = `
      <h1>Welcome, ${firstName}!</h1>
      <p>Your email is verified. Start shopping!</p>
      <a href="${process.env.FRONTEND_URL}/products">Start Shopping</a>
    `;
        const text = `Welcome, ${firstName}! Start shopping at ${process.env.FRONTEND_URL}/products`;
        await this.sendEmail(email, subject, html, text);
    }

    async sendOrderConfirmationEmail(email, order) {
        const subject = `Order Confirmation - ${order.orderNumber}`;
        const itemsList = order.items
            .map(
                (item) =>
                    `${item.productName} x ${item.quantity} - $${item.total}`,
            )
            .join('<br>');
        const html = `
      <h1>Order Confirmation</h1>
      <h2>Order #${order.orderNumber}</h2>
      <h3>Items:</h3>
      <p>${itemsList}</p>
      <p><strong>Total:</strong> $${order.total}</p>
    `;
        const text = `Order #${order.orderNumber}. Total: $${order.total}`;
        await this.sendEmail(email, subject, html, text);
    }

    async sendOrderShippedEmail(email, order) {
        const subject = `Your Order Has Shipped - ${order.orderNumber}`;
        const html = `
      <h1>Your Order Has Shipped!</h1>
      <p>Order #${order.orderNumber} has been shipped.</p>
      ${order.trackingNumber ? `<p><strong>Tracking:</strong> ${order.trackingNumber}</p>` : ''}
    `;
        const text = `Order #${order.orderNumber} shipped! ${order.trackingNumber || ''}`;
        await this.sendEmail(email, subject, html, text);
    }

    async sendOrderDeliveredEmail(email, order) {
        const subject = `Your Order Has Been Delivered - ${order.orderNumber}`;
        const html = `
      <h1>Your Order Has Been Delivered!</h1>
      <p>Order #${order.orderNumber} has been delivered.</p>
      <p>Please leave a review!</p>
    `;
        const text = `Order #${order.orderNumber} delivered!`;
        await this.sendEmail(email, subject, html, text);
    }

    async sendOrderCancelledEmail(email, order) {
        const subject = `Order Cancelled - ${order.orderNumber}`;
        const html = `
      <h1>Order Cancelled</h1>
      <p>Your order #${order.orderNumber} has been cancelled.</p>
      ${order.cancellationReason ? `<p><strong>Reason:</strong> ${order.cancellationReason}</p>` : ''}
    `;
        const text = `Order #${order.orderNumber} cancelled.`;
        await this.sendEmail(email, subject, html, text);
    }

    async sendLowStockAlertEmail(email, products) {
        const subject = 'Low Stock Alert';
        const productsList = products
            .map((p) => `${p.name} (SKU: ${p.sku}) - ${p.stock} units`)
            .join('<br>');
        const html = `<h1>Low Stock Alert</h1><p>Products needing restock:</p><p>${productsList}</p>`;
        const text = `Low Stock: ${products.length} products need restocking.`;
        await this.sendEmail(email, subject, html, text);
    }
}

module.exports = new EmailService();

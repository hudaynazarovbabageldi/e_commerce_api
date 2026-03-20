const logger = require('../utils/logger');

class EmailService {
    constructor() {
        // TODO: Initialize email service (SendGrid, AWS SES, etc.)
    }

    async sendEmail(to, subject, html, text) {
        try {
            logger.logInfo('Email sent', {
                to,
                subject,
                timestamp: new Date().toISOString(),
            });
            console.log('==== EMAIL ====');
            console.log(`To: ${to}`);
            console.log(`Subject: ${subject}`);
            console.log(`Content: ${text || html}`);
            console.log('===============');
        } catch (error) {
            logger.logError('Failed to send email', {
                to,
                subject,
                error: error.message,
            });
            throw error;
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

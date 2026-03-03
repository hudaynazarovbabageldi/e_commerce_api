const logger = require('../utils/logger');

class NotificationService {
    async sendNotification(userId, notification) {
        const { title, message, type, data } = notification;
        logger.logInfo('Notification sent', { userId, type, title });
    }

    async sendPushNotification(userId, notification) {
        // TODO: Integrate with FCM, APNs
        logger.logInfo('Push notification sent', { userId });
    }

    async sendSMS(phone, message) {
        // TODO: Integrate with Twilio, AWS SNS
        logger.logInfo('SMS sent', {
            phone: phone.replace(/\d(?=\d{4})/g, '*'),
        });
    }

    async notifyOrderStatusChange(userId, order) {
        const statusMessages = {
            confirmed: 'Your order has been confirmed',
            processing: 'Your order is being processed',
            shipped: 'Your order has been shipped',
            delivered: 'Your order has been delivered',
            cancelled: 'Your order has been cancelled',
        };

        await this.sendNotification(userId, {
            title: 'Order Update',
            message: statusMessages[order.status] || 'Order status updated',
            type: 'order_update',
            data: { orderId: order.id, orderNumber: order.orderNumber },
        });
    }

    async notifyLowStock(userId, products) {
        await this.sendNotification(userId, {
            title: 'Low Stock Alert',
            message: `${products.length} products are running low on stock`,
            type: 'inventory_alert',
            data: { productIds: products.map(p => p.id) },
        });
    }

    async notifyPriceDrop(userId, product) {
        await this.sendNotification(userId, {
            title: 'Price Drop Alert',
            message: `${product.name} is now on sale!`,
            type: 'price_alert',
            data: { productId: product.id },
        });
    }
}

module.exports = new NotificationService();

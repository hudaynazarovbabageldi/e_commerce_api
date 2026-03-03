const { Inventory, Product } = require('../models');
const { ApiError } = require('../utils/ApiError');
const logger = require('../utils/logger');
const emailService = require('./email.service');

class InventoryService {
    async reserveInventory(productId, quantity) {
        const inventory = await Inventory.findOne({ where: { productId } });
        if (!inventory) throw new ApiError(404, 'Inventory record not found');
        if (inventory.available < quantity)
            throw new ApiError(400, 'Insufficient inventory available');

        await inventory.reserve(quantity);
        logger.logBusinessEvent('inventory_reserved', {
            productId,
            quantity,
            available: inventory.available,
        });
    }

    async releaseInventory(productId, quantity) {
        const inventory = await Inventory.findOne({ where: { productId } });
        if (!inventory) throw new ApiError(404, 'Inventory record not found');

        await inventory.release(quantity);
        logger.logBusinessEvent('inventory_released', {
            productId,
            quantity,
            available: inventory.available,
        });
    }

    async deductInventory(productId, quantity) {
        const inventory = await Inventory.findOne({ where: { productId } });
        if (!inventory) throw new ApiError(404, 'Inventory record not found');

        await inventory.deduct(quantity);

        const product = await Product.findByPk(productId);
        if (product) {
            product.stock -= quantity;
            await product.save();
        }

        if (inventory.isLowStock()) {
            await this.handleLowStock(productId);
        }

        logger.logBusinessEvent('inventory_deducted', {
            productId,
            quantity,
            available: inventory.available,
        });
    }

    async restockInventory(productId, quantity) {
        const inventory = await Inventory.findOne({ where: { productId } });
        if (!inventory) throw new ApiError(404, 'Inventory record not found');

        await inventory.restock(quantity);

        const product = await Product.findByPk(productId);
        if (product) {
            product.stock += quantity;
            await product.save();
        }

        logger.logBusinessEvent('inventory_restocked', {
            productId,
            quantity,
            newQuantity: inventory.quantity,
        });
    }

    async handleLowStock(productId) {
        const product = await Product.findByPk(productId, {
            include: [{ model: Inventory, as: 'inventory' }],
        });

        if (!product) return;

        logger.logWarn('Low stock detected', {
            productId,
            productName: product.name,
            stock: product.stock,
            threshold: product.lowStockThreshold,
        });

        const adminEmails = ['admin@example.com'];
        for (const email of adminEmails) {
            await emailService
                .sendLowStockAlertEmail(email, [product])
                .catch(err =>
                    logger.logError('Failed to send low stock alert', {
                        error: err.message,
                    })
                );
        }
    }

    async getInventoryStatus(productId) {
        const inventory = await Inventory.findOne({ where: { productId } });
        if (!inventory) throw new ApiError(404, 'Inventory record not found');

        return {
            productId,
            quantity: inventory.quantity,
            reserved: inventory.reserved,
            available: inventory.available,
            isLowStock: inventory.isLowStock(),
            needsReorder: inventory.needsReorder(),
            reorderPoint: inventory.reorderPoint,
            reorderQuantity: inventory.reorderQuantity,
        };
    }

    async performAudit(productId, actualCount) {
        const inventory = await Inventory.findOne({ where: { productId } });
        if (!inventory) throw new ApiError(404, 'Inventory record not found');

        const systemCount = inventory.quantity;
        const discrepancy = actualCount - systemCount;

        await inventory.updateCount(actualCount);

        const product = await Product.findByPk(productId);
        if (product) {
            product.stock = actualCount;
            await product.save();
        }

        logger.logBusinessEvent('inventory_audit', {
            productId,
            systemCount,
            actualCount,
            discrepancy,
        });

        return {
            productId,
            systemCount,
            actualCount,
            discrepancy,
            auditedAt: new Date(),
        };
    }
}

module.exports = new InventoryService();

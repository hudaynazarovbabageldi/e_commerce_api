// const productRepository = require("../repositories/product.repository");
// const { ApiError } = require("../utils/ApiError");

// class ProductService {
//   async getProducts(filters, pagination) {
//     const result = await productRepository.findAll(filters, pagination);

//     return {
//       products: result.rows,
//       totalItems: result.count,
//       totalPages: Math.ceil(result.count / pagination.limit),
//       currentPage: pagination.page,
//     };
//   }

//   async getProductById(id) {
//     const product = await productRepository.findById(id);

//     if (!product) {
//       throw new ApiError(404, "Product not found");
//     }

//     return product;
//   }

//   async createProduct(productData) {
//     // Business logic validation
//     if (productData.price < 0) {
//       throw new ApiError(400, "Price cannot be negative");
//     }

//     return productRepository.create(productData);
//   }

//   async updateProduct(id, productData) {
//     const product = await productRepository.update(id, productData);

//     if (!product) {
//       throw new ApiError(404, "Product not found");
//     }

//     return product;
//   }

//   async deleteProduct(id) {
//     const result = await productRepository.delete(id);

//     if (!result) {
//       throw new ApiError(404, "Product not found");
//     }

//     return { message: "Product deleted successfully" };
//   }

//   async checkAvailability(productId, quantity) {
//     const product = await this.getProductById(productId);

//     if (product.stock < quantity) {
//       throw new ApiError(400, "Insufficient stock");
//     }

//     return true;
//   }
// }

// module.exports = new ProductService();
const { Product, Category, Inventory } = require('../models');
const { ApiError } = require('../utils/ApiError');
const logger = require('../utils/logger');

class ProductService {
    async getProductWithAvailability(productId) {
        const product = await Product.findByPk(productId, {
            include: [
                { model: Category, as: 'category' },
                { model: Inventory, as: 'inventory' },
            ],
        });
        if (!product) throw new ApiError(404, 'Product not found');

        return {
            ...product.toJSON(),
            available: product.inventory
                ? product.inventory.available
                : product.stock,
        };
    }

    async checkAvailability(productId, quantity) {
        const product = await Product.findByPk(productId);
        if (!product) throw new ApiError(404, 'Product not found');
        if (!product.isActive)
            throw new ApiError(400, 'Product is not available');
        if (product.isDigital) return true;
        return product.stock >= quantity;
    }

    async updateStock(productId, quantity, action = 'set') {
        const product = await Product.findByPk(productId);
        if (!product) throw new ApiError(404, 'Product not found');

        const inventory = await Inventory.findOne({ where: { productId } });

        switch (action) {
            case 'set':
                if (inventory) await inventory.updateCount(quantity);
                product.stock = quantity;
                break;
            case 'add':
                if (inventory) await inventory.restock(quantity);
                product.stock += quantity;
                break;
            case 'subtract':
                if (product.stock < quantity)
                    throw new ApiError(400, 'Insufficient stock');
                if (inventory) await inventory.deduct(quantity);
                product.stock -= quantity;
                break;
            default:
                throw new ApiError(400, 'Invalid action');
        }

        await product.save();
        logger.logBusinessEvent('stock_updated', {
            productId,
            action,
            quantity,
            newStock: product.stock,
        });
        return product.stock;
    }

    async getLowStockProducts() {
        const products = await Product.findAll({
            where: { isActive: true, isDigital: false },
            include: [{ model: Inventory, as: 'inventory', required: false }],
        });
        return products.filter(product => product.isLowStock());
    }
}

module.exports = new ProductService();

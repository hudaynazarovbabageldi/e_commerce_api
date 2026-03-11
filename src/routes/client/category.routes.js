const express = require('express');
const router = express.Router();

const categoryController = require('../../controllers/client/category.controller');

const { apiLimiter } = require('../../middlewares/rateLimiter.middleware');

router.get('/', apiLimiter, categoryController.getCategories);

router.get('/:id', categoryController.getCategoryById);

module.exports = router;

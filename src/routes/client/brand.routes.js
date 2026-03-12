const express = require('express');
const router = express.Router();

const brandController = require('../../controllers/client/brand.controller');
const { apiLimiter } = require('../../middlewares/rateLimiter.middleware');

router.get('/', apiLimiter, brandController.getBrands);
router.get('/:id', brandController.getBrandById);

module.exports = router;

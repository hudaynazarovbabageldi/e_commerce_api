const express = require('express');
const router = express.Router();

const bannerController = require('../../controllers/client/banner.controller');

const { apiLimiter } = require('../../middlewares/rateLimiter.middleware');

router.get('/', apiLimiter, bannerController.getBanners);

router.get('/:id', bannerController.getBannerById);

module.exports = router;

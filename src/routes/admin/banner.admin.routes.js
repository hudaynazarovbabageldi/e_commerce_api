const express = require('express');
const router = express.Router();

const bannerController = require('../../controllers/admin/banner.admin.controller');
const {
    authenticate,
    authorize,
} = require('../../middlewares/auth.middleware');
const {
    validate,
    commonSchemas,
} = require('../../middlewares/Validate.middleware');
const { apiLimiter } = require('../../middlewares/rateLimiter.middleware');

router.get(
    '/',
    authenticate,
    authorize('admin'),
    apiLimiter,
    bannerController.getBanners,
);

router.get('/:id', authenticate, bannerController.getBannerById);
router.post('/', authenticate, bannerController.createBanner);
router.put('/:id', authenticate, bannerController.updateBanner);
router.delete('/:id', authenticate, bannerController.deleteBanner);

// router.delete(
//     '/:id',
//     authenticate,
//     authorize('admin'),
//     validate(userIdSchema),
//     bannerController.deleteUser,
// );

module.exports = router;

// REVIEW CONTROLLER
// ============================================

/**
 * Create review
 * @route POST /api/reviews
 */
const createReview = asyncHandler(async (req, res) => {
    const { productId, rating, title, comment, images, orderId } = req.body;

    // Check if product exists
    const product = await Product.findByPk(productId);
    if (!product) {
        throw new ApiError(404, 'Product not found');
    }

    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
        where: { productId, userId: req.user.id },
    });

    if (existingReview) {
        throw new ApiError(409, 'You have already reviewed this product');
    }

    // Verify purchase if orderId provided
    let isVerifiedPurchase = false;
    if (orderId) {
        const order = await Order.findOne({
            where: { id: orderId, userId: req.user.id, status: 'delivered' },
        });

        if (order) {
            const orderItem = await order.getItems({
                where: { productId },
            });
            isVerifiedPurchase = orderItem.length > 0;
        }
    }

    // Create review
    const review = await Review.create({
        productId,
        userId: req.user.id,
        orderId: orderId || null,
        rating,
        title,
        comment,
        images: images || [],
        isVerifiedPurchase,
    });

    // Update product rating
    await product.updateRating(rating);

    logger.logBusinessEvent('review_created', {
        reviewId: review.id,
        productId,
        userId: req.user.id,
        rating,
    });

    res.status(201).json(
        new ApiResponse(201, review, 'Review created successfully'),
    );
});

/**
 * Get reviews
 * @route GET /api/reviews
 */
const getReviews = asyncHandler(async (req, res) => {
    const { page, limit, offset } = pagination.validatePaginationParams(
        req.query,
    );

    const where = {};

    // Admin can see all, others see approved only
    if (req.user.role !== 'admin') {
        where.isApproved = true;
    }

    // Filter by product
    if (req.query.productId) {
        where.productId = req.query.productId;
    }

    // Filter by rating
    if (req.query.rating) {
        where.rating = parseInt(req.query.rating);
    }

    // Filter by user
    if (req.query.userId) {
        where.userId = req.query.userId;
    }

    const { rows: reviews, count } = await Review.findAndCountAll({
        where,
        include: [
            {
                model: User,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'avatar'],
            },
            {
                model: Product,
                as: 'product',
                attributes: ['id', 'name', 'slug', 'thumbnail'],
            },
        ],
        limit,
        offset,
        order: [['createdAt', 'DESC']],
    });

    const response = pagination.createPaginatedResponse(
        reviews,
        count,
        page,
        limit,
    );

    res.json(
        new ApiResponse(200, response.data, 'Reviews retrieved successfully', {
            pagination: response.pagination,
        }),
    );
});

/**
 * Get review by ID
 * @route GET /api/reviews/:id
 */
const getReview = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const review = await Review.findByPk(id, {
        include: [
            {
                model: User,
                as: 'user',
                attributes: ['id', 'firstName', 'lastName', 'avatar'],
            },
            {
                model: Product,
                as: 'product',
                attributes: ['id', 'name', 'slug', 'thumbnail'],
            },
        ],
    });

    if (!review) {
        throw new ApiError(404, 'Review not found');
    }

    res.json(new ApiResponse(200, review, 'Review retrieved successfully'));
});

/**
 * Update review
 * @route PUT /api/reviews/:id
 */
const updateReview = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rating, title, comment, images } = req.body;

    const review = await Review.findByPk(id);
    if (!review) {
        throw new ApiError(404, 'Review not found');
    }

    // Check permissions
    if (review.userId !== req.user.id) {
        throw new ApiError(403, 'You can only update your own reviews');
    }

    // Update fields
    if (rating !== undefined) review.rating = rating;
    if (title !== undefined) review.title = title;
    if (comment !== undefined) review.comment = comment;
    if (images !== undefined) review.images = images;

    // Reset approval if content changed
    if (rating !== undefined || comment !== undefined) {
        review.isApproved = false;
    }

    await review.save();

    // Update product rating if rating changed
    if (rating !== undefined) {
        const product = await Product.findByPk(review.productId);
        await product.updateRating(rating);
    }

    logger.logBusinessEvent('review_updated', {
        reviewId: id,
        userId: req.user.id,
    });

    res.json(new ApiResponse(200, review, 'Review updated successfully'));
});

/**
 * Delete review
 * @route DELETE /api/reviews/:id
 */
const deleteReview = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const review = await Review.findByPk(id);
    if (!review) {
        throw new ApiError(404, 'Review not found');
    }

    // Check permissions
    if (req.user.role !== 'admin' && review.userId !== req.user.id) {
        throw new ApiError(403, 'Access denied');
    }

    await review.destroy();

    logger.logBusinessEvent('review_deleted', {
        reviewId: id,
        deletedBy: req.user.id,
    });

    res.json(new ApiResponse(200, null, 'Review deleted successfully'));
});

/**
 * Approve review (Admin only)
 * @route POST /api/reviews/:id/approve
 */
const approveReview = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const review = await Review.findByPk(id);
    if (!review) {
        throw new ApiError(404, 'Review not found');
    }

    await review.approve();

    logger.logBusinessEvent('review_approved', {
        reviewId: id,
        approvedBy: req.user.id,
    });

    res.json(new ApiResponse(200, review, 'Review approved successfully'));
});

/**
 * Mark review as helpful
 * @route POST /api/reviews/:id/helpful
 */
const markHelpful = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const review = await Review.findByPk(id);
    if (!review) {
        throw new ApiError(404, 'Review not found');
    }

    await review.markAsHelpful();

    res.json(new ApiResponse(200, review, 'Review marked as helpful'));
});

/**
 * Report review
 * @route POST /api/reviews/:id/report
 */
const reportReview = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    const review = await Review.findByPk(id);
    if (!review) {
        throw new ApiError(404, 'Review not found');
    }

    await review.report();

    logger.logSecurity('review_reported', {
        reviewId: id,
        reportedBy: req.user.id,
        reason,
    });

    res.json(new ApiResponse(200, null, 'Review reported successfully'));
});

module.exports = {
    createReview,
    getReviews,
    getReview,
    updateReview,
    deleteReview,
    approveReview,
    markHelpful,
    reportReview,
};

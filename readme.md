ecommerce-api/
├── src/
│ ├── config/
│ │ ├── database.js # Sequelize configuration
│ │ ├── redis.js # Redis cache configuration
│ │ ├── env.js # Environment variables
│ │ └── constants.js # App constants
│ │
│ ├── models/
│ │ ├── index.js # Sequelize initialization & associations
│ │ ├── User.js
│ │ ├── Product.js
│ │ ├── Category.js
│ │ ├── Order.js
│ │ ├── OrderItem.js
│ │ ├── Cart.js
│ │ ├── CartItem.js
│ │ ├── Review.js
│ │ ├── Address.js
│ │ ├── Payment.js
│ │ └── Inventory.js
│ │
│ ├── controllers/
│ │ ├── auth.controller.js
│ │ ├── user.controller.js
│ │ ├── product.controller.js
│ │ ├── category.controller.js
│ │ ├── order.controller.js
│ │ ├── cart.controller.js
│ │ ├── review.controller.js
│ │ └── payment.controller.js
│ │
│ ├── services/
│ │ ├── auth.service.js # Business logic for authentication
│ │ ├── user.service.js
│ │ ├── product.service.js
│ │ ├── order.service.js
│ │ ├── cart.service.js
│ │ ├── payment.service.js
│ │ ├── email.service.js
│ │ ├── notification.service.js
│ │ └── inventory.service.js
│ │
│ ├── repositories/
│ │ ├── user.repository.js # Database queries
│ │ ├── product.repository.js
│ │ ├── order.repository.js
│ │ └── cart.repository.js
│ │
│ ├── routes/
│ │ ├── index.js # Route aggregator
│ │ ├── auth.routes.js
│ │ ├── user.routes.js
│ │ ├── product.routes.js
│ │ ├── category.routes.js
│ │ ├── order.routes.js
│ │ ├── cart.routes.js
│ │ └── review.routes.js
│ │
│ ├── middlewares/
│ │ ├── auth.middleware.js # JWT verification
│ │ ├── validate.middleware.js # Request validation
│ │ ├── error.middleware.js # Error handling
│ │ ├── rateLimiter.middleware.js
│ │ ├── upload.middleware.js # File uploads
│ │ └── logger.middleware.js
│ │
│ ├── validators/
│ │ ├── auth.validator.js # Joi/Yup schemas
│ │ ├── user.validator.js
│ │ ├── product.validator.js
│ │ └── order.validator.js
│ │
│ ├── utils/
│ │ ├── ApiError.js # Custom error class
│ │ ├── ApiResponse.js # Standardized responses
│ │ ├── jwt.js # JWT helpers
│ │ ├── logger.js # Winston logger
│ │ ├── encryption.js # Bcrypt helpers
│ │ └── pagination.js # Pagination helper
│ │
│ ├── jobs/
│ │ ├── emailQueue.js # Bull queue for emails
│ │ ├── orderProcessor.js
│ │ └── inventorySync.js
│ │
│ ├── migrations/ # Sequelize migrations
│ ├── seeders/ # Database seeders
│ │
│ └── app.js # Express app setup
│
├── tests/
│ ├── unit/
│ ├── integration/
│ └── e2e/
│
├── .env
├── .env.example
├── .sequelizerc
├── package.json
├── docker-compose.yml
└── server.js # Entry point

models
sequelize assosiations and initializaions goymaly;
services:
business-logic;
queries:
db queries:

## Big File Upload (Chunk/Streaming) with MinIO

For large files, use multipart/chunk upload routes instead of `POST /api/v1/admin/upload` (multer limit applies there).

### Required env vars

```env
MINIO_ENABLED=true
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=uploads
MINIO_REGION=us-east-1
MINIO_PUBLIC_URL=http://127.0.0.1:9000

UPLOAD_MAX_PART_SIZE=67108864
UPLOAD_MAX_FILE_SIZE=10737418240
UPLOAD_SESSION_TTL_SECONDS=21600
```

### Routes

Client base: `/api/v1/upload`  
Admin base: `/api/v1/admin/upload`

1. Initialize multipart upload

`POST /multipart/init`

```json
{
    "filename": "big-video.mp4",
    "contentType": "video/mp4",
    "size": 1048576000
}
```

Response contains `uploadId`, `objectName`, `bucket`, `maxPartSize`.

2. Upload each chunk

`PUT /multipart/:uploadId/parts/:partNumber`

- Body: raw binary chunk (`application/octet-stream`)
- Header: `Content-Length` required

3. Complete multipart upload

`POST /multipart/:uploadId/complete`

```json
{
    "parts": [
        { "partNumber": 1, "etag": "<etag-1>" },
        { "partNumber": 2, "etag": "<etag-2>" }
    ]
}
```

If `parts` is omitted, server will try to complete with already tracked parts.

4. Abort upload

`DELETE /multipart/:uploadId`

### Direct stream upload (single request)

`PUT /stream?filename=movie.mp4`

- Body: raw file stream
- Headers:
    - `Content-Type`
    - `Content-Length`

This route streams directly to MinIO with no multer size cap.

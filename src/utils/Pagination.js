const getPaginationMeta = (totalItems, page = 1, limit = 20) => {
    const totalPages = Math.ceil(totalItems / limit);
    const currentPage = Math.max(1, Math.min(page, totalPages || 1));
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    return {
        totalItems,
        totalPages,
        currentPage,
        itemsPerPage: limit,
        hasNextPage,
        hasPrevPage,
        nextPage: hasNextPage ? currentPage + 1 : null,
        prevPage: hasPrevPage ? currentPage - 1 : null,
    };
};

const getOffset = (page = 1, limit = 20) => {
    const validPage = Math.max(1, parseInt(page) || 1);
    const validLimit = Math.max(1, parseInt(limit) || 20);
    return (validPage - 1) * validLimit;
};

const validatePaginationParams = (
    params = {},
    options = { maxLimit: 100, defaultLimit: 20, defaultPage: 1 },
) => {
    const { maxLimit = 100, defaultLimit = 20, defaultPage = 1 } = options;

    let page = parseInt(params.page) || defaultPage;
    let limit = parseInt(params.limit) || defaultLimit;

    // Ensure page is at least 1
    page = Math.max(1, page);

    // Ensure limit is between 1 and maxLimit
    limit = Math.max(1, Math.min(limit, maxLimit));

    return {
        page,
        limit,
        offset: getOffset(page, limit),
    };
};

const createPaginatedResponse = (
    data,
    totalItems,
    page,
    limit,
    additionalData = {},
) => {
    const pagination = getPaginationMeta(totalItems, page, limit);

    return {
        success: true,
        data,
        pagination,
        ...additionalData,
    };
};

const generatePaginationLinks = (
    baseUrl,
    currentPage,
    totalPages,
    queryParams = {},
) => {
    const buildUrl = (page) => {
        const params = new URLSearchParams({
            ...queryParams,
            page: page.toString(),
        });
        return `${baseUrl}?${params.toString()}`;
    };

    const links = {
        self: buildUrl(currentPage),
        first: buildUrl(1),
        last: buildUrl(totalPages),
    };

    if (currentPage > 1) {
        links.prev = buildUrl(currentPage - 1);
    }

    if (currentPage < totalPages) {
        links.next = buildUrl(currentPage + 1);
    }

    return links;
};

/**
 * Calculate page range for pagination UI
 * @param {Number} currentPage - Current page number
 * @param {Number} totalPages - Total number of pages
 * @param {Number} maxVisible - Maximum visible page numbers
 * @returns {Array} Array of page numbers to display
 */
const getPageRange = (currentPage, totalPages, maxVisible = 5) => {
    if (totalPages <= maxVisible) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const halfVisible = Math.floor(maxVisible / 2);
    let start = Math.max(1, currentPage - halfVisible);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
        start = Math.max(1, end - maxVisible + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
};

const parseSortParams = (
    sortParam,
    allowedFields = {},
    defaultSort = 'created_at:desc',
) => {
    if (!sortParam) {
        const [field, direction] = defaultSort.split(':');
        return [[field, direction.toUpperCase()]];
    }

    const sorts = sortParam.split(',');
    const orderArray = [];

    for (const sort of sorts) {
        let field, direction;

        // Handle "-field" syntax (descending)
        if (sort.startsWith('-')) {
            field = sort.substring(1);
            direction = 'DESC';
        }
        // Handle "field:asc" or "field:desc" syntax
        else if (sort.includes(':')) {
            [field, direction] = sort.split(':');
            direction = direction.toUpperCase();
        }
        // Default to ascending
        else {
            field = sort;
            direction = 'ASC';
        }

        // Validate field name
        if (allowedFields[field]) {
            orderArray.push([allowedFields[field], direction]);
        }
    }

    // If no valid sorts, use default
    if (orderArray.length === 0) {
        const [field, direction] = defaultSort.split(':');
        return [[field, direction.toUpperCase()]];
    }

    return orderArray;
};

/**
 * Parse filter parameters
 * @param {Object} queryParams - Query parameters
 * @param {Array} allowedFilters - Array of allowed filter field names
 * @returns {Object} Parsed filters
 */
const parseFilterParams = (queryParams = {}, allowedFilters = []) => {
    const filters = {};

    for (const key of allowedFilters) {
        if (queryParams[key] !== undefined && queryParams[key] !== '') {
            filters[key] = queryParams[key];
        }
    }

    // Handle range filters (e.g., minPrice, maxPrice)
    const rangeFilters = {};

    for (const key in queryParams) {
        if (key.startsWith('min') || key.startsWith('max')) {
            const baseField = key.replace(/^(min|max)/, '').toLowerCase();

            if (!rangeFilters[baseField]) {
                rangeFilters[baseField] = {};
            }

            if (key.startsWith('min')) {
                rangeFilters[baseField].min = parseFloat(queryParams[key]);
            } else {
                rangeFilters[baseField].max = parseFloat(queryParams[key]);
            }
        }
    }

    return { ...filters, ...rangeFilters };
};

const parseCursorParams = (cursor, limit = 20) => {
    const validLimit = Math.max(1, Math.min(parseInt(limit) || 20, 100));

    if (!cursor) {
        return { limit: validLimit, cursor: null };
    }

    try {
        // Decode cursor (assuming it's a base64 encoded ID)
        const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
        return { limit: validLimit, cursor: decodedCursor };
    } catch (error) {
        return { limit: validLimit, cursor: null };
    }
};

const encodeCursor = (id) => {
    return Buffer.from(id.toString()).toString('base64');
};

const createCursorPaginatedResponse = (data, limit, cursorField = 'id') => {
    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, limit) : data;

    let nextCursor = null;
    if (hasMore && items.length > 0) {
        const lastItem = items[items.length - 1];
        nextCursor = encodeCursor(lastItem[cursorField]);
    }

    return {
        success: true,
        data: items,
        pagination: {
            hasMore,
            nextCursor,
            limit,
        },
    };
};

const paginateArray = (array, page = 1, limit = 20) => {
    const offset = getOffset(page, limit);
    return array.slice(offset, offset + limit);
};

const getPaginationSummary = (totalItems, page, limit) => {
    if (totalItems === 0) {
        return 'No items found';
    }

    const start = getOffset(page, limit) + 1;
    const end = Math.min(start + limit - 1, totalItems);

    return `Showing ${start}-${end} of ${totalItems} items`;
};

module.exports = {
    getPaginationMeta,
    getOffset,
    validatePaginationParams,
    createPaginatedResponse,
    generatePaginationLinks,
    getPageRange,
    parseSortParams,
    parseFilterParams,
    parseCursorParams,
    encodeCursor,
    createCursorPaginatedResponse,
    paginateArray,
    getPaginationSummary,
};

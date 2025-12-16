const AppError = require('../utils/AppError');
const companyRepository = require('../repositories/company.repository');
const galleryRepository = require('../repositories/companyGallery.repository');
const reviewRepository = require('../repositories/companyReview.repository');
const companyDocumentRepository = require('../repositories/companyDocument.repository');

const sanitizeCompany = (company) => {
    if (!company) return null;

    return {
        id: company.id,
        agentId: company.agent_id,
        name: company.name,
        description: company.description,
        address: company.address,
        phone: company.phone,
        website: company.website,
        companyType: company.company_type,
        companyIndustry: company.company_industry,
        manufacturingStrategy: company.manufacturing_strategy,
        status: company.status,
        contacts: company.contacts,
        locations: company.locations,
        createdAt: company.created_at,
        updatedAt: company.updated_at,
    };
};

const sanitizeGalleryItem = (item) => ({
    id: item.id,
    companyId: item.company_id,
    imageFileId: item.image_file_id,
    description: item.description,
    uploadedAt: item.uploaded_at,
});

const sanitizeReview = (review) => ({
    id: review.id,
    companyId: review.company_id,
    reviewerCompanyId: review.reviewer_company_id,
    reviewerCompanyName: review.reviewer_name || null,
    reviewText: review.review_text,
    rating: review.rating,
    createdAt: review.created_at,
});

const sanitizeDocument = (doc) => ({
    id: doc.id,
    companyId: doc.company_id,
    fileId: doc.file_id,
    docType: doc.doc_type,
    description: doc.description,
    uploadedAt: doc.uploaded_at,
});

const enrichProfile = (company, gallery = [], reviews = [], documents) => {
    const sanitizedCompany = sanitizeCompany(company);
    const sanitizedGallery = gallery.map(sanitizeGalleryItem);
    const sanitizedReviews = reviews.map(sanitizeReview);
    const sanitizedDocuments = Array.isArray(documents) ? documents.map(sanitizeDocument) : undefined;
    const averageRating =
        sanitizedReviews.length > 0
            ? sanitizedReviews.reduce((sum, item) => sum + item.rating, 0) / sanitizedReviews.length
            : null;

    const profile = {
        company: sanitizedCompany,
        gallery: sanitizedGallery,
        reviews: sanitizedReviews,
        averageRating,
    };

    if (sanitizedDocuments !== undefined) {
        profile.documents = sanitizedDocuments;
    }

    return profile;
};

const getCompanyOrThrowByAgent = async (agentId) => {
    const company = await companyRepository.findByAgentId(agentId);
    if (!company) {
        throw new AppError('Company profile not found for this user', 404);
    }
    return company;
};

const parseCompanyId = (value) => {
    const id = Number(value);
    if (Number.isNaN(id)) {
        throw new AppError('Invalid company id', 400);
    }
    return id;
};

const getCompanyOrThrowById = async (companyId) => {
    const numericId = parseCompanyId(companyId);
    const company = await companyRepository.findById(numericId);
    if (!company) {
        throw new AppError('Company not found', 404);
    }
    return company;
};

const getMyProfile = async (agentId) => {
    const company = await getCompanyOrThrowByAgent(agentId);
    const [gallery, reviews, documents] = await Promise.all([
        galleryRepository.listByCompanyId(company.id),
        reviewRepository.listByCompanyId(company.id),
        companyDocumentRepository.listByCompanyId(company.id),
    ]);
    return enrichProfile(company, gallery, reviews, documents);
};

const updateMyProfile = async (agentId, payload) => {
    const dbUpdates = {
        description: payload.description,
        address: payload.address,
        phone: payload.phone,
        website: payload.website,
        company_type: payload.companyType,
        company_industry: payload.companyIndustry,
        manufacturing_strategy: payload.manufacturingStrategy,
        contacts: payload.contacts,
        locations: payload.locations,
    };

    const updated = await companyRepository.updateCompanyByAgent(agentId, dbUpdates);
    if (!updated) {
        throw new AppError('Company profile not found', 404);
    }
    return sanitizeCompany(updated);
};

const getCompanyProfile = async (companyId) => {
    const company = await getCompanyOrThrowById(companyId);
    const [gallery, reviews] = await Promise.all([
        galleryRepository.listByCompanyId(company.id),
        reviewRepository.listByCompanyId(company.id),
    ]);
    return enrichProfile(company, gallery, reviews);
};

const addGalleryItem = async (agentId, payload) => {
    const company = await getCompanyOrThrowByAgent(agentId);
    const item = await galleryRepository.createGalleryItem({
        companyId: company.id,
        imageFileId: payload.imageFileId,
        description: payload.description,
    });
    return sanitizeGalleryItem(item);
};

const listGallery = async (companyId) => {
    const company = await getCompanyOrThrowById(companyId);
    const items = await galleryRepository.listByCompanyId(company.id);
    return items.map(sanitizeGalleryItem);
};

const listReviews = async (companyId) => {
    const company = await getCompanyOrThrowById(companyId);
    const reviews = await reviewRepository.listByCompanyId(company.id);
    return reviews.map(sanitizeReview);
};

const createReview = async (agentId, companyId, payload) => {
    const [targetCompany, reviewerCompany] = await Promise.all([
        getCompanyOrThrowById(companyId),
        getCompanyOrThrowByAgent(agentId),
    ]);

    if (targetCompany.id === reviewerCompany.id) {
        throw new AppError('You cannot review your own company', 400);
    }

    const review = await reviewRepository.createReview({
        companyId: targetCompany.id,
        reviewerCompanyId: reviewerCompany.id,
        reviewText: payload.reviewText,
        rating: payload.rating,
    });

    return sanitizeReview({ ...review, reviewer_name: reviewerCompany.name });
};

module.exports = {
    getMyProfile,
    updateMyProfile,
    getCompanyProfile,
    addGalleryItem,
    listGallery,
    listReviews,
    createReview,
};

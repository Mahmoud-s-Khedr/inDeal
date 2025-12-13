const express = require('express');
const protect = require('../../middlewares/authMiddleware');
const validate = require('../../middlewares/validateMiddleware');
const companyController = require('../../controllers/company.controller');
const {
    updateCompanySchema,
    addGalleryItemSchema,
    createReviewSchema,
    companyIdParamsSchema,
} = require('../../validations/company.validation');

const router = express.Router();

router.get('/me', protect, companyController.getMyProfile);
router.put('/me', protect, validate(updateCompanySchema), companyController.updateMyProfile);
router.post('/me/gallery', protect, validate(addGalleryItemSchema), companyController.addGalleryItem);

router.get('/:id', validate(companyIdParamsSchema), companyController.getCompanyProfile);
router.get('/:id/gallery', validate(companyIdParamsSchema), companyController.listGallery);
router.get('/:id/reviews', validate(companyIdParamsSchema), companyController.listReviews);
router.post('/:id/reviews', protect, validate(createReviewSchema), companyController.createReview);

module.exports = router;

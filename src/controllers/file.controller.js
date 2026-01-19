const catchAsync = require('../utils/catchAsync');
const sendResponse = require('../utils/response');
const fileService = require('../services/file.service');

const createUploadUrl = catchAsync(async (req, res) => {
  const signedUpload = await fileService.createUploadUrl({
    fileName: req.body.fileName,
    fileType: req.body.fileType,
    fileSize: req.body.fileSize,
    uploaderId: req.user ? req.user.id : null,
  });

  sendResponse(res, 201, signedUpload, 'Signed upload URL generated');
});

module.exports = {
  createUploadUrl,
};

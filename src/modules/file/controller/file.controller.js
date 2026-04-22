const catchAsync = require('../../../core/http/catchAsync');
const sendResponse = require('../../../core/http/response');
const fileService = require('../service/file.service');

const createUploadUrl = catchAsync(async (req, res) => {
  const signedUpload = await fileService.createUploadUrl({
    fileName: req.body.fileName,
    fileType: req.body.fileType,
    fileSize: req.body.fileSize,
    uploaderId: req.user ? req.user.id : null,
  });

  sendResponse(res, 201, signedUpload, 'Signed upload URL generated');
});

const getFileById = catchAsync(async (req, res) => {
  const file = await fileService.getFileById(req.params.id);
  sendResponse(res, 200, file, 'File retrieved successfully');
});

module.exports = {
  createUploadUrl,
  getFileById,
};

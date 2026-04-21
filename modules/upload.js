const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const path = require('path');
const cloudinary = require('../configs/cloudinary');

const buildPublicId = (originalName) => {
  const baseName = path.parse(originalName || 'file').name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'file';

  return `${Date.now()}-${baseName}`;
};

const imageStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'NIMBLE_UPLOADS/images',
    resource_type: 'image',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    public_id: (req, file) => buildPublicId(file.originalname),
  },
});

const videoStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'NIMBLE_UPLOADS/videos',
    resource_type: 'video',
    allowed_formats: ['mp4', 'mov', 'avi', 'mkv', 'webm'],
    public_id: (req, file) => buildPublicId(file.originalname),
  },
});

const uploadImage = multer({ storage: imageStorage });
const uploadVideo = multer({
  storage: videoStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
});

// Backward compatible export: current routes still use upload.single('HinhAnh')
module.exports = uploadImage;
module.exports.uploadImage = uploadImage;
module.exports.uploadVideo = uploadVideo;
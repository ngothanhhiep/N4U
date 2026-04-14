const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
// Đi ra ngoài (../) rồi vào thư mục configs
const cloudinary = require('../configs/cloudinary');// Kiểm tra đường dẫn này cho đúng với file cloudinary của bạn

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'NIMBLE_UPLOADS',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    public_id: (req, file) => Date.now() + '-' + file.originalname,
  },
});

const upload = multer({ storage: storage });

module.exports = upload; // Dùng module.exports thay vì export default
// Thay 'import' bằng 'require'
const cloudinary = require('../configs/cloudinary'); 

const uploadImages = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Không có file nào được chọn!' });
        }

        // Với multer-storage-cloudinary, ảnh đã được upload thành công lên mây
        // req.file.path là URL của ảnh, req.file.filename là ID của ảnh trên Cloudinary
        res.status(200).json({
            message: 'Upload ảnh thành công!',
            url: req.file.path,
            public_id: req.file.filename
        });
    } catch (error) {
        console.error('Lỗi upload:', error);
        res.status(500).json({ 
            message: 'Lỗi server khi upload ảnh', 
            error: error.message 
        });
    }
};

// Thay 'export' bằng 'module.exports'
module.exports = { uploadImages };
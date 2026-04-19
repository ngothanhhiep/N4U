var mongoose = require('mongoose');

const baiVietSchema = new mongoose.Schema({
    ChuDe: { type: mongoose.Schema.Types.ObjectId, ref: 'ChuDe' },
    TaiKhoan: { type: mongoose.Schema.Types.ObjectId, ref: 'TaiKhoan' },
    TieuDe: { type: String, required: true },
    TomTat: { type: String, required: true },
    NoiDung: { type: String, required: true },
    VideoURL: { type: String, default: '' },
    
    // --- Thêm phần quản lý ảnh đại diện bài viết ---
    HinhAnh: { 
        type: String, 
        default: '/images/noimage.png' // Ảnh mặc định nếu bài viết không có hình
    },
    CloudinaryId: { 
        type: String // Dùng để xóa ảnh trên Cloudinary khi xóa bài viết
    },
    // ----------------------------------------------

    NgayDang: { type: Date, default: Date.now },
    LuotXem: { type: Number, default: 0 },
    KiemDuyet: { type: Number, default: 0 }
}, { 
    timestamps: true // Tự động thêm createdAt và updatedAt
});

var baiVietModel = mongoose.model('BaiViet', baiVietSchema);
module.exports = baiVietModel;
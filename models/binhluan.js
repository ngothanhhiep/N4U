var mongoose = require('mongoose');

const binhLuanSchema = new mongoose.Schema({
    // Liên kết tới bài viết nào
    BaiViet: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'BaiViet', 
        required: true 
    },
    
    // Liên kết tới người dùng nào (Nếu muốn lưu thông tin từ Model TaiKhoan)
    TaiKhoan: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'TaiKhoan',
        required: true 
    },

    // Nội dung bình luận
    NoiDung: { 
        type: String, 
        required: true 
    },

    // Quản lý tương tác
    LuotThich: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TaiKhoan' }],
    LuotKhongThich: [{ type: mongoose.Schema.Types.ObjectId, ref: 'TaiKhoan' }],


    // Kiểm duyệt bình luận (0: Đợi duyệt, 1: Đã duyệt, 2: Bị khóa)
    KiemDuyet: { 
        type: Number, 
        default: 1 
    }
}, { 
    timestamps: true // Tự động tạo NgayDang (createdAt) và NgayCapNhat (updatedAt)
});

// Tạo virtual field để lấy tên người bình luận từ TaiKhoan khi cần (tùy chọn)
// Hoặc bạn có thể dùng .populate('TaiKhoan') khi truy vấn.

var binhLuanModel = mongoose.model('BinhLuan', binhLuanSchema);
module.exports = binhLuanModel;
var mongoose = require('mongoose');

const baoCaoSchema = new mongoose.Schema({
    // Người gửi báo cáo
    NguoiBaoCao: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'TaiKhoan', 
        required: true 
    },

    // Loại đối tượng bị báo cáo: 'BaiViet' hoặc 'BinhLuan'
    LoaiDoiTuong: { 
        type: String, 
        enum: ['BaiViet', 'BinhLuan'], 
        required: true 
    },

    // ID của bài viết hoặc bình luận bị báo cáo
    BaiViet: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'BaiViet', 
        default: null 
    },
    BinhLuan: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'BinhLuan', 
        default: null 
    },

    // Lý do vi phạm
    LyDo: { 
        type: String, 
        enum: [
            'NoiDungNhayCam',   // Nội dung nhạy cảm / không phù hợp
            'NgonNguThoTuc',    // Ngôn ngữ thô tục, tục tĩu
            'CongKichThuDich',  // Công kích, thù địch, phân biệt đối xử
            'TinGiaMaoLua',     // Tin giả / lừa đảo
            'Khac'              // Lý do khác
        ], 
        required: true 
    },

    // Mô tả chi tiết thêm (tùy chọn)
    MoTa: { type: String, default: '' },

    // Trạng thái xử lý:
    // 0 - Chờ xử lý
    // 1 - Đã xử lý (vi phạm được xác nhận)
    // 2 - Từ chối (không vi phạm)
    TrangThai: { type: Number, enum: [0, 1, 2], default: 0 },

    // Ghi chú của admin khi xử lý
    GhiChuAdmin: { type: String, default: '' }
}, { 
    timestamps: true 
});

var baoCaoModel = mongoose.model('BaoCao', baoCaoSchema);
module.exports = baoCaoModel;

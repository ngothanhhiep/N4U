var mongoose = require('mongoose');

var videoSchema = new mongoose.Schema({
    TenVideo: { type: String, required: true, trim: true },
    VideoURL: { type: String, required: true, trim: true },
    CloudinaryId: { type: String, default: null },
    DinhDang: { type: String, default: '' },
    KichThuoc: { type: Number, default: 0 },
    ThoiLuong: { type: Number, default: 0 },
    TaiKhoan: { type: mongoose.Schema.Types.ObjectId, ref: 'TaiKhoan', default: null },
    BaiViet: { type: mongoose.Schema.Types.ObjectId, ref: 'BaiViet', default: null }
}, {
    timestamps: true
});

var videoModel = mongoose.model('Video', videoSchema);
module.exports = videoModel;
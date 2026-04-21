var mongoose = require('mongoose');

var taiKhoanSchema = new mongoose.Schema({
    HoVaTen: { type: String, required: true },
    Email: { type: String, unique: true },
    // --- Cập nhật phần hình ảnh ---
    HinhAnh: {
        type: String,
        default: '/images/default-avatar.png' // Đường dẫn ảnh mặc định nếu chưa upload
    },
    CloudinaryId: {
        type: String // Dùng để định danh ảnh trên Cloudinary để xóa/sửa sau này
    },
    // ----------------------------
    TenDangNhap: { type: String, unique: true, sparse: true },
    MatKhau: {type: String, required: function () { return this.LoaiDangNhap === 'local'; } },
    QuyenHan: {type: String, enum: ['user', 'admin', 'manager'], default: 'user'},
    KichHoat: { type: Number, default: 1 },
    LoaiDangNhap: {type: String,enum: ['local', 'google', 'facebook'],default: 'local'},
    GoogleId: { type: String, unique: true, sparse: true }
}, { timestamps: true }); // Thêm timestamps để biết ngày tạo/cập nhật tài khoản

var taiKhoanModel = mongoose.model('TaiKhoan', taiKhoanSchema);
module.exports = taiKhoanModel;
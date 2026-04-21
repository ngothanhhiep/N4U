var express = require('express');
var router = express.Router();
var TaiKhoan = require('../models/taikhoan');
var BaiViet = require('../models/baiviet'); // Thêm model Bài Viết
var Video = require('../models/video');
var BinhLuan = require('../models/binhluan'); // Thêm model Bình Luận
var bcrypt = require('bcryptjs'); // Đảm bảo đã require bcrypt
var upload = require('../modules/upload'); // Module cấu hình Cloudinary
const cloudinary = require('../configs/cloudinary'); // Để dùng lệnh xóa ảnh
const PAGE_SIZE = 20;
var mongoose = require('mongoose');
const ALLOWED_ROLES = ['user', 'admin', 'maneger'];

// Middleware kiểm tra ObjectId hợp lệ
router.param('id', (req, res, next, id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        req.session.error = "ID tài khoản không hợp lệ.";
        return res.redirect('/taikhoan');
    }
    next();
});

// GET: Danh sách tài khoản
router.get('/', async (req, res) => {
    try {
        const currentPage = Math.max(1, parseInt(req.query.page) || 1);
        const totalItems = await TaiKhoan.countDocuments();
        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const page = Math.min(currentPage, totalPages);

        var taikhoans = await TaiKhoan.find()
            .sort({ createdAt: -1 })
            .skip((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE);

        res.render('taikhoan', {
            title: 'Danh sách tài khoản',
            taikhoan: taikhoans,
            currentPage: page,
            totalPages: totalPages,
            pageSize: PAGE_SIZE,
            totalItems: totalItems
        });
    } catch (err) {
        console.error('Lỗi danh sách tài khoản:', err);
        res.status(500).send('Lỗi hệ thống: Không thể tải danh sách tài khoản.');
    }
});

// GET: Thêm tài khoản
router.get('/them', async (req, res) => {
    res.render('taikhoan_them', {
        title: 'Thêm tài khoản'
    });
});

// POST: Thêm tài khoản (Sử dụng upload.single)
router.post('/them', upload.single('HinhAnh'), async (req, res) => {
    var salt = bcrypt.genSaltSync(10);
    const roleFromForm = req.body.QuyenHan;
    const quyenHan = (req.session.QuyenHan === 'admin' && ALLOWED_ROLES.includes(roleFromForm))
        ? roleFromForm
        : 'user';

    var data = {
        HoVaTen: req.body.HoVaTen,
        Email: req.body.Email,
        TenDangNhap: req.body.TenDangNhap,
        MatKhau: bcrypt.hashSync(req.body.MatKhau, salt),
        QuyenHan: quyenHan,
        // Nếu có file upload thì lấy path từ Cloudinary, không thì dùng ảnh mặc định
        HinhAnh: req.file ? req.file.path : '/images/default-avatar.png',
        CloudinaryId: req.file ? req.file.filename : null
    };
    await TaiKhoan.create(data);
    res.redirect('/taikhoan');
});

// GET: Sửa tài khoản
router.get('/sua/:id', async (req, res) => {
    var id = req.params.id;
    var taikhoan = await TaiKhoan.findById(id);
    res.render('taikhoan_sua', {
        title: 'Sửa tài khoản',
        taikhoan: taikhoan
    });
});

// POST: Sửa tài khoản (Xử lý thay đổi ảnh bìa)
router.post('/sua/:id', upload.single('HinhAnh'), async (req, res) => {
    try {
        var id = req.params.id;
        var salt = bcrypt.genSaltSync(10);
        var oldUser = await TaiKhoan.findById(id);

        if (!oldUser) {
            req.session.error = "Tài khoản không tồn tại!";
            return res.redirect('/');
        }

        // Tạo đối tượng dữ liệu cơ bản
        var data = {
            HoVaTen: req.body.HoVaTen,
            Email: req.body.Email,
            TenDangNhap: req.body.TenDangNhap,
        };

        // BẢO MẬT: Chỉ Admin mới được sửa Quyền hạn và Trạng thái kích hoạt
        if (req.session.QuyenHan === 'admin') {
            data.QuyenHan = ALLOWED_ROLES.includes(req.body.QuyenHan)
                ? req.body.QuyenHan
                : 'user';
            data.KichHoat = req.body.KichHoat;
        }

        // Nếu người dùng chọn file ảnh mới
        if (req.file) {
            // 1. Xóa ảnh cũ trên Cloudinary nếu có
            if (oldUser.CloudinaryId) {
                await cloudinary.uploader.destroy(oldUser.CloudinaryId);
            }
            // 2. Cập nhật thông tin ảnh mới
            data.HinhAnh = req.file.path;
            data.CloudinaryId = req.file.filename;
        }

        // Xử lý đổi mật khẩu nếu có nhập
        if (req.body.MatKhau) {
            data.MatKhau = bcrypt.hashSync(req.body.MatKhau, salt);
        }

        // Cập nhật vào Database
        await TaiKhoan.findByIdAndUpdate(id, data);

        // LOGIC ĐIỀU HƯỚNG THEO QUYỀN HẠN
        if (req.session.QuyenHan === 'admin') {
            // Nếu là Admin, quay về danh sách quản lý
            res.redirect('/taikhoan');
        } else {
            // Nếu là User, quay về trang chi tiết hồ sơ của chính họ
            // Cập nhật lại thông tin session nếu họ vừa sửa chính tài khoản của mình
            if (req.session.MaNguoiDung === id) {
                req.session.HoVaTen = data.HoVaTen;
                if (req.file) req.session.HinhAnh = data.HinhAnh;
            }
            res.redirect('/taikhoan/chitiet/' + id);
        }

    } catch (err) {
        console.error("Lỗi khi sửa tài khoản:", err);
        req.session.error = "Có lỗi xảy ra trong quá trình cập nhật.";
        res.redirect('back'); // Quay lại trang trước đó
    }
});

// GET: Chi tiết tài khoản (Đã nâng cấp)
router.get(['/chitiet', '/chitiet/:id'], async (req, res) => {
    try {
        const id = (req.params.id && req.params.id !== 'undefined')
            ? req.params.id
            : (req.session.MaNguoiDung || req.session._id);

        if (!id) {
            req.session.error = 'Vui lòng đăng nhập để xem hồ sơ cá nhân!';
            return res.redirect('/dangnhap');
        }

        // 1. Lấy thông tin tài khoản
        const user = await TaiKhoan.findById(id);
        if (!user) {
            req.session.error = 'Tài khoản không tồn tại!';
            return res.redirect('/');
        }

        // 2. Lấy danh sách bài viết và video của người này
        const danhSachBaiViet = await BaiViet.find({ TaiKhoan: id }).sort({ NgayDang: -1 });
        const danhSachVideo = await Video.find({ TaiKhoan: id })
            .sort({ createdAt: -1 })
            .populate('BaiViet', 'TieuDe');

        // 3. Tính toán thống kê
        let tongLuotXem = 0;
        let tongLuotThich = 0;
        let tongLuotKhongThich = 0;

        // Duyệt qua từng bài viết để tính tổng lượt xem và lấy số lượng bình luận từng bài
        // Chúng ta sử dụng Promise.all để lấy số lượng bình luận nhanh hơn
        const baiVietThongKe = await Promise.all(danhSachBaiViet.map(async (bv) => {
            tongLuotXem += bv.LuotXem;
            
            // Đếm số bình luận của bài viết này
            const soBinhLuan = await BinhLuan.countDocuments({ BaiViet: bv._id });
            
            // Giả sử lượt thich/không thích nằm trong bài viết (nếu bạn thiết kế như vậy)
            // Hoặc tính từ mảng trong bình luận. 
            // Ở đây tôi lấy tổng số bình luận mà người này đã viết:
            return {
                ...bv._doc,
                SoBinhLuan: soBinhLuan
            };
        }));

        // 4. Đếm tổng số bình luận mà người dùng này đã thực hiện
        const tongSoBinhLuanDaViet = await BinhLuan.countDocuments({ TaiKhoan: id });

        res.render('taikhoan_chitiet', {
            title: 'Hồ sơ cá nhân',
            taikhoan: user,
            baiviet: baiVietThongKe,
            video: danhSachVideo,
            thongke: {
                tongLuotXem: tongLuotXem,
                soBaiViet: danhSachBaiViet.length,
                soVideo: danhSachVideo.length,
                tongBinhLuan: tongSoBinhLuanDaViet
            },
            session: req.session
        });
    } catch (err) {
        console.error('Lỗi tìm chi tiết:', err);
        req.session.error = 'Không thể tải hồ sơ cá nhân!';
        res.redirect('/');
    }
});

// GET: Xóa tài khoản (Xóa luôn cả ảnh trên Cloudinary)
router.get('/xoa/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const user = await TaiKhoan.findById(id);

        if (!user) {
            return res.redirect('/taikhoan');
        }

        // Thực hiện xóa ảnh trên Cloudinary
        if (user.CloudinaryId) {
            try {
                // Sử dụng await để đảm bảo xóa xong ảnh (hoặc lỗi) mới chạy tiếp
                await cloudinary.uploader.destroy(user.CloudinaryId);
                console.log("--- Đã xóa ảnh trên Cloudinary:", user.CloudinaryId);
            } catch (cloudErr) {
                // Nếu lỗi xóa ảnh (ví dụ ID ko tồn tại), vẫn log lỗi và cho phép xóa DB tiếp tục
                console.error("--- Lỗi khi xóa ảnh Cloudinary:", cloudErr.message);
            }
        }

        // Xóa tài khoản trong Database
        await TaiKhoan.findByIdAndDelete(id);
        res.redirect('/taikhoan');

    } catch (err) {
        console.error("Lỗi hệ thống khi xóa tài khoản:", err);
        res.status(500).send("Có lỗi xảy ra khi xóa tài khoản.");
    }
});


module.exports = router;
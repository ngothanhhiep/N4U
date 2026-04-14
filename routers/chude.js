var express = require('express');
var router = express.Router();
var ChuDe = require('../models/chude');
var BaiViet = require('../models/baiviet');
var firstImageFunc = require('../modules/firstimage');
var mongoose = require('mongoose');

// Middleware kiểm tra quyền truy cập (Nếu cần)
const checkAuth = (req, res, next) => {
    if (!req.session.MaNguoiDung) {
        req.session.error = "Vui lòng đăng nhập để thực hiện.";
        return res.redirect('/dangnhap');
    }
    next();
};

// Middleware kiểm tra ObjectId hợp lệ trước khi xử lý tham số :id
router.param('id', (req, res, next, id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        req.session.error = "ID chủ đề không hợp lệ.";
        return res.redirect('/chude');
    }
    next();
});

// 1. Route danh sách (Thêm sắp xếp A-Z)
router.get('/', async (req, res) => {
    try {
        // .sort({ TenChuDe: 1 }) giúp danh sách ngăn nắp hơn
        var chudes = await ChuDe.find().sort({ TenChuDe: 1 }); 
        res.render('chude', { title: 'Danh sách chủ đề', chude: chudes });
    } catch (err) {
        req.session.error = "Không thể tải danh sách chủ đề.";
        res.redirect('/');
    }
});

// 2. Route THÊM
router.get('/them', checkAuth, async (req, res) => {
    try {
        res.render('chude_them', { title: 'Thêm chủ đề' });
    } catch (err) {
        console.error('Lỗi render trang thêm chủ đề:', err);
        req.session.error = 'Không thể tải trang thêm chủ đề.';
        res.redirect('/chude');
    }
});

router.post('/them', checkAuth, async (req, res) => {
    try {
        await ChuDe.create({ TenChuDe: req.body.TenChuDe });
        req.session.success = "Thêm chủ đề thành công!";
        res.redirect('/chude');
    } catch (err) {
        // Bắt lỗi trùng tên nếu model có unique: true
        req.session.error = err.code === 11000 ? "Tên chủ đề này đã tồn tại!" : "Lỗi khi thêm mới.";
        res.redirect('/chude/them');
    }
});

// 3. Các route SỬA
router.get('/sua/:id', checkAuth, async (req, res) => {
    try {
        var chude = await ChuDe.findById(req.params.id);
        if (!chude) {
            req.session.error = "Chủ đề không tồn tại.";
            return res.redirect('/chude');
        }
        res.render('chude_sua', { title: 'Sửa chủ đề', chude: chude });
    } catch (err) {
        res.redirect('/chude');
    }
});

router.post('/sua/:id', checkAuth, async (req, res) => {
    try {
        await ChuDe.findByIdAndUpdate(req.params.id, { TenChuDe: req.body.TenChuDe });
        req.session.success = "Cập nhật thành công!";
        res.redirect('/chude');
    } catch (err) {
        req.session.error = "Lỗi khi cập nhật.";
        res.redirect('/chude');
    }
});

// 4. Route XÓA
router.get('/xoa/:id', checkAuth, async (req, res) => {
    try {
        await ChuDe.findByIdAndDelete(req.params.id);
        req.session.success = "Đã xóa chủ đề.";
        res.redirect('/chude');
    } catch (err) {
        req.session.error = "Lỗi khi xóa chủ đề.";
        res.redirect('/chude');
    }
});

// 5. Route xem bài viết theo chủ đề (public)
// Thống nhất URL public theo chuẩn /chude/:id
router.get('/:id', async (req, res) => {
    try {
        const id = req.params.id;

        const [cm, cd, xnn] = await Promise.all([
            ChuDe.find(),
            ChuDe.findById(id),
            BaiViet.find({ KiemDuyet: 1 })
                .sort({ LuotXem: -1 })
                .limit(3)
        ]);

        if (!cd) {
            return res.status(404).send('Chủ đề không tồn tại.');
        }

        const bv = await BaiViet.find({ ChuDe: id, KiemDuyet: 1 })
            .sort({ NgayDang: -1 })
            .populate('ChuDe')
            .populate('TaiKhoan')
            .limit(8);

        const baivietWithImage = bv.map(article => {
            const obj = article.toObject();
            const uploadedImage = obj.HinhAnh && obj.HinhAnh !== '/images/noimage.png'
                ? obj.HinhAnh
                : null;

            return {
                ...obj,
                displayImage: uploadedImage || firstImageFunc(obj.NoiDung)
            };
        });

        res.render('baiviet_chude', {
            title: cd.TenChuDe,
            chuyenmuc: cm,
            chude: cd,
            baiviet: baivietWithImage,
            xemnhieu: xnn
        });
    } catch (err) {
        console.error('Lỗi lấy bài viết theo chủ đề:', err);
        res.status(500).send('Lỗi hệ thống: ' + err.message);
    }
});

module.exports = router;
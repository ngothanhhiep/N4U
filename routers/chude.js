var express = require('express');
var router = express.Router();
var ChuDe = require('../models/chude');
var BaiViet = require('../models/baiviet');
var QuangCao = require('../models/quangcao');
var firstImageFunc = require('../modules/firstimage');
var mongoose = require('mongoose');

// =========================
// MIDDLEWARE DÙNG CHUNG
// =========================

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

// =========================
// ROUTE QUẢN LÝ CHỦ ĐỀ
// =========================

// [GET] /chude - Danh sách chủ đề
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

// [GET] /chude/them - Trang thêm chủ đề
router.get('/them', checkAuth, async (req, res) => {
    try {
        res.render('chude_them', { title: 'Thêm chủ đề' });
    } catch (err) {
        console.error('Lỗi render trang thêm chủ đề:', err);
        req.session.error = 'Không thể tải trang thêm chủ đề.';
        res.redirect('/chude');
    }
});

// [POST] /chude/them - Tạo chủ đề mới
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

// [GET] /chude/sua/:id - Trang sửa chủ đề
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

// [POST] /chude/sua/:id - Cập nhật chủ đề
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

// [GET] /chude/xoa/:id - Xóa chủ đề
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

// =========================
// ROUTE PUBLIC
// =========================

// [GET] /chude/:id - Xem bài viết theo chủ đề
router.get('/:id', async (req, res) => {
    try {
        const id = req.params.id;

        const [cm, cd, xnn, randomAd] = await Promise.all([
            ChuDe.find(),
            ChuDe.findById(id),
            BaiViet.find({ KiemDuyet: 1 })
                .sort({ LuotXem: -1 })
                .limit(5),
            QuangCao.aggregate([{ $sample: { size: 1 } }])
                .then(items => (items && items.length > 0 ? items[0] : null))
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
            xemnhieu: xnn,
            quangcao: randomAd
        });
    } catch (err) {
        console.error('Lỗi lấy bài viết theo chủ đề:', err);
        res.status(500).send('Lỗi hệ thống: ' + err.message);
    }
});

module.exports = router;
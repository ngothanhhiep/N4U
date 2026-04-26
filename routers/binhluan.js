var express = require('express');
var router = express.Router();
var BinhLuan = require('../models/binhluan');
const PAGE_SIZE = 20;

// =========================
// MIDDLEWARE DÙNG CHUNG
// =========================

// Middleware kiểm tra đăng nhập
const isLoggedIn = (req, res, next) => {
    if (req.session.MaNguoiDung) {
        return next();
    }
    req.session.error = 'Bạn phải đăng nhập để thực hiện thao tác này';
    res.redirect('/dangnhap');
};

const canManage = (req, res, next) => {
    if (!req.session.MaNguoiDung) {
        req.session.error = 'Bạn cần đăng nhập để truy cập chức năng này.';
        return res.redirect('/dangnhap');
    }

    if (req.session.QuyenHan !== 'admin' && req.session.QuyenHan !== 'maneger') {
        req.session.error = 'Bạn không có quyền truy cập.';
        return res.redirect('/');
    }

    next();
};

// =========================
// ROUTE QUẢN LÝ BÌNH LUẬN
// =========================

// [GET] /binhluan - Danh sách bình luận (có tìm kiếm theo nội dung)
router.get('/', canManage, async (req, res) => {
    try {
        const tukhoa = (req.query.tukhoa || '').trim();
        const filter = tukhoa
            ? { NoiDung: { $regex: tukhoa, $options: 'i' } }
            : {};

        const currentPage = Math.max(1, parseInt(req.query.page) || 1);
        const totalItems = await BinhLuan.countDocuments(filter);
        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const page = Math.min(currentPage, totalPages);

        const dsBinhLuan = await BinhLuan.find(filter)
            .populate('TaiKhoan', 'HoVaTen TenDangNhap')
            .populate('BaiViet', 'TieuDe')
            .sort({ createdAt: -1 })
            .skip((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE);

        res.render('binhluan', {
            title: 'Danh sách bình luận',
            binhluan: dsBinhLuan,
            currentPage: page,
            totalPages: totalPages,
            pageSize: PAGE_SIZE,
            totalItems: totalItems,
            tukhoa: tukhoa
        });
    } catch (err) {
        console.error('Lỗi danh sách bình luận:', err);
        res.status(500).send('Lỗi hệ thống: Không thể tải danh sách bình luận.');
    }
});

// =========================
// ROUTE TƯƠNG TÁC BÌNH LUẬN
// =========================

// [POST] /binhluan/them - Gửi bình luận mới
router.post('/them', isLoggedIn, async (req, res) => {
    try {
        const { BaiViet, NoiDung } = req.body;
        
        if (!NoiDung || NoiDung.trim() === "") {
            req.session.error = "Nội dung bình luận không được để trống!";
            return res.redirect(req.get('Referer') || '/baiviet/' + BaiViet);
        }

        await BinhLuan.create({
            BaiViet: BaiViet,
            TaiKhoan: req.session.MaNguoiDung,
            NoiDung: NoiDung,
            KiemDuyet: 1
        });

        res.redirect(req.get('Referer') || '/baiviet/' + BaiViet);
    } catch (err) {
        console.error("Lỗi bình luận:", err);
        res.redirect('/');
    }
});

// [GET] /binhluan/xoa/:id - Xóa bình luận
router.get('/xoa/:id', isLoggedIn, async (req, res) => {
    try {
        const bl = await BinhLuan.findById(req.params.id);
        
        if (!bl) return res.redirect(req.get('Referer') || '/');

        if (req.session.QuyenHan === 'admin' || req.session.QuyenHan === 'maneger' || req.session.MaNguoiDung == bl.TaiKhoan) {
            await BinhLuan.findByIdAndDelete(req.params.id);
            req.session.success = "Đã xóa bình luận.";
        } else {
            req.session.error = "Bạn không có quyền xóa bình luận này!";
        }
        
        res.redirect(req.get('Referer') || '/');
    } catch (err) {
        res.redirect(req.get('Referer') || '/');
    }
});

// [GET] /binhluan/like/:id - Like/hủy like bình luận
router.get('/like/:id', isLoggedIn, async (req, res) => {
    try {
        const userId = req.session.MaNguoiDung;
        const binhLuanId = req.params.id;

        // Tìm bình luận để kiểm tra xem user đã like chưa
        const bl = await BinhLuan.findById(binhLuanId);
        if (!bl) return res.redirect(req.get('Referer') || '/');

        // Kiểm tra xem userId đã có trong mảng LuotThich chưa
        const isLiked = bl.LuotThich.includes(userId);

        if (isLiked) {
            // Nếu đã like rồi -> Bấm lần nữa là HỦY LIKE
            await BinhLuan.findByIdAndUpdate(binhLuanId, {
                $pull: { LuotThich: userId }
            });
        } else {
            // Nếu chưa like -> THỰC HIỆN LIKE và xóa Dislike (nếu có)
            await BinhLuan.findByIdAndUpdate(binhLuanId, {
                $addToSet: { LuotThich: userId },
                $pull: { LuotKhongThich: userId }
            });
        }

        res.redirect(req.get('Referer') || '/');
    } catch (err) {
        console.error(err);
        res.redirect(req.get('Referer') || '/');
    }
});

// [GET] /binhluan/dislike/:id - Dislike/hủy dislike bình luận
router.get('/dislike/:id', isLoggedIn, async (req, res) => {
    try {
        const userId = req.session.MaNguoiDung;
        const binhLuanId = req.params.id;

        const bl = await BinhLuan.findById(binhLuanId);
        if (!bl) return res.redirect(req.get('Referer') || '/');

        // Kiểm tra xem userId đã có trong mảng LuotKhongThich chưa
        const isDisliked = bl.LuotKhongThich.includes(userId);

        if (isDisliked) {
            // Nếu đã dislike rồi -> Bấm lần nữa là HỦY DISLIKE
            await BinhLuan.findByIdAndUpdate(binhLuanId, {
                $pull: { LuotKhongThich: userId }
            });
        } else {
            // Nếu chưa dislike -> THỰC HIỆN DISLIKE và xóa Like (nếu có)
            await BinhLuan.findByIdAndUpdate(binhLuanId, {
                $addToSet: { LuotKhongThich: userId },
                $pull: { LuotThich: userId }
            });
        }

        res.redirect(req.get('Referer') || '/');
    } catch (err) {
        console.error(err);
        res.redirect(req.get('Referer') || '/');
    }
});

module.exports = router;
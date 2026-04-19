var express = require('express');
var router = express.Router();
var TaiKhoan = require('../models/taikhoan');
var BaiViet = require('../models/baiviet');
var BinhLuan = require('../models/binhluan');
var QuangCao = require('../models/quangcao');

// =========================
// MIDDLEWARE DÙNG CHUNG
// =========================

const canViewReport = (req, res, next) => {
    if (!req.session.MaNguoiDung) {
        req.session.error = 'Bạn cần đăng nhập để truy cập báo cáo.';
        return res.redirect('/dangnhap');
    }

    if (req.session.QuyenHan !== 'admin' && req.session.QuyenHan !== 'maneger') {
        req.session.error = 'Bạn không có quyền truy cập báo cáo.';
        return res.redirect('/');
    }

    next();
};

// =========================
// ROUTE BÁO CÁO
// =========================

// [GET] /report - Báo cáo tổng quan (admin/maneger)
router.get('/', canViewReport, async (req, res) => {
    try {
        const now = new Date();
        const startCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const startPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

        const [
            tongTaiKhoan,
            tongBaiViet,
            baiVietDaDuyet,
            baiVietChoDuyet,
            tongBinhLuan,
            tongQuangCao,
            topBaiViet,
            baiVietThangNay,
            baiVietThangTruoc,
            luotXemThangNayAgg,
            luotXemThangTruocAgg
        ] = await Promise.all([
            TaiKhoan.countDocuments(),
            BaiViet.countDocuments(),
            BaiViet.countDocuments({ KiemDuyet: 1 }),
            BaiViet.countDocuments({ KiemDuyet: 0 }),
            BinhLuan.countDocuments(),
            QuangCao.countDocuments(),
            BaiViet.find({ KiemDuyet: 1 })
                .sort({ LuotXem: -1 })
                .limit(5)
                .populate('TaiKhoan', 'HoVaTen')
                .select('TieuDe LuotXem TaiKhoan NgayDang'),
            BaiViet.countDocuments({
                NgayDang: { $gte: startCurrentMonth, $lt: startNextMonth }
            }),
            BaiViet.countDocuments({
                NgayDang: { $gte: startPrevMonth, $lt: startCurrentMonth }
            }),
            BaiViet.aggregate([
                {
                    $match: {
                        KiemDuyet: 1,
                        NgayDang: { $gte: startCurrentMonth, $lt: startNextMonth }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$LuotXem' }
                    }
                }
            ]),
            BaiViet.aggregate([
                {
                    $match: {
                        KiemDuyet: 1,
                        NgayDang: { $gte: startPrevMonth, $lt: startCurrentMonth }
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: '$LuotXem' }
                    }
                }
            ])
        ]);

        const luotXemThangNay = luotXemThangNayAgg[0] ? luotXemThangNayAgg[0].total : 0;
        const luotXemThangTruoc = luotXemThangTruocAgg[0] ? luotXemThangTruocAgg[0].total : 0;

        const calcChangePercent = (current, previous) => {
            if (!previous) return current > 0 ? 100 : 0;
            return Number((((current - previous) / previous) * 100).toFixed(1));
        };

        const formatMonthYear = (date) => {
            return `${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
        };

        const soSanhThang = {
            thangNayLabel: formatMonthYear(startCurrentMonth),
            thangTruocLabel: formatMonthYear(startPrevMonth),
            luotXemThangNay,
            luotXemThangTruoc,
            baiVietThangNay,
            baiVietThangTruoc,
            phanTramLuotXem: calcChangePercent(luotXemThangNay, luotXemThangTruoc),
            phanTramBaiViet: calcChangePercent(baiVietThangNay, baiVietThangTruoc)
        };

        res.render('index_report', {
            title: 'Báo cáo tổng quan',
            thongke: {
                tongTaiKhoan,
                tongBaiViet,
                baiVietDaDuyet,
                baiVietChoDuyet,
                tongBinhLuan,
                tongQuangCao
            },
            topBaiViet: topBaiViet,
            soSanhThang: soSanhThang
        });
    } catch (err) {
        console.error('Lỗi report:', err);
        req.session.error = 'Không thể tải dữ liệu báo cáo.';
        res.redirect('/');
    }
});

module.exports = router;
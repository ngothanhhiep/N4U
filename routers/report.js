var express = require('express');
var router = express.Router();
var TaiKhoan = require('../models/taikhoan');
var BaiViet = require('../models/baiviet');
var BinhLuan = require('../models/binhluan');
var QuangCao = require('../models/quangcao');

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

router.get('/', canViewReport, async (req, res) => {
    try {
        const [
            tongTaiKhoan,
            tongBaiViet,
            baiVietDaDuyet,
            baiVietChoDuyet,
            tongBinhLuan,
            tongQuangCao,
            topBaiViet
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
                .select('TieuDe LuotXem TaiKhoan NgayDang')
        ]);

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
            topBaiViet: topBaiViet
        });
    } catch (err) {
        console.error('Lỗi report:', err);
        req.session.error = 'Không thể tải dữ liệu báo cáo.';
        res.redirect('/');
    }
});

module.exports = router;
var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var BaoCao = require('../models/baocao');
var BaiViet = require('../models/baiviet');
var BinhLuan = require('../models/binhluan');

const PAGE_SIZE = 15;

// =========================
// MIDDLEWARE DÙNG CHUNG
// =========================

const isLoggedIn = (req, res, next) => {
    if (req.session.MaNguoiDung) return next();
    req.session.error = 'Bạn phải đăng nhập để thực hiện thao tác này.';
    return res.redirect('/dangnhap');
};

const isAdmin = (req, res, next) => {
    if (!req.session.MaNguoiDung) {
        req.session.error = 'Bạn cần đăng nhập.';
        return res.redirect('/dangnhap');
    }
    if (req.session.QuyenHan !== 'admin' && req.session.QuyenHan !== 'manager') {
        req.session.error = 'Bạn không có quyền truy cập trang này.';
        return res.redirect('/');
    }
    next();
};

// Validate ObjectId param
router.param('id', (req, res, next, id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        req.session.error = 'ID báo cáo không hợp lệ.';
        return res.redirect('/baocao');
    }
    next();
});

// =========================
// NGƯỜI DÙNG GỬI BÁO CÁO
// =========================

// [POST] /baocao - Gửi báo cáo vi phạm
router.post('/', isLoggedIn, async (req, res) => {
    const goBack = req.body.redirectTo || req.get('Referer') || '/';

    try {
        const { LoaiDoiTuong, DoiTuongId, LyDo, MoTa } = req.body;

        // Validate dữ liệu đầu vào
        const loaiHopLe = ['BaiViet', 'BinhLuan'];
        const lyDoHopLe = ['NoiDungNhayCam', 'NgonNguThoTuc', 'CongKichThuDich', 'TinGiaMaoLua', 'Khac'];

        if (!loaiHopLe.includes(LoaiDoiTuong)) {
            req.session.error = 'Loại đối tượng báo cáo không hợp lệ.';
            return res.redirect(goBack);
        }

        if (!lyDoHopLe.includes(LyDo)) {
            req.session.error = 'Lý do báo cáo không hợp lệ.';
            return res.redirect(goBack);
        }

        if (!mongoose.Types.ObjectId.isValid(DoiTuongId)) {
            req.session.error = 'Đối tượng báo cáo không hợp lệ.';
            return res.redirect(goBack);
        }

        // Kiểm tra đối tượng có tồn tại không
        let doiTuongTonTai = false;
        if (LoaiDoiTuong === 'BaiViet') {
            doiTuongTonTai = await BaiViet.exists({ _id: DoiTuongId });
        } else {
            doiTuongTonTai = await BinhLuan.exists({ _id: DoiTuongId });
        }

        if (!doiTuongTonTai) {
            req.session.error = 'Không tìm thấy nội dung cần báo cáo.';
            return res.redirect(goBack);
        }

        // Kiểm tra người dùng đã báo cáo đối tượng này chưa
        const daBaoCao = await BaoCao.findOne({
            NguoiBaoCao: req.session.MaNguoiDung,
            LoaiDoiTuong,
            [LoaiDoiTuong === 'BaiViet' ? 'BaiViet' : 'BinhLuan']: DoiTuongId,
            TrangThai: 0 // Còn đang chờ xử lý
        });

        if (daBaoCao) {
            req.session.error = 'Bạn đã gửi báo cáo cho nội dung này rồi, vui lòng chờ xử lý.';
            return res.redirect(goBack);
        }

        // Tạo báo cáo mới
        const baoCaoMoi = new BaoCao({
            NguoiBaoCao: req.session.MaNguoiDung,
            LoaiDoiTuong,
            BaiViet: LoaiDoiTuong === 'BaiViet' ? DoiTuongId : null,
            BinhLuan: LoaiDoiTuong === 'BinhLuan' ? DoiTuongId : null,
            LyDo,
            MoTa: (MoTa || '').trim().substring(0, 500) // Giới hạn 500 ký tự
        });

        await baoCaoMoi.save();
        req.session.success = 'Báo cáo của bạn đã được ghi nhận. Chúng tôi sẽ xem xét trong thời gian sớm nhất.';
        return res.redirect(goBack);
    } catch (err) {
        console.error('Lỗi gửi báo cáo:', err.message);
        req.session.error = 'Đã xảy ra lỗi khi gửi báo cáo, vui lòng thử lại.';
        return res.redirect(goBack);
    }
});

// =========================
// ADMIN QUẢN LÝ BÁO CÁO
// =========================

// [GET] /baocao - Danh sách báo cáo (admin/manager)
router.get('/', isAdmin, async (req, res) => {
    try {
        const trang = parseInt(req.query.trang) || 1;
        const locTrangThai = req.query.trangThai !== undefined ? parseInt(req.query.trangThai) : '';
        const locLoai = req.query.loai || '';

        const filter = {};
        if (locTrangThai !== '') filter.TrangThai = locTrangThai;
        if (locLoai) filter.LoaiDoiTuong = locLoai;

        const tongSo = await BaoCao.countDocuments(filter);
        const tongTrang = Math.ceil(tongSo / PAGE_SIZE) || 1;
        const trangHienTai = Math.min(Math.max(trang, 1), tongTrang);

        const danhSachBaoCao = await BaoCao.find(filter)
            .sort({ createdAt: -1 })
            .skip((trangHienTai - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE)
            .populate('NguoiBaoCao', 'HoVaTen TenDangNhap HinhAnh')
            .populate('BaiViet', 'TieuDe KiemDuyet')
            .populate({
                path: 'BinhLuan',
                select: 'NoiDung KiemDuyet',
                populate: { path: 'BaiViet', select: 'TieuDe' }
            });

        // Thống kê nhanh
        const [choDuyet, daXuLy, tuChoi] = await Promise.all([
            BaoCao.countDocuments({ TrangThai: 0 }),
            BaoCao.countDocuments({ TrangThai: 1 }),
            BaoCao.countDocuments({ TrangThai: 2 })
        ]);

        res.render('baocao', {
            title: 'Quản lý báo cáo vi phạm',
            danhSachBaoCao,
            thongke: { choDuyet, daXuLy, tuChoi, tongSo },
            phanTrang: { trangHienTai, tongTrang },
            filter: { trangThai: locTrangThai, loai: locLoai }
        });
    } catch (err) {
        console.error('Lỗi tải danh sách báo cáo:', err.message);
        req.session.error = 'Không thể tải danh sách báo cáo.';
        res.redirect('/');
    }
});

// [POST] /baocao/:id/xuly - Cập nhật trạng thái xử lý (admin/manager)
router.post('/:id/xuly', isAdmin, async (req, res) => {
    try {
        const { TrangThai, GhiChuAdmin } = req.body;
        const trangThaiSo = parseInt(TrangThai);

        if (![1, 2].includes(trangThaiSo)) {
            req.session.error = 'Trạng thái xử lý không hợp lệ.';
            return res.redirect('/baocao');
        }

        const baoCao = await BaoCao.findByIdAndUpdate(
            req.params.id,
            { 
                TrangThai: trangThaiSo,
                GhiChuAdmin: (GhiChuAdmin || '').trim().substring(0, 300)
            },
            { new: true }
        );

        if (!baoCao) {
            req.session.error = 'Không tìm thấy báo cáo.';
            return res.redirect('/baocao');
        }

        req.session.success = trangThaiSo === 1
            ? 'Đã xác nhận vi phạm và xử lý báo cáo.'
            : 'Đã từ chối báo cáo (không vi phạm).';
        return res.redirect('/baocao');
    } catch (err) {
        console.error('Lỗi xử lý báo cáo:', err.message);
        req.session.error = 'Đã xảy ra lỗi khi xử lý báo cáo.';
        return res.redirect('/baocao');
    }
});

// [POST] /baocao/:id/xoa - Xóa báo cáo (admin)
router.post('/:id/xoa', isAdmin, async (req, res) => {
    try {
        if (req.session.QuyenHan !== 'admin') {
            req.session.error = 'Chỉ admin mới có quyền xóa báo cáo.';
            return res.redirect('/baocao');
        }

        const baoCao = await BaoCao.findByIdAndDelete(req.params.id);
        if (!baoCao) {
            req.session.error = 'Không tìm thấy báo cáo.';
            return res.redirect('/baocao');
        }

        req.session.success = 'Đã xóa báo cáo thành công.';
        return res.redirect('/baocao');
    } catch (err) {
        console.error('Lỗi xóa báo cáo:', err.message);
        req.session.error = 'Đã xảy ra lỗi khi xóa báo cáo.';
        return res.redirect('/baocao');
    }
});

module.exports = router;

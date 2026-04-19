var express = require('express');
var router = express.Router();
var ChuDe = require('../models/chude');
var BaiViet = require('../models/baiviet');
var BinhLuan = require('../models/binhluan');
var QuangCao = require('../models/quangcao');
var upload = require('../modules/upload'); // đã có file cấu hình multer/cloudinary này
var firstImageFunc = require('../modules/firstimage');
const cloudinary = require('cloudinary').v2; // Hoặc đường dẫn tới file config của bạn
const PAGE_SIZE = 10; // Số bài viết hiển thị trên một trang

// Middleware kiểm tra quyền admin hoặc manager
var mongoose = require('mongoose');

const getYoutubeEmbedUrl = (url) => {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();

        if (host.includes('youtu.be')) {
            const id = parsed.pathname.replace('/', '').split('/')[0];
            return id ? `https://www.youtube.com/embed/${id}` : null;
        }

        if (host.includes('youtube.com')) {
            if (parsed.pathname.startsWith('/embed/')) {
                const id = parsed.pathname.split('/embed/')[1].split('/')[0];
                return id ? `https://www.youtube.com/embed/${id}` : null;
            }

            const id = parsed.searchParams.get('v');
            return id ? `https://www.youtube.com/embed/${id}` : null;
        }
    } catch (error) {
        return null;
    }

    return null;
};

const normalizeVideoUrl = (rawUrl) => {
    const value = (rawUrl || '').trim();
    if (!value) return '';

    const youtubeEmbed = getYoutubeEmbedUrl(value);
    if (youtubeEmbed) return youtubeEmbed;

    return value;
};

// =========================
// MIDDLEWARE DÙNG CHUNG
// =========================

// Middleware kiểm tra ObjectId hợp lệ
router.param('id', (req, res, next, id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        req.session.error = "ID bài viết không hợp lệ.";
        return res.redirect('/baiviet');
    }
    next();
});

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
        req.session.error = 'Bạn cần đăng nhập để truy cập chức năng này';
        return res.redirect('/dangnhap');
    }

    if (req.session.QuyenHan !== 'admin' && req.session.QuyenHan !== 'maneger') {
        req.session.error = 'Bạn không có quyền truy cập.';
        return res.redirect('/');
    }

    next();
};

// =========================
// ROUTE QUẢN LÝ BÀI VIẾT
// =========================

// [GET] /baiviet - Danh sách bài viết (admin/maneger)
router.get('/', canManage, async (req, res) => {
    try {
        const currentPage = Math.max(1, parseInt(req.query.page) || 1);
        const totalItems = await BaiViet.countDocuments();
        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const page = Math.min(currentPage, totalPages);

        var bv = await BaiViet.find()
            .populate('ChuDe')
            .populate('TaiKhoan')
            .sort({ NgayDang: -1 })
            .skip((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE);

        var baivietWithImage = bv.map(item => {
            const obj = item.toObject();
            return {
                ...obj,
                displayImage: obj.HinhAnh && obj.HinhAnh !== '/images/noimage.png'
                    ? obj.HinhAnh
                    : firstImageFunc(obj.NoiDung)
            };
        });

        res.render('baiviet', {
            title: 'Danh sách bài viết',
            baiviet: baivietWithImage,
            currentPage: page,
            totalPages: totalPages,
            pageSize: PAGE_SIZE,
            totalItems: totalItems
        });
    } catch (err) {
        res.status(500).send('Lỗi hệ thống: ' + err.message);
    }
});

// [GET] /baiviet/cuatoi - Danh sách bài viết của người đang đăng nhập
router.get('/cuatoi', isLoggedIn, async (req, res) => {
    try {
        var id = req.session.MaNguoiDung;
        const currentPage = Math.max(1, parseInt(req.query.page) || 1);
        const totalItems = await BaiViet.countDocuments({ TaiKhoan: id });
        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const page = Math.min(currentPage, totalPages);

        var bv = await BaiViet.find({ TaiKhoan: id })
            .populate('ChuDe')
            .populate('TaiKhoan')
            .sort({ NgayDang: -1 })
            .skip((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE);

        var baivietWithImage = bv.map(item => {
            const obj = item.toObject();
            return {
                ...obj,
                displayImage: obj.HinhAnh && obj.HinhAnh !== '/images/noimage.png'
                    ? obj.HinhAnh
                    : firstImageFunc(obj.NoiDung)
            };
        });

        res.render('baiviet_cuatoi', {
            title: 'Bài viết của tôi',
            baiviet: baivietWithImage,
            currentPage: page,
            totalPages: totalPages,
            pageSize: PAGE_SIZE,
            totalItems: totalItems
        });
    } catch (err) {
        res.status(500).send('Lỗi hệ thống: ' + err.message);
    }
});

// [GET] /baiviet/them - Trang thêm bài viết
router.get('/them', isLoggedIn, async (req, res) => {
    var cd = await ChuDe.find();
    res.render('baiviet_them', {
        title: 'Đăng bài viết mới',
        chude: cd
    });
});

// [POST] /baiviet/them - Tạo bài viết mới
router.post('/them', isLoggedIn, upload.single('HinhAnh'), async (req, res) => {
    try {
        // Người dùng có thể nhập link ảnh hoặc upload file từ máy
        const hinhAnhLink = (req.body.HinhAnhLink || '').trim();
        const noiDung = req.body.NoiDung || '';
        const videoUrl = normalizeVideoUrl(req.body.VideoURL);
        var data = {
            ChuDe: req.body.MaChuDe,
            TaiKhoan: req.session.MaNguoiDung,
            TieuDe: req.body.TieuDe,
            TomTat: req.body.TomTat,
            NoiDung: noiDung,
            VideoURL: videoUrl,
            // Thứ tự ưu tiên ảnh: file upload -> link ảnh bìa -> ảnh đầu tiên trong nội dung
            HinhAnh: req.file ? req.file.path : (hinhAnhLink || firstImageFunc(noiDung)),
            CloudinaryId: req.file ? req.file.filename : null
        };
        await BaiViet.create(data);
        req.session.success = 'Đăng bài viết thành công, vui lòng chờ duyệt!';
        res.redirect('/baiviet/cuatoi');
    } catch (err) {
        req.session.error = 'Lỗi khi đăng bài: ' + err.message;
        res.redirect('/baiviet/them');
    }
});

// [GET] /baiviet/sua/:id - Trang sửa bài viết
router.get('/sua/:id', isLoggedIn, async (req, res) => {
    try {
        var bv = await BaiViet.findById(req.params.id);
        var cd = await ChuDe.find();
        res.render('baiviet_sua', {
            title: 'Sửa bài viết',
            baiviet: bv,
            chude: cd
        });
    } catch (err) {
        res.redirect('/baiviet/cuatoi');
    }
});

// [POST] /baiviet/sua/:id - Cập nhật bài viết
router.post('/sua/:id', isLoggedIn, upload.single('HinhAnh'), async (req, res) => {
    try {
        const id = req.params.id;
        const bv_cu = await BaiViet.findById(id);
        // Link ảnh có thể được nhập để thay ảnh hiện tại
        const hinhAnhLink = (req.body.HinhAnhLink || '').trim();
        const noiDungMoi = req.body.NoiDung || '';
        const videoUrl = normalizeVideoUrl(req.body.VideoURL);

        if (!bv_cu) {
            req.session.error = 'Bài viết không tồn tại';
            return res.redirect('/baiviet/cuatoi');
        }

        var data = {
            ChuDe: req.body.MaChuDe,
            TieuDe: req.body.TieuDe,
            TomTat: req.body.TomTat,
            NoiDung: noiDungMoi,
            VideoURL: videoUrl,
            KiemDuyet: 0 
        };

        // Ưu tiên file mới nếu có upload
        if (req.file) {
            // XÓA ẢNH CŨ NẾU CÓ
            if (bv_cu && bv_cu.CloudinaryId) {
                await cloudinary.uploader.destroy(bv_cu.CloudinaryId);
            }
            // Cập nhật thông tin ảnh mới
            data.HinhAnh = req.file.path;
            data.CloudinaryId = req.file.filename;
        } else if (hinhAnhLink && hinhAnhLink !== (bv_cu.HinhAnh || '')) {
            // Đổi sang link mới: nếu ảnh cũ nằm trên Cloudinary thì dọn ảnh cũ
            if (bv_cu.CloudinaryId) {
                await cloudinary.uploader.destroy(bv_cu.CloudinaryId);
            }
            data.HinhAnh = hinhAnhLink;
            data.CloudinaryId = null;
        } else if (!hinhAnhLink && bv_cu.CloudinaryId) {
            // Không còn link và không upload file -> lấy ảnh đầu tiên trong nội dung
            await cloudinary.uploader.destroy(bv_cu.CloudinaryId);
            data.HinhAnh = firstImageFunc(noiDungMoi);
            data.CloudinaryId = null;
        } else if (!hinhAnhLink && !bv_cu.CloudinaryId) {
            // Trường hợp ảnh cũ là link và người dùng xóa link -> lấy ảnh đầu trong nội dung
            data.HinhAnh = firstImageFunc(noiDungMoi);
            data.CloudinaryId = null;
        }

        await BaiViet.findByIdAndUpdate(id, data);
        req.session.success = 'Đã cập nhật bài viết thành công';
        res.redirect('/baiviet/cuatoi');
    } catch (err) {
        req.session.error = 'Lỗi khi cập nhật: ' + err.message;
        res.redirect('/baiviet/cuatoi');
    }
});

// [GET] /baiviet/duyet/:id - Duyệt/hủy duyệt bài viết
router.get('/duyet/:id', canManage, async (req, res) => {
    try {
        var bv = await BaiViet.findById(req.params.id);
        if (bv) {
            await BaiViet.findByIdAndUpdate(req.params.id, { 'KiemDuyet': 1 - bv.KiemDuyet });
        }
        res.redirect(req.get('referer') || '/baiviet');
    } catch (err) {
        res.redirect('/baiviet');
    }
});

// [GET] /baiviet/xoa/:id - Xóa bài viết
router.get('/xoa/:id', isLoggedIn, async (req, res) => {
    try {
        const id = req.params.id;
        const bv = await BaiViet.findById(id);

        if (!bv) {
            req.session.error = 'Bài viết không tồn tại';
            return res.redirect('/baiviet/cuatoi');
        }

        const isOwner = req.session.MaNguoiDung == String(bv.TaiKhoan);
        const isManager = req.session.QuyenHan === 'admin' || req.session.QuyenHan === 'maneger';
        if (!isOwner && !isManager) {
            req.session.error = 'Bạn không có quyền xóa bài viết này.';
            return res.redirect(req.get('referer') || '/baiviet/cuatoi');
        }

        // 1. Chỉ xóa Cloudinary khi bài viết thật sự dùng ảnh upload (có CloudinaryId)
        if (bv.CloudinaryId) {
            try {
                await cloudinary.uploader.destroy(bv.CloudinaryId);
                console.log("--- Đã xóa ảnh bài viết trên Cloudinary:", bv.CloudinaryId);
            } catch (cloudErr) {
                console.error("--- Lỗi Cloudinary:", cloudErr.message);
            }
        }

        // 2. XÓA BÀI VIẾT TRONG DATABASE
        await BaiViet.findByIdAndDelete(id);
        
        req.session.success = 'Đã xóa bài viết thành công';
        res.redirect(req.get('referer') || '/baiviet/cuatoi');
    } catch (err) {
        console.error("Lỗi xóa bài viết:", err);
        req.session.error = 'Lỗi hệ thống: ' + err.message;
        res.redirect('/baiviet/cuatoi');
    }
});

// =========================
// ROUTE PUBLIC
// =========================

// [GET] /baiviet/:id - Chi tiết bài viết
router.get('/:id', async (req, res) => {
    try {
        var id = req.params.id;
        
        // 1. Tìm bài viết
        var bv = await BaiViet.findById(id)
            .populate('ChuDe')
            .populate({ path: 'TaiKhoan', select: 'HoVaTen TenDangNhap Email HinhAnh' });
        
        if (bv) {
            // --- LOGIC GIỚI HẠN TĂNG LƯỢT XEM BẰNG SESSION ---
            if (!req.session.BaiVietDaXem) {
                req.session.BaiVietDaXem = [];
            }

            if (!req.session.BaiVietDaXem.includes(id)) {
                bv.LuotXem += 1;
                await bv.save();
                req.session.BaiVietDaXem.push(id);
            }

            // 2. Lấy bài viết cùng chủ đề (trừ bài hiện tại)
            let baiVietCungChuDe = [];
            if (bv.ChuDe && bv.ChuDe._id) {
                const rawRelated = await BaiViet.find({
                    _id: { $ne: bv._id },
                    ChuDe: bv.ChuDe._id,
                    KiemDuyet: 1
                })
                    .sort({ NgayDang: -1 })
                    .limit(5)
                    .select('TieuDe TomTat NoiDung HinhAnh NgayDang LuotXem');

                baiVietCungChuDe = rawRelated.map(item => {
                    const obj = item.toObject();
                    const uploadedImage = obj.HinhAnh && obj.HinhAnh !== '/images/noimage.png'
                        ? obj.HinhAnh
                        : null;

                    return {
                        ...obj,
                        displayImage: uploadedImage || firstImageFunc(obj.NoiDung)
                    };
                });
            }

            // 3. Lấy danh sách bình luận có phân trang
            const currentCommentPage = Math.max(1, parseInt(req.query.commentPage) || 1);
            const totalComments = await BinhLuan.countDocuments({ BaiViet: bv._id, KiemDuyet: 1 });
            const totalCommentPages = Math.max(1, Math.ceil(totalComments / PAGE_SIZE));
            const commentPage = Math.min(currentCommentPage, totalCommentPages);

            const dsBinhLuan = await BinhLuan.find({ BaiViet: bv._id, KiemDuyet: 1 })
                .populate('TaiKhoan', 'HoVaTen HinhAnh')
                .sort({ createdAt: -1 })
                .skip((commentPage - 1) * PAGE_SIZE)
                .limit(PAGE_SIZE);

            const tacGia = bv.TaiKhoan
                ? (bv.TaiKhoan.HoVaTen || bv.TaiKhoan.TenDangNhap || bv.TaiKhoan.Email)
                : 'N/A';

            const randomAd = await QuangCao.aggregate([{ $sample: { size: 1 } }])
                .then(items => (items && items.length > 0 ? items[0] : null));

            res.render('baiviet_chitiet', {
                title: bv.TieuDe,
                baiviet: bv,
                tacGia: tacGia,
                binhluan: dsBinhLuan,
                quangcao: randomAd,
                baiVietCungChuDe: baiVietCungChuDe,
                totalComments: totalComments,
                currentCommentPage: commentPage,
                totalCommentPages: totalCommentPages,
                commentPageSize: PAGE_SIZE
            });
        } else {
            res.status(404).send('Bài viết không tồn tại.');
        }
    } catch (err) {
        console.error("Lỗi trang chi tiết:", err);
        res.status(500).send('Lỗi hệ thống: ' + err.message);
    }
});

module.exports = router;
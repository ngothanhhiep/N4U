var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var Video = require('../models/video');
var BaiViet = require('../models/baiviet');
var upload = require('../modules/upload');
var uploadVideo = upload.uploadVideo;
var cloudinary = require('../configs/cloudinary');

const PAGE_SIZE = 12;

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

    try {
        const parsed = new URL(value);
        return parsed.toString();
    } catch (error) {
        return '';
    }
};

const isYoutubeEmbedUrl = (url) => {
    const value = (url || '').toLowerCase();
    return value.includes('youtube.com/embed/');
};

const createExternalVideoId = () => {
    return `external-${Date.now()}-${Math.floor(Math.random() * 1000000000)}`;
};

const isCloudinaryVideo = (video) => {
    if (!video || !video.CloudinaryId) return false;
    return video.DinhDang !== 'youtube' && video.DinhDang !== 'link';
};

const handleVideoUpload = (req, res, next) => {
    uploadVideo.single('Video')(req, res, (err) => {
        if (!err) return next();

        if (err.code === 'LIMIT_FILE_SIZE') {
            req.session.error = 'Video vượt quá giới hạn 100MB.';
        } else {
            req.session.error = 'Lỗi upload video: ' + err.message;
        }

        if (req.params && req.params.id) {
            return res.redirect('/video/sua/' + req.params.id);
        }

        return res.redirect('/video/them');
    });
};

const isLoggedIn = (req, res, next) => {
    if (req.session.MaNguoiDung) {
        return next();
    }

    req.session.error = 'Bạn phải đăng nhập để thực hiện thao tác này';
    return res.redirect('/dangnhap');
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

router.param('id', (req, res, next, id) => {
    if (!mongoose.Types.ObjectId.isValid(id)) {
        req.session.error = 'ID video không hợp lệ.';
        return res.redirect('/video');
    }
    next();
});

const canAccessVideo = (video, req) => {
    const isOwner = String(video.TaiKhoan || '') === String(req.session.MaNguoiDung || '');
    const isManager = req.session.QuyenHan === 'admin' || req.session.QuyenHan === 'maneger';
    return isOwner || isManager;
};

const loadBaiVietOptions = async (req) => {
    const isManager = req.session.QuyenHan === 'admin' || req.session.QuyenHan === 'maneger';
    const query = isManager ? {} : { TaiKhoan: req.session.MaNguoiDung };

    return BaiViet.find(query)
        .select('TieuDe')
        .sort({ NgayDang: -1 })
        .limit(200);
};

// [GET] /video/moinhat - Video mới nhất (public)
router.get('/moinhat', async (req, res) => {
    try {
        const currentPage = Math.max(1, parseInt(req.query.page) || 1);
        const totalItems = await Video.countDocuments();
        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const page = Math.min(currentPage, totalPages);

        const videos = await Video.find()
            .populate('TaiKhoan', 'HoVaTen TenDangNhap Email')
            .populate('BaiViet', 'TieuDe _id')
            .sort({ createdAt: -1 })
            .skip((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE);

        return res.render('video_moinhat', {
            title: 'Video mới nhất',
            video: videos,
            currentPage: page,
            totalPages: totalPages,
            pageSize: PAGE_SIZE,
            totalItems: totalItems,
            isYoutubeEmbedUrl: isYoutubeEmbedUrl
        });
    } catch (err) {
        req.session.error = 'Lỗi hệ thống khi tải trang video mới nhất.';
        return res.redirect('/');
    }
});

// [GET] /video - Danh sách video (admin/manager)
router.get('/', canManage, async (req, res) => {
    try {
        const currentPage = Math.max(1, parseInt(req.query.page) || 1);
        const totalItems = await Video.countDocuments();
        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const page = Math.min(currentPage, totalPages);

        const videos = await Video.find()
            .populate('TaiKhoan', 'HoVaTen TenDangNhap Email')
            .populate('BaiViet', 'TieuDe')
            .sort({ createdAt: -1 })
            .skip((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE);

        return res.render('video', {
            title: 'Danh sách video',
            currentPage: page,
            totalPages: totalPages,
            pageSize: PAGE_SIZE,
            totalItems: totalItems,
            video: videos
        });
    } catch (err) {
        req.session.error = 'Lỗi hệ thống khi tải danh sách video.';
        return res.redirect('/');
    }
});

// [GET] /video/cuatoi - Danh sách video của người đăng nhập
router.get('/cuatoi', isLoggedIn, async (req, res) => {
    try {
        const currentPage = Math.max(1, parseInt(req.query.page) || 1);
        const query = { TaiKhoan: req.session.MaNguoiDung };
        const totalItems = await Video.countDocuments(query);
        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const page = Math.min(currentPage, totalPages);

        const videos = await Video.find(query)
            .populate('BaiViet', 'TieuDe')
            .sort({ createdAt: -1 })
            .skip((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE);

        return res.render('video_cuatoi', {
            title: 'Video của tôi',
            currentPage: page,
            totalPages: totalPages,
            pageSize: PAGE_SIZE,
            totalItems: totalItems,
            video: videos
        });
    } catch (err) {
        req.session.error = 'Lỗi hệ thống khi tải danh sách video của bạn.';
        return res.redirect('/');
    }
});

// [GET] /video/them - Trang thêm video
router.get('/them', isLoggedIn, async (req, res) => {
    try {
        const baiVietOptions = await loadBaiVietOptions(req);

        return res.render('video_them', {
            title: 'Thêm video',
            baiviet: baiVietOptions
        });
    } catch (err) {
        req.session.error = 'Lỗi hệ thống khi tải trang thêm video.';
        return res.redirect('/video/cuatoi');
    }
});

// [GET] /video/xem/:id - Chi tiết video
router.get('/xem/:id', isLoggedIn, async (req, res) => {
    try {
        const video = await Video.findById(req.params.id)
            .populate('TaiKhoan', 'HoVaTen TenDangNhap Email HinhAnh')
            .populate('BaiViet', 'TieuDe _id');

        if (!video) {
            req.session.error = 'Video không tồn tại.';
            return res.redirect('/video/cuatoi');
        }

        if (!canAccessVideo(video, req)) {
            req.session.error = 'Bạn không có quyền xem video này.';
            return res.redirect('/video/cuatoi');
        }

        return res.render('video_chitiet', {
            title: video.TenVideo,
            video: video,
            isYoutubeEmbedUrl: isYoutubeEmbedUrl
        });
    } catch (err) {
        req.session.error = 'Lỗi hệ thống khi lấy chi tiết video.';
        return res.redirect('/video/cuatoi');
    }
});

// [POST] /video/them - Upload video mới
router.post('/them', isLoggedIn, handleVideoUpload, async (req, res) => {
    try {
        const videoLink = normalizeVideoUrl(req.body.VideoLink);

        if (!req.file && !videoLink) {
            req.session.error = 'Vui lòng chọn file video hoặc nhập link video hợp lệ.';
            return res.redirect('/video/them');
        }

        const isUploadFile = Boolean(req.file);
        const data = {
            TenVideo: (req.body.TenVideo || (req.file ? req.file.originalname : 'Video mới')).trim(),
            VideoURL: isUploadFile ? req.file.path : videoLink,
            CloudinaryId: isUploadFile ? req.file.filename : createExternalVideoId(),
            DinhDang: isUploadFile ? (req.file.format || '') : (isYoutubeEmbedUrl(videoLink) ? 'youtube' : 'link'),
            KichThuoc: isUploadFile ? (req.file.bytes || 0) : 0,
            ThoiLuong: isUploadFile ? (req.file.duration || 0) : 0,
            TaiKhoan: req.session.MaNguoiDung,
            BaiViet: mongoose.Types.ObjectId.isValid(req.body.BaiViet)
                ? req.body.BaiViet
                : null
        };

        const created = await Video.create(data);

        req.session.success = 'Upload video thành công.';
        return res.redirect('/video/xem/' + created._id);
    } catch (err) {
        if (req.file && req.file.filename) {
            try {
                await cloudinary.uploader.destroy(req.file.filename, { resource_type: 'video' });
            } catch (cloudErr) {
                console.error('Lỗi xóa video Cloudinary khi tạo thất bại:', cloudErr.message);
            }
        }

        if (err && err.code === 11000) {
            req.session.error = 'Dữ liệu video bị trùng khóa trong CSDL. Vui lòng thử lại.';
            return res.redirect('/video/them');
        }

        req.session.error = 'Lỗi hệ thống khi upload video: ' + err.message;
        return res.redirect('/video/them');
    }
});

// [GET] /video/sua/:id - Trang sửa video
router.get('/sua/:id', isLoggedIn, async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) {
            req.session.error = 'Video không tồn tại.';
            return res.redirect('/video/cuatoi');
        }

        if (!canAccessVideo(video, req)) {
            req.session.error = 'Bạn không có quyền sửa video này.';
            return res.redirect('/video/cuatoi');
        }

        const baiVietOptions = await loadBaiVietOptions(req);

        return res.render('video_sua', {
            title: 'Sửa video',
            video: video,
            baiviet: baiVietOptions
        });
    } catch (err) {
        req.session.error = 'Lỗi hệ thống khi tải trang sửa video.';
        return res.redirect('/video/cuatoi');
    }
});

// [POST] /video/sua/:id - Cập nhật thông tin/video file
router.post('/sua/:id', isLoggedIn, handleVideoUpload, async (req, res) => {
    try {
        const videoCu = await Video.findById(req.params.id);
        if (!videoCu) {
            req.session.error = 'Video không tồn tại.';
            return res.redirect('/video/cuatoi');
        }

        if (!canAccessVideo(videoCu, req)) {
            if (req.file && req.file.filename) {
                try {
                    await cloudinary.uploader.destroy(req.file.filename, { resource_type: 'video' });
                } catch (cloudErr) {
                    console.error('Lỗi xóa video mới do không đủ quyền:', cloudErr.message);
                }
            }
            req.session.error = 'Bạn không có quyền sửa video này.';
            return res.redirect('/video/cuatoi');
        }

        const data = {
            TenVideo: (req.body.TenVideo || videoCu.TenVideo || '').trim(),
            BaiViet: mongoose.Types.ObjectId.isValid(req.body.BaiViet) ? req.body.BaiViet : null
        };

        const videoLink = normalizeVideoUrl(req.body.VideoLink);

        if (req.file) {
            if (isCloudinaryVideo(videoCu)) {
                try {
                    await cloudinary.uploader.destroy(videoCu.CloudinaryId, { resource_type: 'video' });
                } catch (cloudErr) {
                    console.error('Lỗi xóa video cũ Cloudinary:', cloudErr.message);
                }
            }

            data.VideoURL = req.file.path;
            data.CloudinaryId = req.file.filename;
            data.DinhDang = req.file.format || '';
            data.KichThuoc = req.file.bytes || 0;
            data.ThoiLuong = req.file.duration || 0;
        } else if (videoLink && videoLink !== (videoCu.VideoURL || '')) {
            if (isCloudinaryVideo(videoCu)) {
                try {
                    await cloudinary.uploader.destroy(videoCu.CloudinaryId, { resource_type: 'video' });
                } catch (cloudErr) {
                    console.error('Lỗi xóa video cũ Cloudinary khi đổi sang link:', cloudErr.message);
                }
            }

            data.VideoURL = videoLink;
            data.CloudinaryId = createExternalVideoId();
            data.DinhDang = isYoutubeEmbedUrl(videoLink) ? 'youtube' : 'link';
            data.KichThuoc = 0;
            data.ThoiLuong = 0;
        }

        const updated = await Video.findByIdAndUpdate(
            req.params.id,
            data,
            { new: true, runValidators: true }
        );

        req.session.success = 'Cập nhật video thành công.';
        return res.redirect('/video/xem/' + updated._id);
    } catch (err) {
        if (req.file && req.file.filename) {
            try {
                await cloudinary.uploader.destroy(req.file.filename, { resource_type: 'video' });
            } catch (cloudErr) {
                console.error('Lỗi xóa video mới khi cập nhật thất bại:', cloudErr.message);
            }
        }

        req.session.error = 'Lỗi hệ thống khi cập nhật video: ' + err.message;
        return res.redirect('/video/cuatoi');
    }
});

// [GET] /video/xoa/:id - Xóa video
router.get('/xoa/:id', isLoggedIn, async (req, res) => {
    try {
        const video = await Video.findById(req.params.id);
        if (!video) {
            req.session.error = 'Video không tồn tại.';
            return res.redirect('/video/cuatoi');
        }

        if (!canAccessVideo(video, req)) {
            req.session.error = 'Bạn không có quyền xóa video này.';
            return res.redirect('/video/cuatoi');
        }

        await Video.findByIdAndDelete(req.params.id);

        if (isCloudinaryVideo(video)) {
            try {
                await cloudinary.uploader.destroy(video.CloudinaryId, { resource_type: 'video' });
            } catch (cloudErr) {
                console.error('Lỗi xóa video Cloudinary khi xóa dữ liệu:', cloudErr.message);
            }
        }

        req.session.success = 'Xóa video thành công.';
        return res.redirect('/video/cuatoi');
    } catch (err) {
        req.session.error = 'Lỗi hệ thống khi xóa video: ' + err.message;
        return res.redirect('/video/cuatoi');
    }
});

module.exports = router;
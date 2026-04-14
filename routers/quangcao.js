var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
var QuangCao = require('../models/quangcao');
var upload = require('../modules/upload');
const cloudinary = require('../configs/cloudinary');

const PAGE_SIZE = 20;

const checkAdminOrManager = (req, res, next) => {
    if (!req.session.MaNguoiDung) {
        req.session.error = 'Bạn cần đăng nhập.';
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
        req.session.error = 'ID quảng cáo không hợp lệ.';
        return res.redirect('/quangcao');
    }
    next();
});

// GET: Danh sách quảng cáo (có phân trang)
router.get('/', checkAdminOrManager, async (req, res) => {
    try {
        const currentPage = Math.max(1, parseInt(req.query.page) || 1);
        const totalItems = await QuangCao.countDocuments();
        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const page = Math.min(currentPage, totalPages);

        const dsQuangCao = await QuangCao.find()
            .sort({ createdAt: -1 })
            .skip((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE);

        res.render('quangcao', {
            title: 'Danh sách quảng cáo',
            quangcao: dsQuangCao,
            currentPage: page,
            totalPages: totalPages,
            pageSize: PAGE_SIZE,
            totalItems: totalItems
        });
    } catch (err) {
        req.session.error = 'Lỗi hệ thống khi tải danh sách quảng cáo.';
        res.redirect('/');
    }
});

// GET: Form thêm quảng cáo
router.get('/them', checkAdminOrManager, async (req, res) => {
    res.render('quangcao_them', {
        title: 'Thêm quảng cáo'
    });
});

// POST: Thêm quảng cáo
router.post('/them', checkAdminOrManager, upload.single('HinhAnhFile'), async (req, res) => {
    try {
        const hinhAnhLink = (req.body.HinhAnh || '').trim();
        const uploadedImage = req.file ? req.file.path : '';
        const uploadedCloudinaryId = req.file ? req.file.filename : null;

        const data = {
            TenQuangCao: (req.body.TenQuangCao || '').trim(),
            HinhAnh: uploadedImage || hinhAnhLink,
            CloudinaryId: uploadedCloudinaryId,
            LinkQuangCao: (req.body.LinkQuangCao || '').trim()
        };

        if (!data.TenQuangCao) {
            req.session.error = 'Tên quảng cáo là bắt buộc.';
            return res.redirect('/quangcao/them');
        }

        await QuangCao.create(data);
        req.session.success = 'Thêm quảng cáo thành công.';
        res.redirect('/quangcao');
    } catch (err) {
        if (req.file && req.file.filename) {
            try {
                await cloudinary.uploader.destroy(req.file.filename);
            } catch (cloudErr) {
                console.error('Lỗi xóa ảnh Cloudinary khi thêm quảng cáo thất bại:', cloudErr.message);
            }
        }
        req.session.error = 'Lỗi hệ thống khi thêm quảng cáo.';
        res.redirect('/quangcao/them');
    }
});

// GET: Form sửa quảng cáo
router.get('/sua/:id', checkAdminOrManager, async (req, res) => {
    try {
        const qc = await QuangCao.findById(req.params.id);
        if (!qc) {
            req.session.error = 'Không tìm thấy quảng cáo.';
            return res.redirect('/quangcao');
        }

        res.render('quangcao_sua', {
            title: 'Sửa quảng cáo',
            quangcao: qc
        });
    } catch (err) {
        req.session.error = 'Lỗi hệ thống khi tải trang sửa quảng cáo.';
        res.redirect('/quangcao');
    }
});

// POST: Sửa quảng cáo
router.post('/sua/:id', checkAdminOrManager, upload.single('HinhAnhFile'), async (req, res) => {
    try {
        const qcCu = await QuangCao.findById(req.params.id);
        if (!qcCu) {
            req.session.error = 'Không tìm thấy quảng cáo để cập nhật.';
            return res.redirect('/quangcao');
        }

        const hinhAnhLink = (req.body.HinhAnh || '').trim();
        const data = {
            TenQuangCao: (req.body.TenQuangCao || '').trim(),
            LinkQuangCao: (req.body.LinkQuangCao || '').trim()
        };

        if (!data.TenQuangCao) {
            req.session.error = 'Tên quảng cáo là bắt buộc.';
            return res.redirect('/quangcao/sua/' + req.params.id);
        }

        if (req.file) {
            if (qcCu.CloudinaryId) {
                try {
                    await cloudinary.uploader.destroy(qcCu.CloudinaryId);
                } catch (cloudErr) {
                    console.error('Lỗi xóa ảnh cũ Cloudinary khi cập nhật quảng cáo:', cloudErr.message);
                }
            }

            data.HinhAnh = req.file.path;
            data.CloudinaryId = req.file.filename;
        } else if (hinhAnhLink !== (qcCu.HinhAnh || '')) {
            if (qcCu.CloudinaryId) {
                try {
                    await cloudinary.uploader.destroy(qcCu.CloudinaryId);
                } catch (cloudErr) {
                    console.error('Lỗi xóa ảnh cũ Cloudinary khi đổi sang link:', cloudErr.message);
                }
            }

            data.HinhAnh = hinhAnhLink;
            data.CloudinaryId = null;
        }

        const qc = await QuangCao.findByIdAndUpdate(
            req.params.id,
            data,
            { new: true, runValidators: true }
        );

        if (!qc) {
            req.session.error = 'Không tìm thấy quảng cáo để cập nhật.';
            return res.redirect('/quangcao');
        }

        req.session.success = 'Cập nhật quảng cáo thành công.';
        res.redirect('/quangcao');
    } catch (err) {
        if (req.file && req.file.filename) {
            try {
                await cloudinary.uploader.destroy(req.file.filename);
            } catch (cloudErr) {
                console.error('Lỗi xóa ảnh mới khi cập nhật quảng cáo thất bại:', cloudErr.message);
            }
        }
        req.session.error = 'Lỗi hệ thống khi cập nhật quảng cáo.';
        res.redirect('/quangcao/sua/' + req.params.id);
    }
});

// GET: Xóa quảng cáo
router.get('/xoa/:id', checkAdminOrManager, async (req, res) => {
    try {
        const qc = await QuangCao.findByIdAndDelete(req.params.id);
        if (!qc) {
            req.session.error = 'Không tìm thấy quảng cáo để xóa.';
            return res.redirect('/quangcao');
        }

        if (qc.CloudinaryId) {
            try {
                await cloudinary.uploader.destroy(qc.CloudinaryId);
            } catch (cloudErr) {
                console.error('Lỗi xóa ảnh Cloudinary khi xóa quảng cáo:', cloudErr.message);
            }
        }

        req.session.success = 'Xóa quảng cáo thành công.';
        res.redirect('/quangcao');
    } catch (err) {
        req.session.error = 'Lỗi hệ thống khi xóa quảng cáo.';
        res.redirect('/quangcao');
    }
});

module.exports = router;
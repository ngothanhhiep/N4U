var express = require('express');
var router = express.Router();
var ChuDe = require('../models/chude');
var BaiViet = require('../models/baiviet');
var QuangCao = require('../models/quangcao');
var firstImageFunc = require('../modules/firstimage');
var mongoose = require('mongoose');

// Cấu hình upload
var upload = require('../modules/upload'); 
var imageController = require('../controllers/images'); 

const mapArticleCardData = (article) => {
    const articleObj = article.toObject();
    const uploadedImage = articleObj.HinhAnh && articleObj.HinhAnh !== '/images/noimage.png'
        ? articleObj.HinhAnh
        : null;

    return {
        ...articleObj,
        displayImage: uploadedImage || firstImageFunc(articleObj.NoiDung)
    };
};

// =========================
// ROUTE HỖ TRỢ
// =========================

// [POST] /uploads - Upload ảnh cho editor
router.post('/uploads', upload.single('HinhAnh'), imageController.uploadImages);

// =========================
// ROUTE PUBLIC
// =========================

// [GET] / - Trang chủ
router.get('/', async (req, res) => {
    try {
        const [cm, bv, xnn, randomAd] = await Promise.all([
            ChuDe.find(),
            BaiViet.find({ KiemDuyet: 1 })
                .sort({ NgayDang: -1 })
                .populate('ChuDe')
                .populate('TaiKhoan')
                .limit(12),
            BaiViet.find({ KiemDuyet: 1 })
                .sort({ LuotXem: -1 })
                .populate('ChuDe')
                .populate('TaiKhoan')
                .limit(5),
            QuangCao.aggregate([{ $sample: { size: 1 } }])
                .then(items => (items && items.length > 0 ? items[0] : null))
        ]);

        // Ưu tiên ảnh upload, nếu chưa có thì lấy ảnh đầu tiên trong nội dung
        var baivietWithImage = bv.map(mapArticleCardData);

        res.render('index', {
            title: 'Trang chủ',
            chuyenmuc: cm,
            baiviet: baivietWithImage, // Sử dụng mảng đã có ảnh
            xemnhieu: xnn,
            quangcao: randomAd
        });
    } catch (error) {
        console.error("Lỗi trang chủ:", error);
        res.status(500).send('Lỗi hệ thống: ' + error.message);
    }
});

const renderCategoryPage = async (req, res) => {
    try {
        var id = req.params.id;

        // Kiểm tra ObjectId hợp lệ
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).send('ID chủ đề không hợp lệ.');
        }

        const [cm, cd, xnn] = await Promise.all([
            ChuDe.find(),
            ChuDe.findById(id),
            BaiViet.find({ KiemDuyet: 1 }).sort({ LuotXem: -1 }).limit(3)
        ]);

        if (!cd) return res.status(404).send('Chủ đề không tồn tại.');

        var bv = await BaiViet.find({ ChuDe: id, KiemDuyet: 1 })
            .sort({ NgayDang: -1 })
            .populate('ChuDe')
            .populate('TaiKhoan')
            .limit(8);

        var baivietWithImage = bv.map(mapArticleCardData);

        res.render('baiviet_chude', {
            title: cd.TenChuDe,
            chuyenmuc: cm,
            chude: cd,
            baiviet: baivietWithImage,
            xemnhieu: xnn
        });
    } catch (error) {
        console.error("Lỗi lấy bài viết theo chủ đề:", error);
        res.status(500).send('Lỗi hệ thống: ' + error.message);
    }
};

// [GET] /tinmoi - Danh sách bài viết mới nhất
router.get('/tinmoi', async (req, res) => {
    try {
        const PAGE_SIZE = 10;
        const currentPage = Math.max(1, parseInt(req.query.page) || 1);
        const totalItems = await BaiViet.countDocuments({ KiemDuyet: 1 });
        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const page = Math.min(currentPage, totalPages);

        const [cm, bv, xnn] = await Promise.all([
            ChuDe.find(),
            BaiViet.find({ KiemDuyet: 1 })
                .sort({ NgayDang: -1 })
                .populate('ChuDe')
                .populate('TaiKhoan')
                .skip((page - 1) * PAGE_SIZE)
                .limit(PAGE_SIZE),
            BaiViet.find({ KiemDuyet: 1 })
                .sort({ LuotXem: -1 })
                .limit(5)
        ]);

        const baivietWithImage = bv.map(mapArticleCardData);

        res.render('baiviet_moinhat', {
            title: 'Bài viết mới nhất',
            chuyenmuc: cm,
            baiviet: baivietWithImage,
            xemnhieu: xnn,
            currentPage: page,
            totalPages: totalPages,
            totalItems: totalItems
        });
    } catch (error) {
        console.error("Lỗi trang tin mới nhất:", error);
        res.status(500).send('Lỗi hệ thống: ' + error.message);
    }
});

// [GET] /timkiem - Tìm kiếm bài viết
router.get('/timkiem', async (req, res) => {
    try {
        const tukhoa = (req.query.tukhoa || '').trim().substring(0, 200);
        const chuDeFilter = (req.query.chuDe || '').trim();
        const tacGiaFilter = (req.query.tacGia || '').trim();
        const tuNgay = (req.query.tuNgay || '').trim();
        const denNgay = (req.query.denNgay || '').trim();

        if (!tukhoa) {
            const cm = await ChuDe.find();
            return res.render('index_timkiem', {
                title: 'Tìm kiếm',
                tukhoa: '',
                chuyenmuc: cm,
                baiviet: [],
                xemnhieu: [],
                currentPage: 1,
                totalPages: 1,
                totalItems: 0,
                filters: { chuDeFilter: '', tacGiaFilter: '', tuNgay: '', denNgay: '' }
            });
        }

        const PAGE_SIZE = 10;
        const currentPage = Math.max(1, parseInt(req.query.page) || 1);

        // Escape ký tự đặc biệt của regex để tránh ReDoS
        const escaped = tukhoa.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');

        // Xây dựng query tìm kiếm
        const searchQuery = {
            KiemDuyet: 1,
            $or: [
                { TieuDe: regex },
                { TomTat: regex },
                { NoiDung: regex }
            ]
        };

        // Thêm filter chủ đề
        if (chuDeFilter && mongoose.Types.ObjectId.isValid(chuDeFilter)) {
            searchQuery.ChuDe = new mongoose.Types.ObjectId(chuDeFilter);
        }

        // Thêm filter tác giả
        if (tacGiaFilter && mongoose.Types.ObjectId.isValid(tacGiaFilter)) {
            searchQuery.TaiKhoan = new mongoose.Types.ObjectId(tacGiaFilter);
        }

        // Thêm filter ngày (từ ngày đến ngày)
        if (tuNgay || denNgay) {
            searchQuery.NgayDang = {};
            if (tuNgay) {
                const startDate = new Date(tuNgay);
                startDate.setHours(0, 0, 0, 0);
                searchQuery.NgayDang.$gte = startDate;
            }
            if (denNgay) {
                const endDate = new Date(denNgay);
                endDate.setHours(23, 59, 59, 999);
                searchQuery.NgayDang.$lte = endDate;
            }
        }

        const totalItems = await BaiViet.countDocuments(searchQuery);
        const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
        const page = Math.min(currentPage, totalPages);

        const [cm, bv, xnn, allAuthors] = await Promise.all([
            ChuDe.find(),
            BaiViet.find(searchQuery)
                .sort({ NgayDang: -1 })
                .populate('ChuDe')
                .populate('TaiKhoan')
                .skip((page - 1) * PAGE_SIZE)
                .limit(PAGE_SIZE),
            BaiViet.find({ KiemDuyet: 1 })
                .sort({ LuotXem: -1 })
                .limit(5),
            BaiViet.find({ KiemDuyet: 1 })
                .distinct('TaiKhoan')
                .then(ids => require('../models/taikhoan').find({ _id: { $in: ids } }))
        ]);

        // Highlight từ khóa trong tiêu đề và tóm tắt
        const highlightText = (text, keyword) => {
            if (!text) return '';
            const esc = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return text.replace(new RegExp(esc, 'gi'), match => `<mark>${match}</mark>`);
        };

        const baivietWithHighlight = bv.map(article => {
            const obj = article.toObject();
            const uploadedImage = obj.HinhAnh && obj.HinhAnh !== '/images/noimage.png'
                ? obj.HinhAnh : null;
            return {
                ...obj,
                displayImage: uploadedImage || firstImageFunc(obj.NoiDung),
                highlightedTitle: highlightText(obj.TieuDe, tukhoa),
                highlightedSummary: highlightText(
                    obj.TomTat ? obj.TomTat.substring(0, 150) : '', tukhoa
                ) + '...'
            };
        });

        res.render('index_timkiem', {
            title: `Tìm kiếm: ${tukhoa}`,
            tukhoa,
            chuyenmuc: cm,
            taikhoan: allAuthors,
            baiviet: baivietWithHighlight,
            xemnhieu: xnn,
            currentPage: page,
            totalPages,
            totalItems,
            filters: {
                chuDeFilter,
                tacGiaFilter,
                tuNgay,
                denNgay
            }
        });
    } catch (error) {
        console.error("Lỗi tìm kiếm:", error);
        res.status(500).send('Lỗi hệ thống: ' + error.message);
    }
});

// [GET] /chuyenmuc/:id - URL cũ, chuyển hướng về /chude/:id
router.get('/chuyenmuc/:id', (req, res) => {
    return res.redirect('/chude/' + req.params.id);
});

module.exports = router;
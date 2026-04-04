var express = require('express');
var router = express.Router();
var ChuDe = require('../models/chude');
var BaiViet = require('../models/baiviet');
var firstImageFunc = require('../modules/firstimage');
const chuDeModel = require('../models/chude');
const firstImage = require('../modules/firstimage');

// GET: Trang chủ
router.get('/', async (req, res) => {
    // lấy chuyên mục hiển thị vào menu
    var cm = await ChuDe.find();

    // lấy mười hai bài viết mới nhất hiển thị vào trang chủ
    var bv = await BaiViet.find({KiemDuyet : 1})
        .sort({NgayDang: -1})
        .populate('ChuDe')
        .populate('TaiKhoan')
        .limit(12);

    // Thêm firstImage cho mỗi bài viết
    bv = bv.map(b => ({ ...b.toObject(), firstImage: firstImageFunc(b.NoiDung) }));
    
    // lấy ba bài đăng xem nhiều nhất hiển thị ở cột phải
    var xnn = await BaiViet.find({KiemDuyet : 1})
        .sort({LuotXem: -1})
        .populate('ChuDe')
        .populate('TaiKhoan')
        .limit(3); 

    var firstImage = bv.length > 0 ? firstImageFunc(bv[0].NoiDung) : '/images/noimage.png';

    res.render('index', {
        title: 'Trang chủ',

        chuyenmuc: cm,
        baiviet: bv,
        xemnhieu: xnn,
        firstImage: firstImage
    });
});

//GET: Lấy những bài viết cùng mã chủ đề'
router.get('/chude/:id', async (req, res) => {
    var id = req.params.id;

    //Lấy chuyên mục hiển thị vào menu
    var cm = await ChuDe.find();

    //Lấy thông tin chủ đề hiện tại
    var cd = await ChuDe.findById(id);

    //Lấy thông tin 8 bài viết cùng chuyên mục
    var bv = await BaiViet.find({ChuDe: id, KiemDuyet : 1})
        .sort({NgayDang: -1})
        .populate('ChuDe')
        .populate('TaiKhoan')
        .limit(8);

    // Thêm firstImage cho mỗi bài viết
    bv = bv.map(b => ({ ...b.toObject(), firstImage: firstImageFunc(b.NoiDung) }));

    // lấy 3 bài đăng xem nhiều nhất hiển thị ở cột phải
    var xnn = await BaiViet.find({KiemDuyet : 1})
        .sort({LuotXem: -1})
        .populate('ChuDe')
        .populate('TaiKhoan')
        .limit(3);

    var firstImage = bv.length > 0 ? firstImageFunc(bv[0].NoiDung) : '/images/noimage.png';

    res.render('baiviet_chude', {
        title: cd ? cd.TenChuDe : 'Chủ đề',
        chuyenmuc: cm,
        chude: cd,
        baiviet: bv,
        xemnhieu: xnn,
        firstImage: firstImage
    });
});

// GET: Lỗi
router.get('/error', async (req, res) => {
    res.render('error', {
        title: 'Lỗi'
    });
});
// GET: Thành công
router.get('/success', async (req, res) => {
    res.render('success', {
        title: 'Hoàn thành'
    });
});
module.exports = router;
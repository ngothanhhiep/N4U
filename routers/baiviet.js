var express = require('express');
var router = express.Router();
var ChuDe = require('../models/chude');
var BaiViet = require('../models/baiviet');
const session = require('express-session');
const taiKhoanModel = require('../models/taikhoan');
// GET: Danh sách bài viết
router.get('/', async (req, res) => {
    var bv = await BaiViet.find()
        .populate('ChuDe')   
        .populate('TaiKhoan')
    res.render('baiviet', { 
        title: 'Danh sách bài viết',
        baiviet: bv
    });
});
// GET: Chi tiết bài viết
router.get('/:id', async (req, res) => {
    var id = req.params.id;
    var bv = await BaiViet.findById(id)
        .populate('ChuDe')
        .populate('TaiKhoan');
    if (bv) {
        // Tăng lượt xem
        bv.LuotXem += 1;
        await bv.save();
        res.render('baiviet_chitiet', {
            title: bv.TieuDe,
            baiviet: bv
        });
    } else {
        res.redirect('/error');
    }
});
// GET: Đăng bài viết
router.get('/them', async (req, res) => {
    var cd = await ChuDe.find();
    res.render('thembaiviet', {
        title: 'Đăng bài viết',
        chude: cd
    });
});
// POST: Đăng bài viết
router.post('/them', async (req, res) => {
    if (req.session.MaNguoiDung) {
        var data = {
            ChuDe: req.body.MaChuDe,
            NguoiDung: req.body.MaNguoiDung,
            TieuDe: req.body.TieuDe,
            TomTat: req.body.TomTat,
            NoiDung: req.body.NoiDung,
        };
        await BaiViet.create(data);
        res.redirect('/baiviet');
    }else {
        req.session.error = 'Bạn phải đăng nhập để đăng bài viết';
        res.redirect('/error');
    }
});
// GET: Sửa bài viết
router.get('/sua/:id', async (req, res) => {
    var id = req.params.id;
    var bv = await BaiViet.findById(id).exec();
    var cd = await ChuDe.find();
    res.render('suabaiviet', {
        title: 'Sửa bài viết',
        baiviet: bv,
        ChuDe: cd
    });
});
// POST: Sửa bài viết
router.post('/sua/:id', async (req, res) => {
    var id = req.params.id;
    var data = {
        ChuDe: req.body.MaChuDe,
        TieuDe: req.body.TieuDe,
        TomTat: req.body.TomTat,
        NoiDung: req.body.NoiDung,
    };
    await BaiViet.findByIdAndUpdate(id, data);
    req.session.success = 'Đã cập nhật bài viết thành công và đang chờ kiểm duyệt';
    res.redirect('/success');
});
// GET: Xóa bài viết
router.get('/xoa/:id', async (req, res) => {
    var id = req.params.id;
    await BaiViet.findByIdAndDelete(id);
    req.session.success = 'Đã xóa bài viết thành công';

    // Chuyển hướng về trang trước đó hoặc trang chủ nếu không có trang trước đó
    res.redirect(req.get('referer') || '/');
});
// GET: Duyệt bài viết
router.get('/duyet/:id', async (req, res) => {
    var id = req.params.id;
    var bv = await BaiViet.find(id);
    await BaiViet.findByIdAndUpdate(id, { 'KiemDuyet': 1 - bv.KiemDuyet });

    //trở lại trang trước
    res.redirect(req.get('referer') || '/');
});
// GET: Danh sách bài viết của tôi
router.get('/cuatoi', async (req, res) => {
    if (req.session.MaNguoiDung) {
        var id = req.session.MaNguoiDung;
        var bv = await BaiViet.find({ MaNguoiDung: id })
            .populate('MaChuDe')   
            .populate('TaiKhoan');
        res.render('baivietcuatoi', { 
            title: 'Danh sách bài viết của tôi',
            baiviet: bv
        });
    }else {
        req.session.error = 'Bạn phải đăng nhập để xem bài viết của mình';
        res.redirect('/dangnhap');
    }
});
module.exports = router;
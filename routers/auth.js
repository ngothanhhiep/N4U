var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs');
var TaiKhoan = require('../models/taikhoan');
// GET: Đăng ký
router.get('/dangky', async (req, res) => {
    res.render('dangky', {
        title: 'Đăng ký tài khoản'
    });
});
// POST: Đăng ký
router.post('/dangky', async (req, res) => {
    var salt = bcrypt.genSaltSync(10);
    var data = {
        HoVaTen: req.body.HoVaTen,
        Email: req.body.Email,
        HinhAnh: req.body.HinhAnh,
        TenDangNhap: req.body.TenDangNhap,
        MatKhau: bcrypt.hashSync(req.body.MatKhau, salt)
    };
    await TaiKhoan.create(data);
    res.redirect('/dangnhap'); // Chuyển hướng đến trang đăng nhập sau khi đăng ký thành công
});
// GET: Đăng nhập
router.get('/dangnhap', async (req, res) => {
    res.render('dangnhap', {
        title: 'Đăng nhập'
    });
});
// POST: Đăng nhập
router.post('/dangnhap', async (req, res) => {
    if (req.session.MaNguoiDung) {
        req.session.error = 'Bạn đã đăng nhập rồi';
        res.redirect('/dangnhap');
        return;
    }
    var taikhoan = await TaiKhoan.findOne({ TenDangNhap: req.body.TenDangNhap }).exec();
    if (taikhoan) {
        if (bcrypt.compareSync(req.body.MatKhau, taikhoan.MatKhau)) {
            if (taikhoan.KichHoat === 0) {
                req.session.error = 'Tài khoản của bạn đã bị khóa';
                res.redirect('/dangnhap');
            } else {
                //đăng ký session   
                req.session.MaNguoiDung = taikhoan._id;
                req.session.HoVaTen = taikhoan.HoVaTen;
                req.session.QuyenHan = taikhoan.QuyenHan;
                res.redirect('/');
            } 
        } else {
            req.session.error = 'Sai mật khẩu';
            res.redirect('/dangnhap');
        }
    } else {
        req.session.error = 'Tài khoản không tồn tại';
        res.redirect('/dangnhap');
    }
});
// GET: Đăng xuất
router.get('/dangxuat', async (req, res) => {
    if (req.session.MaNguoiDung) {
        //xóa session
        delete req.session.MaNguoiDung;
        delete req.session.HoVaTen;
        delete req.session.QuyenHan;
        res.redirect('/');
    }else {
        req.session.error = 'Người dùng chưa đăng nhập';
        res.redirect('/dangnhap');
    }
});
module.exports = router;
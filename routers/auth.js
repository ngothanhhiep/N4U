var express = require('express');
var router = express.Router();
var bcrypt = require('bcryptjs'); // Khuyên dùng: bcrypt (thư viện gốc) nhanh hơn bcryptjs nếu có thể
var TaiKhoan = require('../models/taikhoan');
var upload = require('../modules/upload');
const { OAuth2Client } = require('google-auth-library');
const GOOGLE_CLIENT_ID = '827853340584-10aelbqsgulk9bf5b6el7p88a2u5o8r3.apps.googleusercontent.com';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);


// GET: Đăng ký
router.get('/dangky', async (req, res) => {
    res.render('dangky', {
        title: 'Đăng ký tài khoản',
        error: res.locals.error || null,
        success: res.locals.success || null
    });
});

// POST: Đăng ký
router.post('/dangky', upload.single('HinhAnh'), async (req, res) => {
    try {
        const { HoVaTen, Email, TenDangNhap, MatKhau } = req.body;

        // 1. Kiểm tra song song cả Tên đăng nhập và Email
        const existingUser = await TaiKhoan.findOne({
            $or: [{ TenDangNhap: TenDangNhap }, { Email: Email }]
        });

        if (existingUser) {
            req.session.error = existingUser.TenDangNhap === TenDangNhap 
                ? 'Tên đăng nhập này đã được sử dụng!' 
                : 'Email này đã được đăng ký!';
            return res.redirect('/dangky');
        }

        // 2. Mã hóa mật khẩu (Sử dụng async để tối ưu hiệu năng)
        const salt = await bcrypt.genSalt(10);
        const hashedMatKhau = await bcrypt.hash(MatKhau, salt);
        
        // 3. Chuẩn bị dữ liệu
        const data = {
            HoVaTen: HoVaTen,
            Email: Email,
            TenDangNhap: TenDangNhap,
            MatKhau: hashedMatKhau,
            // Sử dụng ảnh mặc định từ Model nếu không upload, 
            // nhưng ở đây ta gán thủ công để kiểm soát CloudinaryId
            HinhAnh: req.file ? req.file.path : '/images/default-avatar.png',
            CloudinaryId: req.file ? req.file.filename : null,
            LoaiDangNhap: 'local'
        };

        await TaiKhoan.create(data);
        
        req.session.success = "Đăng ký thành công! Hãy đăng nhập.";
        res.redirect('/dangnhap'); 

    } catch (error) {
        console.error("Lỗi đăng ký:", error);
        req.session.error = "Lỗi hệ thống: " + error.message;
        res.redirect('/dangky');
    }
});

// GET: Đăng nhập
router.get('/dangnhap', (req, res) => {
    if (req.session.MaNguoiDung) return res.redirect('/');

    res.render('dangnhap', {
        title: 'Đăng nhập',
        error: res.locals.error || null,
        success: res.locals.success || null
    });
});

// POST: Đăng nhập
router.post('/dangnhap', async (req, res) => {
    try {
        const TenDangNhap = (req.body.TenDangNhap || '').trim();
        const MatKhau = req.body.MatKhau || '';

        if (!TenDangNhap || !MatKhau) {
            req.session.error = 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu';
            return res.redirect(303, '/dangnhap');
        }

        // Hỗ trợ đăng nhập bằng tên đăng nhập hoặc email
        const taikhoan = await TaiKhoan.findOne({
            $or: [
                { TenDangNhap: TenDangNhap },
                { Email: TenDangNhap.toLowerCase() }
            ]
        });

        if (!taikhoan) {
            req.session.error = 'Tên đăng nhập hoặc mật khẩu không chính xác';
            return res.redirect(303, '/dangnhap');
        }

        if (taikhoan.KichHoat === 0) {
            req.session.error = 'Tài khoản của bạn đã bị khóa';
            return res.redirect(303, '/dangnhap');
        }

        let isMatch = false;
        if (taikhoan.MatKhau) {
            if (taikhoan.MatKhau.startsWith('$2')) {
                isMatch = await bcrypt.compare(MatKhau, taikhoan.MatKhau);
            } else {
                // Hỗ trợ dữ liệu cũ nếu trước đây mật khẩu được lưu dạng thường
                isMatch = MatKhau === taikhoan.MatKhau;

                if (isMatch) {
                    const salt = await bcrypt.genSalt(10);
                    taikhoan.MatKhau = await bcrypt.hash(MatKhau, salt);
                    await taikhoan.save();
                }
            }
        }

        if (!isMatch) {
            req.session.error = 'Tên đăng nhập hoặc mật khẩu không chính xác';
            return res.redirect(303, '/dangnhap');
        }

        req.session.MaNguoiDung = taikhoan._id;
        req.session._id = taikhoan._id;         // THÊM DÒNG NÀY ĐỂ NAVBAR KHÔNG BỊ UNDEFINED
        req.session.HoVaTen = taikhoan.HoVaTen;
        req.session.QuyenHan = taikhoan.QuyenHan;
        req.session.HinhAnh = taikhoan.HinhAnh;

        req.session.save((err) => {
            if (err) {
                console.error('Lỗi lưu session:', err);
                req.session.error = 'Không thể tạo phiên đăng nhập';
                return res.redirect(303, '/dangnhap');
            }

            return res.redirect(303, '/');
        });
    } catch (error) {
        console.error('--- Login Error:', error);
        req.session.error = 'Lỗi server khi đăng nhập';
        return res.redirect(303, '/dangnhap');
    }
});

// POST: Đăng nhập bằng Google
router.post('/dangnhap/google', async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            req.session.error = 'Không nhận được token từ Google.';
            return res.redirect('/dangnhap');
        }

        // Xác thực token với Google
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const { sub: googleId, email, name, picture } = payload;

        // Tìm tài khoản theo GoogleId hoặc Email
        let taikhoan = await TaiKhoan.findOne({
            $or: [{ GoogleId: googleId }, { Email: email }]
        });

        if (taikhoan) {
            // Nếu đăng ký bằng local trước đó → liên kết GoogleId
            if (!taikhoan.GoogleId) {
                taikhoan.GoogleId = googleId;
                taikhoan.LoaiDangNhap = 'google';
                if (!taikhoan.HinhAnh || taikhoan.HinhAnh === '/images/default-avatar.png') {
                    taikhoan.HinhAnh = picture;
                }
                await taikhoan.save();
            }
        } else {
            // Tạo tài khoản mới từ Google
            taikhoan = await TaiKhoan.create({
                HoVaTen: name,
                Email: email,
                GoogleId: googleId,
                HinhAnh: picture || '/images/default-avatar.png',
                LoaiDangNhap: 'google',
                QuyenHan: 'user',
                KichHoat: 1
            });
        }

        if (taikhoan.KichHoat === 0) {
            req.session.error = 'Tài khoản của bạn đã bị khóa.';
            return res.redirect('/dangnhap');
        }

        req.session.MaNguoiDung = taikhoan._id;
        req.session._id = taikhoan._id;
        req.session.HoVaTen = taikhoan.HoVaTen;
        req.session.QuyenHan = taikhoan.QuyenHan;
        req.session.HinhAnh = taikhoan.HinhAnh;

        req.session.save((err) => {
            if (err) {
                req.session.error = 'Không thể tạo phiên đăng nhập.';
                return res.redirect('/dangnhap');
            }
            return res.redirect('/');
        });
    } catch (error) {
        console.error('Lỗi đăng nhập Google:', error);
        req.session.error = 'Đăng nhập bằng Google thất bại. Vui lòng thử lại.';
        return res.redirect('/dangnhap');
    }
});

// GET: Đăng xuất
router.get('/dangxuat', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log("Lỗi đăng xuất:", err);
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); // Tên cookie mặc định của express-session
        res.redirect('/dangnhap');
    });
});

module.exports = router;
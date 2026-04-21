const express = require('express')
const app = express()
const port = 4000;

var indexRouter = require('./routers/index');
var chudeRouter = require('./routers/chude');
var taikhoanRouter = require('./routers/taikhoan');
var baivietRouter = require('./routers/baiviet');
var authRouter = require('./routers/auth');
var binhluanRouter = require('./routers/binhluan');
var quangcaoRouter = require('./routers/quangcao');
var reportRouter = require('./routers/report');
var videoRouter = require('./routers/video');
var ChuDe = require('./models/chude');

var mongoose = require('mongoose');
var session = require('express-session');
var path = require('path');
var uri = 'mongodb://user:user123456@ac-dfhjs7r-shard-00-01.kyxw2pa.mongodb.net:27017/NimbleNewNowNetworkForYou?ssl=true&authSource=admin';
mongoose.connect(uri)
  .then(() => console.log('Đã kết nối thành công tới MongoDB.'))
  .catch(err => console.log(err));

app.set('views', './views');
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  name: 'iNews', // Tên session (tự chọn)
  secret: 'DTH215906Hiep', // Khóa bảo vệ (tự chọn)
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 14 * 24 * 60 * 60 * 1000 // Hết hạn sau 30 ngày
  }
}));
app.use((req, res, next) => {
  // Chuyển biến session thành biến cục bộ cho tất cả view
  res.locals.session = req.session;
  res.locals.error = req.session.error || null;
  res.locals.success = req.session.success || null;

  // Xóa thông báo sau khi đã chuyển sang res.locals
  delete req.session.error;
  delete req.session.success;

  next();
});

app.use(async (req, res, next) => {
  try {
    res.locals.footerChude = await ChuDe.find().sort({ TenChuDe: 1 });
  } catch (err) {
    console.error('Lỗi tải chủ đề cho footer:', err.message);
    res.locals.footerChude = [];
  }

  next();
});


app.use('/', indexRouter);
app.use('/chude', chudeRouter);
app.use('/taikhoan', taikhoanRouter);
app.use('/baiviet', baivietRouter);
app.use('/binhluan', binhluanRouter);
app.use('/quangcao', quangcaoRouter);
app.use('/report', reportRouter);
app.use('/video', videoRouter);
app.use('/', authRouter);
app.use('/', express.static(path.join(__dirname, 'public')));


app.get('/', (req, res) => {
  res.render('index', {
    title: 'Trang chủ'
  });
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

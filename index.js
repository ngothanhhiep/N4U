const express = require('express')
const app = express()
const port = 3000;

var indexRouter = require('./routers/index');
var chudeRouter = require('./routers/chude');
var taikhoanRouter = require('./routers/taikhoan');
var baivietRouter = require('./routers/baiviet');
var authRouter = require('./routers/auth');

var mongoose = require('mongoose');
var session = require('express-session');
var path = require('path');
var uri = 'mongodb://user:user123456@ac-dfhjs7r-shard-00-01.kyxw2pa.mongodb.net:27017/trangtin?ssl=true&authSource=admin';
mongoose.connect(uri)
  .then(() => console.log('Đã kết nối thành công tới MongoDB.'))
  .catch(err => console.log(err));

app.set('views', './views');
app.set('view engine', 'ejs');
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  name: 'iNews', // Tên session (tự chọn)
  secret: 'Mèo méo meo mèo meo', // Khóa bảo vệ (tự chọn)
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000 // Hết hạn sau 30 ngày
  }
}));
app.use((req, res, next) => {
  // Chuyển biến session thành biến cục bộ
  res.locals.session = req.session;

  // Lấy thông báo (lỗi, thành công) của trang trước đó (nếu có)
  var err = req.session.error;
  var msg = req.session.success;

  // Xóa session sau khi đã truyền qua biến trung gian
  delete req.session.error;
  delete req.session.success;

  // Gán thông báo (lỗi, thành công) vào biến cục bộ
  res.locals.message = '';
  if (err) res.locals.message = '<span class="text-danger">' + err + '</span>';
  if (msg) res.locals.message = '<span class="text-success">' + msg + '</span>';

  next();
});


app.use('/', indexRouter);
app.use('/chude', chudeRouter);
app.use('/taikhoan', taikhoanRouter);
app.use('/baiviet', baivietRouter);
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

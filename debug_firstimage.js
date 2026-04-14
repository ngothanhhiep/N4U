const mongoose = require('mongoose');
const BaiViet = require('./models/baiviet');
const firstImage = require('./modules/firstimage');
const uri = 'mongodb://user:user123456@ac-dfhjs7r-shard-00-01.kyxw2pa.mongodb.net:27017/NimbleNewNowNetworkForYou?ssl=true&authSource=admin';

(async () => {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const doc = await BaiViet.findOne({ KiemDuyet: 1 }).lean();
    console.log('found', !!doc);
    if (!doc) return process.exit(0);
    console.log('NoiDung first 400 chars:');
    console.log(doc.NoiDung ? doc.NoiDung.slice(0, 400) : 'NONE');
    console.log('firstImage =>', firstImage(doc.NoiDung || ''));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
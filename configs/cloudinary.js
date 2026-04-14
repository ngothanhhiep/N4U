const cloudinary = require('cloudinary').v2;

cloudinary.config({ 
  cloud_name: 'dzxouue97', 
  api_key: '951886932763846', 
  api_secret: 'pZJlfetoiIpuwhxyS_Gouv_7we0' 
});

module.exports = cloudinary; // Xuất trực tiếp đối tượng cloudinary đã cấu hình
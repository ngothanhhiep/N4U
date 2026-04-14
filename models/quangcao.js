var mongoose = require('mongoose');

var quangCaoSchema = new mongoose.Schema({
    TenQuangCao: { type: String, required: true, trim: true },
    HinhAnh: { type: String, default: '' },
    CloudinaryId: { type: String, default: null },
    LinkQuangCao: { type: String, default: '' }
}, {
    timestamps: true
});

var quangCaoModel = mongoose.model('QuangCao', quangCaoSchema);
module.exports = quangCaoModel;

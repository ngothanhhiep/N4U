function decodeHtmlEntities(value) {
	if (!value || typeof value !== 'string') {
		return '';
	}

	return value
		.replace(/&amp;/gi, '&')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>');
}

function firstImage(noiDung) {
	if (!noiDung || typeof noiDung !== 'string') {
		return '/images/noimage.png';
	}

	var image = '/images/noimage.png';
	var imgTagRegExp = /<img\b[^>]*>/gi;
	var srcRegExp = /\b(?:src|data-src|data-cke-saved-src)\s*=\s*["']?([^"'\s>]+)["']?/i;
	var imgTagMatch;

	while ((imgTagMatch = imgTagRegExp.exec(noiDung)) !== null) {
		var tag = imgTagMatch[0];
		var srcMatch = srcRegExp.exec(tag);

		if (srcMatch && srcMatch[1]) {
			var cleaned = decodeHtmlEntities(srcMatch[1].trim());
			if (cleaned) {
				image = cleaned;
				break;
			}
		}
	}

	return image;
}

module.exports = firstImage;
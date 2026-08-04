const DEFAULT_COVER_IMAGE = '/img/m48a5_patton_cn.jpg';
const MAX_COVER_IMAGE_LENGTH = 1900000;

function hasExpectedSignature(buffer, mimeType) {
  if (mimeType === 'image/png') {
    return buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3
      && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/webp') {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
      && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}

function validateCoverImage(value) {
  const coverImage = String(value || '').trim();
  if (!coverImage) return { error: '请先从本地选择一张封面图片' };
  if (coverImage.length > MAX_COVER_IMAGE_LENGTH) {
    return { error: '封面图片处理后仍然过大，请选择尺寸更小的图片' };
  }

  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/]+={0,2})$/i.exec(coverImage);
  if (!match) return { error: '封面必须是从本地上传的 JPG、PNG 或 WebP 图片' };

  try {
    const bytes = Buffer.from(match[2], 'base64');
    if (!hasExpectedSignature(bytes, match[1].toLowerCase())) {
      return { error: '无法识别这张图片，请重新选择' };
    }
  } catch {
    return { error: '无法读取这张图片，请重新选择' };
  }

  return { coverImage };
}

function publicSiteSettings(record) {
  const storedCover = String(record?.coverImage || '').trim();
  if (!storedCover) {
    return { coverImage: DEFAULT_COVER_IMAGE, isDefault: true };
  }
  const validation = validateCoverImage(storedCover);
  if (validation.error) {
    return { coverImage: DEFAULT_COVER_IMAGE, isDefault: true };
  }
  return { coverImage: validation.coverImage, isDefault: false };
}

module.exports = {
  DEFAULT_COVER_IMAGE,
  MAX_COVER_IMAGE_LENGTH,
  publicSiteSettings,
  validateCoverImage
};

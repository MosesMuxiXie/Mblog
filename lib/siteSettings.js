const DEFAULT_COVER_IMAGE = '/img/m48a5_patton_cn.jpg';
const MAX_COVER_IMAGE_LENGTH = 1900000;
const MAX_PAGE_BACKGROUND_LENGTH = 360000;
const MAX_TOTAL_PAGE_BACKGROUNDS_LENGTH = 2000000;
const MAX_EXTRA_HOMEPAGE_PAGES = 8;
const DEFAULT_HOMEPAGE_LAYOUT = Object.freeze({
  accent: '#c6ef46',
  hero: Object.freeze({
    titleX: 50,
    titleY: 50,
    titleScale: 100,
    imageX: 54,
    imageY: 50,
    overlay: 66
  }),
  content: Object.freeze({
    cardWidth: 960,
    cards: Object.freeze({
      who: Object.freeze({ x: 42, y: 50, backgroundImage: '', imageX: 50, imageY: 50, overlay: 78 }),
      features: Object.freeze({ x: 58, y: 50, backgroundImage: '', imageX: 50, imageY: 50, overlay: 78 }),
      contact: Object.freeze({ x: 42, y: 50, backgroundImage: '', imageX: 50, imageY: 50, overlay: 78 }),
      support: Object.freeze({ x: 42, y: 50, backgroundImage: '', imageX: 50, imageY: 50, overlay: 78 })
    }),
    extraPages: Object.freeze([])
  })
});

function numberInRange(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.round(Math.min(max, Math.max(min, number)) * 10) / 10;
}

function defaultHomepageLayout() {
  return JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_LAYOUT));
}

function validatePageBackground(value) {
  const backgroundImage = String(value || '').trim();
  if (!backgroundImage) return { backgroundImage: '' };
  if (backgroundImage.startsWith('/') && !backgroundImage.startsWith('//') && backgroundImage.length <= 300) {
    return { backgroundImage };
  }
  if (backgroundImage.length > MAX_PAGE_BACKGROUND_LENGTH) {
    return { error: '单张页面背景图过大，请重新选择' };
  }
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([a-z0-9+/]+={0,2})$/i.exec(backgroundImage);
  if (!match) return { error: '页面背景必须是从本地上传的 JPG、PNG 或 WebP 图片' };
  try {
    const bytes = Buffer.from(match[2], 'base64');
    if (!hasExpectedSignature(bytes, match[1].toLowerCase())) {
      return { error: '无法识别页面背景图，请重新选择' };
    }
  } catch {
    return { error: '无法读取页面背景图' };
  }
  return { backgroundImage };
}

function normalizePageVisual(input, fallback) {
  const background = validatePageBackground(input.backgroundImage);
  if (background.error) return background;
  return {
    page: {
      x: numberInRange(input.x, fallback.x, 12, 88),
      y: numberInRange(input.y, fallback.y, 18, 82),
      backgroundImage: background.backgroundImage,
      imageX: numberInRange(input.imageX, 50, 0, 100),
      imageY: numberInRange(input.imageY, 50, 0, 100),
      overlay: numberInRange(input.overlay, 78, 20, 95)
    }
  };
}

function validateHomepageLayout(value) {
  if (value === undefined || value === null) return { layout: defaultHomepageLayout() };
  if (typeof value !== 'object' || Array.isArray(value)) {
    return { error: '主页布局格式不正确' };
  }

  const defaults = DEFAULT_HOMEPAGE_LAYOUT;
  const accent = String(value.accent || defaults.accent).trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(accent)) {
    return { error: '主题色必须是有效的六位十六进制颜色' };
  }

  const hero = value.hero && typeof value.hero === 'object' ? value.hero : {};
  const content = value.content && typeof value.content === 'object' ? value.content : {};
  const inputCards = content.cards && typeof content.cards === 'object' ? content.cards : {};
  const cards = {};
  let totalBackgroundLength = 0;
  Object.keys(defaults.content.cards).forEach(id => {
    const input = inputCards[id] && typeof inputCards[id] === 'object' ? inputCards[id] : {};
    const fallback = defaults.content.cards[id];
    const normalized = normalizePageVisual(input, fallback);
    if (normalized.error) cards.error = normalized.error;
    else {
      cards[id] = normalized.page;
      totalBackgroundLength += normalized.page.backgroundImage.length;
    }
  });
  if (cards.error) return { error: cards.error };

  const inputExtraPages = Array.isArray(content.extraPages) ? content.extraPages : [];
  if (inputExtraPages.length > MAX_EXTRA_HOMEPAGE_PAGES) {
    return { error: `最多可以新增 ${MAX_EXTRA_HOMEPAGE_PAGES} 个滚动页` };
  }
  const usedIds = new Set();
  const extraPages = [];
  for (let index = 0; index < inputExtraPages.length; index += 1) {
    const input = inputExtraPages[index] && typeof inputExtraPages[index] === 'object'
      ? inputExtraPages[index]
      : {};
    const id = String(input.id || '').trim().toLowerCase();
    if (!/^custom-[a-z0-9-]{4,48}$/.test(id) || usedIds.has(id)) {
      return { error: '新增滚动页的编号无效' };
    }
    usedIds.add(id);
    const fallback = { x: index % 2 ? 58 : 42, y: 50 };
    const normalized = normalizePageVisual(input, fallback);
    if (normalized.error) return { error: normalized.error };
    totalBackgroundLength += normalized.page.backgroundImage.length;
    extraPages.push({
      id,
      label: String(input.label || `PAGE / ${String(index + 5).padStart(2, '0')}`).trim().slice(0, 48),
      title: String(input.title || '新页面标题').trim().slice(0, 120),
      body: String(input.body || '在创作者模式中编辑这个页面的内容。').trim().slice(0, 1000),
      ...normalized.page
    });
  }
  if (totalBackgroundLength > MAX_TOTAL_PAGE_BACKGROUNDS_LENGTH) {
    return { error: '所有滚动页的背景图总大小过大，请移除部分图片或使用尺寸更小的图片' };
  }

  return {
    layout: {
      accent,
      hero: {
        titleX: numberInRange(hero.titleX, defaults.hero.titleX, 12, 88),
        titleY: numberInRange(hero.titleY, defaults.hero.titleY, 18, 82),
        titleScale: numberInRange(hero.titleScale, defaults.hero.titleScale, 55, 145),
        imageX: numberInRange(hero.imageX, defaults.hero.imageX, 0, 100),
        imageY: numberInRange(hero.imageY, defaults.hero.imageY, 0, 100),
        overlay: numberInRange(hero.overlay, defaults.hero.overlay, 20, 90)
      },
      content: {
        cardWidth: numberInRange(content.cardWidth, defaults.content.cardWidth, 520, 1120),
        cards,
        extraPages
      }
    }
  };
}

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
  const layout = validateHomepageLayout(record?.layout).layout || defaultHomepageLayout();
  if (!storedCover) {
    return { coverImage: DEFAULT_COVER_IMAGE, isDefault: true, layout };
  }
  const validation = validateCoverImage(storedCover);
  if (validation.error) {
    return { coverImage: DEFAULT_COVER_IMAGE, isDefault: true, layout };
  }
  return { coverImage: validation.coverImage, isDefault: false, layout };
}

module.exports = {
  DEFAULT_COVER_IMAGE,
  DEFAULT_HOMEPAGE_LAYOUT,
  MAX_EXTRA_HOMEPAGE_PAGES,
  MAX_COVER_IMAGE_LENGTH,
  MAX_PAGE_BACKGROUND_LENGTH,
  defaultHomepageLayout,
  publicSiteSettings,
  validateCoverImage,
  validateHomepageLayout
};

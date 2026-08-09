const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_COVER_IMAGE,
  DEFAULT_HOMEPAGE_LAYOUT,
  publicSiteSettings,
  validateCoverImage,
  validateHomepageLayout
} = require('../lib/siteSettings');

const ONE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

test('accepts a real locally uploaded cover image data URL', () => {
  const result = validateCoverImage(ONE_PIXEL_PNG);
  assert.equal(result.error, undefined);
  assert.equal(result.coverImage, ONE_PIXEL_PNG);
});

test('rejects remote URLs and spoofed image data', () => {
  assert.match(validateCoverImage('https://example.com/cover.jpg').error, /本地上传/);
  assert.match(validateCoverImage('data:image/png;base64,SGVsbG8=').error, /无法识别/);
});

test('returns the bundled homepage cover when no valid custom setting exists', () => {
  assert.deepEqual(publicSiteSettings(null), {
    coverImage: DEFAULT_COVER_IMAGE,
    isDefault: true,
    layout: DEFAULT_HOMEPAGE_LAYOUT
  });
  assert.deepEqual(publicSiteSettings({ coverImage: 'invalid' }), {
    coverImage: DEFAULT_COVER_IMAGE,
    isDefault: true,
    layout: DEFAULT_HOMEPAGE_LAYOUT
  });
});

test('publishes a valid custom homepage cover', () => {
  assert.deepEqual(publicSiteSettings({ coverImage: ONE_PIXEL_PNG }), {
    coverImage: ONE_PIXEL_PNG,
    isDefault: false,
    layout: DEFAULT_HOMEPAGE_LAYOUT
  });
});

test('normalizes homepage creator layout into safe visual bounds', () => {
  const result = validateHomepageLayout({
    accent: '#123abc',
    hero: { titleX: 999, titleY: -4, titleScale: 120, imageX: 35, overlay: 55 },
    content: { cardWidth: 840, cards: { who: { x: 31, y: 64 } } }
  });

  assert.equal(result.error, undefined);
  assert.equal(result.layout.accent, '#123abc');
  assert.deepEqual(result.layout.hero, {
    titleX: 88,
    titleY: 18,
    titleScale: 120,
    imageX: 35,
    imageY: 50,
    overlay: 55
  });
  assert.deepEqual(result.layout.content.cards.who, {
    x: 31,
    y: 64,
    backgroundImage: '',
    imageX: 50,
    imageY: 50,
    overlay: 78
  });
  assert.deepEqual(result.layout.content.cards.features, {
    x: 58,
    y: 50,
    backgroundImage: '',
    imageX: 50,
    imageY: 50,
    overlay: 78
  });
});

test('rejects malformed homepage creator colors', () => {
  assert.match(validateHomepageLayout({ accent: 'red' }).error, /主题色/);
});

test('publishes per-page backgrounds and additional scroll pages', () => {
  const result = validateHomepageLayout({
    content: {
      cards: { who: { backgroundImage: ONE_PIXEL_PNG, imageX: 24, imageY: 68, overlay: 72 } },
      extraPages: [{
        id: 'custom-about-more',
        label: 'PAGE / 05',
        title: '更多内容',
        body: '这是新增的整屏滚动页。',
        backgroundImage: ONE_PIXEL_PNG,
        x: 57,
        y: 46
      }]
    }
  });

  assert.equal(result.error, undefined);
  assert.equal(result.layout.content.cards.who.backgroundImage, ONE_PIXEL_PNG);
  assert.equal(result.layout.content.cards.who.imageX, 24);
  assert.deepEqual(result.layout.content.extraPages[0], {
    id: 'custom-about-more',
    label: 'PAGE / 05',
    title: '更多内容',
    body: '这是新增的整屏滚动页。',
    x: 57,
    y: 46,
    backgroundImage: ONE_PIXEL_PNG,
    imageX: 50,
    imageY: 50,
    overlay: 78
  });
});

test('rejects unsafe page background data and invalid extra page ids', () => {
  assert.match(validateHomepageLayout({
    content: { cards: { who: { backgroundImage: 'data:image/png;base64,SGVsbG8=' } } }
  }).error, /无法识别/);
  assert.match(validateHomepageLayout({
    content: { extraPages: [{ id: '<script>', title: 'x', body: 'y' }] }
  }).error, /编号无效/);
});

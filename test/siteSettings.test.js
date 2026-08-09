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
  assert.deepEqual(result.layout.content.cards.who, { x: 31, y: 64 });
  assert.deepEqual(result.layout.content.cards.features, { x: 58, y: 50 });
});

test('rejects malformed homepage creator colors', () => {
  assert.match(validateHomepageLayout({ accent: 'red' }).error, /主题色/);
});

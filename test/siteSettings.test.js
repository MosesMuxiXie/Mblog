const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_COVER_IMAGE,
  publicSiteSettings,
  validateCoverImage
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
    isDefault: true
  });
  assert.deepEqual(publicSiteSettings({ coverImage: 'invalid' }), {
    coverImage: DEFAULT_COVER_IMAGE,
    isDefault: true
  });
});

test('publishes a valid custom homepage cover', () => {
  assert.deepEqual(publicSiteSettings({ coverImage: ONE_PIXEL_PNG }), {
    coverImage: ONE_PIXEL_PNG,
    isDefault: false
  });
});

const test = require('node:test');
const assert = require('node:assert/strict');

const { htmlToText, sanitizeBlogHtml } = require('../lib/blogContent');
const { optionalImage, validateBlog } = require('../api/blogs/index');

test('keeps the curated insert designs and table structure', () => {
  const input = `
    <div class="insert-card insert-card-tip unknown" onclick="alert(1)">
      <strong>小提示</strong><p>正文</p>
    </div>
    <table class="insert-table"><thead><tr><th>标题</th></tr></thead>
      <tbody><tr><td>内容</td></tr></tbody></table>`;

  const output = sanitizeBlogHtml(input);

  assert.match(output, /class="insert-card insert-card-tip"/);
  assert.match(output, /<table class="insert-table">/);
  assert.match(output, /<thead><tr><th>标题<\/th><\/tr><\/thead>/);
  assert.doesNotMatch(output, /onclick|unknown/);
  assert.match(htmlToText(output), /标题\s+内容/);
});

test('keeps small approved attachment data links with a safe download name', () => {
  const input = '<a class="insert-attachment" href="data:application/pdf;base64,SGVsbG8=" download="说明.pdf"><span class="insert-attachment-icon">PDF</span><small>5 B</small></a>';

  const output = sanitizeBlogHtml(input);

  assert.match(output, /href="data:application\/pdf;base64,SGVsbG8="/);
  assert.match(output, /download="说明.pdf"/);
  assert.match(output, /class="insert-attachment-icon"/);
  assert.match(output, /<small>5 B<\/small>/);
});

test('rejects executable data links and unsafe attachment filenames', () => {
  const input = '<a class="insert-attachment" href="data:text/html;base64,PHNjcmlwdD4=" download="bad.html">下载</a>';

  const output = sanitizeBlogHtml(input);

  assert.equal(output, '<a class="insert-attachment">下载</a>');
});

test('rejects an article body that exceeds the stored rich-content limit', () => {
  const result = validateBlog({
    title: '标题',
    slug: 'oversized-post',
    content: '正文',
    contentHtml: `<p>${'x'.repeat(2000000)}</p>`
  });

  assert.match(result.error, /图片或附件太多/);
});

test('keeps the featured image optional instead of assigning a default image', () => {
  const result = validateBlog({
    title: '无图文章',
    slug: 'text-only-post',
    content: '这是一篇没有特色图片的文章。'
  });

  assert.equal(result.blog.image, '');
  assert.equal(optionalImage('/img/default.jpg'), '');
});

const byId = id => document.getElementById(id);
const contentEditor = byId('content-editor');
let adminStatus = null;
let posts = [];
let editorDirty = false;
let slugTouched = false;
let savedSelection = null;

const DEFAULT_EMOJIS = [
  '😀', '😄', '😂', '🥹', '😍', '🤔', '😎',
  '👍', '👏', '🙏', '💪', '🎉', '❤️', '🔥',
  '✨', '💡', '📌', '✅', '⚠️', '🚀', '🌿'
];
const INSERT_SYMBOLS = ['©', '®', '™', '°', '±', '×', '÷', '≠', '≈', '≤', '≥', '∞', '√', '∑', 'π', 'Ω'];
const CUSTOM_EMOJI_STORAGE_KEY = 'mosankai-blog-custom-emojis';
const ATTACHMENT_TYPES = new Map([
  ['pdf', 'application/pdf'],
  ['txt', 'text/plain'],
  ['csv', 'text/csv'],
  ['doc', 'application/msword'],
  ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  ['xls', 'application/vnd.ms-excel'],
  ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ['ppt', 'application/vnd.ms-powerpoint'],
  ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  ['zip', 'application/zip']
]);

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.location.replace('/blog/admin');
    const error = new Error(payload?.error || '请求失败，请稍后重试');
    error.status = response.status;
    throw error;
  }
  return payload;
}

function escapeHtml(value) {
  const node = document.createElement('span');
  node.textContent = String(value || '');
  return node.innerHTML;
}

function readCustomEmojis() {
  try {
    const value = JSON.parse(localStorage.getItem(CUSTOM_EMOJI_STORAGE_KEY) || '[]');
    return Array.isArray(value)
      ? value.map(item => String(item || '').trim()).filter(Boolean).slice(0, 28)
      : [];
  } catch {
    return [];
  }
}

function saveCustomEmojis(emojis) {
  localStorage.setItem(CUSTOM_EMOJI_STORAGE_KEY, JSON.stringify(emojis.slice(0, 28)));
}

function renderEmojiGrid(containerId, emojis) {
  const container = byId(containerId);
  container.replaceChildren();
  emojis.forEach(emoji => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.emoji = emoji;
    button.title = `插入 ${emoji}`;
    button.setAttribute('aria-label', `插入表情 ${emoji}`);
    button.textContent = emoji;
    container.append(button);
  });
}

function renderCustomEmojis() {
  const emojis = readCustomEmojis();
  renderEmojiGrid('custom-emoji-grid', emojis);
  byId('custom-emoji-area').classList.toggle('hidden', !emojis.length);
}

function safeImage(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '/img/default.jpg';
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(candidate)) {
    return candidate;
  }
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate;
  try {
    const parsed = new URL(candidate);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '/img/default.jpg';
  } catch {
    return '/img/default.jpg';
  }
}

function setMessage(id, text = '', type = '') {
  const element = byId(id);
  element.textContent = text;
  element.className = `form-message ${type}`.trim();
}

function showStudioMessage(text, type = '') {
  const element = byId('editor-message');
  element.textContent = text;
  element.className = `studio-message visible ${type}`.trim();
  window.clearTimeout(showStudioMessage.timer);
  showStudioMessage.timer = window.setTimeout(() => {
    element.classList.remove('visible');
  }, 4200);
}

function setAccount(username) {
  const name = String(username || 'Admin');
  byId('account-name').textContent = name;
  byId('account-avatar').textContent = (name[0] || 'A').toUpperCase();
  byId('new-username').value = name;
}

function closeMenu() {
  document.querySelector('.dashboard-sidebar').classList.remove('open');
  byId('sidebar-scrim').classList.remove('open');
}

function closeStudioPanels() {
  byId('block-library').classList.remove('mobile-open');
  byId('post-settings').classList.remove('mobile-open');
}

function switchLibraryTab(tabName) {
  const insertActive = tabName === 'insert';
  byId('blocks-library-panel').classList.toggle('hidden', insertActive);
  byId('insert-library-panel').classList.toggle('hidden', !insertActive);
  document.querySelectorAll('[data-library-tab]').forEach(tab => {
    const active = tab.dataset.libraryTab === tabName;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
}

function showPanel(panelId) {
  document.querySelectorAll('.dashboard-panel').forEach(panel => {
    panel.classList.toggle('hidden', panel.id !== panelId);
  });
  document.querySelectorAll('.side-nav-item[data-panel]').forEach(button => {
    button.classList.toggle('active', button.dataset.panel === panelId);
  });

  const editorMode = panelId === 'editor-panel';
  document.body.classList.toggle('editor-mode', editorMode);
  const headings = {
    'posts-panel': '文章管理',
    'account-panel': '账号安全'
  };
  if (!editorMode) byId('page-heading').textContent = headings[panelId] || '博客后台';
  closeMenu();
  closeStudioPanels();
}

function normalizeSlug(value) {
  return String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLocaleLowerCase('en-US');
}

function suggestedSlug(title) {
  return normalizeSlug(title)
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .slice(0, 80);
}

function updateSlugPreview() {
  const slug = normalizeSlug(byId('slug').value);
  byId('slug-preview').textContent = slug || '…';
}

function updateFeaturedImagePreview(value) {
  const image = String(value || '').trim();
  const preview = byId('featured-image-preview');
  const previewImage = preview.querySelector('img');
  byId('image').value = image;
  preview.classList.toggle('empty', !image);
  previewImage.src = image ? safeImage(image) : '';
  byId('remove-featured-image').classList.toggle('hidden', !image);
}

function fileDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')));
    reader.addEventListener('error', () => reject(new Error('无法读取这张图片')));
    reader.readAsDataURL(file);
  });
}

function loadImageSource(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('无法解析这张图片')));
    image.src = source;
  });
}

async function optimizedFeaturedImage(file) {
  const allowed = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
  if (!allowed.includes(file.type)) throw new Error('请选择 JPG、PNG、GIF 或 WebP 图片');
  if (file.size > 8 * 1024 * 1024) throw new Error('原始图片不能超过 8 MB');

  const source = await fileDataUrl(file);
  if (file.type === 'image/gif') {
    if (source.length > 1500000) throw new Error('GIF 图片过大，请压缩到约 1 MB 后再上传');
    return source;
  }

  const image = await loadImageSource(source);
  const firstScale = Math.min(1, 1600 / image.naturalWidth, 1000 / image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * firstScale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * firstScale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  let output = canvas.toDataURL('image/webp', .82);

  if (output.length > 1500000) {
    const secondScale = Math.min(1, 1200 / canvas.width, 750 / canvas.height);
    const smaller = document.createElement('canvas');
    smaller.width = Math.max(1, Math.round(canvas.width * secondScale));
    smaller.height = Math.max(1, Math.round(canvas.height * secondScale));
    smaller.getContext('2d').drawImage(canvas, 0, 0, smaller.width, smaller.height);
    output = smaller.toDataURL('image/webp', .7);
  }
  if (output.length > 1700000) throw new Error('图片处理后仍然过大，请换一张尺寸更小的图片');
  return output;
}

function resizeTitle() {
  const title = byId('title');
  title.style.height = 'auto';
  title.style.height = `${Math.max(58, title.scrollHeight)}px`;
}

function updateDocumentState() {
  const title = byId('title').value.trim();
  byId('studio-document-title').textContent = title || '未命名文章';
  if (!byId('editing-id').value) {
    byId('studio-save-state').textContent = editorDirty ? '新文章 · 尚未发布' : '新文章';
  } else {
    byId('studio-save-state').textContent = editorDirty ? '有未保存的修改' : '已同步到博客';
  }
}

function resetEditor() {
  byId('blog-form').reset();
  byId('editing-id').value = '';
  byId('author').value = adminStatus?.username || 'Admin';
  byId('editing-status').textContent = '草稿';
  byId('publish-button').textContent = '发布';
  byId('view-post-button').classList.add('hidden');
  contentEditor.innerHTML = '';
  updateFeaturedImagePreview('');
  byId('block-library').classList.remove('collapsed');
  byId('post-settings').classList.remove('collapsed');
  switchLibraryTab('blocks');
  byId('symbol-picker').classList.add('hidden');
  editorDirty = false;
  slugTouched = false;
  savedSelection = null;
  updateSlugPreview();
  resizeTitle();
  updateDocumentState();
}

function newPost() {
  resetEditor();
  showPanel('editor-panel');
  window.requestAnimationFrame(() => byId('title').focus());
}

function renderPosts() {
  const list = byId('post-list');
  if (!posts.length) {
    list.innerHTML = `
      <div class="empty-library">
        <span>✦</span>
        <h3>还没有文章</h3>
        <p>打开独立写作台，开始你的第一篇博客。</p>
        <button class="primary-button" type="button" data-new-post>开始写作</button>
      </div>`;
    return;
  }

  list.innerHTML = posts.map(post => {
    const slug = post.slug || post.id;
    const url = `/blog/${encodeURIComponent(slug)}`;
    return `
      <article class="post-management-item">
        <img src="${escapeHtml(safeImage(post.image))}" alt="">
        <div class="post-management-copy">
          <div class="post-management-meta">
            <span>${escapeHtml(post.date || '')}</span>
            <span>${escapeHtml(post.author || 'Admin')}</span>
          </div>
          <h3>${escapeHtml(post.title)}</h3>
          <p>${escapeHtml(post.excerpt || '暂无摘要')}</p>
          <code>/blog/${escapeHtml(slug)}</code>
        </div>
        <div class="post-management-actions">
          <a href="${url}" target="_blank" rel="noopener">查看</a>
          <button type="button" data-edit-post="${encodeURIComponent(post.id)}">编辑</button>
        </div>
      </article>`;
  }).join('');
}

async function loadPosts() {
  try {
    posts = await api('/api/blogs');
    renderPosts();
  } catch (error) {
    byId('post-list').innerHTML = `<div class="empty-state error-text">${escapeHtml(error.message)}</div>`;
  }
}

async function editPost(id) {
  try {
    const post = await api(`/api/blogs/${encodeURIComponent(id)}`);
    resetEditor();
    byId('editing-id').value = post.id;
    byId('title').value = post.title || '';
    byId('author').value = post.author || adminStatus?.username || 'Admin';
    byId('slug').value = post.slug || post.id;
    byId('tags').value = (post.tags || []).join(', ');
    byId('excerpt').value = post.excerpt || '';
    updateFeaturedImagePreview(post.image === '/img/default.jpg' ? '' : (post.image || ''));
    if (post.contentFormat === 'html' && post.contentHtml) {
      contentEditor.innerHTML = post.contentHtml;
    } else {
      contentEditor.textContent = post.content || '';
    }
    byId('editing-status').textContent = `已发布 · ${post.date || ''}`;
    byId('publish-button').textContent = '更新';
    byId('view-post-button').href = `/blog/${encodeURIComponent(post.slug || post.id)}`;
    byId('view-post-button').classList.remove('hidden');
    editorDirty = false;
    slugTouched = true;
    updateSlugPreview();
    resizeTitle();
    updateDocumentState();
    showPanel('editor-panel');
    window.scrollTo({ top: 0 });
  } catch (error) {
    showStudioMessage(error.message, 'error');
  }
}

function saveSelection() {
  const selection = window.getSelection();
  if (!selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (contentEditor.contains(range.commonAncestorContainer)) {
    savedSelection = range.cloneRange();
  }
}

function restoreSelection() {
  contentEditor.focus();
  const selection = window.getSelection();
  if (!savedSelection || !contentEditor.contains(savedSelection.commonAncestorContainer)) {
    savedSelection = document.createRange();
    savedSelection.selectNodeContents(contentEditor);
    savedSelection.collapse(false);
  }
  selection.removeAllRanges();
  selection.addRange(savedSelection);
}

function runCommand(command, value = null) {
  restoreSelection();
  document.execCommand(command, false, value);
  saveSelection();
  markEditorDirty();
}

function insertHtml(html) {
  restoreSelection();
  document.execCommand('insertHTML', false, html);
  saveSelection();
  markEditorDirty();
}

function validInlineImageUrl(value) {
  const url = String(value || '').trim();
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
  }
}

function insertLink() {
  saveSelection();
  const value = window.prompt('输入链接地址（https://…）');
  if (value === null) return;
  const url = validInlineImageUrl(value);
  if (!url) {
    showStudioMessage('链接地址无效，请使用 http、https 或站内路径。', 'error');
    return;
  }
  runCommand('createLink', url);
}

function insertImageFromUrl() {
  saveSelection();
  const value = window.prompt('输入图片地址；取消后也可以选择本地图片上传。');
  if (value === null) return;
  if (!value.trim()) {
    byId('inline-image-file').click();
    return;
  }
  const url = validInlineImageUrl(value);
  if (!url) {
    showStudioMessage('图片地址无效，请使用 http、https 或站内路径。', 'error');
    return;
  }
  runCommand('insertImage', url);
}

function insertBlock(type) {
  const blocks = {
    paragraph: '<p><br></p>',
    heading: '<h2>输入标题</h2><p><br></p>',
    quote: '<blockquote>输入引用内容</blockquote><p><br></p>',
    divider: '<hr><p><br></p>',
    code: '<pre><code>在这里输入代码</code></pre><p><br></p>'
  };
  if (blocks[type]) insertHtml(blocks[type]);
  else if (type === 'image') insertImageFromUrl();
  else if (type === 'link') insertLink();
  else if (type === 'unorderedList') runCommand('insertUnorderedList');
  else if (type === 'orderedList') runCommand('insertOrderedList');
}

function insertText(text) {
  insertHtml(escapeHtml(text));
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${Math.max(.1, bytes / 1024).toFixed(1)} KB`;
}

async function insertInlineImageFile(file) {
  if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
    throw new Error('请选择 JPG、PNG、GIF 或 WebP 图片');
  }
  if (file.size > 700 * 1024) {
    throw new Error('图片超过 700 KB，请压缩后再上传');
  }
  const source = await fileDataUrl(file);
  runCommand('insertImage', source);
}

async function insertLocalContentFile(file) {
  if (file.type.startsWith('image/')) {
    await insertInlineImageFile(file);
    showStudioMessage('本地图片已插入正文。', 'success');
    return;
  }

  const extension = file.name.split('.').pop()?.toLocaleLowerCase('en-US') || '';
  const mime = ATTACHMENT_TYPES.get(extension);
  if (!mime) {
    throw new Error('暂不支持这种文件；可上传 PDF、Office、TXT、CSV 或 ZIP');
  }
  if (file.size > 500 * 1024) {
    throw new Error('附件超过 500 KB，请压缩后再上传');
  }

  const source = await fileDataUrl(file);
  const dataUrl = source.replace(/^data:[^;,]*;base64,/i, `data:${mime};base64,`);
  const fileName = file.name
    .replace(/[^\p{L}\p{N}\s._()+-]/gu, '_')
    .slice(0, 160) || `attachment.${extension}`;
  const label = extension.toUpperCase().slice(0, 5) || 'FILE';
  insertHtml(`
    <p><a class="insert-attachment" href="${escapeHtml(dataUrl)}"
      download="${escapeHtml(fileName)}">
      <span class="insert-attachment-icon">${escapeHtml(label)}</span>
      <span class="insert-attachment-copy"><strong>${escapeHtml(fileName)}</strong>
      <small>${escapeHtml(formatFileSize(file.size))} · 点击下载</small></span>
    </a></p><p><br></p>`);
  showStudioMessage('本地附件已插入正文。', 'success');
}

function insertDesign(type) {
  const staticDesigns = {
    table: `
      <table class="insert-table">
        <thead><tr><th>标题 1</th><th>标题 2</th><th>标题 3</th></tr></thead>
        <tbody>
          <tr><td>内容</td><td>内容</td><td>内容</td></tr>
          <tr><td>内容</td><td>内容</td><td>内容</td></tr>
        </tbody>
      </table><p><br></p>`,
    info: '<div class="insert-card insert-card-info"><strong>信息</strong><p>在这里填写需要补充说明的内容。</p></div><p><br></p>',
    tip: '<div class="insert-card insert-card-tip"><strong>小提示</strong><p>在这里填写对读者有帮助的提示。</p></div><p><br></p>',
    warning: '<div class="insert-card insert-card-warning"><strong>请注意</strong><p>在这里填写需要特别留意的内容。</p></div><p><br></p>',
    columns: '<div class="insert-columns"><div class="insert-column"><p>左栏内容</p></div><div class="insert-column"><p>右栏内容</p></div></div><p><br></p>'
  };
  if (staticDesigns[type]) {
    insertHtml(staticDesigns[type]);
    return;
  }

  if (type === 'button') {
    saveSelection();
    const label = window.prompt('按钮上显示什么文字？', '了解更多');
    if (label === null || !label.trim()) return;
    const value = window.prompt('输入按钮链接（https://… 或站内路径）', 'https://');
    if (value === null) return;
    const url = validInlineImageUrl(value);
    if (!url) {
      showStudioMessage('按钮链接无效，请使用 http、https 或站内路径。', 'error');
      return;
    }
    insertHtml(`<p><a class="insert-button" href="${escapeHtml(url)}" target="_blank">${escapeHtml(label.trim().slice(0, 60))}</a></p><p><br></p>`);
    return;
  }

  if (type === 'date') {
    const now = new Date();
    const value = new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
      hour: '2-digit', minute: '2-digit'
    }).format(now);
    insertHtml(`<p><span class="insert-date">${escapeHtml(value)}</span></p><p><br></p>`);
    return;
  }

  if (type === 'symbol') {
    byId('symbol-picker').classList.toggle('hidden');
    return;
  }

  if (type === 'signature') {
    const author = byId('author').value.trim() || adminStatus?.username || 'Admin';
    insertHtml(`<div class="insert-signature">撰文 · ${escapeHtml(author)}</div><p><br></p>`);
  }
}

function markEditorDirty() {
  editorDirty = true;
  updateDocumentState();
}

byId('blog-form').addEventListener('submit', async event => {
  event.preventDefault();
  const id = byId('editing-id').value;
  const button = byId('publish-button');
  const original = button.textContent;
  const content = contentEditor.innerText.trim();
  const contentHtml = contentEditor.innerHTML;
  if (!content) {
    showStudioMessage('请先填写文章正文。', 'error');
    contentEditor.focus();
    return;
  }
  if (contentHtml.length > 1900000) {
    showStudioMessage('正文中的图片或附件太多，请移除部分本地文件后再发布。', 'error');
    return;
  }

  button.disabled = true;
  button.textContent = id ? '更新中…' : '发布中…';
  try {
    const body = {
      title: byId('title').value.trim(),
      slug: normalizeSlug(byId('slug').value),
      author: byId('author').value.trim(),
      tags: byId('tags').value.split(',').map(tag => tag.trim()).filter(Boolean),
      excerpt: byId('excerpt').value.trim(),
      image: byId('image').value.trim(),
      content,
      contentHtml
    };
    const result = await api(id ? `/api/blogs/${encodeURIComponent(id)}` : '/api/blogs', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(body)
    });
    byId('editing-id').value = result.id;
    byId('slug').value = result.slug;
    byId('editing-status').textContent = '已发布';
    byId('publish-button').textContent = '更新';
    byId('view-post-button').href = result.url;
    byId('view-post-button').classList.remove('hidden');
    editorDirty = false;
    slugTouched = true;
    updateSlugPreview();
    updateDocumentState();
    await loadPosts();
    showStudioMessage(id ? '文章修改已发布。' : '文章已发布。', 'success');
  } catch (error) {
    showStudioMessage(error.message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = byId('editing-id').value ? '更新' : original;
  }
});

byId('credentials-form').addEventListener('submit', async event => {
  event.preventDefault();
  const newPassword = byId('new-password').value;
  if (newPassword !== byId('confirm-password').value) {
    setMessage('credentials-message', '两次输入的新密码不一致', 'error');
    return;
  }
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const original = button.innerHTML;
  button.disabled = true;
  button.textContent = '正在验证…';
  setMessage('credentials-message');
  try {
    const result = await api('/api/blogs/admin/credentials', {
      method: 'POST',
      body: JSON.stringify({
        newUsername: byId('new-username').value.trim(),
        currentPassword: byId('current-password').value,
        newPassword
      })
    });
    adminStatus = { ...adminStatus, ...result };
    setAccount(result.username);
    byId('current-password').value = '';
    byId('new-password').value = '';
    byId('confirm-password').value = '';
    byId('default-password-warning').classList.toggle('hidden', !result.usingDefaultPassword);
    setMessage('credentials-message', '管理员登录信息已更新，其他旧会话已失效。', 'success');
  } catch (error) {
    setMessage('credentials-message', error.message, 'error');
  } finally {
    button.disabled = false;
    button.innerHTML = original;
  }
});

document.querySelectorAll('[data-panel]').forEach(button => {
  button.addEventListener('click', () => showPanel(button.dataset.panel));
});
document.querySelectorAll('[data-new-post]').forEach(button => {
  button.addEventListener('click', newPost);
});
document.querySelectorAll('[data-open-account]').forEach(button => {
  button.addEventListener('click', () => showPanel('account-panel'));
});
document.querySelectorAll('[data-command]').forEach(button => {
  button.addEventListener('mousedown', event => event.preventDefault());
  button.addEventListener('click', () => runCommand(button.dataset.command));
});
document.querySelectorAll('[data-insert-link]').forEach(button => {
  button.addEventListener('mousedown', event => event.preventDefault());
  button.addEventListener('click', insertLink);
});
document.querySelectorAll('[data-insert-image]').forEach(button => {
  button.addEventListener('mousedown', event => event.preventDefault());
  button.addEventListener('click', insertImageFromUrl);
});

byId('block-format').addEventListener('change', event => {
  if (event.target.value) runCommand('formatBlock', event.target.value);
});
byId('font-family').addEventListener('change', event => {
  if (event.target.value) runCommand('fontName', event.target.value);
  event.target.selectedIndex = 0;
});
byId('font-size').addEventListener('change', event => {
  if (event.target.value) runCommand('fontSize', event.target.value);
  event.target.selectedIndex = 0;
});
byId('text-color').addEventListener('input', event => runCommand('foreColor', event.target.value));
byId('block-grid').addEventListener('click', event => {
  const block = event.target.closest('[data-block]');
  if (block) insertBlock(block.dataset.block);
});
document.querySelectorAll('[data-library-tab]').forEach(tab => {
  tab.addEventListener('click', () => switchLibraryTab(tab.dataset.libraryTab));
});
byId('block-search-input').addEventListener('input', event => {
  const term = event.target.value.trim().toLocaleLowerCase('zh-CN');
  byId('block-grid').querySelectorAll('[data-block]').forEach(block => {
    block.classList.toggle('hidden', !block.textContent.toLocaleLowerCase('zh-CN').includes(term));
  });
});

['default-emoji-grid', 'custom-emoji-grid'].forEach(id => {
  byId(id).addEventListener('click', event => {
    const button = event.target.closest('[data-emoji]');
    if (button) insertText(button.dataset.emoji);
  });
});
byId('toggle-custom-emoji').addEventListener('click', () => {
  const form = byId('custom-emoji-form');
  const open = form.classList.toggle('hidden') === false;
  byId('toggle-custom-emoji').setAttribute('aria-expanded', String(open));
  if (open) byId('custom-emoji-input').focus();
});
byId('add-custom-emoji').addEventListener('click', () => {
  const input = byId('custom-emoji-input');
  const value = input.value.trim();
  if (!value) {
    showStudioMessage('请先粘贴一个表情或短符号。', 'error');
    input.focus();
    return;
  }
  if (Array.from(value).length > 6) {
    showStudioMessage('自定义表情请控制在 6 个字符以内。', 'error');
    input.select();
    return;
  }
  const emojis = readCustomEmojis();
  if (!emojis.includes(value)) emojis.push(value);
  saveCustomEmojis(emojis);
  input.value = '';
  renderCustomEmojis();
  showStudioMessage('自定义表情已保存到这台设备。', 'success');
});
byId('custom-emoji-input').addEventListener('keydown', event => {
  if (event.key === 'Enter') {
    event.preventDefault();
    byId('add-custom-emoji').click();
  }
});
byId('clear-custom-emojis').addEventListener('click', () => {
  if (!window.confirm('清空这台设备上保存的自定义表情吗？')) return;
  saveCustomEmojis([]);
  renderCustomEmojis();
});

byId('design-grid').addEventListener('click', event => {
  const button = event.target.closest('[data-design]');
  if (button) insertDesign(button.dataset.design);
});
byId('symbol-picker').addEventListener('click', event => {
  const button = event.target.closest('[data-symbol]');
  if (button) insertText(button.dataset.symbol);
});
byId('local-file-button').addEventListener('click', () => {
  saveSelection();
  byId('local-content-file').click();
});
byId('local-content-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const button = byId('local-file-button');
  button.disabled = true;
  try {
    await insertLocalContentFile(file);
  } catch (error) {
    showStudioMessage(error.message, 'error');
  } finally {
    button.disabled = false;
  }
});

byId('inline-image-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  try {
    await insertInlineImageFile(file);
    showStudioMessage('本地图片已插入正文。', 'success');
  } catch (error) {
    showStudioMessage(error.message, 'error');
  }
});

contentEditor.addEventListener('input', markEditorDirty);
contentEditor.addEventListener('mouseup', saveSelection);
contentEditor.addEventListener('keyup', saveSelection);
contentEditor.addEventListener('focus', saveSelection);
contentEditor.addEventListener('click', event => {
  const link = event.target.closest('a');
  if (link && !event.ctrlKey && !event.metaKey) event.preventDefault();
});
byId('title').addEventListener('input', event => {
  resizeTitle();
  if (!slugTouched) {
    byId('slug').value = suggestedSlug(event.target.value);
    updateSlugPreview();
  }
  markEditorDirty();
});
byId('slug').addEventListener('input', () => {
  slugTouched = true;
  updateSlugPreview();
  markEditorDirty();
});
['author', 'tags', 'excerpt', 'image'].forEach(id => {
  byId(id).addEventListener('input', markEditorDirty);
});

byId('featured-image-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const button = byId('featured-image-button');
  const original = button.textContent;
  button.textContent = '正在处理…';
  button.classList.add('disabled');
  try {
    const image = await optimizedFeaturedImage(file);
    updateFeaturedImagePreview(image);
    markEditorDirty();
    showStudioMessage('特色图片已添加并完成优化。', 'success');
  } catch (error) {
    showStudioMessage(error.message, 'error');
  } finally {
    button.textContent = original;
    button.classList.remove('disabled');
  }
});
byId('remove-featured-image').addEventListener('click', () => {
  updateFeaturedImagePreview('');
  markEditorDirty();
});

byId('post-list').addEventListener('click', event => {
  const editButton = event.target.closest('[data-edit-post]');
  if (editButton) editPost(decodeURIComponent(editButton.dataset.editPost));
  const newButton = event.target.closest('[data-new-post]');
  if (newButton) newPost();
});
byId('close-editor-button').addEventListener('click', () => {
  if (editorDirty && !window.confirm('这篇文章还有未发布的修改，确定离开写作台吗？')) return;
  showPanel('posts-panel');
});
byId('toggle-blocks-button').addEventListener('click', () => {
  const library = byId('block-library');
  if (window.innerWidth <= 1050) {
    library.classList.toggle('mobile-open');
    byId('post-settings').classList.remove('mobile-open');
  } else {
    library.classList.toggle('collapsed');
  }
});
byId('toggle-settings-button').addEventListener('click', () => {
  const settings = byId('post-settings');
  if (window.innerWidth <= 1050) {
    settings.classList.toggle('mobile-open');
    byId('block-library').classList.remove('mobile-open');
  } else {
    settings.classList.toggle('collapsed');
  }
});
byId('close-settings-button').addEventListener('click', () => {
  if (window.innerWidth <= 1050) byId('post-settings').classList.remove('mobile-open');
  else byId('post-settings').classList.add('collapsed');
});
byId('menu-button').addEventListener('click', () => {
  document.querySelector('.dashboard-sidebar').classList.add('open');
  byId('sidebar-scrim').classList.add('open');
});
byId('sidebar-scrim').addEventListener('click', closeMenu);
byId('logout-button').addEventListener('click', async () => {
  await api('/api/blogs/admin/auth', { method: 'DELETE' }).catch(() => {});
  window.location.replace('/blog/admin');
});
window.addEventListener('resize', () => {
  if (window.innerWidth > 860) closeMenu();
  if (window.innerWidth > 1050) closeStudioPanels();
});
window.addEventListener('beforeunload', event => {
  if (!document.body.classList.contains('editor-mode') || !editorDirty) return;
  event.preventDefault();
  event.returnValue = '';
});

document.execCommand('defaultParagraphSeparator', false, 'p');
document.execCommand('styleWithCSS', false, true);
renderEmojiGrid('default-emoji-grid', DEFAULT_EMOJIS);
renderCustomEmojis();
renderEmojiGrid('symbol-picker', INSERT_SYMBOLS);
byId('symbol-picker').querySelectorAll('[data-emoji]').forEach(button => {
  button.dataset.symbol = button.dataset.emoji;
  delete button.dataset.emoji;
  button.title = `插入 ${button.dataset.symbol}`;
});
resizeTitle();
updateSlugPreview();

api('/api/blogs/admin/auth')
  .then(async status => {
    if (!status.authenticated) {
      window.location.replace('/blog/admin');
      return;
    }
    adminStatus = status;
    setAccount(status.username);
    byId('default-password-warning').classList.toggle('hidden', !status.usingDefaultPassword);
    byId('dashboard-loading').classList.add('hidden');
    byId('dashboard-app').classList.remove('hidden');
    await loadPosts();
  })
  .catch(() => window.location.replace('/blog/admin'));

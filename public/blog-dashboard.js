const byId = id => document.getElementById(id);
const contentEditor = byId('content-editor');
let adminStatus = null;
let posts = [];
let editorDirty = false;
let slugTouched = false;
let savedSelection = null;
let homepageCoverImage = '';
let homepageCoverDirty = false;
let homepageCoverForPreview = '/img/m48a5_patton_cn.jpg';
let homepageLayoutDirty = false;
let selectedCreatorPageId = 'who';
const DEFAULT_HOMEPAGE_LAYOUT = {
  accent: '#c6ef46',
  hero: { titleX: 50, titleY: 50, titleScale: 100, imageX: 54, imageY: 50, overlay: 66 },
  content: {
    cardWidth: 960,
    cards: {
      who: { x: 42, y: 50, backgroundImage: '', imageX: 50, imageY: 50, overlay: 78 },
      features: { x: 58, y: 50, backgroundImage: '', imageX: 50, imageY: 50, overlay: 78 },
      contact: { x: 42, y: 50, backgroundImage: '', imageX: 50, imageY: 50, overlay: 78 },
      support: { x: 42, y: 50, backgroundImage: '', imageX: 50, imageY: 50, overlay: 78 }
    },
    extraPages: []
  }
};
let homepageLayout = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_LAYOUT));
let savedHomepageLayout = JSON.parse(JSON.stringify(DEFAULT_HOMEPAGE_LAYOUT));
let findatimeChartData = [];
let findatimeLoaded = false;
let findatimeLoading = false;
let findatimeResizeTimer = null;

const DEFAULT_EMOJIS = [
  '😀', '😄', '😂', '🥹', '😍', '🤔', '😎',
  '👍', '👏', '🙏', '💪', '🎉', '❤️', '🔥',
  '✨', '💡', '📌', '✅', '⚠️', '🚀', '🌿'
];
const INSERT_SYMBOLS = ['©', '®', '™', '°', '±', '×', '÷', '≠', '≈', '≤', '≥', '∞', '√', '∑', 'π', 'Ω'];
const FINDATIME_PERIOD_ICONS = ['●', '7', '30', '∞'];
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
    if (response.status === 401) window.location.replace('/admin');
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
  if (!candidate || candidate === '/img/default.jpg') return '';
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(candidate)) {
    return candidate;
  }
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate;
  try {
    const parsed = new URL(candidate);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch {
    return '';
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
  const creatorMode = panelId === 'creator-panel';
  document.body.classList.toggle('editor-mode', editorMode);
  document.body.classList.toggle('creator-mode', creatorMode);
  const panelMeta = {
    'posts-panel': ['文章管理', 'EDITORIAL DESK'],
    'site-panel': ['网站封面', 'SITE APPEARANCE'],
    'creator-panel': ['主页创作者模式', 'HOMEPAGE CREATOR'],
    'findatime-panel': ['约时间管理', 'FIND A TIME'],
    'account-panel': ['账号安全', 'ADMIN SECURITY']
  };
  if (!editorMode && !creatorMode) {
    const [heading, eyebrow] = panelMeta[panelId] || ['管理后台', 'MOSANKAI ADMIN'];
    byId('page-heading').textContent = heading;
    byId('page-eyebrow').textContent = eyebrow;
  }
  closeMenu();
  closeStudioPanels();

  if (creatorMode) {
    window.requestAnimationFrame(sendCreatorSettings);
  }

  if (panelId === 'findatime-panel') {
    if (!findatimeLoaded) loadFindatimeDashboard();
    else window.requestAnimationFrame(drawFindatimeChart);
    if (window.location.pathname === '/admin/dashboard') {
      window.history.replaceState(null, '', '/admin/dashboard?panel=findatime-panel');
    }
  } else if (!editorMode && !creatorMode && window.location.pathname === '/admin/dashboard'
      && window.location.search.includes('panel=findatime-panel')) {
    window.history.replaceState(null, '', '/admin/dashboard');
  }
}

function numberInRange(value, fallback, min, max) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function normalizeHomepageLayout(value) {
  const source = value && typeof value === 'object' ? value : {};
  const hero = source.hero && typeof source.hero === 'object' ? source.hero : {};
  const content = source.content && typeof source.content === 'object' ? source.content : {};
  const inputCards = content.cards && typeof content.cards === 'object' ? content.cards : {};
  const cards = {};
  const safeBackground = value => {
    const candidate = String(value || '').trim();
    return candidate.startsWith('/') && !candidate.startsWith('//')
      || /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(candidate)
      ? candidate
      : '';
  };
  const pageVisual = (input, fallback) => ({
    x: numberInRange(input.x, fallback.x, 12, 88),
    y: numberInRange(input.y, fallback.y, 18, 82),
    backgroundImage: safeBackground(input.backgroundImage),
    imageX: numberInRange(input.imageX, 50, 0, 100),
    imageY: numberInRange(input.imageY, 50, 0, 100),
    overlay: numberInRange(input.overlay, 78, 20, 95)
  });
  Object.keys(DEFAULT_HOMEPAGE_LAYOUT.content.cards).forEach(id => {
    const input = inputCards[id] && typeof inputCards[id] === 'object' ? inputCards[id] : {};
    const fallback = DEFAULT_HOMEPAGE_LAYOUT.content.cards[id];
    cards[id] = pageVisual(input, fallback);
  });
  const extraPages = (Array.isArray(content.extraPages) ? content.extraPages : []).slice(0, 8)
    .filter(page => /^custom-[a-z0-9-]{4,48}$/.test(String(page?.id || '')))
    .map((page, index) => ({
      id: String(page.id),
      label: String(page.label || `PAGE / ${String(index + 5).padStart(2, '0')}`).slice(0, 48),
      title: String(page.title || '新页面标题').slice(0, 120),
      body: String(page.body || '在创作者模式中编辑这个页面的内容。').slice(0, 1000),
      ...pageVisual(page, { x: index % 2 ? 58 : 42, y: 50 })
    }));
  return {
    accent: /^#[0-9a-f]{6}$/i.test(String(source.accent || ''))
      ? String(source.accent).toLowerCase()
      : DEFAULT_HOMEPAGE_LAYOUT.accent,
    hero: {
      titleX: numberInRange(hero.titleX, 50, 12, 88),
      titleY: numberInRange(hero.titleY, 50, 18, 82),
      titleScale: numberInRange(hero.titleScale, 100, 55, 145),
      imageX: numberInRange(hero.imageX, 54, 0, 100),
      imageY: numberInRange(hero.imageY, 50, 0, 100),
      overlay: numberInRange(hero.overlay, 66, 20, 90)
    },
    content: {
      cardWidth: numberInRange(content.cardWidth, 960, 520, 1120),
      cards,
      extraPages
    }
  };
}

function cloneLayout(value) {
  return JSON.parse(JSON.stringify(normalizeHomepageLayout(value)));
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
  const image = safeImage(value);
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

async function optimizedHomepageCover(file) {
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片');
  if (file.size > 12 * 1024 * 1024) throw new Error('原始图片不能超过 12 MB');

  const source = await fileDataUrl(file);
  const image = await loadImageSource(source);
  const scale = Math.min(1, 1920 / image.naturalWidth, 1200 / image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  let output = canvas.toDataURL('image/webp', .84);

  if (output.length > 1800000) output = canvas.toDataURL('image/webp', .68);
  if (output.length > 1800000) {
    const secondScale = Math.min(1, 1440 / canvas.width, 900 / canvas.height);
    const smaller = document.createElement('canvas');
    smaller.width = Math.max(1, Math.round(canvas.width * secondScale));
    smaller.height = Math.max(1, Math.round(canvas.height * secondScale));
    smaller.getContext('2d').drawImage(canvas, 0, 0, smaller.width, smaller.height);
    output = smaller.toDataURL('image/webp', .7);
  }
  if (output.length > 1850000) throw new Error('图片处理后仍然过大，请换一张尺寸更小的图片');
  return output;
}

async function optimizedPageBackground(file) {
  const allowed = ['image/png', 'image/jpeg', 'image/webp'];
  if (!allowed.includes(file.type)) throw new Error('请选择 JPG、PNG 或 WebP 图片');
  if (file.size > 12 * 1024 * 1024) throw new Error('原始图片不能超过 12 MB');

  const source = await fileDataUrl(file);
  const image = await loadImageSource(source);
  const render = (maxWidth, maxHeight, quality) => {
    const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/webp', quality);
  };

  let output = render(1600, 1000, .7);
  if (output.length > 345000) output = render(1400, 900, .56);
  if (output.length > 345000) output = render(1100, 760, .5);
  if (output.length > 355000) throw new Error('图片处理后仍然过大，请换一张尺寸更小的图片');
  return output;
}

function updateHomepageCoverPreview(value, isDefault = false) {
  const coverImage = safeImage(value) || '/img/m48a5_patton_cn.jpg';
  homepageCoverForPreview = coverImage;
  homepageCoverImage = isDefault ? '' : coverImage;
  byId('homepage-cover-preview').querySelector('img').src = coverImage;
  byId('homepage-cover-status').textContent = isDefault ? '当前使用默认封面' : '当前使用自定义封面';
  byId('restore-homepage-cover').disabled = isDefault;
  sendCreatorSettings();
}

function setCreatorMessage(text = '', type = '') {
  const element = byId('creator-layout-message');
  element.textContent = text;
  element.className = `creator-message ${type}`.trim();
}

function updateCreatorSaveState() {
  byId('save-homepage-layout').disabled = !homepageLayoutDirty;
  byId('undo-homepage-layout').disabled = !homepageLayoutDirty;
  byId('creator-save-state').textContent = homepageLayoutDirty ? '有未保存的修改' : '所有修改已保存';
}

function creatorPageById(id = selectedCreatorPageId) {
  return homepageLayout.content.cards[id]
    || homepageLayout.content.extraPages.find(page => page.id === id)
    || null;
}

function creatorPageName(id) {
  const names = { who: '01 · 关于', features: '02 · 功能', contact: '03 · 联系', support: '04 · 支持' };
  const extra = homepageLayout.content.extraPages.find(page => page.id === id);
  return names[id] || (extra ? `${String(homepageLayout.content.extraPages.indexOf(extra) + 5).padStart(2, '0')} · ${extra.title}` : '页面');
}

function syncCreatorPageControls() {
  const select = byId('creator-page-select');
  const optionSignature = JSON.stringify(homepageLayout.content.extraPages.map(page => [page.id, page.title]));
  if (select.dataset.signature !== optionSignature) {
    select.querySelectorAll('option[data-custom-page]').forEach(option => option.remove());
    homepageLayout.content.extraPages.forEach((page, index) => {
      const option = document.createElement('option');
      option.value = page.id;
      option.dataset.customPage = '';
      option.textContent = `${String(index + 5).padStart(2, '0')} · ${page.title}`;
      select.append(option);
    });
    select.dataset.signature = optionSignature;
  }
  if (!creatorPageById(selectedCreatorPageId)) selectedCreatorPageId = 'who';
  select.value = selectedCreatorPageId;

  const page = creatorPageById();
  const custom = homepageLayout.content.extraPages.some(item => item.id === selectedCreatorPageId);
  byId('creator-custom-page-fields').classList.toggle('hidden', !custom);
  byId('delete-homepage-page').classList.toggle('hidden', !custom);
  if (custom) {
    byId('creator-page-label').value = page.label;
    byId('creator-page-title').value = page.title;
    byId('creator-page-body').value = page.body;
  }

  const background = safeImage(page?.backgroundImage);
  const preview = byId('creator-page-background-preview');
  preview.classList.toggle('empty', !background);
  preview.querySelector('img').src = background || '';
  byId('remove-page-background').disabled = !background;
  byId('creator-page-overlay').value = page?.overlay ?? 78;
  byId('creator-page-overlay-output').textContent = `${Math.round(page?.overlay ?? 78)}%`;
  byId('creator-page-image-x').value = page?.imageX ?? 50;
  byId('creator-page-image-x-output').textContent = `${Math.round(page?.imageX ?? 50)}%`;
  byId('creator-page-image-y').value = page?.imageY ?? 50;
  byId('creator-page-image-y-output').textContent = `${Math.round(page?.imageY ?? 50)}%`;
}

function syncCreatorControls() {
  byId('creator-accent').value = homepageLayout.accent;
  byId('creator-accent-output').textContent = homepageLayout.accent;
  byId('creator-title-scale').value = homepageLayout.hero.titleScale;
  byId('creator-title-scale-output').textContent = `${Math.round(homepageLayout.hero.titleScale)}%`;
  byId('creator-overlay').value = homepageLayout.hero.overlay;
  byId('creator-overlay-output').textContent = `${Math.round(homepageLayout.hero.overlay)}%`;
  byId('creator-card-width').value = homepageLayout.content.cardWidth;
  byId('creator-card-width-output').textContent = `${Math.round(homepageLayout.content.cardWidth)} px`;
  document.documentElement.style.setProperty('--creator-accent', homepageLayout.accent);
  syncCreatorPageControls();
  updateCreatorSaveState();
}

function sendCreatorSettings() {
  const frame = byId('homepage-creator-frame');
  if (!frame?.contentWindow) return;
  frame.contentWindow.postMessage({
    type: 'mosankai:creator-settings',
    layout: homepageLayout,
    coverImage: homepageCoverForPreview
  }, window.location.origin);
}

function setHomepageLayout(value, { dirty = true, send = true } = {}) {
  homepageLayout = cloneLayout(value);
  if (dirty) homepageLayoutDirty = true;
  syncCreatorControls();
  if (send) sendCreatorSettings();
}

function setLayoutPath(path, value) {
  const parts = path.split('.');
  let target = homepageLayout;
  parts.slice(0, -1).forEach(part => { target = target[part]; });
  target[parts.at(-1)] = path === 'accent' ? String(value) : Number(value);
  setHomepageLayout(homepageLayout);
}

function updateSelectedCreatorPage(changes, message = '页面设置已更新，保存后才会发布。') {
  const page = creatorPageById();
  if (!page) return;
  Object.assign(page, changes);
  setHomepageLayout(homepageLayout);
  setCreatorMessage(message);
}

function selectCreatorPage(id, scroll = false) {
  if (!creatorPageById(id)) return;
  selectedCreatorPageId = id;
  syncCreatorPageControls();
  byId('creator-selection-label').textContent = `当前页面：${creatorPageName(id)}`;
  if (scroll) {
    byId('homepage-creator-frame').contentWindow?.postMessage({
      type: 'mosankai:creator-scroll',
      id
    }, window.location.origin);
  }
}

function applyCreatorDragPatch(patch) {
  if (!patch || typeof patch !== 'object') return;
  if (patch.kind === 'title') {
    homepageLayout.hero.titleX = numberInRange(patch.x, 50, 12, 88);
    homepageLayout.hero.titleY = numberInRange(patch.y, 50, 18, 82);
  } else if (patch.kind === 'hero-background') {
    homepageLayout.hero.imageX = numberInRange(patch.x, 54, 0, 100);
    homepageLayout.hero.imageY = numberInRange(patch.y, 50, 0, 100);
  } else if (patch.kind === 'card' || patch.kind === 'page-background') {
    const page = creatorPageById(patch.id);
    if (!page) return;
    if (patch.kind === 'card') {
      page.x = numberInRange(patch.x, 50, 12, 88);
      page.y = numberInRange(patch.y, 50, 18, 82);
    } else {
      page.imageX = numberInRange(patch.x, 50, 0, 100);
      page.imageY = numberInRange(patch.y, 50, 0, 100);
    }
  } else {
    return;
  }
  homepageLayout = cloneLayout(homepageLayout);
  homepageLayoutDirty = true;
  syncCreatorControls();
}

function closeCreator() {
  if (homepageLayoutDirty && !window.confirm('主页布局还有未保存的修改，确定退出吗？')) return;
  showPanel('site-panel');
}

async function loadSiteSettings() {
  try {
    const settings = await api('/api/site-settings');
    updateHomepageCoverPreview(settings.coverImage, settings.isDefault);
    homepageLayout = cloneLayout(settings.layout);
    savedHomepageLayout = cloneLayout(settings.layout);
    homepageLayoutDirty = false;
    syncCreatorControls();
    sendCreatorSettings();
    homepageCoverDirty = false;
    byId('save-homepage-cover').disabled = true;
  } catch (error) {
    setMessage('homepage-cover-message', error.message, 'error');
  }
}

function findatimeNumber(value) {
  return new Intl.NumberFormat('zh-CN').format(value || 0);
}

function findatimeDateTime(value, includeYear = false) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    ...(includeYear ? { year: 'numeric' } : {}),
    month: includeYear ? '2-digit' : 'long',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(includeYear ? { second: '2-digit', hourCycle: 'h23' } : {})
  }).format(new Date(value));
}

function findatimeChartDate(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'UTC',
    month: 'numeric',
    day: 'numeric'
  }).format(new Date(`${value}T00:00:00Z`));
}

function renderFindatimeDashboard(data) {
  byId('findatime-updated-at').textContent = `数据更新于 ${findatimeDateTime(data.generatedAt)}`;
  byId('findatime-summary-cards').innerHTML = (data.periods || []).map((period, index) => `
    <article class="findatime-summary-card">
      <div class="findatime-summary-top">
        <span>${escapeHtml(period.label)}创建的约会</span>
        <b>${FINDATIME_PERIOD_ICONS[index] || '·'}</b>
      </div>
      <div class="findatime-summary-number">
        <strong>${findatimeNumber(period.meetingCount)}</strong>
        <span>场会议</span>
      </div>
      <div class="findatime-summary-meta">
        <span>访问用户 <strong>${findatimeNumber(period.visitorCount)}</strong></span>
        <span>参与人数 <strong>${findatimeNumber(period.participantCount)}</strong></span>
      </div>
    </article>
  `).join('') || '<div class="findatime-loading-card">暂无统计数据</div>';

  byId('findatime-meeting-table-body').innerHTML = data.meetings?.length
    ? data.meetings.map(meeting => `
      <tr>
        <td><a href="/findatime/uuid/${encodeURIComponent(meeting.id)}" target="_blank" rel="noopener">${escapeHtml(meeting.id)}</a></td>
        <td>${escapeHtml(findatimeDateTime(meeting.createdAt, true))}</td>
        <td><span class="findatime-participant-badge">${findatimeNumber(meeting.participantCount)} 人</span></td>
        <td>${escapeHtml(meeting.title)}</td>
      </tr>
    `).join('')
    : '<tr><td class="findatime-empty-table" colspan="4">暂无会议数据</td></tr>';

  findatimeChartData = Array.isArray(data.chart) ? data.chart : [];
  findatimeLoaded = true;
  window.requestAnimationFrame(drawFindatimeChart);
}

async function loadFindatimeDashboard() {
  if (findatimeLoading) return;
  findatimeLoading = true;
  const button = byId('refresh-findatime');
  const original = button.textContent;
  button.disabled = true;
  button.textContent = '正在刷新…';
  byId('findatime-updated-at').textContent = '正在同步最新数据…';
  try {
    renderFindatimeDashboard(await api('/api/findatime/admin/dashboard'));
  } catch (error) {
    byId('findatime-updated-at').textContent = error.message;
    byId('findatime-summary-cards').innerHTML = `<div class="findatime-loading-card error-text">${escapeHtml(error.message)}</div>`;
  } finally {
    findatimeLoading = false;
    button.disabled = false;
    button.textContent = original;
  }
}

function drawFindatimeChart() {
  const canvas = byId('findatime-trend-chart');
  if (!canvas || byId('findatime-panel').classList.contains('hidden')) return;
  const empty = byId('findatime-chart-empty');
  empty.classList.toggle('hidden', findatimeChartData.length > 0);
  if (!findatimeChartData.length) return;

  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  const context = canvas.getContext('2d');
  context.setTransform(ratio, 0, 0, ratio, 0, 0);

  const width = rect.width;
  const height = rect.height;
  const margin = { top: 20, right: 18, bottom: 40, left: 42 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(1, ...findatimeChartData.flatMap(point => [
    point.meetings, point.visitors, point.participants
  ]));
  const ceiling = Math.max(4, Math.ceil(maxValue / 4) * 4);

  context.clearRect(0, 0, width, height);
  context.font = '10px "Segoe UI", sans-serif';
  context.textBaseline = 'middle';
  context.strokeStyle = 'rgba(23, 43, 58, .1)';
  context.fillStyle = '#778087';
  context.lineWidth = 1;

  for (let index = 0; index <= 4; index += 1) {
    const y = margin.top + plotHeight * (index / 4);
    context.beginPath();
    context.moveTo(margin.left, y);
    context.lineTo(width - margin.right, y);
    context.stroke();
    context.textAlign = 'right';
    context.fillText(String(Math.round(ceiling * (1 - index / 4))), margin.left - 8, y);
  }

  const labelCount = Math.min(5, findatimeChartData.length);
  for (let index = 0; index < labelCount; index += 1) {
    const dataIndex = labelCount === 1 ? 0
      : Math.round(index * (findatimeChartData.length - 1) / (labelCount - 1));
    const x = findatimeChartData.length === 1 ? margin.left + plotWidth / 2
      : margin.left + plotWidth * (dataIndex / (findatimeChartData.length - 1));
    context.textAlign = index === 0 ? 'left' : index === labelCount - 1 ? 'right' : 'center';
    context.fillText(findatimeChartDate(findatimeChartData[dataIndex].date), x, height - 15);
  }

  [
    { key: 'meetings', color: '#d85832' },
    { key: 'visitors', color: '#2f9677' },
    { key: 'participants', color: '#397ca8' }
  ].forEach(({ key, color }) => {
    context.beginPath();
    findatimeChartData.forEach((point, index) => {
      const x = findatimeChartData.length === 1 ? margin.left + plotWidth / 2
        : margin.left + plotWidth * (index / (findatimeChartData.length - 1));
      const y = margin.top + plotHeight * (1 - point[key] / ceiling);
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.strokeStyle = color;
    context.lineWidth = 2.2;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.stroke();
  });
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
    const image = safeImage(post.image);
    return `
      <article class="post-management-item${image ? '' : ' no-image'}">
        ${image ? `<img src="${escapeHtml(image)}" alt="">` : ''}
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
    updateFeaturedImagePreview(post.image);
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

byId('homepage-cover-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  const label = byId('homepage-cover-file-button');
  const original = label.textContent;
  label.textContent = '正在处理图片…';
  label.classList.add('disabled');
  setMessage('homepage-cover-message');
  try {
    const image = await optimizedHomepageCover(file);
    updateHomepageCoverPreview(image, false);
    homepageCoverDirty = true;
    byId('save-homepage-cover').disabled = false;
    setMessage('homepage-cover-message', '图片已处理，请点击“保存并应用”。', 'success');
  } catch (error) {
    setMessage('homepage-cover-message', error.message, 'error');
  } finally {
    label.textContent = original;
    label.classList.remove('disabled');
  }
});

byId('save-homepage-cover').addEventListener('click', async event => {
  if (!homepageCoverImage || !homepageCoverDirty) return;
  const button = event.currentTarget;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = '正在保存…';
  setMessage('homepage-cover-message');
  try {
    const settings = await api('/api/site-settings', {
      method: 'PUT',
      body: JSON.stringify({ coverImage: homepageCoverImage })
    });
    updateHomepageCoverPreview(settings.coverImage, settings.isDefault);
    homepageCoverDirty = false;
    setMessage('homepage-cover-message', '网站封面已更新，重新打开首页即可查看。', 'success');
  } catch (error) {
    button.disabled = false;
    setMessage('homepage-cover-message', error.message, 'error');
  } finally {
    button.textContent = original;
  }
});

byId('restore-homepage-cover').addEventListener('click', async event => {
  if (!window.confirm('恢复为网站原来的默认封面吗？')) return;
  const button = event.currentTarget;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = '正在恢复…';
  setMessage('homepage-cover-message');
  try {
    const settings = await api('/api/site-settings', { method: 'DELETE' });
    updateHomepageCoverPreview(settings.coverImage, settings.isDefault);
    homepageCoverDirty = false;
    byId('save-homepage-cover').disabled = true;
    setMessage('homepage-cover-message', '已恢复默认网站封面。', 'success');
  } catch (error) {
    button.disabled = false;
    setMessage('homepage-cover-message', error.message, 'error');
  } finally {
    button.textContent = original;
  }
});

document.querySelectorAll('[data-layout-control]').forEach(control => {
  control.addEventListener('input', () => {
    setLayoutPath(control.dataset.layoutControl, control.value);
    setCreatorMessage('预览已更新，保存后才会发布到主页。');
  });
});

document.querySelectorAll('[data-creator-viewport]').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-creator-viewport]').forEach(item => {
      item.classList.toggle('active', item === button);
    });
    byId('creator-frame-shell').classList.toggle('mobile', button.dataset.creatorViewport === 'mobile');
  });
});

byId('creator-page-select').addEventListener('change', event => {
  selectCreatorPage(event.target.value, true);
});

byId('add-homepage-page').addEventListener('click', () => {
  const pages = homepageLayout.content.extraPages;
  if (pages.length >= 8) {
    setCreatorMessage('最多可以新增 8 个滚动页。', 'error');
    return;
  }
  const number = pages.length + 5;
  const id = `custom-${Date.now().toString(36)}`;
  pages.push({
    id,
    label: `PAGE / ${String(number).padStart(2, '0')}`,
    title: '新页面标题',
    body: '在右侧编辑这个页面的内容，并为它添加一张背景图。',
    x: pages.length % 2 ? 58 : 42,
    y: 50,
    backgroundImage: '',
    imageX: 50,
    imageY: 50,
    overlay: 78
  });
  selectedCreatorPageId = id;
  setHomepageLayout(homepageLayout);
  selectCreatorPage(id, true);
  setCreatorMessage('已在主页末尾新增一个滚动页，请编辑后保存。', 'success');
});

byId('delete-homepage-page').addEventListener('click', () => {
  const index = homepageLayout.content.extraPages.findIndex(page => page.id === selectedCreatorPageId);
  if (index < 0) return;
  if (!window.confirm('删除这个新增的滚动页吗？保存发布后线上页面才会被删除。')) return;
  homepageLayout.content.extraPages.splice(index, 1);
  selectedCreatorPageId = homepageLayout.content.extraPages[index - 1]?.id || 'support';
  setHomepageLayout(homepageLayout);
  selectCreatorPage(selectedCreatorPageId, true);
  setCreatorMessage('页面已从预览中移除，保存后才会发布。', 'success');
});

[
  ['creator-page-label', 'label'],
  ['creator-page-title', 'title'],
  ['creator-page-body', 'body']
].forEach(([inputId, key]) => {
  byId(inputId).addEventListener('input', event => {
    updateSelectedCreatorPage({ [key]: event.target.value });
  });
});

[
  ['creator-page-overlay', 'overlay'],
  ['creator-page-image-x', 'imageX'],
  ['creator-page-image-y', 'imageY']
].forEach(([inputId, key]) => {
  byId(inputId).addEventListener('input', event => {
    updateSelectedCreatorPage({ [key]: Number(event.target.value) });
  });
});

byId('creator-page-background-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  const label = byId('creator-page-background-button');
  const original = label.textContent;
  label.textContent = '正在处理…';
  label.classList.add('disabled');
  setCreatorMessage();
  try {
    const image = await optimizedPageBackground(file);
    const otherBackgroundsLength = [
      ...Object.entries(homepageLayout.content.cards)
        .filter(([id]) => id !== selectedCreatorPageId)
        .map(([, page]) => page.backgroundImage || ''),
      ...homepageLayout.content.extraPages
        .filter(page => page.id !== selectedCreatorPageId)
        .map(page => page.backgroundImage || '')
    ].reduce((total, value) => total + value.length, 0);
    if (otherBackgroundsLength + image.length > 1950000) {
      throw new Error('所有页面背景图的总大小过大，请先移除一张图片。');
    }
    updateSelectedCreatorPage({ backgroundImage: image }, '背景图已加入预览，请调整焦点后保存。');
  } catch (error) {
    setCreatorMessage(error.message, 'error');
  } finally {
    label.textContent = original;
    label.classList.remove('disabled');
  }
});

byId('remove-page-background').addEventListener('click', () => {
  updateSelectedCreatorPage({ backgroundImage: '' }, '已移除这个页面的背景图。');
});

byId('close-creator-button').addEventListener('click', closeCreator);

byId('creator-previous-panel').addEventListener('click', () => {
  byId('homepage-creator-frame').contentWindow?.scrollBy({ top: -innerHeight * .85, behavior: 'smooth' });
});

byId('creator-next-panel').addEventListener('click', () => {
  byId('homepage-creator-frame').contentWindow?.scrollBy({ top: innerHeight * .85, behavior: 'smooth' });
});

byId('undo-homepage-layout').addEventListener('click', () => {
  setHomepageLayout(savedHomepageLayout, { dirty: false });
  homepageLayoutDirty = false;
  syncCreatorControls();
  setCreatorMessage('已撤销本次所有未保存修改。', 'success');
});

byId('reset-homepage-layout').addEventListener('click', () => {
  if (!window.confirm('将画布恢复到初始布局？点击“保存并发布”后才会影响线上主页。')) return;
  setHomepageLayout(DEFAULT_HOMEPAGE_LAYOUT);
  setCreatorMessage('已载入默认布局，请预览后保存。', 'success');
});

byId('save-homepage-layout').addEventListener('click', async event => {
  if (!homepageLayoutDirty) return;
  const button = event.currentTarget;
  const original = button.textContent;
  button.disabled = true;
  button.textContent = '正在发布…';
  setCreatorMessage();
  try {
    const settings = await api('/api/site-settings', {
      method: 'PUT',
      body: JSON.stringify({
        layout: homepageLayout,
        ...(homepageCoverDirty && homepageCoverImage ? { coverImage: homepageCoverImage } : {})
      })
    });
    updateHomepageCoverPreview(settings.coverImage, settings.isDefault);
    homepageCoverDirty = false;
    byId('save-homepage-cover').disabled = true;
    homepageLayout = cloneLayout(settings.layout);
    savedHomepageLayout = cloneLayout(settings.layout);
    homepageLayoutDirty = false;
    syncCreatorControls();
    sendCreatorSettings();
    setCreatorMessage('主页布局已保存并发布。', 'success');
  } catch (error) {
    homepageLayoutDirty = true;
    updateCreatorSaveState();
    setCreatorMessage(error.message, 'error');
  } finally {
    button.textContent = original;
    button.disabled = !homepageLayoutDirty;
  }
});

window.addEventListener('message', event => {
  if (event.origin !== window.location.origin || event.source !== byId('homepage-creator-frame').contentWindow) return;
  if (event.data?.type === 'mosankai:creator-ready') {
    sendCreatorSettings();
    return;
  }
  if (event.data?.type === 'mosankai:creator-change') {
    applyCreatorDragPatch(event.data.patch);
    setCreatorMessage('画布位置已调整，保存后才会发布到主页。');
    return;
  }
  if (event.data?.type === 'mosankai:creator-selection') {
    if (event.data.pageId && creatorPageById(event.data.pageId)) {
      selectCreatorPage(event.data.pageId);
    }
    const labels = {
      title: '首屏标题',
      'hero-background': '首屏背景焦点',
      'page-background': `${creatorPageName(event.data.pageId)}背景焦点`
    };
    const cardSelection = event.data.selection === event.data.pageId && creatorPageById(event.data.pageId)
      ? `${creatorPageName(event.data.pageId)}内容卡片`
      : '';
    byId('creator-selection-label').textContent = `当前选择：${labels[event.data.selection] || cardSelection || '页面整体'}`;
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
byId('refresh-findatime').addEventListener('click', loadFindatimeDashboard);
byId('logout-button').addEventListener('click', async () => {
  await api('/api/blogs/admin/auth', { method: 'DELETE' }).catch(() => {});
  window.location.replace('/admin');
});
window.addEventListener('resize', () => {
  if (window.innerWidth > 860) closeMenu();
  if (window.innerWidth > 1050) closeStudioPanels();
  window.clearTimeout(findatimeResizeTimer);
  findatimeResizeTimer = window.setTimeout(drawFindatimeChart, 120);
});
window.addEventListener('beforeunload', event => {
  const unsavedArticle = document.body.classList.contains('editor-mode') && editorDirty;
  if (!unsavedArticle && !homepageCoverDirty && !homepageLayoutDirty) return;
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
      window.location.replace('/admin');
      return;
    }
    adminStatus = status;
    setAccount(status.username);
    byId('default-password-warning').classList.toggle('hidden', !status.usingDefaultPassword);
    byId('dashboard-loading').classList.add('hidden');
    byId('dashboard-app').classList.remove('hidden');
    await Promise.all([loadPosts(), loadSiteSettings()]);
    const requestedPanel = new URLSearchParams(window.location.search).get('panel');
    if (requestedPanel === 'findatime-panel') showPanel('findatime-panel');
  })
  .catch(() => window.location.replace('/admin'));

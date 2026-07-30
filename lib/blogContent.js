const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'figcaption', 'figure',
  'font', 'h1', 'h2', 'h3', 'hr', 'i', 'img', 'li', 'ol', 'p', 'pre',
  's', 'span', 'strong', 'u', 'ul'
]);
const VOID_TAGS = new Set(['br', 'hr', 'img']);
const SAFE_STYLE_PROPERTIES = new Set([
  'background-color',
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'text-align',
  'text-decoration',
  'text-decoration-line'
]);
const RESERVED_SLUGS = new Set(['admin', 'dashboard']);

function escapeAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function safeUrl(value, allowImageData = false) {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (allowImageData && /^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=\s]+$/i.test(url)) {
    return url.replace(/\s/g, '');
  }
  try {
    const parsed = new URL(url);
    if (['http:', 'https:'].includes(parsed.protocol)) return parsed.href;
    if (!allowImageData && parsed.protocol === 'mailto:') return parsed.href;
  } catch {}
  return '';
}

function safeColor(value) {
  const color = String(value || '').trim();
  if (/^#[0-9a-f]{3,8}$/i.test(color)) return color;
  if (/^rgba?\(\s*[\d.%\s,]+\)$/i.test(color)) return color;
  if (/^hsla?\(\s*[\d.%\s,]+\)$/i.test(color)) return color;
  if (/^[a-z]{3,24}$/i.test(color)) return color;
  return '';
}

function sanitizeStyle(value) {
  const declarations = [];
  String(value || '').split(';').forEach(declaration => {
    const separator = declaration.indexOf(':');
    if (separator < 1) return;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const rawValue = declaration.slice(separator + 1).trim();
    if (!SAFE_STYLE_PROPERTIES.has(property) || !rawValue || rawValue.length > 120) return;
    if (/url|expression|javascript|@import|[<>"`]/i.test(rawValue)) return;

    let safeValue = '';
    if (property === 'color' || property === 'background-color') {
      safeValue = safeColor(rawValue);
    } else if (property === 'text-align') {
      safeValue = /^(left|right|center|justify)$/.test(rawValue) ? rawValue : '';
    } else if (property === 'font-size') {
      safeValue = /^(?:\d{1,3}(?:\.\d+)?(?:px|em|rem|%)|x{0,2}-?small|medium|x{0,3}-?large|smaller|larger)$/.test(rawValue)
        ? rawValue
        : '';
    } else if (property === 'font-style') {
      safeValue = /^(normal|italic|oblique)$/.test(rawValue) ? rawValue : '';
    } else if (property === 'font-weight') {
      safeValue = /^(normal|bold|[1-9]00)$/.test(rawValue) ? rawValue : '';
    } else if (property === 'text-decoration' || property === 'text-decoration-line') {
      safeValue = /^(?:none|underline|line-through)(?:\s+(?:underline|line-through))*$/.test(rawValue)
        ? rawValue
        : '';
    } else if (property === 'font-family') {
      const fontFamily = rawValue.replace(/&quot;|&#39;/gi, '');
      safeValue = /^[\w\u00C0-\uFFFF\s,'"-]{1,100}$/.test(fontFamily) ? fontFamily : '';
    }
    if (safeValue) declarations.push(`${property}: ${safeValue}`);
  });
  return declarations.join('; ');
}

function parsedAttributes(source) {
  const attributes = [];
  const pattern = /([a-zA-Z][\w:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match;
  while ((match = pattern.exec(source))) {
    attributes.push({
      name: match[1].toLowerCase(),
      value: match[2] ?? match[3] ?? match[4] ?? ''
    });
  }
  return attributes;
}

function sanitizeTag(token) {
  const match = token.match(/^<\s*(\/?)\s*([a-z0-9]+)([\s\S]*?)\/?\s*>$/i);
  if (!match) return '';
  const closing = Boolean(match[1]);
  const tag = match[2].toLowerCase();
  if (!ALLOWED_TAGS.has(tag)) return '';
  if (closing) return VOID_TAGS.has(tag) ? '' : `</${tag}>`;

  const inputAttributes = parsedAttributes(match[3]);
  const outputAttributes = [];
  const attribute = name => inputAttributes.find(item => item.name === name)?.value || '';
  const style = sanitizeStyle(attribute('style'));
  if (style) outputAttributes.push(`style="${escapeAttribute(style)}"`);

  if (tag === 'a') {
    const href = safeUrl(attribute('href'));
    if (href) outputAttributes.push(`href="${escapeAttribute(href)}"`);
    if (attribute('target') === '_blank') {
      outputAttributes.push('target="_blank"', 'rel="noopener noreferrer"');
    }
  }

  if (tag === 'img') {
    const src = safeUrl(attribute('src'), true);
    if (!src) return '';
    outputAttributes.push(`src="${escapeAttribute(src)}"`);
    outputAttributes.push(`alt="${escapeAttribute(attribute('alt').slice(0, 300))}"`);
    outputAttributes.push('loading="lazy"');
  }

  if (tag === 'font') {
    const face = attribute('face');
    const color = safeColor(attribute('color'));
    const size = attribute('size');
    if (/^[\w\u00C0-\uFFFF\s,'"-]{1,100}$/.test(face)) {
      outputAttributes.push(`face="${escapeAttribute(face)}"`);
    }
    if (color) outputAttributes.push(`color="${escapeAttribute(color)}"`);
    if (/^[1-7]$/.test(size)) outputAttributes.push(`size="${size}"`);
  }

  return `<${tag}${outputAttributes.length ? ` ${outputAttributes.join(' ')}` : ''}>`;
}

function sanitizeBlogHtml(value) {
  const html = String(value || '').slice(0, 2000000);
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, sanitizeTag);
}

function decodeBasicEntities(value) {
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function htmlToText(value) {
  return decodeBasicEntities(String(value || '')
    .replace(/<(?:br|\/p|\/div|\/h[1-3]|\/li|\/blockquote)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n'))
    .trim()
    .slice(0, 100000);
}

function normalizeSlug(value) {
  const slug = String(value || '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLocaleLowerCase('en-US');
  if (!slug) return { error: '请填写文章后缀' };
  if (slug.length > 80 || !/^[\p{L}\p{N}_-]+$/u.test(slug)) {
    return { error: '文章后缀限 1–80 个字符，可使用中英文、数字、连字符和下划线' };
  }
  if (RESERVED_SLUGS.has(slug)) return { error: '这个文章后缀已被后台页面占用' };
  return { slug };
}

module.exports = {
  htmlToText,
  normalizeSlug,
  sanitizeBlogHtml
};

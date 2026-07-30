const crypto = require('crypto');
const { requireAdmin } = require('../../lib/blogAdminAuth');
const { htmlToText, normalizeSlug, sanitizeBlogHtml } = require('../../lib/blogContent');
const { getBlogs, saveBlogs } = require('../../lib/blogStore');

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanTags(value) {
  const tags = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(tags.map(tag => cleanText(tag, 30)).filter(Boolean))].slice(0, 8);
}

function cleanImage(value) {
  const image = String(value || '').trim();
  if (!image) return { image: '/img/default.jpg' };
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(image)) {
    if (image.length > 1800000) return { error: '特色图片处理后仍然过大，请选择更小的图片' };
    return { image };
  }
  if (image.length > 2048) return { error: '特色图片地址无效' };
  if (image.startsWith('/') && !image.startsWith('//')) return { image };
  try {
    const parsed = new URL(image);
    if (['http:', 'https:'].includes(parsed.protocol)) return { image: parsed.href };
  } catch {}
  return { error: '封面图片地址必须是站内路径或 http/https 地址' };
}

function validateBlog(body = {}) {
  const image = cleanImage(body.image);
  if (image.error) return image;
  const normalizedSlug = normalizeSlug(body.slug);
  if (normalizedSlug.error) return normalizedSlug;
  const contentHtml = sanitizeBlogHtml(body.contentHtml || '');
  const richText = htmlToText(contentHtml);
  const plainContent = cleanText(body.content, 100000);
  const content = richText || plainContent;
  const blog = {
    title: cleanText(body.title, 120),
    content,
    contentHtml: contentHtml || '',
    contentFormat: contentHtml ? 'html' : 'text',
    excerpt: cleanText(body.excerpt, 400),
    image: image.image,
    tags: cleanTags(body.tags),
    author: cleanText(body.author, 60) || 'Admin',
    slug: normalizedSlug.slug
  };
  if (!blog.title || !blog.content) return { error: '标题和正文不能为空' };
  return { blog };
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const blogs = await getBlogs();
      return res.status(200).json(blogs.map(blog => ({
        id: blog.id,
        title: blog.title,
        excerpt: blog.excerpt,
        image: blog.image,
        date: blog.date,
        tags: blog.tags,
        author: blog.author,
        slug: blog.slug || blog.id,
        updatedAt: blog.updatedAt || null
      })));
    }

    if (req.method === 'POST') {
      if (!(await requireAdmin(req, res))) return;
      const validation = validateBlog(req.body);
      if (validation.error) return res.status(400).json({ error: validation.error });

      const blogs = await getBlogs();
      if (blogs.some(blog => (
        blog.slug === validation.blog.slug || blog.id === validation.blog.slug
      ))) {
        return res.status(409).json({ error: '这个文章后缀已经被使用，请换一个' });
      }
      const now = new Date();
      const id = `${now.getTime().toString(36)}${crypto.randomBytes(3).toString('hex')}`;
      blogs.unshift({
        id,
        ...validation.blog,
        date: now.toISOString().slice(0, 10),
        updatedAt: now.toISOString(),
        comments: []
      });
      await saveBlogs(blogs);
      return res.status(201).json({
        success: true,
        id,
        slug: validation.blog.slug,
        url: `/blog/${encodeURIComponent(validation.blog.slug)}`
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '博客服务暂时不可用，请稍后重试' });
  }
};

module.exports.validateBlog = validateBlog;

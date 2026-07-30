const { getBlogs, saveBlogs } = require('../../../lib/blogStore');

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const id = String(req.query?.id || req.params?.id || '');
  const name = cleanText(req.body?.name, 40);
  const text = cleanText(req.body?.text, 2000);
  if (!name || !text) return res.status(400).json({ error: '姓名和评论不能为空' });

  try {
    const blogs = await getBlogs();
    const blog = blogs.find(item => item.id === id);
    if (!blog) return res.status(404).json({ error: '找不到这篇博客' });

    blog.comments = Array.isArray(blog.comments) ? blog.comments : [];
    blog.comments.push({
      name,
      text,
      date: new Date().toISOString().slice(0, 10)
    });
    await saveBlogs(blogs);
    return res.status(201).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '暂时无法保存评论，请稍后重试' });
  }
};

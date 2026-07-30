const { requireAdmin } = require('../../lib/blogAdminAuth');
const { getBlogs, saveBlogs } = require('../../lib/blogStore');
const { validateBlog } = require('./index');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const id = String(req.query?.id || req.params?.id || '');

  try {
    const blogs = await getBlogs();
    const index = blogs.findIndex(blog => blog.id === id || blog.slug === id);
    if (index < 0) return res.status(404).json({ error: '找不到这篇博客' });

    if (req.method === 'GET') return res.status(200).json(blogs[index]);

    if (req.method === 'PUT') {
      if (!(await requireAdmin(req, res))) return;
      const validation = validateBlog(req.body);
      if (validation.error) return res.status(400).json({ error: validation.error });
      if (blogs.some((blog, blogIndex) => (
        blogIndex !== index
        && (blog.slug === validation.blog.slug || blog.id === validation.blog.slug)
      ))) {
        return res.status(409).json({ error: '这个文章后缀已经被使用，请换一个' });
      }
      blogs[index] = {
        ...blogs[index],
        ...validation.blog,
        updatedAt: new Date().toISOString()
      };
      await saveBlogs(blogs);
      return res.status(200).json({
        success: true,
        id: blogs[index].id,
        slug: blogs[index].slug,
        url: `/blog/${encodeURIComponent(blogs[index].slug)}`
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '博客服务暂时不可用，请稍后重试' });
  }
};

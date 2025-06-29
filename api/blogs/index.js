const fs = require('fs');
const path = require('path');

const BLOGS_FILE = path.join(process.cwd(), 'blogs.json');

export default function handler(req, res) {
  if (req.method === 'GET') {
    const blogs = fs.existsSync(BLOGS_FILE)
      ? JSON.parse(fs.readFileSync(BLOGS_FILE, 'utf8'))
      : [];
    return res.status(200).json(blogs.map(blog => ({
      id: blog.id, title: blog.title, excerpt: blog.excerpt, image: blog.image,
      date: blog.date, tags: blog.tags, author: blog.author
    })));
  }

  if (req.method === 'POST') {
    const { title, content, excerpt, image, tags, author, password } = req.body;
    if (password !== 'admin123') return res.status(401).json({ error: 'Unauthorized' });
    if (!title || !content) return res.status(400).json({ error: 'Title and content required' });

    const blogs = fs.existsSync(BLOGS_FILE)
      ? JSON.parse(fs.readFileSync(BLOGS_FILE, 'utf8'))
      : [];

    const id = Date.now().toString();
    blogs.unshift({
      id, title, content, excerpt, image: image || '/img/default.jpg',
      date: new Date().toISOString().slice(0,10),
      tags: tags || [], author: author || 'Admin', comments: []
    });

    fs.writeFileSync(BLOGS_FILE, JSON.stringify(blogs, null, 2), 'utf8');
    return res.status(200).json({ success: true, id });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

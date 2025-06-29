const fs = require('fs');
const path = require('path');

// const BLOGS_FILE = path.join(process.cwd(), 'blogs.json');
const BLOGS_FILE = path.join('/tmp', 'blogs.json');


export default function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, text } = req.body;
  if (!name || !text) return res.status(400).json({ error: 'Name and text required' });

  const blogs = fs.existsSync(BLOGS_FILE)
    ? JSON.parse(fs.readFileSync(BLOGS_FILE, 'utf8'))
    : [];

  const blog = blogs.find(b => b.id === id);
  if (!blog) return res.status(404).json({ error: 'Not found' });

  blog.comments = blog.comments || [];
  blog.comments.push({ name, text, date: new Date().toISOString().slice(0,10) });

  fs.writeFileSync(BLOGS_FILE, JSON.stringify(blogs, null, 2), 'utf8');
  return res.status(200).json({ success: true });
}

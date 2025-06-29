const fs = require('fs');
const path = require('path');

const BLOGS_FILE = path.join(process.cwd(), 'blogs.json');

export default function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const blogs = fs.existsSync(BLOGS_FILE)
    ? JSON.parse(fs.readFileSync(BLOGS_FILE, 'utf8'))
    : [];

  const blog = blogs.find(b => b.id === id);
  if (!blog) return res.status(404).json({ error: 'Not found' });

  return res.status(200).json(blog);
}

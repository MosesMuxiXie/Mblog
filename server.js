const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const BLOGS_FILE = path.join(__dirname, 'blogs.json');

app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static('public'));

// Helper functions
function loadBlogs() {
  if (!fs.existsSync(BLOGS_FILE)) return [];
  try { return JSON.parse(fs.readFileSync(BLOGS_FILE, 'utf8')); }
  catch { return []; }
}
function saveBlogs(blogs) {
  fs.writeFileSync(BLOGS_FILE, JSON.stringify(blogs, null, 2), 'utf8');
}

// Get all blogs (most recent first)
app.get('/api/blogs', (req, res) => {
  const blogs = loadBlogs();
  res.json(blogs.map(blog => ({
    id: blog.id, title: blog.title, excerpt: blog.excerpt, image: blog.image,
    date: blog.date, tags: blog.tags, author: blog.author
  })));
});

// Get single blog with comments
app.get('/api/blogs/:id', (req, res) => {
  const blogs = loadBlogs();
  const blog = blogs.find(b => b.id === req.params.id);
  if (!blog) return res.status(404).json({ error: 'Not found' });
  res.json(blog);
});

// Post a new blog (simple admin password)
app.post('/api/blogs', (req, res) => {
  const { title, content, excerpt, image, tags, author, password } = req.body;
  if (password !== 'admin123') return res.status(401).json({ error: 'Unauthorized' });
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
  const blogs = loadBlogs();
  const id = Date.now().toString();
  blogs.unshift({
    id, title, content, excerpt, image: image || '/img/default.jpg',
    date: new Date().toISOString().slice(0,10),
    tags: tags || [], author: author || 'Admin', comments: []
  });
  saveBlogs(blogs);
  res.json({ success: true, id });
});

// Add comment to blog
app.post('/api/blogs/:id/comments', (req, res) => {
  const { name, text } = req.body;
  if (!name || !text) return res.status(400).json({ error: 'Name and text required' });
  const blogs = loadBlogs();
  const blog = blogs.find(b => b.id === req.params.id);
  if (!blog) return res.status(404).json({ error: 'Not found' });
  blog.comments = blog.comments || [];
  blog.comments.push({ name, text, date: new Date().toISOString().slice(0,10) });
  saveBlogs(blogs);
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

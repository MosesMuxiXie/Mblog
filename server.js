const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 3000;

// In-memory "database"
let blogs = []; // {id, title, content, comments: [{name, text}]}
let nextId = 1;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public')); // Serve frontend

// Get all blogs
app.get('/api/blogs', (req, res) => {
  res.json(blogs.map(({id, title, content, comments}) => ({
    id, title, content, comments
  })));
});

// Get one blog
app.get('/api/blogs/:id', (req, res) => {
  const blog = blogs.find(b => b.id === Number(req.params.id));
  if (!blog) return res.status(404).json({error: 'Not found'});
  res.json(blog);
});

// Add a new blog (admin only, simple password)
app.post('/api/blogs', (req, res) => {
  const { title, content, password } = req.body;
  if (password !== 'admin123') {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const blog = { id: nextId++, title, content, comments: [] };
  blogs.unshift(blog); // Add to front
  res.json(blog);
});

// Add a comment to a blog
app.post('/api/blogs/:id/comments', (req, res) => {
  const { name, text } = req.body;
  const blog = blogs.find(b => b.id === Number(req.params.id));
  if (!blog) return res.status(404).json({error: 'Not found'});
  if (!name || !text) return res.status(400).json({error: 'Name and text required'});
  blog.comments.push({ name, text });
  res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
if (process.env.FINDATIME_SKIP_ENV_FILE !== 'true' && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { readSession: readBlogAdminSession } = require('./lib/blogAdminAuth');

const app = express();
const PORT = process.env.PORT || 3000;

app.get(['/findatime/admin', '/findatime/admin/'], (req, res) => (
  res.redirect(307, '/admin/dashboard?panel=findatime-panel')
));
app.use(bodyParser.json({ limit: '3mb' }));
app.use(express.static('public'));

function setAdminPageHeaders(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
}

app.get('/findatime', (req, res) => res.sendFile(path.join(__dirname, 'public', 'findatime', 'index.html')));
app.get('/findatime/uuid/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'findatime', 'index.html')));
app.get('/blog', (req, res) => res.sendFile(path.join(__dirname, 'public', 'blog.html')));
app.get('/admin', (req, res) => {
  setAdminPageHeaders(res);
  return res.sendFile(path.join(__dirname, 'public', 'blog-admin.html'));
});
app.get('/admin/dashboard', async (req, res) => {
  try {
    if (!(await readBlogAdminSession(req))) return res.redirect('/admin');
    setAdminPageHeaders(res);
    return res.sendFile(path.join(__dirname, 'public', 'blog-dashboard.html'));
  } catch (error) {
    console.error(error);
    return res.redirect('/admin');
  }
});
app.get('/blog/admin', (req, res) => res.redirect(307, '/admin'));
app.get('/blog/dashboard', (req, res) => res.redirect(307, '/admin/dashboard'));
app.get('/blog/:slug', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  return res.sendFile(path.join(__dirname, 'public', 'blog.html'));
});

const findatimeIndexHandler = require('./api/findatime/index');
app.all('/api/findatime/visit', (req, res) => {
  req.query = { ...req.query, operation: 'visit' };
  return findatimeIndexHandler(req, res);
});
app.all('/api/findatime/admin/auth', require('./api/findatime/admin/auth'));
app.all('/api/findatime/admin/setup', require('./api/findatime/admin/setup'));
app.all('/api/findatime/admin/dashboard', require('./api/findatime/admin/dashboard'));
app.all('/api/findatime/admin/password', require('./api/findatime/admin/password'));
app.all('/api/findatime', findatimeIndexHandler);
app.all('/api/findatime/:id', require('./api/findatime/[id]'));
app.all('/api/blogs/admin/auth', require('./api/blogs/admin/auth'));
app.all('/api/blogs/admin/credentials', require('./api/blogs/admin/credentials'));
app.all('/api/site-settings', require('./api/site-settings'));
app.all('/api/blogs', require('./api/blogs/index'));
app.all('/api/blogs/:id/comments', require('./api/blogs/[id]/comments'));
app.all('/api/blogs/:id', require('./api/blogs/[id]'));

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));

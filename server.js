const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createMeeting, getMeeting, saveParticipant } = require('./lib/meetingStore');
const { normalizeMeetingSlots, validTimeZone } = require('./lib/meetingTime');

const app = express();
const PORT = process.env.PORT || 3000;
const BLOGS_FILE = path.join(__dirname, 'blogs.json');

app.use(bodyParser.json({ limit: '1mb' }));
app.use(express.static('public'));

function publicMeeting(meeting) {
  const participants = meeting.participants || [];
  const counts = Object.fromEntries(meeting.slots.map(slot => [slot.id, 0]));
  const attendees = Object.fromEntries(meeting.slots.map(slot => [slot.id, []]));
  participants.forEach(person => [...new Set(person.availability || [])].forEach(slotId => {
    if (Object.prototype.hasOwnProperty.call(counts, slotId)) {
      counts[slotId] += 1;
      attendees[slotId].push(person.name);
    }
  }));
  return {
    id: meeting.id,
    title: meeting.title,
    duration: meeting.duration,
    timezone: meeting.timezone,
    createdAt: meeting.createdAt,
    slots: meeting.slots.map(slot => ({ ...slot, votes: counts[slot.id], attendees: attendees[slot.id] })),
    participantCount: participants.length
  };
}

app.get('/findatime', (req, res) => res.sendFile(path.join(__dirname, 'public', 'findatime', 'index.html')));
app.get('/findatime/uuid/:id', (req, res) => res.sendFile(path.join(__dirname, 'public', 'findatime', 'index.html')));
app.get('/blog', (req, res) => res.sendFile(path.join(__dirname, 'public', 'blog.html')));

app.post('/api/findatime', async (req, res) => {
  try {
    const title = String(req.body.title || '').trim().slice(0, 80);
    const duration = Number(req.body.duration);
    const submittedTimeZone = req.body.timezone;
    const timezone = submittedTimeZone == null ? 'Asia/Shanghai' : String(submittedTimeZone);
    const slots = normalizeMeetingSlots(req.body.slots, submittedTimeZone == null);
    if (!title) return res.status(400).json({ error: '请输入约会名称' });
    if (!Number.isInteger(duration) || duration < 30 || duration > 480 || duration % 30 !== 0) {
      return res.status(400).json({ error: '无效时长' });
    }
    if (!validTimeZone(timezone)) return res.status(400).json({ error: '浏览器时区无效' });
    if (!slots || !slots.length || slots.length > 10) {
      return res.status(400).json({ error: '无效时间选项' });
    }
    const id = `ua${crypto.randomBytes(7).toString('hex')}`;
    const creatorToken = crypto.randomBytes(18).toString('base64url');
    const meetingSlots = slots.map((start, index) => ({ id: `t${index + 1}`, start }));
    const meeting = { id, title, duration, timezone, createdAt: new Date().toISOString(), slots: meetingSlots };
    await createMeeting(meeting, {
      token: creatorToken,
      name: '创建者',
      availability: meetingSlots.map(slot => slot.id),
      submittedAt: new Date().toISOString()
    });
    return res.status(201).json({ id, creatorToken, url: `/findatime/uuid/${id}` });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '暂时无法创建约会，请稍后重试' });
  }
});

app.get('/api/findatime/:id', async (req, res) => {
  try {
    const meeting = await getMeeting(req.params.id);
    if (!meeting) return res.status(404).json({ error: '找不到这个约会' });
    return res.json(publicMeeting(meeting));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '暂时无法读取约会' });
  }
});

app.post('/api/findatime/:id', async (req, res) => {
  try {
    const meeting = await getMeeting(req.params.id);
    if (!meeting) return res.status(404).json({ error: '找不到这个约会' });
    const name = String(req.body.name || '').trim().slice(0, 40);
    const validSlotIds = new Set(meeting.slots.map(slot => slot.id));
    const availability = [...new Set(Array.isArray(req.body.availability) ? req.body.availability : [])]
      .filter(slotId => validSlotIds.has(slotId));
    if (!name) return res.status(400).json({ error: '请输入姓名' });
    if (!availability.length) return res.status(400).json({ error: '请至少选择一个方便的时间' });
    const suppliedToken = String(req.body.participantToken || '');
    const token = /^[A-Za-z0-9_-]{16,64}$/.test(suppliedToken) ? suppliedToken : crypto.randomBytes(18).toString('base64url');
    const updated = await saveParticipant(req.params.id, { token, name, availability, submittedAt: new Date().toISOString() });
    return res.json({ meeting: publicMeeting(updated), participantToken: token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '暂时无法保存，请稍后重试' });
  }
});

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

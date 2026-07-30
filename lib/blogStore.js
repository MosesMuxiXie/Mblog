const fs = require('fs');
const path = require('path');

const BLOGS_FILE = process.env.BLOG_DATA_FILE || path.join(process.cwd(), 'blogs.json');
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const BLOGS_KEY = 'blog:posts';

function hasRedis() {
  return Boolean(redisUrl && redisToken);
}

async function redis(command) {
  const response = await fetch(redisUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });
  if (!response.ok) throw new Error(`Redis request failed (${response.status})`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

function readLocal() {
  if (!fs.existsSync(BLOGS_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(BLOGS_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function getBlogs() {
  if (!hasRedis()) return readLocal();
  let raw = await redis(['GET', BLOGS_KEY]);
  if (raw) return JSON.parse(raw);

  const seed = readLocal();
  await redis(['SET', BLOGS_KEY, JSON.stringify(seed), 'NX']);
  raw = await redis(['GET', BLOGS_KEY]);
  return raw ? JSON.parse(raw) : seed;
}

async function saveBlogs(blogs) {
  if (hasRedis()) {
    await redis(['SET', BLOGS_KEY, JSON.stringify(blogs)]);
    return;
  }
  fs.writeFileSync(BLOGS_FILE, JSON.stringify(blogs, null, 2), 'utf8');
}

module.exports = {
  getBlogs,
  hasRedis,
  saveBlogs
};

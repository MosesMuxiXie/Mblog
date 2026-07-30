const {
  clearSessionCookie,
  createSession,
  getAdminStatus,
  setSessionCookie,
  verifyLogin
} = require('../../../lib/blogAdminAuth');

const failedLogins = new Map();
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function clientKey(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim();
}

function activeFailures(key) {
  const now = Date.now();
  const attempts = (failedLogins.get(key) || []).filter(time => now - time < ATTEMPT_WINDOW_MS);
  if (attempts.length) failedLogins.set(key, attempts);
  else failedLogins.delete(key);
  return attempts;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      return res.status(200).json(await getAdminStatus(req));
    }

    if (req.method === 'DELETE') {
      clearSessionCookie(res);
      return res.status(204).end();
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const key = clientKey(req);
    const attempts = activeFailures(key);
    if (attempts.length >= MAX_ATTEMPTS) {
      res.setHeader('Retry-After', String(Math.ceil(
        (ATTEMPT_WINDOW_MS - (Date.now() - attempts[0])) / 1000
      )));
      return res.status(429).json({ error: '登录尝试过多，请 15 分钟后再试' });
    }

    const username = String(req.body?.username || '').trim();
    const password = String(req.body?.password || '');
    if (!(await verifyLogin(username, password))) {
      attempts.push(Date.now());
      failedLogins.set(key, attempts);
      return res.status(401).json({ error: '账号或密码不正确' });
    }

    failedLogins.delete(key);
    const token = await createSession(username);
    setSessionCookie(res, token);
    const status = await getAdminStatus({
      ...req,
      headers: {
        ...req.headers,
        cookie: `${req.headers.cookie || ''}; blog_admin_session=${encodeURIComponent(token)}`
      }
    });
    return res.status(200).json({
      authenticated: true,
      username,
      usingDefaultPassword: status.usingDefaultPassword
    });
  } catch (error) {
    console.error(error);
    const storageError = error.code === 'BLOG_ADMIN_STORAGE_UNAVAILABLE';
    return res.status(storageError ? 503 : 500).json({
      error: storageError ? error.message : '登录服务暂时不可用，请稍后重试'
    });
  }
};

const crypto = require('crypto');
const {
  createCredentialRecord,
  getCredentialRecord,
  hasRedis,
  setCredentialRecord
} = require('./blogAdminStore');

const COOKIE_NAME = 'blog_admin_session';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;
const INITIAL_USERNAME = 'Admin';
const INITIAL_PASSWORD = '123456';

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function passwordHash(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function validUsername(username) {
  return /^[A-Za-z0-9_.@-]{3,40}$/.test(username);
}

function validPassword(password) {
  return typeof password === 'string' && password.length >= 6 && password.length <= 128;
}

function cookieMap(header = '') {
  return Object.fromEntries(header.split(';').map(part => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function signature(payload, sessionSecret) {
  return crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
}

function newCredentialRecord(username, password, usingDefaultPassword = false) {
  const salt = crypto.randomBytes(18).toString('base64url');
  return {
    username,
    salt,
    hash: passwordHash(password, salt),
    sessionSecret: crypto.randomBytes(32).toString('base64url'),
    usingDefaultPassword,
    updatedAt: new Date().toISOString()
  };
}

async function ensureCredentials() {
  if (process.env.NODE_ENV === 'production' && !hasRedis()) {
    const error = new Error('生产环境尚未配置管理员持久化存储');
    error.code = 'BLOG_ADMIN_STORAGE_UNAVAILABLE';
    throw error;
  }

  let credentials = await getCredentialRecord();
  if (credentials) return credentials;

  await createCredentialRecord(newCredentialRecord(
    INITIAL_USERNAME,
    INITIAL_PASSWORD,
    true
  ));
  credentials = await getCredentialRecord();
  if (!credentials) throw new Error('无法初始化管理员账号');
  return credentials;
}

async function createSession(username) {
  let credentials = await ensureCredentials();
  if (!safeEqual(username, credentials.username)) return null;
  credentials = {
    ...credentials,
    sessionSecret: crypto.randomBytes(32).toString('base64url'),
    updatedAt: new Date().toISOString()
  };
  await setCredentialRecord(credentials);
  const issuedAt = Date.now();
  const payload = Buffer.from(JSON.stringify({
    username,
    issuedAt,
    expiresAt: issuedAt + SESSION_DURATION_MS
  })).toString('base64url');
  return `${payload}.${signature(payload, credentials.sessionSecret)}`;
}

async function readSession(req) {
  const credentials = await ensureCredentials();
  const token = cookieMap(req.headers.cookie || '')[COOKIE_NAME];
  if (!token) return null;
  const [payload, suppliedSignature] = token.split('.');
  if (!payload || !suppliedSignature
    || !safeEqual(signature(payload, credentials.sessionSecret), suppliedSignature)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!session.issuedAt || session.expiresAt <= Date.now()
      || !safeEqual(session.username, credentials.username)
      || session.issuedAt < Date.parse(credentials.updatedAt)) return null;
    return session;
  } catch {
    return null;
  }
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION_MS / 1000}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

async function verifyLogin(username, password) {
  const credentials = await ensureCredentials();
  if (!safeEqual(username, credentials.username)) return false;
  return safeEqual(passwordHash(password, credentials.salt), credentials.hash);
}

async function changeCredentials(currentPassword, newUsername, newPassword) {
  const credentials = await ensureCredentials();
  if (!(await verifyLogin(credentials.username, currentPassword))) {
    return { ok: false, status: 400, error: '当前密码不正确' };
  }

  const username = String(newUsername || credentials.username).trim();
  if (!validUsername(username)) {
    return {
      ok: false,
      status: 400,
      error: '账号需要 3–40 个字符，仅可使用字母、数字及 . _ @ -'
    };
  }
  if (newPassword && !validPassword(newPassword)) {
    return { ok: false, status: 400, error: '新密码需要 6–128 个字符' };
  }

  let salt = credentials.salt;
  let hash = credentials.hash;
  if (newPassword) {
    salt = crypto.randomBytes(18).toString('base64url');
    hash = passwordHash(newPassword, salt);
  }
  const usingDefaultPassword = newPassword
    ? safeEqual(newPassword, INITIAL_PASSWORD)
    : Boolean(credentials.usingDefaultPassword);
  await setCredentialRecord({
    ...credentials,
    username,
    salt,
    hash,
    sessionSecret: crypto.randomBytes(32).toString('base64url'),
    usingDefaultPassword,
    updatedAt: new Date().toISOString()
  });
  return { ok: true, username, usingDefaultPassword };
}

async function getAdminStatus(req) {
  const credentials = await ensureCredentials();
  const session = await readSession(req);
  return {
    authenticated: Boolean(session),
    username: session?.username || null,
    usingDefaultPassword: Boolean(session && credentials.usingDefaultPassword)
  };
}

async function requireAdmin(req, res) {
  try {
    const session = await readSession(req);
    if (session) return session;
    res.status(401).json({ error: '请先登录管理员账号' });
    return null;
  } catch (error) {
    if (error.code === 'BLOG_ADMIN_STORAGE_UNAVAILABLE') {
      res.status(503).json({ error: error.message });
      return null;
    }
    throw error;
  }
}

module.exports = {
  changeCredentials,
  clearSessionCookie,
  createSession,
  getAdminStatus,
  readSession,
  requireAdmin,
  setSessionCookie,
  verifyLogin
};

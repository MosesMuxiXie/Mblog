const crypto = require('crypto');
const {
  createCredentialRecord,
  getCredentialRecord,
  hasRedis,
  setCredentialRecord
} = require('./findatimeAdminStore');

const COOKIE_NAME = 'findatime_admin_session';
const SESSION_DURATION_MS = 12 * 60 * 60 * 1000;

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
  return typeof password === 'string' && password.length >= 10 && password.length <= 128;
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

async function isConfigured() {
  const credentials = await getCredentialRecord();
  return Boolean(credentials?.username && credentials?.salt
    && credentials?.hash && credentials?.sessionSecret);
}

async function setupAdmin(username, password, setupToken) {
  const expectedToken = String(process.env.FINDATIME_ADMIN_SETUP_TOKEN || '');
  if (process.env.NODE_ENV === 'production' && !hasRedis()) {
    return { ok: false, status: 503, error: '生产环境尚未配置持久化存储' };
  }
  if (expectedToken && !safeEqual(setupToken, expectedToken)) {
    return { ok: false, status: 403, error: '初始化口令不正确' };
  }
  if (!expectedToken && process.env.NODE_ENV === 'production') {
    return { ok: false, status: 503, error: '服务器尚未配置初始化口令' };
  }
  if (!validUsername(username)) {
    return { ok: false, status: 400, error: '账号需要 3–40 个字符，仅可使用字母、数字及 . _ @ -' };
  }
  if (!validPassword(password)) {
    return { ok: false, status: 400, error: '密码需要 10–128 个字符' };
  }

  const salt = crypto.randomBytes(18).toString('base64url');
  const created = await createCredentialRecord({
    username,
    salt,
    hash: passwordHash(password, salt),
    sessionSecret: crypto.randomBytes(32).toString('base64url'),
    updatedAt: new Date().toISOString()
  });
  if (!created) return { ok: false, status: 409, error: '管理员已经初始化，请直接登录' };
  return { ok: true, username };
}

async function createSession(username) {
  const credentials = await getCredentialRecord();
  if (!credentials || !safeEqual(username, credentials.username)) return null;
  const issuedAt = Date.now();
  const payload = Buffer.from(JSON.stringify({
    username,
    issuedAt,
    expiresAt: issuedAt + SESSION_DURATION_MS
  })).toString('base64url');
  return `${payload}.${signature(payload, credentials.sessionSecret)}`;
}

async function readSession(req) {
  const credentials = await getCredentialRecord();
  if (!credentials) return null;
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
  const credentials = await getCredentialRecord();
  if (!credentials || !safeEqual(username, credentials.username)) return false;
  return safeEqual(passwordHash(password, credentials.salt), credentials.hash);
}

async function changePassword(currentPassword, newPassword) {
  const credentials = await getCredentialRecord();
  if (!credentials || !(await verifyLogin(credentials.username, currentPassword))) {
    return { ok: false, error: '当前密码不正确' };
  }
  if (!validPassword(newPassword)) {
    return { ok: false, error: '新密码需要 10–128 个字符' };
  }
  const salt = crypto.randomBytes(18).toString('base64url');
  await setCredentialRecord({
    ...credentials,
    salt,
    hash: passwordHash(newPassword, salt),
    sessionSecret: crypto.randomBytes(32).toString('base64url'),
    updatedAt: new Date().toISOString()
  });
  return { ok: true, username: credentials.username };
}

async function requireAdmin(req, res) {
  const session = await readSession(req);
  if (session) return session;
  res.status(401).json({ error: '请先登录' });
  return null;
}

module.exports = {
  changePassword,
  clearSessionCookie,
  createSession,
  isConfigured,
  readSession,
  requireAdmin,
  setSessionCookie,
  setupAdmin,
  verifyLogin
};

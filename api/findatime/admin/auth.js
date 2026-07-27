const {
  clearSessionCookie,
  createSession,
  isConfigured,
  readSession,
  setSessionCookie,
  verifyLogin
} = require('../../../lib/findatimeAdminAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const session = await readSession(req);
    return res.status(200).json({
      authenticated: Boolean(session),
      configured: await isConfigured(),
      username: session?.username || null
    });
  }

  if (req.method === 'DELETE') {
    clearSessionCookie(res);
    return res.status(204).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await isConfigured())) {
    return res.status(409).json({ error: '请先完成管理员首次设置' });
  }

  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!(await verifyLogin(username, password))) {
    return res.status(401).json({ error: '账号或密码不正确' });
  }

  setSessionCookie(res, await createSession(username));
  return res.status(200).json({ authenticated: true, username });
};

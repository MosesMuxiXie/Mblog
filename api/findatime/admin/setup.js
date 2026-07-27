const {
  createSession,
  isConfigured,
  setSessionCookie,
  setupAdmin
} = require('../../../lib/findatimeAdminAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await isConfigured()) {
    return res.status(409).json({ error: '管理员已经初始化，请直接登录' });
  }

  try {
    const result = await setupAdmin(
      String(req.body?.username || '').trim(),
      String(req.body?.password || ''),
      String(req.body?.setupToken || '')
    );
    if (!result.ok) return res.status(result.status || 400).json({ error: result.error });
    const session = await createSession(result.username);
    setSessionCookie(res, session);
    return res.status(201).json({ authenticated: true, username: result.username });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '暂时无法初始化管理员' });
  }
};

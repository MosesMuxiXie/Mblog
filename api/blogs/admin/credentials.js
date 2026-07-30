const {
  changeCredentials,
  createSession,
  requireAdmin,
  setSessionCookie
} = require('../../../lib/blogAdminAuth');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!(await requireAdmin(req, res))) return;
    const result = await changeCredentials(
      String(req.body?.currentPassword || ''),
      String(req.body?.newUsername || ''),
      String(req.body?.newPassword || '')
    );
    if (!result.ok) return res.status(result.status || 400).json({ error: result.error });

    setSessionCookie(res, await createSession(result.username));
    return res.status(200).json({
      success: true,
      username: result.username,
      usingDefaultPassword: result.usingDefaultPassword
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '暂时无法修改管理员账号' });
  }
};

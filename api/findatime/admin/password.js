const {
  changePassword,
  createSession,
  requireAdmin,
  setSessionCookie
} = require('../../../lib/findatimeAdminAuth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await requireAdmin(req, res))) return;

  try {
    const result = await changePassword(
      String(req.body?.currentPassword || ''),
      String(req.body?.newPassword || '')
    );
    if (!result.ok) return res.status(400).json({ error: result.error });
    setSessionCookie(res, await createSession(result.username));
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '暂时无法修改密码' });
  }
};

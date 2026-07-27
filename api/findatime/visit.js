const { recordVisit } = require('../../lib/findatimeAdminStore');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const visitorId = String(req.body?.visitorId || '');
    const recorded = await recordVisit(visitorId);
    if (!recorded) return res.status(400).json({ error: '无效的访客标识' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(204).end();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '暂时无法记录访问' });
  }
};

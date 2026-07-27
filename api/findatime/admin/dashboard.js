const { requireAdmin } = require('../../../lib/findatimeAdminAuth');
const { buildDashboard } = require('../../../lib/findatimeDashboard');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await requireAdmin(req, res))) return;
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(await buildDashboard());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '暂时无法加载统计数据' });
  }
};

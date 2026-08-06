const { readSession: readBlogAdminSession } = require('../../../lib/blogAdminAuth');
const { readSession: readFindatimeAdminSession } = require('../../../lib/findatimeAdminAuth');
const { buildDashboard } = require('../../../lib/findatimeDashboard');

async function requireUnifiedAdmin(req, res) {
  const session = await readFindatimeAdminSession(req) || await readBlogAdminSession(req);
  if (session) return session;
  res.status(401).json({ error: '请先登录管理员账号' });
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await requireUnifiedAdmin(req, res))) return;
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(await buildDashboard());
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '暂时无法加载统计数据' });
  }
};

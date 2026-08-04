const { requireAdmin } = require('../lib/blogAdminAuth');
const {
  getSiteSettingsRecord,
  setSiteSettingsRecord
} = require('../lib/blogAdminStore');
const {
  publicSiteSettings,
  validateCoverImage
} = require('../lib/siteSettings');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      return res.status(200).json(publicSiteSettings(await getSiteSettingsRecord()));
    }

    if (req.method === 'PUT') {
      if (!(await requireAdmin(req, res))) return;
      const validation = validateCoverImage(req.body?.coverImage);
      if (validation.error) return res.status(400).json({ error: validation.error });

      const record = {
        coverImage: validation.coverImage,
        updatedAt: new Date().toISOString()
      };
      await setSiteSettingsRecord(record);
      return res.status(200).json({
        success: true,
        ...publicSiteSettings(record)
      });
    }

    if (req.method === 'DELETE') {
      if (!(await requireAdmin(req, res))) return;
      const record = { coverImage: '', updatedAt: new Date().toISOString() };
      await setSiteSettingsRecord(record);
      return res.status(200).json({
        success: true,
        ...publicSiteSettings(record)
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '网站封面暂时无法保存，请稍后重试' });
  }
};

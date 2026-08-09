const { requireAdmin } = require('../lib/blogAdminAuth');
const {
  getSiteSettingsRecord,
  setSiteSettingsRecord
} = require('../lib/blogAdminStore');
const {
  publicSiteSettings,
  validateCoverImage,
  validateHomepageLayout
} = require('../lib/siteSettings');

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  try {
    if (req.method === 'GET') {
      return res.status(200).json(publicSiteSettings(await getSiteSettingsRecord()));
    }

    if (req.method === 'PUT') {
      if (!(await requireAdmin(req, res))) return;
      const current = await getSiteSettingsRecord() || {};
      const hasCoverImage = Object.prototype.hasOwnProperty.call(req.body || {}, 'coverImage');
      const hasLayout = Object.prototype.hasOwnProperty.call(req.body || {}, 'layout');
      if (!hasCoverImage && !hasLayout) {
        return res.status(400).json({ error: '没有可保存的站点设置' });
      }

      const coverValidation = hasCoverImage
        ? validateCoverImage(req.body.coverImage)
        : { coverImage: String(current.coverImage || '') };
      if (coverValidation.error) return res.status(400).json({ error: coverValidation.error });

      const layoutValidation = hasLayout
        ? validateHomepageLayout(req.body.layout)
        : validateHomepageLayout(current.layout);
      if (layoutValidation.error) return res.status(400).json({ error: layoutValidation.error });

      const record = {
        coverImage: coverValidation.coverImage,
        layout: layoutValidation.layout,
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
      const current = await getSiteSettingsRecord() || {};
      const record = {
        coverImage: '',
        layout: validateHomepageLayout(current.layout).layout,
        updatedAt: new Date().toISOString()
      };
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

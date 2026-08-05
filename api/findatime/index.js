const crypto = require('crypto');
const { createMeeting } = require('../../lib/meetingStore');
const { normalizeMeetingSlots, validTimeZone } = require('../../lib/meetingTime');
const { normalizeName } = require('../../lib/findatimeMeeting');
const { recordVisit } = require('../../lib/findatimeAdminStore');

function sendError(res, status, error, code) {
  return res.status(status).json({ error, ...(code ? { code } : {}) });
}

async function handleVisit(req, res) {
  try {
    const visitorId = String(req.body?.visitorId || '');
    const recorded = await recordVisit(visitorId);
    if (!recorded) return sendError(res, 400, '无效的访客标识');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(204).end();
  } catch (error) {
    console.error(error);
    return sendError(res, 500, '暂时无法记录访问');
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');
  if (String(req.query?.operation || '') === 'visit') return handleVisit(req, res);

  try {
    const title = String(req.body?.title || '').trim().slice(0, 80);
    const duration = Number(req.body?.duration);
    const submittedSlots = Array.isArray(req.body?.slots) ? req.body.slots : [];
    const submittedTimeZone = req.body?.timezone;
    const timezone = submittedTimeZone == null ? 'Asia/Shanghai' : String(submittedTimeZone);
    const slots = normalizeMeetingSlots(submittedSlots, submittedTimeZone == null);
    const creatorName = normalizeName(req.body?.name);

    if (!title) return sendError(res, 400, '请输入约会名称', 'enterMeetingName');
    if (!creatorName) return sendError(res, 400, '请输入姓名', 'enterParticipantName');
    if (!Number.isInteger(duration) || duration < 30 || duration > 480 || duration % 30 !== 0) {
      return sendError(res, 400, '时长必须为 30 分钟到 8 小时，并以 30 分钟递增');
    }
    if (!validTimeZone(timezone)) return sendError(res, 400, '浏览器时区无效');
    if (!slots || !slots.length || slots.length > 10) {
      return sendError(res, 400, '请选择 1–10 个有效的整点或半点时间');
    }

    const id = `ua${crypto.randomBytes(7).toString('hex')}`;
    const creatorToken = crypto.randomBytes(18).toString('base64url');
    const meetingSlots = slots.map((start, index) => ({
      id: `t${index + 1}`,
      start
    }));
    const meeting = {
      id,
      title,
      duration,
      timezone,
      createdAt: new Date().toISOString(),
      slots: meetingSlots
    };
    const creator = {
      token: creatorToken,
      name: creatorName,
      availability: meetingSlots.map(slot => slot.id),
      unavailable: false,
      submittedAt: new Date().toISOString()
    };

    await createMeeting(meeting, creator);
    return res.status(201).json({ id, creatorToken, url: `/findatime/uuid/${id}` });
  } catch (error) {
    console.error(error);
    return sendError(res, 500, '暂时无法创建约会，请稍后重试');
  }
};

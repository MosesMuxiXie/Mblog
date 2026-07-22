const crypto = require('crypto');
const { createMeeting } = require('../../lib/meetingStore');

function sendError(res, status, error) {
  return res.status(status).json({ error });
}

function validLocalDateTime(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day, hour, minute));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day && hour >= 0 && hour <= 23 && (minute === 0 || minute === 30);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return sendError(res, 405, 'Method not allowed');

  try {
    const title = String(req.body?.title || '').trim().slice(0, 80);
    const duration = Number(req.body?.duration);
    const submittedSlots = Array.isArray(req.body?.slots) ? req.body.slots : [];
    const slots = [...new Set(submittedSlots.map(value => String(value)))].sort();

    if (!title) return sendError(res, 400, '请输入约会名称');
    if (!Number.isInteger(duration) || duration < 30 || duration > 480 || duration % 30 !== 0) {
      return sendError(res, 400, '时长必须为 30 分钟到 8 小时，并以 30 分钟递增');
    }
    if (!slots.length || slots.length > 10 || slots.some(value => !validLocalDateTime(value))) {
      return sendError(res, 400, '请选择 1–10 个有效的整点或半点时间');
    }

    const id = `ua${crypto.randomBytes(7).toString('hex')}`;
    const creatorToken = crypto.randomBytes(18).toString('base64url');
    const meetingSlots = slots.map((start, index) => ({
      id: `t${index + 1}`,
      start: `${start}:00+08:00`
    }));
    const meeting = {
      id,
      title,
      duration,
      timezone: 'Asia/Shanghai',
      createdAt: new Date().toISOString(),
      slots: meetingSlots
    };
    const creator = {
      token: creatorToken,
      name: '创建者',
      availability: meetingSlots.map(slot => slot.id),
      submittedAt: new Date().toISOString()
    };

    await createMeeting(meeting, creator);
    return res.status(201).json({ id, creatorToken, url: `/findatime/uuid/${id}` });
  } catch (error) {
    console.error(error);
    return sendError(res, 500, '暂时无法创建约会，请稍后重试');
  }
};

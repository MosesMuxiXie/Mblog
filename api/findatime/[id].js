const crypto = require('crypto');
const { getMeeting, saveParticipant } = require('../../lib/meetingStore');
const { normalizeName, publicMeeting } = require('../../lib/findatimeMeeting');

module.exports = async function handler(req, res) {
  const id = String(req.query?.id || req.params?.id || '');
  if (!/^ua[a-f0-9]{14}$/.test(id)) {
    return res.status(404).json({ error: '找不到这个约会' });
  }

  try {
    const meeting = await getMeeting(id);
    if (!meeting) return res.status(404).json({ error: '找不到这个约会' });

    if (req.method === 'GET') return res.status(200).json(publicMeeting(meeting));
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const name = normalizeName(req.body?.name);
    const unavailable = req.body?.unavailable === true;
    const validSlotIds = new Set(meeting.slots.map(slot => slot.id));
    const availability = unavailable
      ? []
      : [...new Set(Array.isArray(req.body?.availability) ? req.body.availability : [])]
        .filter(slotId => validSlotIds.has(slotId));
    const suppliedToken = String(req.body?.participantToken || '');
    const participantToken = /^[A-Za-z0-9_-]{16,64}$/.test(suppliedToken)
      ? suppliedToken
      : crypto.randomBytes(18).toString('base64url');

    if (!name) return res.status(400).json({ error: '请输入姓名', code: 'enterParticipantName' });
    if (!unavailable && !availability.length) {
      return res.status(400).json({
        error: '请至少选择一个方便的时间，或选择“无法参加”',
        code: 'chooseAvailability'
      });
    }

    const submittedAt = new Date().toISOString();
    const updated = await saveParticipant(id, {
      token: participantToken,
      name,
      availability,
      unavailable,
      submittedAt
    });
    return res.status(200).json({
      meeting: publicMeeting(updated),
      participantToken
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '暂时无法保存，请稍后重试' });
  }
};

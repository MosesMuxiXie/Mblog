const crypto = require('crypto');
const { getMeeting, saveParticipant } = require('../../lib/meetingStore');

function publicMeeting(meeting) {
  const participants = meeting.participants || [];
  const counts = Object.fromEntries(meeting.slots.map(slot => [slot.id, 0]));
  const attendees = Object.fromEntries(meeting.slots.map(slot => [slot.id, []]));
  participants.forEach(person => {
    [...new Set(person.availability || [])].forEach(slotId => {
      if (Object.prototype.hasOwnProperty.call(counts, slotId)) {
        counts[slotId] += 1;
        attendees[slotId].push(person.name);
      }
    });
  });

  return {
    id: meeting.id,
    title: meeting.title,
    duration: meeting.duration,
    timezone: meeting.timezone,
    createdAt: meeting.createdAt,
    slots: meeting.slots.map(slot => ({ ...slot, votes: counts[slot.id], attendees: attendees[slot.id] })),
    participantCount: participants.length
  };
}

module.exports = async function handler(req, res) {
  const id = String(req.query?.id || '');
  if (!/^ua[a-f0-9]{14}$/.test(id)) return res.status(404).json({ error: '找不到这个约会' });

  try {
    const meeting = await getMeeting(id);
    if (!meeting) return res.status(404).json({ error: '找不到这个约会' });

    if (req.method === 'GET') return res.status(200).json(publicMeeting(meeting));
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const name = String(req.body?.name || '').trim().slice(0, 40);
    const validSlotIds = new Set(meeting.slots.map(slot => slot.id));
    const availability = [...new Set(Array.isArray(req.body?.availability) ? req.body.availability : [])]
      .filter(slotId => validSlotIds.has(slotId));
    const suppliedToken = String(req.body?.participantToken || '');
    const participantToken = /^[A-Za-z0-9_-]{16,64}$/.test(suppliedToken)
      ? suppliedToken
      : crypto.randomBytes(18).toString('base64url');

    if (!name) return res.status(400).json({ error: '请输入姓名' });
    if (!availability.length) return res.status(400).json({ error: '请至少选择一个方便的时间' });

    const updated = await saveParticipant(id, {
      token: participantToken,
      name,
      availability,
      submittedAt: new Date().toISOString()
    });
    return res.status(200).json({ meeting: publicMeeting(updated), participantToken });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: '暂时无法保存，请稍后重试' });
  }
};

const crypto = require('crypto');
const {
  getMeeting,
  getComments,
  saveComment,
  withdrawComment,
  saveParticipant
} = require('../../lib/meetingStore');
const { normalizeName, publicMeeting } = require('../../lib/findatimeMeeting');

function sendError(res, status, error, code) {
  return res.status(status).json({ error, ...(code ? { code } : {}) });
}

function publicComment(comment, participantToken = '') {
  return {
    id: comment.id,
    parentId: comment.parentId || null,
    name: comment.name,
    text: comment.withdrawn ? '' : comment.text,
    createdAt: comment.createdAt,
    withdrawn: Boolean(comment.withdrawn),
    owned: Boolean(participantToken && comment.participantToken === participantToken)
  };
}

function headerParticipantToken(req) {
  return String(
    req.headers?.['x-participant-token']
    || req.headers?.['X-Participant-Token']
    || ''
  );
}

async function handleComments(req, res, meeting, id) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') {
    const comments = await getComments(id);
    const participantToken = headerParticipantToken(req);
    return res.status(200).json({
      comments: comments.map(comment => publicComment(comment, participantToken))
    });
  }
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return sendError(res, 405, 'Method not allowed');
  }

  const participantToken = String(req.body?.participantToken || '');
  const participant = (meeting.participants || []).find(person => person.token === participantToken);
  if (!participant || !/^[A-Za-z0-9_-]{16,64}$/.test(participantToken)) {
    return sendError(
      res,
      403,
      'Submit your availability before joining the conversation.',
      'submitAvailabilityFirst'
    );
  }

  if (req.method === 'DELETE') {
    const commentId = String(req.body?.commentId || '');
    if (!/^c[a-f0-9]{16}$/.test(commentId)) {
      return sendError(res, 400, 'This comment cannot be withdrawn.', 'invalidComment');
    }

    const result = await withdrawComment(id, commentId, participantToken);
    if (result.status === 'meetingNotFound') {
      return sendError(res, 404, 'This meeting could not be found.', 'meetingNotFound');
    }
    if (result.status === 'notFound') {
      return sendError(res, 404, 'This comment no longer exists.', 'commentNotFound');
    }
    if (result.status === 'forbidden') {
      return sendError(res, 403, 'You can only withdraw your own comments.', 'notCommentOwner');
    }
    return res.status(200).json({
      comments: result.comments.map(comment => publicComment(comment, participantToken))
    });
  }

  const text = String(req.body?.text || '').trim().slice(0, 1000);
  if (!text) return sendError(res, 400, 'Write a comment first.', 'writeCommentFirst');

  const parentId = req.body?.parentId == null ? null : String(req.body.parentId);
  if (parentId) {
    if (!/^c[a-f0-9]{16}$/.test(parentId)) {
      return sendError(res, 400, 'This comment cannot be replied to.', 'invalidReplyTarget');
    }
    const comments = await getComments(id);
    const parent = comments.find(comment => comment.id === parentId);
    if (!parent || parent.parentId || parent.withdrawn) {
      return sendError(res, 400, 'This comment cannot be replied to.', 'invalidReplyTarget');
    }
  }

  const comment = {
    id: `c${crypto.randomBytes(8).toString('hex')}`,
    parentId,
    participantToken,
    name: participant.name,
    text,
    createdAt: new Date().toISOString()
  };
  const comments = await saveComment(id, comment);
  if (!comments) return sendError(res, 404, 'This meeting could not be found.', 'meetingNotFound');

  return res.status(201).json({
    comment: publicComment(comment, participantToken),
    comments: comments.map(item => publicComment(item, participantToken))
  });
}

module.exports = async function handler(req, res) {
  const id = String(req.query?.id || req.params?.id || '');
  if (!/^ua[a-f0-9]{14}$/.test(id)) {
    return res.status(404).json({ error: '找不到这个约会' });
  }

  try {
    const meeting = await getMeeting(id);
    if (!meeting) return res.status(404).json({ error: '找不到这个约会' });

    const commentsRequest = req.query?.comments === '1'
      || req.body?.action === 'comment'
      || req.body?.action === 'withdrawComment';
    if (commentsRequest) return handleComments(req, res, meeting, id);

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

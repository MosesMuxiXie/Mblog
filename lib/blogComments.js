const crypto = require('crypto');

const COMMENT_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function fallbackCommentId(comment, index) {
  const fingerprint = JSON.stringify([
    comment?.name || '',
    comment?.text || '',
    comment?.date || '',
    comment?.createdAt || '',
    index
  ]);
  return `legacy_${crypto.createHash('sha256').update(fingerprint).digest('hex').slice(0, 20)}`;
}

function normalizeComments(value) {
  const comments = Array.isArray(value) ? value : [];
  return comments.map((comment, index) => ({
    ...comment,
    id: COMMENT_ID_PATTERN.test(String(comment?.id || ''))
      ? String(comment.id)
      : fallbackCommentId(comment, index),
    parentId: COMMENT_ID_PATTERN.test(String(comment?.parentId || ''))
      ? String(comment.parentId)
      : null
  }));
}

function publicComment(comment) {
  return {
    id: comment.id,
    parentId: comment.parentId || null,
    name: cleanText(comment.name, 40),
    text: comment.withdrawn ? '' : cleanText(comment.text, 2000),
    date: comment.date || String(comment.createdAt || '').slice(0, 10),
    createdAt: comment.createdAt || null,
    updatedAt: comment.updatedAt || null,
    withdrawn: Boolean(comment.withdrawn)
  };
}

function publicComments(comments) {
  return normalizeComments(comments).map(publicComment);
}

function createComment({ name, text, parentId }) {
  const now = new Date();
  const editToken = crypto.randomBytes(32).toString('base64url');
  return {
    comment: {
      id: `comment_${now.getTime().toString(36)}_${crypto.randomBytes(6).toString('hex')}`,
      parentId: parentId || null,
      name: cleanText(name, 40),
      text: cleanText(text, 2000),
      date: now.toISOString().slice(0, 10),
      createdAt: now.toISOString(),
      updatedAt: null,
      withdrawn: false,
      ownerTokenHash: hashToken(editToken)
    },
    editToken
  };
}

function hashToken(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function ownsComment(comment, token) {
  const storedHash = String(comment?.ownerTokenHash || '');
  if (!/^[a-f0-9]{64}$/.test(storedHash) || !token) return false;
  return crypto.timingSafeEqual(
    Buffer.from(storedHash, 'hex'),
    Buffer.from(hashToken(token), 'hex')
  );
}

module.exports = {
  COMMENT_ID_PATTERN,
  cleanText,
  createComment,
  normalizeComments,
  ownsComment,
  publicComment,
  publicComments
};

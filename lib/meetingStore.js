const fs = require('fs');
const path = require('path');

const DATA_FILE = process.env.FINDATIME_DATA_FILE || path.join(process.cwd(), 'findatime-meetings.json');
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

function hasRedis() {
  return Boolean(redisUrl && redisToken);
}

async function redis(command) {
  const response = await fetch(redisUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${redisToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(command)
  });

  if (!response.ok) throw new Error(`Redis request failed (${response.status})`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

function readLocal() {
  if (!fs.existsSync(DATA_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeLocal(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

async function createMeeting(meeting, creator) {
  if (hasRedis()) {
    await redis(['SET', `findatime:meeting:${meeting.id}`, JSON.stringify(meeting), 'NX']);
    await redis(['HSET', `findatime:participants:${meeting.id}`, creator.token, JSON.stringify(creator)]);
    return;
  }

  const data = readLocal();
  data[meeting.id] = { ...meeting, participants: [creator] };
  writeLocal(data);
}

async function getMeeting(id) {
  if (hasRedis()) {
    const rawMeeting = await redis(['GET', `findatime:meeting:${id}`]);
    if (!rawMeeting) return null;
    const participantPairs = await redis(['HGETALL', `findatime:participants:${id}`]);
    const participants = [];
    for (let index = 1; index < (participantPairs || []).length; index += 2) {
      participants.push(JSON.parse(participantPairs[index]));
    }
    return { ...JSON.parse(rawMeeting), participants };
  }

  const data = readLocal();
  return data[id] || null;
}

async function getComments(id) {
  if (hasRedis()) {
    const commentPairs = await redis(['HGETALL', `findatime:comments:${id}`]);
    const comments = [];
    for (let index = 1; index < (commentPairs || []).length; index += 2) {
      try {
        comments.push(JSON.parse(commentPairs[index]));
      } catch {
        // Ignore a malformed comment instead of hiding the conversation.
      }
    }
    return comments.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  const data = readLocal();
  const comments = data[id]?.comments;
  return Array.isArray(comments) ? [...comments] : [];
}

async function saveComment(id, comment) {
  if (hasRedis()) {
    await redis(['HSET', `findatime:comments:${id}`, comment.id, JSON.stringify(comment)]);
    return getComments(id);
  }

  const data = readLocal();
  if (!data[id]) return null;
  data[id].comments = Array.isArray(data[id].comments) ? data[id].comments : [];
  data[id].comments.push(comment);
  writeLocal(data);
  return [...data[id].comments];
}

async function withdrawComment(id, commentId, participantToken) {
  if (hasRedis()) {
    const comments = await getComments(id);
    const comment = comments.find(item => item.id === commentId);
    if (!comment || comment.withdrawn) return { status: 'notFound', comments };
    if (comment.participantToken !== participantToken) return { status: 'forbidden', comments };

    const hasReplies = comments.some(item => item.parentId === commentId);
    if (hasReplies) {
      const { participantToken: _participantToken, ...withdrawnComment } = comment;
      await redis(['HSET', `findatime:comments:${id}`, commentId, JSON.stringify({
        ...withdrawnComment,
        text: '',
        withdrawn: true,
        withdrawnAt: new Date().toISOString()
      })]);
    } else {
      await redis(['HDEL', `findatime:comments:${id}`, commentId]);
    }
    return { status: 'withdrawn', comments: await getComments(id) };
  }

  const data = readLocal();
  if (!data[id]) return { status: 'meetingNotFound', comments: [] };
  const comments = Array.isArray(data[id].comments) ? data[id].comments : [];
  const commentIndex = comments.findIndex(item => item.id === commentId);
  const comment = comments[commentIndex];
  if (!comment || comment.withdrawn) return { status: 'notFound', comments: [...comments] };
  if (comment.participantToken !== participantToken) {
    return { status: 'forbidden', comments: [...comments] };
  }

  const hasReplies = comments.some(item => item.parentId === commentId);
  if (hasReplies) {
    const { participantToken: _participantToken, ...withdrawnComment } = comment;
    comments[commentIndex] = {
      ...withdrawnComment,
      text: '',
      withdrawn: true,
      withdrawnAt: new Date().toISOString()
    };
  } else {
    comments.splice(commentIndex, 1);
  }
  data[id].comments = comments;
  writeLocal(data);
  return { status: 'withdrawn', comments: [...comments] };
}

async function saveParticipant(id, participant) {
  if (hasRedis()) {
    await redis(['HSET', `findatime:participants:${id}`, participant.token, JSON.stringify(participant)]);
    return getMeeting(id);
  }

  const data = readLocal();
  if (!data[id]) return null;
  const participants = data[id].participants || [];
  const existing = participants.findIndex(item => item.token === participant.token);
  if (existing >= 0) participants[existing] = participant;
  else participants.push(participant);
  data[id].participants = participants;
  writeLocal(data);
  return data[id];
}

async function listMeetings() {
  if (hasRedis()) {
    let cursor = '0';
    const keys = [];
    do {
      const result = await redis(['SCAN', cursor, 'MATCH', 'findatime:meeting:*', 'COUNT', 500]);
      cursor = String(result?.[0] || '0');
      keys.push(...(result?.[1] || []));
    } while (cursor !== '0');

    return Promise.all(keys.map(async key => {
      const id = key.slice('findatime:meeting:'.length);
      const [rawMeeting, participantPairs] = await Promise.all([
        redis(['GET', key]),
        redis(['HGETALL', `findatime:participants:${id}`])
      ]);
      if (!rawMeeting) return null;
      const participants = [];
      for (let index = 1; index < (participantPairs || []).length; index += 2) {
        try {
          participants.push(JSON.parse(participantPairs[index]));
        } catch {
          // Ignore a malformed participant record instead of hiding the dashboard.
        }
      }
      return { ...JSON.parse(rawMeeting), participants };
    })).then(meetings => meetings.filter(Boolean));
  }

  return Object.values(readLocal());
}

module.exports = {
  createMeeting,
  getMeeting,
  getComments,
  saveComment,
  withdrawComment,
  saveParticipant,
  listMeetings,
  hasRedis
};

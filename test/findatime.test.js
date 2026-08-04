const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { normalizeName, publicMeeting } = require('../lib/findatimeMeeting');

function sampleMeeting() {
  return {
    id: 'ua0123456789abcd',
    title: '项目启动会',
    duration: 60,
    timezone: 'Asia/Shanghai',
    createdAt: '2026-07-31T00:00:00.000Z',
    slots: [
      { id: 't1', start: '2026-08-03T02:00:00.000Z' },
      { id: 't2', start: '2026-08-03T06:00:00.000Z' }
    ],
    participants: [
      {
        token: 'creator-token-123456',
        name: '小明',
        availability: ['t1', 't2'],
        submittedAt: '2026-07-31T00:00:00.000Z'
      },
      {
        token: 'participant-token-1',
        name: '小红',
        availability: ['t1'],
        submittedAt: '2026-07-31T01:00:00.000Z'
      }
    ]
  };
}

test('normalizes participant names', () => {
  assert.equal(normalizeName('  小明  '), '小明');
  assert.equal(normalizeName(''), '');
  assert.equal(normalizeName('a'.repeat(50)).length, 40);
});

test('publishes time attendees and people who cannot attend', () => {
  const source = sampleMeeting();
  source.participants.push({
    token: 'participant-token-unavailable',
    name: '小李',
    availability: ['t1'],
    unavailable: true,
    submittedAt: '2026-07-31T02:00:00.000Z'
  });
  const meeting = publicMeeting(source);
  assert.equal(meeting.participantCount, 3);
  assert.equal(meeting.slots[0].votes, 2);
  assert.deepEqual(meeting.slots[0].attendees, ['小明', '小红']);
  assert.deepEqual(meeting.unavailable, { count: 1, attendees: ['小李'] });
});

function invoke(handler, req) {
  let statusCode = 200;
  let payload;
  const res = {
    setHeader() {},
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      payload = body;
      return this;
    }
  };
  return Promise.resolve(handler(req, res)).then(() => ({ statusCode, payload }));
}

test('creates a meeting, updates availability, and supports comments and replies', async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'findatime-test-'));
  const originalDataFile = process.env.FINDATIME_DATA_FILE;
  process.env.FINDATIME_DATA_FILE = path.join(temporaryDirectory, 'meetings.json');

  const storePath = require.resolve('../lib/meetingStore');
  const createPath = require.resolve('../api/findatime/index');
  const meetingPath = require.resolve('../api/findatime/[id]');
  delete require.cache[storePath];
  delete require.cache[createPath];
  delete require.cache[meetingPath];
  const createHandler = require(createPath);
  const meetingHandler = require(meetingPath);
  const baseMeeting = {
    method: 'POST',
    body: {
      title: '项目启动会',
      name: '小明',
      duration: 60,
      timezone: 'Asia/Shanghai',
      slots: ['2026-08-03T02:00:00.000Z']
    }
  };

  try {
    const missingCreatorName = await invoke(createHandler, {
      ...baseMeeting,
      body: { ...baseMeeting.body, name: '' }
    });
    assert.equal(missingCreatorName.statusCode, 400);
    assert.equal(missingCreatorName.payload.code, 'enterParticipantName');

    const created = await invoke(createHandler, baseMeeting);
    assert.equal(created.statusCode, 201);

    const missingParticipantName = await invoke(meetingHandler, {
      method: 'POST',
      query: { id: created.payload.id },
      body: { availability: ['t1'] }
    });
    assert.equal(missingParticipantName.statusCode, 400);
    assert.equal(missingParticipantName.payload.code, 'enterParticipantName');

    const noChoice = await invoke(meetingHandler, {
      method: 'POST',
      query: { id: created.payload.id },
      body: { name: '小红', availability: [] }
    });
    assert.equal(noChoice.statusCode, 400);
    assert.equal(noChoice.payload.code, 'chooseAvailability');

    const updated = await invoke(meetingHandler, {
      method: 'POST',
      query: { id: created.payload.id },
      body: { name: '小红', availability: ['t1'] }
    });
    assert.equal(updated.statusCode, 200);
    assert.equal(updated.payload.meeting.participantCount, 2);
    assert.equal(updated.payload.meeting.slots[0].votes, 2);
    assert.equal(Object.prototype.hasOwnProperty.call(updated.payload, 'notificationSent'), false);

    const declined = await invoke(meetingHandler, {
      method: 'POST',
      query: { id: created.payload.id },
      body: {
        name: '小红',
        availability: ['t1'],
        unavailable: true,
        participantToken: updated.payload.participantToken
      }
    });
    assert.equal(declined.statusCode, 200);
    assert.equal(declined.payload.meeting.participantCount, 2);
    assert.equal(declined.payload.meeting.slots[0].votes, 1);
    assert.deepEqual(declined.payload.meeting.unavailable, {
      count: 1,
      attendees: ['小红']
    });

    const commentWithoutAvailability = await invoke(meetingHandler, {
      method: 'POST',
      query: { id: created.payload.id },
      body: { action: 'comment', text: 'Can we start a little later?' }
    });
    assert.equal(commentWithoutAvailability.statusCode, 403);
    assert.equal(commentWithoutAvailability.payload.code, 'submitAvailabilityFirst');

    const comment = await invoke(meetingHandler, {
      method: 'POST',
      query: { id: created.payload.id },
      body: {
        action: 'comment',
        text: 'Can we start a little later?',
        participantToken: created.payload.creatorToken
      }
    });
    assert.equal(comment.statusCode, 201);
    assert.equal(comment.payload.comment.parentId, null);
    assert.equal(Object.prototype.hasOwnProperty.call(comment.payload.comment, 'participantToken'), false);

    const reply = await invoke(meetingHandler, {
      method: 'POST',
      query: { id: created.payload.id },
      body: {
        action: 'comment',
        text: 'That works for me.',
        parentId: comment.payload.comment.id,
        participantToken: updated.payload.participantToken
      }
    });
    assert.equal(reply.statusCode, 201);
    assert.equal(reply.payload.comment.parentId, comment.payload.comment.id);

    const nestedReply = await invoke(meetingHandler, {
      method: 'POST',
      query: { id: created.payload.id },
      body: {
        action: 'comment',
        text: 'A nested reply',
        parentId: reply.payload.comment.id,
        participantToken: created.payload.creatorToken
      }
    });
    assert.equal(nestedReply.statusCode, 400);
    assert.equal(nestedReply.payload.code, 'invalidReplyTarget');

    const conversation = await invoke(meetingHandler, {
      method: 'GET',
      query: { id: created.payload.id, comments: '1' }
    });
    assert.equal(conversation.statusCode, 200);
    assert.equal(conversation.payload.comments.length, 2);
    assert.deepEqual(
      conversation.payload.comments.map(item => item.text),
      ['Can we start a little later?', 'That works for me.']
    );
    assert.deepEqual(conversation.payload.comments.map(item => item.owned), [false, false]);

    const ownedConversation = await invoke(meetingHandler, {
      method: 'GET',
      query: { id: created.payload.id, comments: '1' },
      headers: { 'x-participant-token': created.payload.creatorToken }
    });
    assert.deepEqual(ownedConversation.payload.comments.map(item => item.owned), [true, false]);

    const rejectedWithdrawal = await invoke(meetingHandler, {
      method: 'DELETE',
      query: { id: created.payload.id },
      body: {
        action: 'withdrawComment',
        commentId: comment.payload.comment.id,
        participantToken: updated.payload.participantToken
      }
    });
    assert.equal(rejectedWithdrawal.statusCode, 403);
    assert.equal(rejectedWithdrawal.payload.code, 'notCommentOwner');

    const withdrawnRoot = await invoke(meetingHandler, {
      method: 'DELETE',
      query: { id: created.payload.id },
      body: {
        action: 'withdrawComment',
        commentId: comment.payload.comment.id,
        participantToken: created.payload.creatorToken
      }
    });
    assert.equal(withdrawnRoot.statusCode, 200);
    assert.equal(withdrawnRoot.payload.comments.length, 2);
    assert.equal(withdrawnRoot.payload.comments[0].withdrawn, true);
    assert.equal(withdrawnRoot.payload.comments[0].text, '');
    assert.equal(withdrawnRoot.payload.comments[0].owned, false);

    const withdrawnReply = await invoke(meetingHandler, {
      method: 'DELETE',
      query: { id: created.payload.id },
      body: {
        action: 'withdrawComment',
        commentId: reply.payload.comment.id,
        participantToken: updated.payload.participantToken
      }
    });
    assert.equal(withdrawnReply.statusCode, 200);
    assert.equal(withdrawnReply.payload.comments.length, 1);
    assert.equal(withdrawnReply.payload.comments[0].withdrawn, true);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    if (originalDataFile == null) delete process.env.FINDATIME_DATA_FILE;
    else process.env.FINDATIME_DATA_FILE = originalDataFile;
    delete require.cache[storePath];
    delete require.cache[createPath];
    delete require.cache[meetingPath];
  }
});

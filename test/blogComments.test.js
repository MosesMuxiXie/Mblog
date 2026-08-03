const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function invoke(handler, req) {
  let statusCode = 200;
  let payload;
  const headers = {};
  const res = {
    setHeader(name, value) {
      headers[name] = value;
    },
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      payload = body;
      return this;
    }
  };
  return Promise.resolve(handler(req, res)).then(() => ({ statusCode, payload, headers }));
}

test('blog comments support replies, owner-only edits, and safe withdrawal', async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'blog-comments-test-'));
  const dataFile = path.join(temporaryDirectory, 'blogs.json');
  fs.writeFileSync(dataFile, JSON.stringify([{
    id: 'post-1',
    slug: 'post-one',
    title: 'Test post',
    content: 'Body',
    comments: []
  }]));

  const environmentKeys = [
    'BLOG_DATA_FILE',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN'
  ];
  const originalEnvironment = Object.fromEntries(environmentKeys.map(key => [key, process.env[key]]));
  process.env.BLOG_DATA_FILE = dataFile;
  environmentKeys.slice(1).forEach(key => delete process.env[key]);

  const storePath = require.resolve('../lib/blogStore');
  const commentsPath = require.resolve('../api/blogs/[id]/comments');
  const blogPath = require.resolve('../api/blogs/[id]');
  delete require.cache[storePath];
  delete require.cache[commentsPath];
  delete require.cache[blogPath];

  const commentsHandler = require(commentsPath);
  const blogHandler = require(blogPath);

  try {
    const root = await invoke(commentsHandler, {
      method: 'POST',
      query: { id: 'post-1' },
      body: { name: 'Moses', text: 'First comment' }
    });
    assert.equal(root.statusCode, 201);
    assert.match(root.payload.comment.id, /^comment_/);
    assert.equal(root.payload.comment.parentId, null);
    assert.equal(typeof root.payload.editToken, 'string');
    assert.equal(Object.hasOwn(root.payload.comment, 'ownerTokenHash'), false);

    const publicPost = await invoke(blogHandler, {
      method: 'GET',
      query: { id: 'post-one' }
    });
    assert.equal(publicPost.statusCode, 200);
    assert.equal(publicPost.payload.comments.length, 1);
    assert.equal(Object.hasOwn(publicPost.payload.comments[0], 'ownerTokenHash'), false);

    const rejectedEdit = await invoke(commentsHandler, {
      method: 'PATCH',
      query: { id: 'post-1' },
      body: { commentId: root.payload.comment.id, text: 'Changed by someone else', editToken: 'wrong' }
    });
    assert.equal(rejectedEdit.statusCode, 403);
    assert.equal(rejectedEdit.payload.code, 'notCommentOwner');

    const edited = await invoke(commentsHandler, {
      method: 'PATCH',
      query: { id: 'post-1' },
      body: { commentId: root.payload.comment.id, text: 'Edited comment', editToken: root.payload.editToken }
    });
    assert.equal(edited.statusCode, 200);
    assert.equal(edited.payload.comment.text, 'Edited comment');
    assert.equal(typeof edited.payload.comment.updatedAt, 'string');

    const reply = await invoke(commentsHandler, {
      method: 'POST',
      query: { id: 'post-one' },
      body: { name: 'Reader', text: 'A reply', parentId: root.payload.comment.id }
    });
    assert.equal(reply.statusCode, 201);
    assert.equal(reply.payload.comment.parentId, root.payload.comment.id);

    const nestedReply = await invoke(commentsHandler, {
      method: 'POST',
      query: { id: 'post-1' },
      body: { name: 'Moses', text: 'Nested', parentId: reply.payload.comment.id }
    });
    assert.equal(nestedReply.statusCode, 400);
    assert.equal(nestedReply.payload.code, 'invalidReplyTarget');

    const withdrawnRoot = await invoke(commentsHandler, {
      method: 'DELETE',
      query: { id: 'post-1' },
      body: { commentId: root.payload.comment.id, editToken: root.payload.editToken }
    });
    assert.equal(withdrawnRoot.statusCode, 200);
    assert.equal(withdrawnRoot.payload.disposition, 'withdrawn');
    assert.equal(withdrawnRoot.payload.comments.length, 2);
    assert.equal(withdrawnRoot.payload.comments[0].withdrawn, true);
    assert.equal(withdrawnRoot.payload.comments[0].text, '');

    const removedReply = await invoke(commentsHandler, {
      method: 'DELETE',
      query: { id: 'post-1' },
      body: { commentId: reply.payload.comment.id, editToken: reply.payload.editToken }
    });
    assert.equal(removedReply.statusCode, 200);
    assert.equal(removedReply.payload.disposition, 'removed');
    assert.equal(removedReply.payload.comments.length, 1);
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    environmentKeys.forEach(key => {
      if (originalEnvironment[key] == null) delete process.env[key];
      else process.env[key] = originalEnvironment[key];
    });
    delete require.cache[storePath];
    delete require.cache[commentsPath];
    delete require.cache[blogPath];
  }
});

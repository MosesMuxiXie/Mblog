const {
  COMMENT_ID_PATTERN,
  cleanText,
  createComment,
  normalizeComments,
  ownsComment,
  publicComment,
  publicComments
} = require('../../../lib/blogComments');
const { getBlogs, saveBlogs } = require('../../../lib/blogStore');

function sendError(res, status, error, code) {
  return res.status(status).json({ error, code });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const id = String(req.query?.id || req.params?.id || '');

  try {
    const blogs = await getBlogs();
    const blog = blogs.find(item => item.id === id || item.slug === id);
    if (!blog) return sendError(res, 404, '找不到这篇博客', 'blogNotFound');

    blog.comments = normalizeComments(blog.comments);

    if (req.method === 'POST') {
      const name = cleanText(req.body?.name, 40);
      const text = cleanText(req.body?.text, 2000);
      const parentId = cleanText(req.body?.parentId, 80);
      if (!name || !text) {
        return sendError(res, 400, '姓名和评论不能为空', 'emptyComment');
      }
      if (parentId) {
        const parent = blog.comments.find(comment => comment.id === parentId);
        if (!parent || parent.parentId || parent.withdrawn) {
          return sendError(res, 400, '无法回复这条评论', 'invalidReplyTarget');
        }
      }

      const { comment, editToken } = createComment({ name, text, parentId });
      blog.comments.push(comment);
      await saveBlogs(blogs);
      return res.status(201).json({
        success: true,
        comment: publicComment(comment),
        comments: publicComments(blog.comments),
        editToken
      });
    }

    if (req.method === 'PATCH') {
      const commentId = cleanText(req.body?.commentId, 80);
      const text = cleanText(req.body?.text, 2000);
      if (!COMMENT_ID_PATTERN.test(commentId)) {
        return sendError(res, 400, '评论编号无效', 'invalidComment');
      }
      if (!text) return sendError(res, 400, '评论内容不能为空', 'emptyComment');

      const comment = blog.comments.find(item => item.id === commentId);
      if (!comment || comment.withdrawn) {
        return sendError(res, 404, '找不到这条评论', 'commentNotFound');
      }
      if (!ownsComment(comment, req.body?.editToken)) {
        return sendError(res, 403, '你只能编辑自己发表的评论', 'notCommentOwner');
      }

      comment.text = text;
      comment.updatedAt = new Date().toISOString();
      await saveBlogs(blogs);
      return res.status(200).json({
        success: true,
        comment: publicComment(comment),
        comments: publicComments(blog.comments)
      });
    }

    if (req.method === 'DELETE') {
      const commentId = cleanText(req.body?.commentId, 80);
      if (!COMMENT_ID_PATTERN.test(commentId)) {
        return sendError(res, 400, '评论编号无效', 'invalidComment');
      }

      const commentIndex = blog.comments.findIndex(item => item.id === commentId);
      const comment = blog.comments[commentIndex];
      if (!comment || comment.withdrawn) {
        return sendError(res, 404, '找不到这条评论', 'commentNotFound');
      }
      if (!ownsComment(comment, req.body?.editToken)) {
        return sendError(res, 403, '你只能撤回自己发表的评论', 'notCommentOwner');
      }

      const hasReplies = blog.comments.some(item => item.parentId === comment.id);
      if (hasReplies) {
        comment.text = '';
        comment.withdrawn = true;
        comment.updatedAt = new Date().toISOString();
        delete comment.ownerTokenHash;
      } else {
        blog.comments.splice(commentIndex, 1);
      }
      await saveBlogs(blogs);
      return res.status(200).json({
        success: true,
        disposition: hasReplies ? 'withdrawn' : 'removed',
        comments: publicComments(blog.comments)
      });
    }

    res.setHeader('Allow', 'POST, PATCH, DELETE');
    return sendError(res, 405, 'Method not allowed', 'methodNotAllowed');
  } catch (error) {
    console.error(error);
    return sendError(res, 500, '暂时无法保存评论，请稍后重试', 'commentSaveFailed');
  }
};

function getTime(value) {
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function sortByCreatedAt(a, b) {
  return getTime(a.created_at) - getTime(b.created_at);
}

function findRootReply(reply, byId) {
  if (!reply) return null;
  if (reply.root_reply_id && byId.has(reply.root_reply_id)) {
    return byId.get(reply.root_reply_id);
  }

  const seen = new Set([reply.id]);
  let current = reply;

  while (current?.parent_reply_id && byId.has(current.parent_reply_id)) {
    if (seen.has(current.parent_reply_id)) return null;
    const parent = byId.get(current.parent_reply_id);
    seen.add(parent.id);
    current = parent;
  }

  return current || null;
}

export function buildReplyTree(replies = []) {
  const sorted = [...replies].sort(sortByCreatedAt);
  const byId = new Map(sorted.map((reply) => [reply.id, { ...reply, children: [] }]));
  const roots = [];
  const rootIds = new Set();

  sorted.forEach((reply) => {
    const item = byId.get(reply.id);
    if (!reply.parent_reply_id || !byId.has(reply.parent_reply_id)) {
      roots.push(item);
      rootIds.add(item.id);
    }
  });

  sorted.forEach((reply) => {
    if (!reply.parent_reply_id || !byId.has(reply.parent_reply_id)) return;

    const item = byId.get(reply.id);
    const root = findRootReply(reply, byId);

    if (!root || root.id === item.id) {
      if (!rootIds.has(item.id)) {
        roots.push(item);
        rootIds.add(item.id);
      }
      return;
    }

    const rootItem = byId.get(root.id);
    if (!rootItem) {
      if (!rootIds.has(item.id)) {
        roots.push(item);
        rootIds.add(item.id);
      }
      return;
    }

    if (!rootIds.has(rootItem.id)) {
      roots.push(rootItem);
      rootIds.add(rootItem.id);
    }
    rootItem.children.push(item);
  });

  return roots
    .map((root) => ({
      ...root,
      children: [...root.children].sort(sortByCreatedAt),
    }))
    .sort(sortByCreatedAt);
}

export function collectReplyThreadIds(replies = [], replyId) {
  const childMap = new Map();
  replies.forEach((reply) => {
    if (!reply.parent_reply_id) return;
    const current = childMap.get(reply.parent_reply_id) || [];
    current.push(reply.id);
    childMap.set(reply.parent_reply_id, current);
  });

  const ids = new Set([replyId]);
  const stack = [replyId];

  while (stack.length) {
    const currentId = stack.pop();
    const children = childMap.get(currentId) || [];
    children.forEach((childId) => {
      if (!ids.has(childId)) {
        ids.add(childId);
        stack.push(childId);
      }
    });
  }

  replies.forEach((reply) => {
    if (reply.root_reply_id === replyId) ids.add(reply.id);
  });

  return [...ids];
}

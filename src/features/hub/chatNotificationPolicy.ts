export type ItemChatReply = {
  id: string;
  parent_item_id: string | null;
  sender_user_id: string;
};

/** Private Hub threads never notify the other household member. */
export function shouldNotifyPartner(isPrivate: boolean | null | undefined) {
  return isPrivate !== true;
}

/** Count unread partner replies per shopping-list item. */
export function countUnreadItemReplies(
  replies: ItemChatReply[],
  readMessageIds: ReadonlySet<string>,
  currentUserId: string,
) {
  const counts: Record<string, number> = {};

  for (const reply of replies) {
    if (
      !reply.parent_item_id ||
      reply.sender_user_id === currentUserId ||
      readMessageIds.has(reply.id)
    ) {
      continue;
    }

    counts[reply.parent_item_id] = (counts[reply.parent_item_id] || 0) + 1;
  }

  return counts;
}

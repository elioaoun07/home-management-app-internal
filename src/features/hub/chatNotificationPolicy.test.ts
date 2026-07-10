import { describe, expect, it } from "vitest";
import {
  countUnreadItemReplies,
  shouldNotifyPartner,
} from "./chatNotificationPolicy";

describe("Hub chat notification policy", () => {
  it("notifies the partner for public threads only", () => {
    expect(shouldNotifyPartner(false)).toBe(true);
    expect(shouldNotifyPartner(undefined)).toBe(true);
    expect(shouldNotifyPartner(true)).toBe(false);
  });

  it("counts only unread replies sent by the partner", () => {
    const counts = countUnreadItemReplies(
      [
        { id: "partner-unread", parent_item_id: "milk", sender_user_id: "partner" },
        { id: "partner-read", parent_item_id: "milk", sender_user_id: "partner" },
        { id: "mine", parent_item_id: "milk", sender_user_id: "me" },
        { id: "other-item", parent_item_id: "bread", sender_user_id: "partner" },
      ],
      new Set(["partner-read"]),
      "me",
    );

    expect(counts).toEqual({ milk: 1, bread: 1 });
  });
});

import { describe, expect, it } from "vitest";
import { isPartnerAccountAccessible } from "./accountAccess";

describe("isPartnerAccountAccessible", () => {
  it("allows a visible private partner account only for a household-transfer destination", () => {
    const privateAccount = { visible: true, is_public: false };

    expect(isPartnerAccountAccessible(privateAccount)).toBe(false);
    expect(
      isPartnerAccountAccessible(privateAccount, {
        allowPrivatePartner: true,
      }),
    ).toBe(true);
  });

  it("never exposes a hidden partner account", () => {
    expect(
      isPartnerAccountAccessible({ visible: false, is_public: true }, {
        allowPrivatePartner: true,
      }),
    ).toBe(false);
  });
});

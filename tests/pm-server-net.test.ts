import { describe, expect, it } from "vitest";
import { hostAllowed } from "../scripts/pm/net.mjs";

describe("hostAllowed", () => {
  it("always allows localhost forms, with or without port", () => {
    for (const lan of [false, true]) {
      expect(hostAllowed("127.0.0.1", { lan })).toBe(true);
      expect(hostAllowed("127.0.0.1:4317", { lan })).toBe(true);
      expect(hostAllowed("localhost", { lan })).toBe(true);
      expect(hostAllowed("localhost:5000", { lan })).toBe(true);
      expect(hostAllowed("[::1]", { lan })).toBe(true);
      expect(hostAllowed("[::1]:4317", { lan })).toBe(true);
    }
  });

  it("allows a missing Host header (historical guard parity)", () => {
    expect(hostAllowed(undefined)).toBe(true);
    expect(hostAllowed("")).toBe(true);
  });

  it("allows private-range hosts only in LAN mode", () => {
    const privates = ["192.168.1.20:4317", "192.168.0.2", "10.0.0.5", "10.255.1.2:80", "172.16.0.9", "172.31.99.1"];
    for (const host of privates) {
      expect(hostAllowed(host)).toBe(false);
      expect(hostAllowed(host, { lan: true })).toBe(true);
    }
  });

  it("always rejects public or non-private hosts", () => {
    const bad = ["evil.com", "evil.com:4317", "8.8.8.8", "172.32.0.1", "172.15.0.1", "11.0.0.1", "192.169.1.1", "pm.attacker.net"];
    for (const host of bad) {
      expect(hostAllowed(host)).toBe(false);
      expect(hostAllowed(host, { lan: true })).toBe(false);
    }
  });
});

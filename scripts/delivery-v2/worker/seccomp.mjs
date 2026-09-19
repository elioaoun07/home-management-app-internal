// Based on Moby's Apache-2.0 default profile, vendored from
// https://github.com/moby/profiles/blob/main/seccomp/default.json (2026-09-13).
// Preserve the default deny action and capability-conditioned rules. Permit the
// syscalls bubblewrap needs to create an *unprivileged child* namespace. Kernel
// ownership checks still forbid joining/modifying the parent namespace; workers
// keep no capabilities, no-new-privileges, a read-only root and no host mounts.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
export function nestedSandboxProfile() {
  const profile = JSON.parse(readFileSync(new URL("./seccomp-default.json", import.meta.url), "utf8"));
  profile.syscalls.push(
    { names: ["unshare", "mount", "umount2", "pivot_root", "setns"], action: "SCMP_ACT_ALLOW" },
    { names: ["clone"], action: "SCMP_ACT_ALLOW", args: [{ index: 0, value: 268435456, valueTwo: 268435456, op: "SCMP_CMP_MASKED_EQ" }] },
  );
  return profile;
}
export const nestedSandboxJSON = JSON.stringify(nestedSandboxProfile());
export const nestedSandboxDigest = "sha256:" + createHash("sha256").update(nestedSandboxJSON).digest("hex");

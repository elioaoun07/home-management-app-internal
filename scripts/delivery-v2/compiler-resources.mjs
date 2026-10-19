// Owner-approved checker amendment (2026-10-18). Installer and model-worker
// limits stay independent; this profile is bound to receipts and qualification.
export const COMPILER_RESOURCE_PROFILE = Object.freeze({
  schema: "delivery-v2/compiler-resources@1",
  containerMemory: "8g",
  oldSpaceMiB: 6144,
  nodeOptions: "--max-old-space-size=6144",
});

export function isCompilerCommand(argv) {
  return Array.isArray(argv) && argv[0] === "node" && [
    "scripts/delivery-v2/probes/compiler-program.mjs",
    "scripts/delivery-v2/typecheck-runner.mjs",
    "/opt/era/scripts/delivery-v2/typecheck-runner.mjs",
  ].includes(argv[1]);
}

export function compilerResourceFlags(argv, memory = COMPILER_RESOURCE_PROFILE.containerMemory) {
  if (!isCompilerCommand(argv)) return [];
  if (memory !== COMPILER_RESOURCE_PROFILE.containerMemory) throw new Error("compiler resource profile requires the approved 8g checker memory limit");
  return ["--env", "NODE_OPTIONS=" + COMPILER_RESOURCE_PROFILE.nodeOptions];
}

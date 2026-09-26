// Trusted local setup. Copies only native subscription credentials into named
// Docker volumes over stdin; never mounts a host directory or prints a token.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildWorkerImage, createDockerCli, makeBoundaryConfig, readEgressBinding, authProbeArgs } from "./worker-boundary.mjs";
import { subscriptionCredential } from "./worker/subscription.mjs";
import { writeCredentialScript } from "./credential-sync.mjs";
const BACKENDS = ["claude-agent-sdk", "codex-exec-sdk"];
const TAG = "era-delivery-v2-worker:subscriptions";
const HOSTS = ["api.anthropic.com", "auth.openai.com", "chatgpt.com", "claude.ai", "console.anthropic.com", "platform.claude.com"];
export function setupSubscriptions({ root = process.cwd(), docker = createDockerCli(), build = false } = {}) {
  const run = (args, options) => {
    const result = docker.runSync(args, options);
    if (result.status !== 0) throw new Error("Delivery setup failed: " + args[0] + " " + result.stderr.slice(0, 1000));
    return result;
  };
  if (build) {
    const result = buildWorkerImage({ tag: TAG, repoRoot: root, docker });
    if (!result.ok) throw new Error(result.stderr);
  }
  const imageId = run(["image", "inspect", "--format", "{{.Id}}", TAG]).stdout.trim();
  const name = "era-delivery-egress-" + imageId.slice(7, 19);
  const boundary = makeBoundaryConfig({ image: imageId, network: { mode: "namespace-proxy", name, imageId, allowHosts: HOSTS },
    credentials: Object.fromEntries(BACKENDS.map(id => [id, { volume: "era-delivery-subscription-" + id }])), dependencies: { volume: "era-dlv107-dependencies" } });
  if (docker.runSync(["container", "inspect", name]).status !== 0) {
    run(["run", "-d", "--name", name, "--label", "era.delivery.role=egress", "--restart", "unless-stopped", "--network", "bridge", "--user", "0:0", "--read-only", "--cap-drop", "ALL", "--cap-add", "NET_ADMIN", "--cap-add", "SETUID", "--cap-add", "SETGID", "--security-opt", "no-new-privileges", "--pids-limit", "64", "--memory", "128m", "--cpus", "0.5", imageId, "node", "/opt/era/scripts/delivery-v2/worker/egress.mjs", JSON.stringify(HOSTS)]);
  }
  readEgressBinding(boundary, args => run(args));
  for (const backend of BACKENDS) {
    const path = join(homedir(), backend === "claude-agent-sdk" ? ".claude/.credentials.json" : ".codex/auth.json");
    const credential = subscriptionCredential(backend, JSON.parse(readFileSync(path, "utf8")));
    const volume = boundary.credentials[backend].volume;
    run(["volume", "create", "--label", "era.delivery.role=subscription", volume]);
    const script = writeCredentialScript(backend);
    run(["run", "--rm", "-i", "--network", "none", "--user", "0:0", "--read-only", "--cap-drop", "ALL", "--cap-add", "CHOWN", "--cap-add", "FOWNER", "--mount", "type=volume,source=" + volume + ",target=/dst", imageId, "node", "-e", script], { input: JSON.stringify(credential) });
  }
  const path = join(root, ".delivery/v2/preparations/subscription-boundary.json");
  mkdirSync(join(root, ".delivery/v2/preparations"), { recursive: true });
  writeFileSync(path, JSON.stringify(boundary, null, 2));
  return { path, boundary };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const { path, boundary } = setupSubscriptions({ build: process.argv.includes("--build") });
    process.stdout.write("Boundary prepared: " + path + "\n");
    for (const backend of BACKENDS) {
      const result = createDockerCli().runSync(authProbeArgs(boundary, backend), { timeout: 60000 });
      process.stdout.write(result.stdout || result.stderr);
      if (result.status !== 0) process.exitCode = 1;
    }
  } catch (error) { process.stderr.write(error.message + "\n"); process.exitCode = 1; }
}

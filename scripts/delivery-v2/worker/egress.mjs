// Trusted namespace owner. Workers join its network namespace with uid 10001 and
// no capabilities. Only the proxy's distinct uid can open external connections;
// all worker traffic must pass the exact-host HTTPS CONNECT allowlist.
import { createServer } from "node:http";
import { lookup } from "node:dns/promises";
import { connect, isIP } from "node:net";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const PROXY_UID = 10002;
export const PROXY_PORT = 3128;

export function normalizeHosts(hosts) {
  if (!Array.isArray(hosts) || !hosts.length || hosts.some((host) => typeof host !== "string" || !/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/u.test(host))) {
    throw new Error("egress requires exact DNS hostnames");
  }
  return [...new Set(hosts)].sort();
}

export function connectTarget(authority, allowHosts) {
  const match = /^([a-z0-9.-]+):443$/u.exec(String(authority || ""));
  return match && allowHosts.includes(match[1]) ? match[1] : null;
}

export function publicAddress(address) {
  // Resolve IPv4 deliberately; do not let a provider hostname rebind into the
  // host, metadata service, another container or any private network.
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 2))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

export function firewallCommands() {
  return [
    // Kernel routing rejects the worker UID before a packet leaves. Unlike an
    // ICMP reject (which can itself be dropped), this returns EACCES to connect.
    ["ip", ["rule", "add", "pref", "100", "uidrange", "10001-10001", "prohibit"]],
    ["ip", ["-6", "rule", "add", "pref", "100", "uidrange", "10001-10001", "prohibit"]],
    ["iptables", ["-w", "-A", "OUTPUT", "-m", "owner", "--uid-owner", String(PROXY_UID), "-j", "ACCEPT"]],
    ["iptables", ["-w", "-A", "OUTPUT", "-o", "lo", "-p", "tcp", "-d", "127.0.0.1", "--dport", String(PROXY_PORT), "-j", "ACCEPT"]],
    ["iptables", ["-w", "-A", "OUTPUT", "-j", "REJECT", "--reject-with", "icmp-admin-prohibited"]],
    ["ip6tables", ["-w", "-A", "OUTPUT", "-m", "owner", "--uid-owner", String(PROXY_UID), "-j", "ACCEPT"]],
    ["ip6tables", ["-w", "-A", "OUTPUT", "-j", "REJECT", "--reject-with", "icmp6-adm-prohibited"]],
  ];
}

async function main() {
  const allowHosts = normalizeHosts(JSON.parse(process.argv[2] || "[]"));
  for (const [bin, args] of firewallCommands()) {
    const result = spawnSync(bin, args, { encoding: "utf8" });
    if (result.status !== 0) throw new Error("egress firewall failed: " + bin + " " + String(result.stderr || result.error));
  }
  process.setgroups([]);
  process.setgid(PROXY_UID);
  process.setuid(PROXY_UID);
  const server = createServer((request, response) => {
    if (request.method === "GET" && request.url === "/__era/ready") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ready: true, allowHosts, proxyUid: process.getuid(), firewall: "uid-proxy-only@1" }));
    } else {
      response.writeHead(403);
      response.end();
    }
  });
  server.on("connect", async (request, socket, head) => {
    const host = connectTarget(request.url, allowHosts);
    const deny = () => { if (!socket.destroyed) socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); };
    if (!host) return deny();
    try {
      const addresses = await lookup(host, { all: true, family: 4 });
      if (!addresses.length || addresses.some(({ address }) => !publicAddress(address))) return deny();
      const upstream = connect({ host: addresses[0].address, port: 443 });
      upstream.setTimeout(120_000, () => upstream.destroy());
      socket.setTimeout(120_000, () => socket.destroy());
      upstream.once("connect", () => {
        socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        socket.pipe(upstream);
        upstream.pipe(socket);
      });
      upstream.on("error", () => socket.destroy());
      socket.on("error", () => upstream.destroy());
      socket.on("close", () => upstream.destroy());
      upstream.on("close", () => socket.destroy());
    } catch { deny(); }
  });
  server.on("clientError", (_error, socket) => socket.destroy());
  server.listen(PROXY_PORT, "127.0.0.1", () => process.stdout.write("egress ready\n"));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(String(error.message) + "\n"); process.exitCode = 1; });
}

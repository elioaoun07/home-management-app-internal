// DLV-133: a bounded selection from an already reviewed frozen lockfile.
// This is diagnostic evidence only: it cannot publish an environment receipt.
import { createHash } from "node:crypto";

const hash = text => "sha256:" + createHash("sha256").update(text).digest("hex");

/** Preserve exact leaf-package resolution bytes; refuse syntax we cannot prove. */
export function selectDiagnosticPackages(lockfile, requested) {
  if (!Array.isArray(requested) || requested.length < 1 || requested.length > 4 || new Set(requested).size !== requested.length) throw new Error("diagnostic requires one to four distinct lockfile package IDs");
  const text = String(lockfile).replace(/\r\n/gu, "\n");
  if (!/^lockfileVersion: '9\.0'$/mu.test(text)) throw new Error("diagnostic requires lockfile version 9.0");
  function section(name) {
    const matches = [...text.matchAll(new RegExp("^" + name + ":\\n([\\s\\S]*?)(?=^[A-Za-z][A-Za-z0-9_-]*:|$(?![\\s\\S]))", "gm"))];
    if (matches.length !== 1) throw new Error("ambiguous lockfile section: " + name);
    return matches[0][1];
  }
  function entry(body, id) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    const matches = [...body.matchAll(new RegExp("^  '" + escaped + "':([^\\n]*)(?:\\n|$)", "gm"))];
    if (matches.length !== 1) throw new Error("missing or ambiguous lockfile package: " + id);
    // Comments may use less indentation than the mapping they interrupt. Keep
    // every byte until the next sibling key so unsupported syntax cannot hide
    // dependency edges from the strict leaf validation below.
    const remainder = body.slice(matches[0].index + matches[0][0].length);
    const next = remainder.search(/^  (?!#)[^\s][^\n]*:/mu);
    return { inline: matches[0][1].trim(), body: next < 0 ? remainder : remainder.slice(0, next) };
  }
  const packages = section("packages"), snapshots = section("snapshots");
  const selected = requested.map(id => {
    const match = /^(?<name>(?:@[a-z0-9_.-]+\/)?[a-z0-9_.-]+)@(?<version>\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.+-]+)?)$/u.exec(id);
    if (!match) throw new Error("diagnostic needs an exact registry package/version: " + id);
    const record = entry(packages, id), snapshot = entry(snapshots, id);
    const lines = record.body.split("\n").filter(Boolean);
    const resolution = lines.filter(line => /^    resolution: \{integrity: sha512-[A-Za-z0-9+/]+={0,2}\}$/u.test(line));
    if (record.inline || resolution.length !== 1 || lines.some(line => !/^    (?:resolution: \{integrity: sha512-[A-Za-z0-9+/]+={0,2}\}|engines: \{node: '[^'\n]+'\}|(?:cpu|os|libc): \[[a-z0-9_, !-]+\]|hasBin: true)$/u.test(line))) throw new Error("diagnostic package is not a supported integrity-pinned leaf: " + id);
    if (!((snapshot.inline === "{}" && !snapshot.body.trim()) || (!snapshot.inline && snapshot.body.trim() === "optional: true"))) throw new Error("diagnostic package has dependency edges or unsupported snapshot: " + id);
    return { id, ...match.groups, integrity: resolution[0].slice("    resolution: {integrity: ".length, -1), record: record.body.trimEnd(), snapshot: snapshot.inline ? " {}" : "\n" + snapshot.body.trimEnd() };
  });
  if (new Set(selected.map(row => row.name)).size !== selected.length) throw new Error("diagnostic package names must be distinct");
  const packageJson = JSON.stringify({ name: "era-checker-package-diagnostic", version: "0.0.0", private: true, optionalDependencies: Object.fromEntries(selected.map(row => [row.name, row.version])) }, null, 2) + "\n";
  const derivedLockfile = "lockfileVersion: '9.0'\n\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\n\nimporters:\n  .:\n    optionalDependencies:\n" + selected.map(row => `      '${row.name}':\n        specifier: ${row.version}\n        version: ${row.version}\n`).join("") + "\npackages:\n" + selected.map(row => `\n  '${row.id}':\n${row.record}\n`).join("") + "\nsnapshots:\n" + selected.map(row => `\n  '${row.id}':${row.snapshot}\n`).join("");
  return { schema: "delivery-v2/package-diagnostic@1", sourceLockDigest: hash(lockfile), packageDigest: hash(packageJson), lockDigest: hash(derivedLockfile), packages: selected.map(({ id, name, version, integrity }) => ({ id, name, version, integrity })), packageJson, lockfile: derivedLockfile };
}

/** Builtins only: report payload identity and ELF headers without executing it. */
export function diagnosticPackageFactsSource(packages) {
  return `const fs=require('node:fs'),path=require('node:path');const result=${JSON.stringify(packages)}.map(expected=>{try{const root=fs.realpathSync('/deps/node_modules/'+expected.name);if(!root.startsWith('/deps/node_modules/'))throw Error('package escaped dependency root');const manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));if(manifest.name!==expected.name||manifest.version!==expected.version)throw Error('package identity mismatch');const native=[];function walk(dir){for(const name of fs.readdirSync(dir).sort()){const file=path.join(dir,name),stat=fs.lstatSync(file);if(stat.isSymbolicLink())continue;if(stat.isDirectory())walk(file);else if(stat.isFile()&&stat.size>=20){const fd=fs.openSync(file,'r'),header=Buffer.alloc(20);try{fs.readSync(fd,header,0,20,0)}finally{fs.closeSync(fd)}if(header.subarray(0,4).equals(Buffer.from([127,69,76,70])))native.push({path:path.relative(root,file),bytes:stat.size,mode:stat.mode,elfClass:header[4],endian:header[5],machine:header.readUInt16LE(18)})}}}walk(root);if(!native.length)throw Error('native payload absent');return{...expected,ok:true,manifest:{name:manifest.name,version:manifest.version,os:manifest.os,cpu:manifest.cpu,libc:manifest.libc},native}}catch(error){return{...expected,ok:false,error:error.message}}});console.log(JSON.stringify({schema:'delivery-v2/package-facts@1',platform:process.platform,arch:process.arch,glibc:process.report.getReport().header.glibcVersionRuntime,ok:result.every(row=>row.ok),packages:result}));`;
}

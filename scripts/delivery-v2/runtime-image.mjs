// Explicit trusted setup: a lock-bound Codex overlay on a retained worker image.
// This never runs from readiness or dispatch and never installs lifecycle scripts.
import { createHash, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { inspectDependencyTree } from "./worker/dependency-inventory.mjs";

const digest = bytes => "sha256:" + createHash("sha256").update(bytes).digest("hex");
const SRI = /^sha512-[A-Za-z0-9+/]+={0,2}$/u;
const VERSION = /^\d+\.\d+\.\d+$/u;
const PACKAGE_PATHS = ["@openai/codex-sdk", "@openai/codex", "@openai/codex-linux-x64"];
const offline = ["--pull=never", "--network", "none", "--user", "10001:10001", "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "256", "--memory", "4g", "--cpus", "2", "--tmpfs", "/tmp:rw,uid=10001,gid=10001,size=2g", "--env", "HOME=/tmp"];

export function planCodexRuntimeOverlay({ baseImage, fromVersion, toVersion, lockfile, metadata }) {
  if (!/^sha256:[a-f0-9]{64}$/u.test(baseImage) || !VERSION.test(fromVersion) || !VERSION.test(toVersion) || fromVersion === toVersion) throw new Error("exact distinct runtime pins required");
  if (!Array.isArray(metadata) || metadata.length !== 8 || new Set(metadata.map(p => p.name + "@" + p.version)).size !== 8) throw new Error("complete exact Codex metadata required");
  const packages = metadata.map(p => {
    const sdk = p.name === "@openai/codex-sdk", match = new RegExp("^" + toVersion.replaceAll(".", "\\.") + "(?:-(darwin|linux|win32)-(arm64|x64))?$").exec(p.version);
    if (!match || (!sdk && p.name !== "@openai/codex") || (sdk && match[1]) || !SRI.test(p.dist?.integrity || "")) throw new Error("unexpected runtime package");
    const tarball = "https://registry.npmjs.org/" + p.name + "/-/" + p.name.split("/")[1] + "-" + p.version + ".tgz";
    if (p.dist.tarball !== tarball || ["preinstall", "install", "postinstall", "prepare"].some(key => p.scripts?.[key])) throw new Error("runtime source/lifecycle refused");
    const key = "  '" + p.name + "@" + p.version + "':";
    const lines = String(lockfile).replace(/\r\n/gu, "\n");
    const start = lines.indexOf(key);
    if (start < 0 || !lines.slice(start, lines.indexOf("\n\n", start)).includes("resolution: {integrity: " + p.dist.integrity + "}")) throw new Error("runtime metadata differs from frozen lock");
    return { ...p, target: sdk ? "@openai/codex-sdk" : match[1] ? "@openai/codex-" + match[1] + "-" + match[2] : "@openai/codex" };
  });
  const sdk = packages.find(p => p.target === "@openai/codex-sdk"), cli = packages.find(p => p.target === "@openai/codex");
  if (JSON.stringify(sdk?.dependencies) !== JSON.stringify({ "@openai/codex": toVersion }) || Object.keys(cli?.dependencies || {}).length || Object.keys(cli?.optionalDependencies || {}).length !== 6) throw new Error("unsupported runtime dependency graph");
  for (const pkg of packages.filter(p => p.target !== sdk.target && p.target !== cli.target)) {
    if (cli.optionalDependencies[pkg.target] !== "npm:@openai/codex@" + pkg.version || Object.keys(pkg.dependencies || {}).length || Object.keys(pkg.optionalDependencies || {}).length) throw new Error("runtime optional edge mismatch");
  }
  const selected = PACKAGE_PATHS.map(target => packages.find(p => p.target === target));
  if (selected.some(p => !p)) throw new Error("Linux runtime closure absent");
  return { schema: "delivery-v2/runtime-overlay@1", baseImage, fromVersion, toVersion, lockDigest: digest(lockfile), packages, selected, providerJobs: 0 };
}

/** Builtins + system tar only; exactly three SRI-pinned downloads through the proxy. */
export function runtimeOverlaySource(plan) {
  return `const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),https=require('node:https'),tls=require('node:tls'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const plan=${JSON.stringify(plan)},inspect=${inspectDependencyTree.toString()};
const out='/out',payload=out+'/payload';
function tar(args){const r=spawnSync('tar',args,{encoding:'utf8',timeout:120000,maxBuffer:16000000});if(r.status!==0||r.error)throw Error('tar operation failed');return r.stdout;}
function fetchPackage(pkg,file){return new Promise((resolve,reject)=>{
 const agent=new https.Agent();agent.createConnection=(options,callback)=>{const req=http.request({host:'127.0.0.1',port:3128,method:'CONNECT',path:'registry.npmjs.org:443',timeout:20000});req.once('connect',(res,socket)=>{if(res.statusCode!==200){socket.destroy();return callback(Error('registry tunnel refused'));}const secure=tls.connect({socket,servername:'registry.npmjs.org'});secure.once('secureConnect',()=>callback(null,secure));secure.once('error',callback);});req.once('timeout',()=>req.destroy(Error('registry tunnel timeout')));req.once('error',callback);req.end();};
 const stream=fs.createWriteStream(file,{flags:'wx',mode:384}),hash=crypto.createHash('sha512');let size=0,finished=false;
 const fail=error=>{if(finished)return;finished=true;agent.destroy();stream.destroy();reject(error);};stream.once('error',fail);
 const request=https.get(pkg.dist.tarball,{agent,timeout:120000},res=>{if(res.statusCode!==200){res.resume();return fail(Error('registry HTTP '+res.statusCode));}res.on('data',chunk=>{size+=chunk.length;hash.update(chunk);if(size>768*1024*1024)request.destroy(Error('archive size limit'));});res.once('error',fail);res.pipe(stream);stream.once('finish',()=>{if(finished)return;finished=true;agent.destroy();const actual='sha512-'+hash.digest('base64');if(actual!==pkg.dist.integrity)return reject(Error('archive integrity mismatch'));resolve({size,integrity:actual});});});request.once('timeout',()=>request.destroy(Error('registry download timeout')));request.once('error',fail);
});}
function supportedInventory(root){const inventory=inspect(root,require);if(!inventory.ok)throw Error('runtime inventory invalid');return inventory;}
async function main(){
 if(process.getuid()!==10001||process.getgid()!==10001||process.platform!=='linux'||process.arch!=='x64')throw Error('runtime platform mismatch');
 fs.mkdirSync(payload,{recursive:true});fs.mkdirSync(out+'/archives');
 const evidence={schema:plan.schema,baseImage:plan.baseImage,fromVersion:plan.fromVersion,toVersion:plan.toVersion,lockDigest:plan.lockDigest,packages:[],providerJobs:0};
 for(const pkg of plan.selected){
  const oldRoot='/opt/era/node_modules/'+pkg.target,oldManifest=JSON.parse(fs.readFileSync(oldRoot+'/package.json','utf8'));
  if(oldManifest.version!==plan.fromVersion+(pkg.target.endsWith('linux-x64')?'-linux-x64':''))throw Error('base runtime version drift');
  const archive=out+'/archives/'+pkg.target.split('/')[1]+'.tgz',download=await fetchPackage(pkg,archive);
  const members=tar(['-tzf',archive]).trim().split('\\n');
  if(members.length>100000||members.some(name=>!name.startsWith('package/')||name.includes('\\\\')||name.split('/').some(part=>part==='..'||part==='.')||name.includes('\\0')))throw Error('unsafe archive path');
  if(tar(['-tvzf',archive]).trim().split('\\n').some(line=>!['-','d'].includes(line[0])))throw Error('archive links or special files refused');
  const target=payload+'/node_modules/'+pkg.target;fs.mkdirSync(target,{recursive:true});
  tar(['-xzf',archive,'-C',target,'--strip-components=1','--no-same-owner']);
  const actual=JSON.parse(fs.readFileSync(target+'/package.json','utf8'));if(actual.name!==pkg.name||actual.version!==pkg.version)throw Error('payload identity mismatch');
  const before=supportedInventory(oldRoot),after=supportedInventory(target),paths=new Set(after.entries.map(row=>row.path));
  // ADD overlays cannot remove a base-layer file; refuse stale executable bytes.
  if(before.entries.some(row=>!paths.has(row.path)))throw Error('overlay would retain removed package files: '+pkg.target);
  evidence.packages.push({target:pkg.target,version:pkg.version,download,before,after});
 }
 const root=JSON.parse(fs.readFileSync('/opt/era/package.json','utf8'));
 if(root.dependencies?.['@openai/codex-sdk']!==plan.fromVersion)throw Error('base runtime manifest drift');
 root.dependencies['@openai/codex-sdk']=plan.toVersion;fs.writeFileSync(payload+'/package.json',JSON.stringify(root,null,2)+'\\n');
 for(const name of ['package-lock.json','node_modules/.package-lock.json']){
  const lock=JSON.parse(fs.readFileSync('/opt/era/'+name,'utf8'));if(lock.lockfileVersion!==3)throw Error('unsupported image lock format');
  if(lock.packages[''])lock.packages[''].dependencies['@openai/codex-sdk']=plan.toVersion;
  for(const pkg of plan.packages){const at='node_modules/'+pkg.target;if(!lock.packages[at])continue;const row=lock.packages[at];if(row.version!==plan.fromVersion+(pkg.version.slice(plan.toVersion.length)))throw Error('base lock version drift');row.version=pkg.version;row.resolved=pkg.dist.tarball;row.integrity=pkg.dist.integrity;if(row.dependencies)row.dependencies=pkg.dependencies;if(row.optionalDependencies)row.optionalDependencies=pkg.optionalDependencies;}
  fs.writeFileSync(payload+'/'+name,JSON.stringify(lock,null,2)+'\\n');
 }
 fs.writeFileSync(out+'/runtime-evidence.json',JSON.stringify(evidence,null,2)+'\\n');
 tar(['-cf',out+'/runtime.tar','-C',payload,'.']);
 console.log(JSON.stringify({ok:true,packages:evidence.packages.map(p=>({target:p.target,version:p.version,bytes:p.download.size,files:p.after.entries.length})),archiveBytes:fs.statSync(out+'/runtime.tar').size,providerJobs:0}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});`;
}

export async function stageCodexRuntimeOverlay({ plan, evidence, docker, nonce = randomUUID() }) {
  if (!/^[a-f0-9-]{36}$/u.test(nonce) || existsSync(evidence)) throw new Error("fresh runtime staging identity required");
  mkdirSync(evidence, { recursive: true });
  writeFileSync(join(evidence, "plan.json"), JSON.stringify(plan, null, 2));
  const volume = "era-v2-runtime-" + nonce, owned = new Set();
  let sequence = 0, failed = null, result = null;
  async function run(args, options = {}) {
    const value = await docker.run(args, options);
    writeFileSync(join(evidence, String(++sequence).padStart(3, "0") + ".json"), JSON.stringify({ args, ...(options.input ? { inputDigest: digest(options.input) } : {}), ...value }, null, 2));
    if (value.status !== 0 || value.error) throw new Error("runtime operation failed: " + args[0] + ": " + (value.error || value.stderr));
    return value;
  }
  async function create(args) {
    const r = await run(["create", "--label", "era.runtime-staging=" + nonce, ...args]);
    const id = r.stdout.trim(); if (!/^[a-f0-9]{64}$/u.test(id)) throw new Error("runtime container identity uncertain");
    owned.add(id); return id;
  }
  async function remove(id) { await run(["rm", "-f", id]); owned.delete(id); }
  try {
    if ((await run(["image", "inspect", "--format", "{{.Id}} {{.Os}}/{{.Architecture}}", plan.baseImage])).stdout.trim() !== plan.baseImage + " linux/amd64") throw new Error("base image mismatch");
    if ((await run(["volume", "ls", "--filter", "name=^" + volume + "$", "--format", "{{.Name}}"])).stdout.trim()) throw new Error("runtime volume collision");
    await run(["volume", "create", "--label", "era.runtime-staging=" + nonce, volume]);
    const mount = ["--mount", "type=volume,source=" + volume + ",target=/out,volume-nocopy"];
    const seed = await create(["--pull=never", "--network", "none", "--user", "0:0", "--read-only", "--cap-drop", "ALL", "--cap-add", "CHOWN", "--security-opt", "no-new-privileges", "--pids-limit", "64", "--memory", "256m", "--cpus", "1", ...mount, plan.baseImage, "node", "-e", "require('node:fs').chownSync('/out',10001,10001)"]);
    await run(["start", "--attach", seed], { timeout: 30000 }); await remove(seed);
    const proxy = await create(["--pull=never", "--network", "bridge", "--user", "0:0", "--read-only", "--cap-drop", "ALL", "--cap-add", "NET_ADMIN", "--cap-add", "SETUID", "--cap-add", "SETGID", "--security-opt", "no-new-privileges", "--pids-limit", "64", "--memory", "128m", "--cpus", "0.5", plan.baseImage, "node", "/opt/era/scripts/delivery-v2/worker/egress.mjs", '["registry.npmjs.org"]']);
    await run(["start", proxy]);
    const ready = await run(["exec", proxy, "node", "-e", "fetch('http://127.0.0.1:3128/__era/ready',{signal:AbortSignal.timeout(5000)}).then(r=>r.json()).then(x=>{if(!x.ready||x.proxyUid!==10002||x.firewall!=='uid-proxy-only@1'||JSON.stringify(x.allowHosts)!=='[\"registry.npmjs.org\"]')process.exit(1);console.log(JSON.stringify(x))})"]);
    if (!JSON.parse(ready.stdout).ready) throw new Error("registry proxy not ready");
    const flags = [...offline]; flags[flags.indexOf("--network") + 1] = "container:" + proxy;
    const source = runtimeOverlaySource(plan); writeFileSync(join(evidence, "stage-source.cjs"), source);
    const stage = await create(["-i", ...flags, ...mount, plan.baseImage, "node", "-"]);
    const staged = await run(["start", "--attach", "--interactive", stage], { input: source, timeout: 1200000 });
    const state = await run(["inspect", "--format", "{{.State.Status}} {{.State.ExitCode}}", stage]);
    if (state.stdout.trim() !== "exited 0") throw new Error("runtime staging not quiescent");
    await remove(proxy);
    for (const file of ["runtime.tar", "runtime-evidence.json"]) await run(["cp", stage + ":/out/" + file, join(evidence, file)]);
    await remove(stage);
    result = { ok: true, volume, nonce, baseImage: plan.baseImage, targetVersion: plan.toVersion, archive: join(evidence, "runtime.tar"), archiveDigest: digest(readFileSync(join(evidence, "runtime.tar"))), summary: JSON.parse(staged.stdout.trim()), providerJobs: 0 };
  } catch (error) { failed = error; }
  finally {
    for (const id of [...owned]) { try { await remove(id); } catch { /* verified below; evidence retained */ } }
    let cleanupConfirmed = false;
    try { cleanupConfirmed = !(await run(["ps", "-a", "--filter", "label=era.runtime-staging=" + nonce, "--format", "{{.ID}}"])).stdout.trim(); } catch { /* unknown is refusal */ }
    writeFileSync(join(evidence, "outcome.json"), JSON.stringify({ ...(result || { ok: false, volume, nonce }), cleanupConfirmed, error: failed?.message ?? null }, null, 2));
    if (!cleanupConfirmed && !failed) failed = new Error("runtime cleanup unconfirmed");
  }
  if (failed) throw failed;
  return result;
}

function requireImmutableBase(baseImage) {
  if (!/^sha256:[a-f0-9]{64}$/u.test(baseImage)) throw new Error("immutable base required");
}

/** Offline proof of the copied image, independent of Docker's successful cp. */
export function runtimeImageVerificationSource({ frozen, runtimeEvidence, targetVersion }) {
  if (runtimeEvidence.toVersion !== targetVersion || runtimeEvidence.baseImage !== frozen.baseImage || JSON.stringify(runtimeEvidence.packages.map(p => p.target)) !== JSON.stringify(PACKAGE_PATHS)) throw new Error("runtime verification evidence mismatch");
  const expected = runtimeEvidence.packages.map(p => ({ target: p.target, version: p.version, digest: p.after.digest }));
  return `const fs=require('node:fs'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const inspect=${inspectDependencyTree.toString()},packages=${JSON.stringify(expected)},files=${JSON.stringify(frozen.files)};
if(process.getuid()!==10001||process.getgid()!==10001)throw Error('image user mismatch');
for(const p of packages){const root='/opt/era/node_modules/'+p.target;const actual=inspect(root,require);if(!actual.ok||actual.digest!==p.digest||JSON.parse(fs.readFileSync(root+'/package.json','utf8')).version!==p.version)throw Error('image package inventory mismatch: '+p.target);}
for(const f of files){if('sha256:'+crypto.createHash('sha256').update(fs.readFileSync('/opt/era/'+f.path)).digest('hex')!==f.sha256)throw Error('image source mismatch: '+f.path);}
const native=spawnSync('/opt/era/node_modules/.bin/codex',['--version'],{encoding:'utf8',timeout:20000});
if(native.status!==0||native.stdout.trim()!==${JSON.stringify("codex-cli " + targetVersion)})throw Error('image native version mismatch');
console.log(JSON.stringify({ok:true,version:${JSON.stringify(targetVersion)},packages:packages.length,sourceFiles:files.length,providerJobs:0}));`;
}

/** Copy only the worker's existing trusted source closure into a new build context. */
export function freezeRuntimeImageContext({ repoRoot, staged, context }) {
  requireImmutableBase(staged.baseImage);
  if (!staged.ok || existsSync(context) || digest(readFileSync(staged.archive)) !== staged.archiveDigest) throw new Error("verified runtime archive and fresh context required");
  const base = resolve(repoRoot), destination = resolve(context), files = [];
  if (!destination.startsWith(base + sep)) throw new Error("runtime context must stay inside workspace");
  function walk(name) {
    const file = join(base, name), stat = lstatSync(file);
    if (stat.isSymbolicLink()) throw new Error("linked runtime source refused");
    if (stat.isDirectory()) for (const child of readdirSync(file).sort()) walk(name + "/" + child);
    else if (stat.isFile() && (/\.(?:mjs|json)$/u.test(name) || name === "scripts/delivery-v2/worker/LICENSE.moby")) files.push({ path: name, sha256: digest(readFileSync(file)) });
    else throw new Error("unexpected runtime source file: " + name);
  }
  for (const name of ["scripts/delivery", "scripts/delivery-v2", "scripts/pm/shared", "scripts/pm/mutations.mjs", "scripts/pm/lint.mjs"]) walk(name);
  mkdirSync(context, { recursive: true });
  for (const file of files) {
    const bytes = readFileSync(join(base, file.path));
    if (digest(bytes) !== file.sha256) throw new Error("runtime source changed during freeze");
    const target = join(context, file.path); mkdirSync(dirname(target), { recursive: true }); writeFileSync(target, bytes, { flag: "wx" });
  }
  copyFileSync(staged.archive, join(context, "runtime.tar"));
  if (digest(readFileSync(join(context, "runtime.tar"))) !== staged.archiveDigest) throw new Error("copied runtime archive changed");
  return { baseImage: staged.baseImage, archiveDigest: staged.archiveDigest, files, sourceDigest: digest(JSON.stringify(files)) };
}

/**
 * Local Engine assembly, never BuildKit: FROM sha256:<config-id> is a registry
 * name to BuildKit, and --network none only governs RUN. The created container
 * is never started. Only its image filesystem is writable for archive import.
 */
export async function assembleRuntimeImage({ repoRoot, staged, evidence, tag, docker, nonce = randomUUID() }) {
  if (!/^era-delivery-[a-z0-9-]+:[a-z0-9.-]+$/u.test(tag) || !/^[a-f0-9-]{36}$/u.test(nonce) || existsSync(evidence)) throw new Error("fresh named runtime image evidence required");
  const context = join(evidence, "context");
  const frozen = freezeRuntimeImageContext({ repoRoot, staged, context });
  writeFileSync(join(evidence, "frozen.json"), JSON.stringify(frozen, null, 2));
  const verification = runtimeImageVerificationSource({ frozen, runtimeEvidence: JSON.parse(readFileSync(join(dirname(staged.archive), "runtime-evidence.json"), "utf8")), targetVersion: staged.targetVersion });
  writeFileSync(join(evidence, "verify-image.cjs"), verification);
  let sequence = 0, container = null, failure = null, result = null;
  async function run(args, options = {}) {
    const value = await docker.run(args, options);
    writeFileSync(join(evidence, String(++sequence).padStart(3, "0") + ".json"), JSON.stringify({ args, ...(options.input ? { inputDigest: digest(options.input), inputBytes: options.input.length } : {}), ...value }, null, 2));
    if (value.status !== 0 || value.error) throw new Error("local image assembly failed: " + args[0]);
    return value;
  }
  const format = '{{json .}}';
  const configuration = row => Object.fromEntries(["Env", "Cmd", "Entrypoint", "WorkingDir", "User", "Volumes", "OnBuild"].map(key => [key, row.Config[key] ?? null]));
  try {
    const base = JSON.parse((await run(["image", "inspect", "--format", format, staged.baseImage])).stdout);
    if (base.Id !== staged.baseImage || base.Os !== "linux" || base.Architecture !== "amd64" || base.Config.User !== "10001:10001" || Object.keys(base.Config.Volumes || {}).length || base.Config.OnBuild?.length) throw new Error("unsupported base image configuration");
    if ((await run(["image", "ls", "--filter", "reference=" + tag, "--format", "{{.ID}}"])).stdout.trim()) throw new Error("replacement image tag already exists");
    const created = await run(["create", "--pull=never", "--name", "era-runtime-assembly-" + nonce, "--label", "era.runtime-assembly=" + nonce, "--network", "none", "--user", "10001:10001", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", "256", "--memory", "4g", "--cpus", "2", staged.baseImage]);
    container = created.stdout.trim();
    if (!/^[a-f0-9]{64}$/u.test(container)) throw new Error("assembly container identity uncertain");
    const archive = readFileSync(join(context, "runtime.tar"));
    if (digest(archive) !== staged.archiveDigest) throw new Error("frozen archive drift");
    await run(["cp", "-a", "-", container + ":/opt/era/"], { input: archive });
    await run(["cp", join(context, "scripts") + "/.", container + ":/opt/era/scripts/"]);
    const state = JSON.parse((await run(["inspect", "--format", format, container])).stdout);
    if (state.Image !== staged.baseImage || state.State.Status !== "created" || state.State.Running || state.State.Pid !== 0 || state.HostConfig.NetworkMode !== "none" || state.Mounts.length) throw new Error("assembly container was not inert");
    const image = (await run(["commit", container, tag], { timeout: 1200000 })).stdout.trim();
    if (!/^sha256:[a-f0-9]{64}$/u.test(image)) throw new Error("replacement image identity uncertain");
    writeFileSync(join(evidence, "image.id"), image + "\n", { flag: "wx" });
    const built = JSON.parse((await run(["image", "inspect", "--format", format, image])).stdout);
    if (built.Id !== image || built.Os !== base.Os || built.Architecture !== base.Architecture || JSON.stringify(configuration(built)) !== JSON.stringify(configuration(base)) || JSON.stringify(built.RootFS.Layers.slice(0, -1)) !== JSON.stringify(base.RootFS.Layers)) throw new Error("replacement image ancestry/configuration mismatch");
    const checked = await run(["run", "--rm", "-i", "--name", "era-runtime-verify-" + nonce, "--label", "era.runtime-assembly=" + nonce, ...offline, image, "node", "-"], { input: verification, timeout: 120000 });
    const verified = JSON.parse(checked.stdout.trim());
    if (verified.ok !== true || verified.version !== staged.targetVersion || verified.packages !== 3 || verified.sourceFiles !== frozen.files.length || verified.providerJobs !== 0) throw new Error("image verification result invalid");
    result = { ok: true, image, tag, evidence, verified, assembly: "local-engine-copy-commit@1", ...frozen, providerJobs: 0 };
  } catch (error) { failure = error; }
  finally {
    // Only this assembly's exact created container can be removed.
    if (container && /^[a-f0-9]{64}$/u.test(container)) { try { await run(["rm", container]); } catch (error) { failure ||= error; } }
    // The verifier has --rm; if transport was interrupted, remove its exact name.
    try {
      const verifier = (await run(["ps", "-a", "--filter", "label=era.runtime-assembly=" + nonce, "--filter", "name=^/era-runtime-verify-" + nonce + "$", "--format", "{{.Names}}"])).stdout.trim();
      if (verifier === "era-runtime-verify-" + nonce) await run(["rm", "-f", verifier]);
    } catch (error) { failure ||= error; }
    let cleanupConfirmed = false;
    try { cleanupConfirmed = !(await run(["ps", "-a", "--filter", "label=era.runtime-assembly=" + nonce, "--format", "{{.ID}}"])).stdout.trim(); } catch (error) { failure ||= error; }
    if (!cleanupConfirmed) failure ||= new Error("image assembly cleanup unconfirmed");
    writeFileSync(join(evidence, "outcome.json"), JSON.stringify({ ...result, ok: !failure, error: failure?.message ?? null, cleanupConfirmed }, null, 2));
  }
  if (failure) throw failure;
  return result;
}

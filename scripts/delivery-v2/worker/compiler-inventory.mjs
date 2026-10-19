// A volume name is not proof of its current bytes. Run with a read-only mount.
export const COMPILER_MANIFEST = ".era-compiler-manifest.json";
export function compilerInventorySource(expected, root = "/program") {
  return `const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=${JSON.stringify(root)},manifest=${JSON.stringify(COMPILER_MANIFEST)},expected=${JSON.stringify(expected)};
const hash=b=>'sha256:'+crypto.createHash('sha256').update(b).digest('hex');
const raw=fs.readFileSync(path.join(root,manifest));if(hash(raw)!==expected)throw Error('compiler manifest changed');
const entries=JSON.parse(raw),wanted=new Map(entries.map(e=>[e.path,e]));let count=0;
function walk(dir,prefix=''){if(fs.lstatSync(dir).isSymbolicLink())throw Error('linked compiler directory');for(const name of fs.readdirSync(dir)){const file=path.join(dir,name),rel=prefix+name,s=fs.lstatSync(file);if(s.isSymbolicLink())throw Error('linked compiler input: '+rel);if(s.isDirectory()){walk(file,rel+'/');continue}if(rel===manifest)continue;const e=wanted.get(rel);if(!s.isFile()||!e)throw Error('unexpected compiler input: '+rel);const b=fs.readFileSync(file);if(b.length!==e.size||hash(b)!==e.sha256)throw Error('compiler input changed: '+rel);count++}}
walk(root);if(count!==entries.length)throw Error('compiler inputs missing');process.stdout.write('era-compiler-input-verified');`;
}

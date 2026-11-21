// Test-only DOM around the actual exported controller; no product globals.
import { build } from "esbuild";
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

export async function controllerBundle(evidence) {
  const result = await build({
    stdin: { resolveDir: process.cwd(), loader: "ts", contents: `
import { createBoardCamera } from './scripts/pm/app/stage/camera';
import { ZONES, BOARD } from './scripts/pm/app/stage/config';
import { boardPoint } from './scripts/pm/app/stage/board';
const region = document.querySelector('#fixture-region');
const wrapper = document.querySelector('.board-camera');
let now = 0;
let observation = { nowMs:0,rowAgeMs:null,stagedZone:null,closed:false,frozen:false,reducedMotion:false };
const camera = createBoardCamera(wrapper, { now:()=>now, onSettled:value=>{
  const row = document.createElement('li');
  row.textContent=JSON.stringify({...value,at:performance.now()});
  document.querySelector('#settled').append(row);
} });
for (const zone of ZONES) {
  const point = boardPoint(zone.pad.x,zone.pad.y,BOARD.pad.raise);
  const width=zone.pad.width+zone.pad.depth;
  const pad=document.createElement('div');
  pad.className='fixture-pad';pad.dataset.fixtureZone=zone.id;
  Object.assign(pad.style,{position:'absolute',left:(point.x-zone.pad.depth)+'px',top:point.y+'px',width:width+'px',height:(width/2)+'px'});
  const label=document.createElement('button');label.className='board-zone-name';label.textContent=zone.label;
  Object.assign(label.style,{left:(point.x-zone.pad.depth+width/2)+'px',top:(point.y+width/2)+'px'});
  wrapper.append(pad,label);
}
const resize=()=>camera.resize(region.clientWidth,region.clientHeight);
resize();camera.observe(observation);
document.querySelector('#apply').addEventListener('click',()=>{
  const command=JSON.parse(document.querySelector('#command').value);
  if(command.nowMs!==undefined)now=command.nowMs;
  if(command.action==='observe'){
    observation={...observation,...command.value,nowMs:now};camera.observe(observation);
  } else if(command.action==='inspect')camera.inspect(command.zone);
  else if(command.action==='overview')camera.overview();
  else if(command.action==='follow')camera.toggleFollow();
  else if(command.action==='drag') { camera.beginDrag();camera.pan(command.dx,command.dy);camera.endDrag(); }
  else if(command.action==='zoom')camera.zoom(command.delta);
  else if(command.action==='resize')camera.resize(region.clientWidth,region.clientHeight,command.free);
  document.querySelector('#command').dataset.appliedAt=String(performance.now());
  document.querySelector('#command').dataset.applied=String(command.serial);
});
document.querySelector('#ready').textContent='ready';
` },
    bundle: true, write: false, platform: "browser", format: "iife", target: "es2022",
  });
  const js = result.outputFiles[0].text;
  writeFileSync(`${evidence}/controller-harness.js`, js);
  return { js, sha256: createHash("sha256").update(js).digest("hex") };
}

export async function installController(context, assets, harness, theme) {
  const origin = new URL(assets.base).origin;
  const html = `<!doctype html><html data-theme="${theme}"><head><style>${assets.bundle.css}</style><style>
html,body{margin:0!important;padding:0!important;overflow:hidden!important}
#fixture-region{position:relative;width:100vw;height:calc(100dvh - 60px);overflow:hidden;background:var(--theme-bg)}
.fixture-pad{background:var(--surface-soft);clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)}
#fixture-controls{height:60px;display:flex;align-items:center;gap:8px;padding:4px;background:var(--surface)}
#command{width:70%;height:44px}#settled,#ready{display:none}
</style></head><body><div id="fixture-region"><div class="board-camera"></div></div><div id="fixture-controls"><textarea id="command"></textarea><button id="apply">Apply</button></div><ol id="settled"></ol><output id="ready"></output><script>${harness.js}</script></body></html>`;
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname === "/__camera-controller") return route.fulfill({ contentType: "text/html", body: html });
    return route.abort();
  });
  const page = await context.newPage();
  await page.goto(`${origin}/__camera-controller`);
  await page.waitForFunction(() => document.getElementById("ready")?.textContent === "ready");
  return page;
}

let serial = 0;
export async function command(page, value) {
  const current = ++serial;
  await page.locator("#command").fill(JSON.stringify({ ...value, serial: current }));
  await page.locator("#apply").click();
  await page.waitForFunction((expected) => document.getElementById("command")?.dataset.applied === String(expected), current);
}

/** Test sampling only. It is not installed in any product animation loop. */
export function cameraSample(zone) {
  const wrapper = document.querySelector(".board-camera");
  const region = document.querySelector("#fixture-region,.board-region");
  const pad = zone ? document.querySelector(`[data-fixture-zone="${zone}"],.board-zone[data-zone="${zone}"]`) : null;
  const box = (node) => {
    if (!node) return null;
    const r = node.getBoundingClientRect();
    return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom };
  };
  const labels = [...document.querySelectorAll(".board-zone-name")].map((node) => {
    let scale=1;
    for(let current=node;current;current=current.parentElement){
      const value=getComputedStyle(current).transform;
      if(value!=="none"){const matrix=new DOMMatrixReadOnly(value);scale*=Math.hypot(matrix.a,matrix.b);}
    }
    return { text:node.textContent.trim(),font:parseFloat(getComputedStyle(node).fontSize)*scale,height:node.getBoundingClientRect().height };
  });
  const transform = getComputedStyle(wrapper).transform;
  return { region:box(region),wrapper:box(wrapper),pad:box(pad),scale:new DOMMatrixReadOnly(transform).a,
    transform,transition:getComputedStyle(wrapper).transitionDuration,attrs:{...wrapper.dataset},labels };
}

export async function waitFollowFrame(page, zone) {
  return page.evaluate(async (zone) => {
    const region=document.querySelector("#fixture-region").getBoundingClientRect();
    const start=Number(document.getElementById('command').dataset.appliedAt);
    let minFont=Infinity;
    return await new Promise((resolve)=>{
      const sample=()=>{
        const r=document.querySelector(`[data-fixture-zone="${zone}"]`).getBoundingClientRect();
        const ratio=r.width/region.width;
        const error=Math.hypot(r.x+r.width/2-region.x-region.width/2,r.y+r.height/2-region.y-region.height/2);
        const elapsed=performance.now()-start;
        for(const node of document.querySelectorAll('.board-zone-name')){
          let scale=1;
          for(let p=node;p;p=p.parentElement){const t=getComputedStyle(p).transform;if(t!=='none'){const m=new DOMMatrixReadOnly(t);scale*=Math.hypot(m.a,m.b);}}
          minFont=Math.min(minFont,parseFloat(getComputedStyle(node).fontSize)*scale);
        }
        if((Math.abs(ratio-0.28)<0.001&&error<2)||elapsed>920)resolve({zone,ratio,error,elapsed,minFont});
        else requestAnimationFrame(sample);
      };sample();
    });
  }, zone);
}

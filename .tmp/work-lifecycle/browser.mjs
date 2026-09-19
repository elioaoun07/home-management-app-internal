import { writeFileSync } from 'node:fs';
const target=await (await fetch('http://127.0.0.1:9228/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl); await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let sequence=0;const pending=new Map(),errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text+': '+m.params.exceptionDetails.exception?.description);});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description);return r.result.value;};

const pause=()=>new Promise(r=>setTimeout(r,550));
const nav=async(hash)=>{await send('Page.navigate',{url:'http://127.0.0.1:4180/#'+hash});await pause();await evaluate('document.fonts.ready');await pause();};
const shot=async(name)=>{const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync('.tmp/work-lifecycle/'+name+'.png',Buffer.from(r.data,'base64'));};
const report=[];
const record=async(name)=>{const value=await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,heading:document.querySelector('h1')?.textContent,deliver:!!document.querySelector('.deliver-button'),text:document.querySelector('main')?.innerText||document.body.innerText})`);report.push({name,...value});if(value.scroll>value.width)throw new Error('Page overflow: '+name);return value;};
await send('Page.enable');await send('Runtime.enable');
for(const width of [1440,390,320]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:width>1000?1000:844,deviceScaleFactor:1,mobile:false});
 await nav('/explore?view=done&q=R64');let r=await record('Done search '+width);if(!r.text.includes('R64')||r.deliver)throw new Error('Done search failed');await shot('done-'+width);
 await evaluate(`document.querySelector('.history-entry').click()`);await pause();r=await record('Completed detail '+width);if(!r.text.includes('Done')||!r.text.includes('UAT pending')||r.deliver)throw new Error('Completed detail failed');await shot('completed-'+width);await evaluate(`document.querySelector('a.back').click()`);await pause();await record('Back to filtered Done '+width);if(await evaluate('location.hash')!=='#/explore?view=done&q=R64')throw new Error('Lost Done search on Back');
 await nav('/work/Delivery/DLV-90');r=await record('Actionable item '+width);if(!r.deliver)throw new Error('Actionable item missing Deliver');await shot('todo-'+width);
 await nav('/deliver/PM%20Tooling/R64');r=await record('Old done launch '+width);if(r.deliver||r.text.includes('Start delivery'))throw new Error('Completed launch offered');
 await nav('/work/Delivery/DLV-98');r=await record('Owner check '+width);if(!r.text.includes('Owner check')||r.deliver)throw new Error('Owner check launch offered');
 await nav('/explore?q=DLV-98');r=await record('Owner check excluded '+width);if(r.text.includes('Record a native baseline'))throw new Error('Owner check on To do');
 await nav('/work/Delivery/DLV-116');r=await record('Completed history '+width);if(!r.text.includes('Synthetic retained attempt'))throw new Error('Retained history missing');
 await evaluate(`document.querySelector('.run-link').click()`);await pause();await record('Retained attempt opens '+width);
}
await nav('/explore?view=done&q=R64');await evaluate(`document.documentElement.dataset.theme='pink'`);await pause();await shot('done-pink-320');await record('Pink Done');
writeFileSync('.tmp/work-lifecycle/browser-report.json',JSON.stringify({report,errors},null,2));console.log(JSON.stringify({observations:report.length,errors},null,2));
ws.close();await fetch('http://127.0.0.1:9228/json/close/'+target.id);

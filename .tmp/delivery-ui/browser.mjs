import { writeFileSync } from 'node:fs';
const target=await (await fetch('http://127.0.0.1:9228/json/new?about:blank',{method:'PUT'})).json();
const ws=new WebSocket(target.webSocketDebuggerUrl); await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let sequence=0;const pending=new Map(),errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}else if(m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.text+': '+m.params.exceptionDetails.exception?.description);});
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async(expression)=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description);return r.result.value;};
const wait=()=>new Promise(r=>setTimeout(r,450));
const click=async(text)=>{await evaluate(`Array.from((document.querySelector('[role="dialog"]')||document).querySelectorAll('button')).find(b=>b.textContent.trim()===${JSON.stringify(text)})?.click()`);await wait();};
const navigate=async(scenario='',hash='')=>{await send('Page.navigate',{url:`http://127.0.0.1:4179/?scenario=${scenario}#/delivery/run/r-uat-preview${hash}`});await wait();await evaluate(`document.fonts.ready`);await wait();};
const shot=async(name)=>{const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(`.tmp/delivery-ui/${name}.png`,Buffer.from(r.data,'base64'));};
const layout=()=>evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,body:getComputedStyle(document.querySelector('.plan-step-list .prose')||document.querySelector('.review-card')).fontSize,tab:Array.from(document.querySelectorAll('[role=tab]')).find(e=>e.getAttribute('aria-selected')==='true')?.textContent,heading:document.querySelector('.delivery-status h2')?.textContent})`);
await send('Page.enable');await send('Runtime.enable');
const report=[];
for(const width of [1440,1920,768,430,390,320]){
 await send('Emulation.setDeviceMetricsOverride',{width,height:width>1000?1000:844,deviceScaleFactor:1,mobile:false});
 await navigate('','?tab=plan');report.push({scenario:'plan',...await layout()});await shot(`plan-${width}`);
 await click('Checks2/2'); // Explicit tab selection below also handles mobile hidden counts.
 await evaluate(`document.getElementById('delivery-tab-checks').click()`);await wait();report.push({scenario:'checks',...await layout()});
 if(width===390||width===1440)await shot(`checks-${width}`);
 await evaluate(`document.getElementById('delivery-tab-changes').click()`);await wait();report.push({scenario:'changes',...await layout()});if(width===390||width===1440)await shot(`changes-${width}`);
 await evaluate(`document.getElementById('delivery-tab-activity').click()`);await wait();report.push({scenario:'activity',...await layout()});
}
await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
await navigate('plan');await evaluate(`document.querySelector('button').focus()`);await click('Open plan.md');report.push({scenario:'plan reader',dialog:await evaluate(`!!document.querySelector('[role=dialog]')`),...await layout()});await shot('plan-reader-390');
await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape'});await wait();
report.push({scenario:'reader escape',closed:await evaluate(`!document.querySelector('[role=dialog]')`),focus:await evaluate(`document.activeElement?.textContent`)});
await navigate('applied','?tab=changes');await click('Roll back');report.push({scenario:'rollback preview',calls:await evaluate('window.uat.calls'),focus:await evaluate('document.activeElement?.textContent')});await shot('rollback-390');await click('Cancel');report.push({scenario:'rollback cancel',calls:await evaluate('window.uat.calls')});
await navigate('revisions','?tab=plan');report.push({scenario:'latest revision',approve:await evaluate(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Approve')`)});await evaluate(`const s=document.querySelector('[aria-label="Plan revision"]');s.value='plan-preview';s.dispatchEvent(new Event('change',{bubbles:true}))`);await wait();report.push({scenario:'old revision',approve:await evaluate(`Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='Approve')`)});
await navigate('checks');report.push({scenario:'inconclusive default',...await layout()});await shot('inconclusive-390');
await navigate('long','?tab=plan');report.push({scenario:'long plan',steps:await evaluate(`document.querySelectorAll('.plan-step-list>li').length`),...await layout()});
for(const theme of ['pink']){await navigate('','?tab=plan');await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);await wait();report.push({scenario:`theme ${theme}`,...await layout()});await shot(`plan-${theme}-390`);}
await navigate('','?tab=changes');await evaluate(`document.querySelector('.changed-file').click()`);await wait();report.push({scenario:'diff reader',diff:await evaluate(`document.querySelector('.delivery-diff')?.textContent`)});await shot('diff-390');
await navigate('','?tab=plan');await evaluate(`document.getElementById('delivery-tab-plan').focus()`);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowRight',code:'ArrowRight'});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowRight',code:'ArrowRight'});await wait();report.push({scenario:'keyboard tabs',focus:await evaluate(`document.activeElement.id`),...await layout()});
await send('Page.reload');await wait();await wait();report.push({scenario:'tab reload',...await layout()});
await navigate('applied','?tab=changes');await click('Roll back');await click('Roll back');report.push({scenario:'rollback confirm',calls:await evaluate('window.uat.calls')});
await send('Emulation.setDeviceMetricsOverride',{width:720,height:500,deviceScaleFactor:2,mobile:false});await navigate('','?tab=plan');report.push({scenario:'200 percent equivalent reflow',...await layout()});await shot('plan-zoom');
await send('Emulation.setDeviceMetricsOverride',{width:390,height:430,deviceScaleFactor:1,mobile:false});await navigate('plan');await evaluate(`document.querySelector('textarea').focus(); document.querySelector('textarea').scrollIntoView({block:'center'})`);await wait();report.push({scenario:'keyboard-sized viewport',...await layout()});await shot('plan-keyboard');
writeFileSync('.tmp/delivery-ui/browser-report.json',JSON.stringify({report,errors},null,2));console.log(JSON.stringify({report,errors},null,2));
ws.close();await fetch(`http://127.0.0.1:9228/json/close/${target.id}`);

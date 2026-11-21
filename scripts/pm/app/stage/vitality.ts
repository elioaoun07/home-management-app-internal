const targets:Record<string,number>={live:1,thinking:.85,quiet:.35,stale:.08,'your-turn':.3,'push-pending':.4,shipped:.25,failed:.2,cancelled:.1,reverted:.1,'signal-lost':0,'link-down':0};
export function vitalityTarget(state:string){return targets[state]??0;}
export function stepVitality(value:number,state:string,dt:number){const target=vitalityTarget(state);if(state==='link-down'||state==='signal-lost')return 0;const duration=state==='stale'?20:state==='quiet'?6:state==='live'?1.5:3;return value+(target-value)*(1-Math.exp(-dt*4/duration));}

import { paletteOpen, theme } from "./store.js";

const routes={h:"/",t:"/tasks",c:"/checklist",b:"/bugs",d:"/delivery"};
let prefix=false;let timer=0;
export function initShortcuts(){
  const handler=(event)=>{
    const target=event.target;if(target?.matches?.("input,textarea,select,[contenteditable=true]")){if(event.key==="Escape")target.blur();return;}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();paletteOpen.value=true;return;}
    if(event.key==="/"&&!event.ctrlKey&&!event.metaKey){event.preventDefault();paletteOpen.value=true;return;}
    if(event.key==="Escape"){paletteOpen.value=false;return;}
    if(event.key.toLowerCase()==="g"){prefix=true;clearTimeout(timer);timer=setTimeout(()=>{prefix=false},900);return;}
    if(prefix&&routes[event.key.toLowerCase()]){prefix=false;if(routes[event.key.toLowerCase()]!=="/delivery"||globalThis.PM_MODE==="server")location.hash=routes[event.key.toLowerCase()];return;}
    if(event.key.toLowerCase()==="t"){theme.value=theme.value==="auto"?"blue":theme.value==="blue"?"frost":"auto";}
  };
  addEventListener("keydown",handler);return()=>{removeEventListener("keydown",handler);clearTimeout(timer);};
}


import { useState } from "preact/hooks";
import { byRelPath, runMutation } from "../../app/store.js";
import { Modal } from "../../components/Primitives.jsx";

const INBOX = "0 - Inbox.md";

export function QuickCapture({ onClose }) {
  const [text,setText]=useState(""); const [busy,setBusy]=useState(false);
  const inbox=byRelPath.value.get(INBOX.toLowerCase());
  const add=async(event)=>{event.preventDefault();if(!inbox||!text.trim())return;setBusy(true);const stamp=new Date().toISOString().slice(0,10);const line=`- [ ] ${stamp} — ${text.trim().replace(/\s*\n\s*/g," ")}`; try{await runMutation("append",{file:inbox.relPath,afterHeading:"New",line},"Idea captured — run /triage-inbox to file it");onClose();}finally{setBusy(false);}};
  return <Modal title="Capture an idea" onClose={onClose}><form onSubmit={add}><div class="field"><label>Raw idea / bug — your own words</label><textarea rows="4" autofocus value={text} onInput={(event)=>setText(event.currentTarget.value)} placeholder="e.g. bug while transferring to partner account"/></div><button class="button primary" disabled={!inbox||busy||!text.trim()}>{busy?"Saving…":"Add to inbox"}</button>{!inbox&&<p class="muted">0 - Inbox.md not found at the PM root.</p>}</form></Modal>;
}

import { resolveRelativeMd } from "../../../shared/links.mjs";
import { isChecklistPath } from "../../../shared/tasks.mjs";
import { archiveTask, hideCompleted, toggleTask, sourcePreview } from "../../app/store.js";
import { parseMarkdown } from "../../lib/md-parse.js";
import { Icon } from "../../components/Icon.jsx";

const tokenRe = /(\[([^\]]+)\]\((<[^>]+>|[^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*|~~([^~]+)~~|_([^_]+)_)/g;

export function Inline({ text, file }) {
  const nodes = []; let cursor = 0; let match;
  while ((match = tokenRe.exec(String(text || "")))) {
    if (match.index > cursor) nodes.push(String(text).slice(cursor, match.index));
    if (match[2]) {
      const href = match[3].replace(/^<|>$/g, ""); const resolved = resolveRelativeMd(file, href);
      nodes.push(resolved ? <a href={`#/doc/${encodeURI(resolved.relPath)}${resolved.anchor ? `?h=${encodeURIComponent(resolved.anchor)}` : ""}`}>{match[2]}</a> : <a href={href} target={/^https?:/i.test(href) ? "_blank" : undefined} rel="noreferrer">{match[2]}</a>);
    } else if (match[4]) {
      const value = match[4]; const sourceLike = /^(?:src|scripts|tests|migrations|ERA Notes)\//.test(value);
      nodes.push(sourceLike ? <button class="chip id" onClick={() => { sourcePreview.value = value.replace(/:\d+(?:-\d+)?$/, ""); }}>{value}</button> : <code>{value}</code>);
    } else if (match[5]) nodes.push(<strong>{match[5]}</strong>);
    else if (match[6]) nodes.push(<del>{match[6]}</del>);
    else if (match[7]) nodes.push(<em>{match[7]}</em>);
    cursor = match.index + match[0].length;
  }
  if (cursor < String(text || "").length) nodes.push(String(text).slice(cursor));
  return <span class="md-inline">{nodes}</span>;
}

export function Markdown({ raw, file }) {
  return <div class="markdown">{parseMarkdown(raw).map((block, index) => {
    if (block.type === "heading") { const Tag = `h${block.level}`; return <Tag id={block.slug} key={index}><Inline text={block.text} file={file}/></Tag>; }
    if (block.type === "para") return <p key={index}><Inline text={block.text} file={file}/></p>;
    if (block.type === "fence") return <pre key={index}><code>{block.code}</code></pre>;
    if (block.type === "quote") return <blockquote key={index}><Inline text={block.text} file={file}/></blockquote>;
    if (block.type === "hr") return <hr key={index}/>;
    if (block.type === "table") return <table key={index}><thead><tr>{block.head.map((cell)=><th>{<Inline text={cell} file={file}/>}</th>)}</tr></thead><tbody>{block.rows.map((row)=><tr>{row.map((cell)=><td><Inline text={cell} file={file}/></td>)}</tr>)}</tbody></table>;
    if (block.type === "list") return <List block={block} file={file} key={index}/>;
    return null;
  })}</div>;
}

/**
 * A checklist row. Beyond the checkbox (which only records state) it carries the
 * two actions that take the item *out* of the queue: Ship writes a dated stamp
 * into the campaign's Shipped Log, Discard writes one into the Cancelled Log —
 * both delete the line here, both undoable from the toast. Ship needs a ticked
 * box (the server rejects `not-done`), so it only appears once the row is done.
 */
function TaskItem({ item, file }) {
  const done = item.checkbox.state === "done";
  const canArchive = globalThis.PM_MODE === "server" && isChecklistPath(file);
  return <li class={`md-task ${item.checkbox.state}`} data-cbidx={item.checkbox.cbidx} style={{marginLeft:item.indent}}>
    <button class={`checkbox ${done ? "checked" : ""}`} onClick={() => toggleTask(file, item.checkbox.cbidx)} disabled={globalThis.PM_MODE !== "server"} aria-label={done ? "Reopen task" : "Complete task"}>{done ? "✓" : ""}</button>
    <Inline text={item.text} file={file}/>
    {canArchive && <span class="md-task-actions">
      {done && <button class="icon-button ship" title="Ship — file into the Master Book's Shipped Log and clear the line" aria-label="Ship task" onClick={() => archiveTask(file, item.checkbox.cbidx, "ship")}><Icon name="archive" size={15}/></button>}
      <button class="icon-button discard" title="Discard — archive as Cancelled and clear the line" aria-label="Discard task" onClick={() => archiveTask(file, item.checkbox.cbidx, "discard")}><Icon name="ban" size={15}/></button>
    </span>}
  </li>;
}

/**
 * A markdown list, with the hide-completed rule applied *per list* rather than
 * per document: each list keeps its own "N completed hidden" pill so the lane it
 * belongs to still reports how much has shipped. Clicking the pill turns the
 * global toggle off — it is the only affordance that reveals them, so it must
 * lead somewhere rather than just informing.
 */
function List({ block, file }) {
  const hiding = hideCompleted.value;
  const visible = hiding ? block.items.filter((item) => !item.checkbox || item.checkbox.state !== "done") : block.items;
  const hidden = block.items.length - visible.length;
  return <ul>
    {visible.map((item, itemIndex) => item.checkbox
      ? <TaskItem item={item} file={file} key={item.checkbox.cbidx}/>
      : <li key={`p${itemIndex}`}><Inline text={item.text} file={file}/></li>)}
    {hidden > 0 && <li class="md-hidden-pill"><button onClick={() => { hideCompleted.value = false; }}>{hidden} completed hidden — show</button></li>}
  </ul>;
}


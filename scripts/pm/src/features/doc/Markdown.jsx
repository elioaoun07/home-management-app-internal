import { resolveRelativeMd } from "../../../shared/links.mjs";
import { toggleTask, sourcePreview } from "../../app/store.js";
import { parseMarkdown } from "../../lib/md-parse.js";

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
    if (block.type === "list") return <ul key={index}>{block.items.map((item, itemIndex) => item.checkbox ? <li class={`md-task ${item.checkbox.state}`} data-cbidx={item.checkbox.cbidx} key={itemIndex} style={{marginLeft:item.indent}}><button class={`checkbox ${item.checkbox.state === "done" ? "checked" : ""}`} onClick={() => toggleTask(file, item.checkbox.cbidx)} disabled={globalThis.PM_MODE !== "server"} aria-label={item.checkbox.state === "done" ? "Reopen task" : "Complete task"}>{item.checkbox.state === "done" ? "✓" : ""}</button><Inline text={item.text} file={file}/></li> : <li key={itemIndex}><Inline text={item.text} file={file}/></li>)}</ul>;
    return null;
  })}</div>;
}


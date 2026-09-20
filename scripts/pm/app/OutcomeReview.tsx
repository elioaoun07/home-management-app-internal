// Outcome tab (2026-09-19): one page that answers "how did this delivery go?" from
// recorded facts only — verdict, what went well, what needs attention, links into
// every other view, artifacts and token split. No AI-written claims are shown.
import { CheckCircle2, CircleAlert, CircleDashed, ExternalLink, FileText, GitBranch, ListChecks, MessageSquare, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { compact, outcomeSummary, type OutcomeVerdict, type ReviewTab } from "./deliveryReviewModel";
import type { V2RunDetail } from "./types";

const VERDICTS: Record<OutcomeVerdict, { label: string; Icon: typeof CheckCircle2 }> = {
  verified: { label: "Verified", Icon: CheckCircle2 },
  inconclusive: { label: "Inconclusive", Icon: CircleAlert },
  failed: { label: "Failed", Icon: XCircle },
  "in-progress": { label: "In progress", Icon: CircleDashed },
  closed: { label: "Closed", Icon: CircleDashed },
};

function Row({ icon, label, meta, onClick, href }: { icon: ReactNode; label: string; meta?: string | null; onClick?: () => void; href?: string }) {
  const body = (
    <>
      {icon}
      <span>{label}</span>
      {meta && <small>{meta}</small>}
    </>
  );
  return <li>{href ? <a href={href}>{body}<ExternalLink size={13} /></a> : <button onClick={onClick}>{body}</button>}</li>;
}

export function OutcomeReview({ detail, openTab }: { detail: V2RunDetail; openTab: (tab: ReviewTab) => void }) {
  const summary = outcomeSummary(detail);
  const { label, Icon } = VERDICTS[summary.verdict];
  const campaign = detail.work.campaign;
  const specHref = campaign && detail.work.alias ? `#/work/${encodeURIComponent(campaign)}/${encodeURIComponent(detail.work.alias)}` : null;
  const planned = detail.plans.at(-1);
  const candidate = detail.candidate;
  const receipts = detail.evidence.length;
  return (
    <section className="outcome-review">
      <div className="outcome-verdict" data-verdict={summary.verdict}>
        <Icon size={30} strokeWidth={1.6} />
        <div>
          <h2>{label}</h2>
          {detail.result && <small>Result v{detail.result.result_version}</small>}
        </div>
      </div>

      <div className="outcome-columns">
        {!!summary.good.length && (
          <div className="outcome-list" data-tone="good">
            <h3>Went well</h3>
            <ul>
              {summary.good.map((line) => (
                <li key={line}>
                  <CheckCircle2 size={15} />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}
        {!!summary.attention.length && (
          <div className="outcome-list" data-tone="attention">
            <h3>Needs attention</h3>
            <ul>
              {summary.attention.map((line) => (
                <li key={line}>
                  <CircleAlert size={15} />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="outcome-columns">
        <div className="outcome-links">
          <h3>Open</h3>
          <ul>
            {specHref && <Row icon={<FileText size={16} />} label="Spec" meta={detail.work.alias} href={specHref} />}
            {planned && <Row icon={<FileText size={16} />} label="Plan" meta={`r${planned.revision}`} onClick={() => openTab("plan")} />}
            <Row icon={<ListChecks size={16} />} label="Verification" meta={summary.groups.length ? `${summary.groups.filter((g) => g.current.state === "satisfied").length}/${summary.groups.length}` : null} onClick={() => openTab("checks")} />
            <Row icon={<MessageSquare size={16} />} label="Conversation" meta={detail.activity.length ? String(detail.activity.length) : null} onClick={() => openTab("activity")} />
            {candidate && <Row icon={<GitBranch size={16} />} label="Changes" meta={String(candidate.changed.length)} onClick={() => openTab("changes")} />}
          </ul>
        </div>
        <div className="outcome-links">
          <h3>Artifacts</h3>
          <ul>
            {planned && <Row icon={<FileText size={16} />} label="plan.md" meta={`r${planned.revision}`} onClick={() => openTab("plan")} />}
            {candidate && <Row icon={<GitBranch size={16} />} label={`Candidate ${candidate.generation}`} meta={`${candidate.changed.length} files`} onClick={() => openTab("changes")} />}
            {!!receipts && <Row icon={<ListChecks size={16} />} label="Check receipts" meta={String(receipts)} onClick={() => openTab("checks")} />}
            {candidate?.changed.map((file) => (
              <Row key={file.path} icon={<GitBranch size={14} />} label={file.path.split("/").pop() || file.path} meta={file.kind} onClick={() => openTab("changes")} />
            ))}
          </ul>
        </div>
      </div>

      {summary.tokens && (
        <dl className="outcome-tokens">
          <div>
            <dt>Fresh</dt>
            <dd>{compact(summary.tokens.fresh)}</dd>
          </div>
          <div>
            <dt>Cached</dt>
            <dd>{compact(summary.tokens.cached)}</dd>
          </div>
          <div>
            <dt>Output</dt>
            <dd>{compact(summary.tokens.output)}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{compact(summary.tokens.total)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}

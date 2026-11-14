import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { PairV2, useV2Session } from "./BrowserSession";
import { Back, Empty, ErrorNotice } from "./components";
import { durableV2Command } from "./commandIntents";
import { client, pmKeys, useWorld } from "./state";
import { PendingCommand, transport } from "./transport";
import { UatPage, useUat } from "./UatWizard";
import type { ItemUatRead, UatHandover } from "./types";
import { activeItemHandovers } from "../../delivery-v2/uat-item-selection.mjs";
import "./uat.css";

export function ItemUatWizard({
  campaign,
  id,
}: {
  campaign: string;
  id: string;
}) {
  const { connected } = useWorld();
  const session = useV2Session();
  const existing = useUat(!transport().v2UatItem);
  const [opened, setOpened] = useState<UatHandover | null>(null);
  const item = useQuery({
    queryKey: pmKeys.v2uatItem(campaign, id),
    queryFn: ({ signal }) => transport().v2UatItem!(campaign, id, signal),
    enabled: connected && !!session.data?.paired && !!transport().v2UatItem,
  });
  const handovers =
    item.data?.handovers ||
    existing.data?.filter(
      (entry) =>
        entry.subject.campaign === campaign &&
        entry.subject.work_id?.toUpperCase() === id.toUpperCase(),
    ) ||
    [];
  const active = activeItemHandovers(
    opened &&
      !handovers.some((entry) => entry.handover_id === opened.handover_id)
      ? [...handovers, opened]
      : handovers,
    item.data?.preview?.revision,
  );
  const current = active.find((entry) => entry.status === "ready")?.handover_id;
  if (current) return <UatPage id={current} />;
  if (session.data?.paired === false && transport().capabilities.pairing)
    return (
      <div className="uat-page">
        <Back fallback="/sessions" />
        <PairV2 />
      </div>
    );
  if (session.error)
    return (
      <ErrorNotice error={session.error} retry={() => void session.refetch()} />
    );
  if (!session.data || item.isLoading || existing.isLoading)
    return <p className="d-idle">Loading</p>;
  if (item.data?.preview?.content.scenarios.length)
    return (
      <ItemUatPreview
        key={`${campaign}:${id}:${item.data.preview.revision}`}
        item={item.data}
        offline={!connected}
        onOpen={setOpened}
      />
    );
  if (active.length) return <UatPage id={active[0].handover_id} />;
  return (
    <div className="uat-page">
      <Back fallback="/sessions" />
      <header className="uat-head">
        <div>
          <span className="eyebrow">
            {campaign} · {id}
          </span>
          <h1>{item.data?.title || "Test steps"}</h1>
        </div>
      </header>
      <ErrorNotice
        error={item.error || existing.error}
        retry={() => void item.refetch()}
      />
      <Empty
        title={
          transport().v2UatItem
            ? "Test instructions missing"
            : "Open on the laptop"
        }
      />
    </div>
  );
}

export function ItemUatPreview({
  item,
  offline,
  onOpen,
}: {
  item: ItemUatRead;
  offline: boolean;
  onOpen: (handover: UatHandover) => void;
}) {
  const [position, setPosition] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const preview = item.preview;
  const steps =
    preview?.content.scenarios.flatMap((scenario) =>
      scenario.steps.map((step, index) => ({ scenario, step, index })),
    ) || [];
  const current = steps[position];
  if (!preview || !current) return null;
  const start = async () => {
    setBusy(true);
    setError(null);
    setPending(false);
    try {
      const reply = await durableV2Command<{ handover: UatHandover }>(
        "uat",
        `item-uat:${item.campaign}:${item.id}:${preview.revision}`,
        {
          action: "start-item",
          campaign: item.campaign,
          work_id: item.id,
          revision: preview.revision,
        },
      );
      client.setQueryData(
        pmKeys.v2uatOne(reply.handover.handover_id),
        reply.handover,
      );
      void client.invalidateQueries({ queryKey: pmKeys.v2uat });
      onOpen(reply.handover);
    } catch (failure) {
      if (failure instanceof PendingCommand) setPending(true);
      else setError(failure);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="uat-page item-uat-preview">
      <Back fallback="/sessions" />
      <header className="uat-head">
        <div>
          <span className="eyebrow">
            {item.campaign} · {item.id}
          </span>
          <h1>{item.title}</h1>
        </div>
        <span className="uat-chip">Not tested</span>
      </header>
      <ErrorNotice error={error} />
      {preview.content.setup && (
        <details className="uat-setup">
          <summary>Setup</summary>
          <p className="uat-pre">{preview.content.setup}</p>
        </details>
      )}
      <section className="uat-card" aria-labelledby="item-uat-step-title">
        <div className="uat-card-head">
          <span className="uat-count">
            Step {position + 1} of {steps.length}
          </span>
          <span className="uat-muted">{current.scenario.title}</span>
        </div>
        <h2 id="item-uat-step-title">{current.step.action}</h2>
        <div className="uat-expect-box">
          <span>Expect</span>
          <p>{current.step.expected || "Expected result missing"}</p>
        </div>
        <div className="uat-nav">
          <button
            className="secondary"
            disabled={position === 0}
            onClick={() => setPosition(position - 1)}
          >
            <ChevronLeft size={18} />
            Previous
          </button>
          <button
            className="secondary"
            disabled={position === steps.length - 1}
            onClick={() => setPosition(position + 1)}
          >
            Next
            <ChevronRight size={18} />
          </button>
        </div>
        {(current.scenario.setup ||
          current.scenario.cleanup ||
          current.scenario.limits ||
          preview.content.limits) && (
          <details className="uat-context">
            <summary>Context</summary>
            {current.scenario.setup && (
              <p className="uat-pre">{current.scenario.setup}</p>
            )}
            {current.scenario.cleanup && (
              <p className="uat-pre">
                <strong>Reset</strong> {current.scenario.cleanup}
              </p>
            )}
            {current.scenario.limits && (
              <p className="uat-pre uat-muted">{current.scenario.limits}</p>
            )}
            {preview.content.limits && (
              <p className="uat-pre uat-muted">{preview.content.limits}</p>
            )}
          </details>
        )}
      </section>
      {!preview.available && (
        <p className="uat-muted">Test instructions incomplete</p>
      )}
      <div className="uat-actions">
        <button
          className="primary"
          disabled={!preview.available || offline || busy}
          onClick={() => void start()}
        >
          <Play size={16} />
          {busy ? "Starting…" : pending ? "Retry" : "Start test"}
        </button>
      </div>
      {pending && <p role="status">Pending sync</p>}
    </div>
  );
}

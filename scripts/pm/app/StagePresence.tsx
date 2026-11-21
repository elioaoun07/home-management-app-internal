import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  Bell,
  BellOff,
  Maximize,
  PictureInPicture2,
  Volume2,
  VolumeX,
} from "lucide-react";
import type { LocalRunView } from "./LocalDelivery";
import { copyPipStyles, documentPip, PocketEra } from "./PocketEra";
import { createStageSound, type StageSound } from "./stageSound";
import { useTabPresence } from "./tabPresence";
import type { AttentionItem } from "./localRunAttention";
import { displayTitle } from "./localRunModel";

const savedSound = () => {
  try {
    return localStorage.getItem("pm-game-sound") === "on";
  } catch {
    return false;
  }
};

export function StagePresence({
  run,
  state,
  caption,
  elapsed,
  stageRef,
  replay = false,
  attention,
  settingsOnly = false,
}: {
  run: LocalRunView;
  state: string;
  caption: string;
  elapsed: string;
  stageRef: RefObject<HTMLElement | null>;
  replay?: boolean;
  attention?: readonly AttentionItem[];
  settingsOnly?: boolean;
}) {
  const [sound, setSound] = useState(savedSound);
  const [notify, setNotify] = useState(false);
  const [pocket, setPocket] = useState<Window | null>(null);
  const audio = useRef<StageSound | null>(null);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const prior = useRef(state);
  const replayRef = useRef(replay);
  replayRef.current = replay;
  const actCount =
    attention?.filter((item) => item.state === "open" && item.level === "act")
      .length ?? 0;
  useTabPresence(run.work.id, state, actCount, displayTitle(run));
  const announcedActs = useRef(
    new Set(
      attention
        ?.filter((item) => item.state === "open" && item.level === "act")
        .map((item) => item.id),
    ),
  );
  const closePocket = useCallback(() => setPocket(null), []);
  const theater = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    else if (stage.requestFullscreen)
      void stage.requestFullscreen().catch(() => {});
  }, [stageRef]);
  useEffect(() => {
    const stage = stageRef.current;
    const cue = (event: Event) => {
      if (!soundRef.current) return;
      const detail = (event as CustomEvent<{ kind: string; seal?: boolean }>)
        .detail;
      if (detail && !(detail.kind === "failure" && !replayRef.current))
        audio.current?.play(detail.seal ? "seal" : detail.kind);
    };
    stage?.addEventListener("pm-stage-cue", cue);
    const life = (event: Event) => {
      const data = (
        event as CustomEvent<{ vitality: number; tier: number; muted: boolean }>
      ).detail;
      if (data)
        audio.current?.ambience(
          data.vitality,
          data.tier,
          !soundRef.current || data.muted,
        );
    };
    stage?.addEventListener("pm-stage-life", life);
    const key = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target instanceof HTMLElement &&
          event.target.closest("input,textarea,select,[contenteditable=true]"))
      )
        return;
      if (!settingsOnly && event.key.toLowerCase() === "f") {
        event.preventDefault();
        theater();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      stage?.removeEventListener("pm-stage-cue", cue);
      stage?.removeEventListener("pm-stage-life", life);
      document.removeEventListener("keydown", key);
      audio.current?.close();
      audio.current = null;
    };
  }, [stageRef, theater, settingsOnly]);
  useEffect(() => {
    if (state === "link-down") audio.current?.ambience(0, 0, true);
    if (attention) return;
    if (replay) return;
    if (prior.current === state) return;
    prior.current = state;
    const ready = ["your-turn", "owner-turn", "uat-ready"].includes(state);
    if (sound) {
      if (ready) audio.current?.play("ready");
      else if (state === "failed") audio.current?.play("failure");
      else if (state === "stale") audio.current?.play("stale");
    }
    if (
      notify &&
      document.visibilityState === "hidden" &&
      (ready || state === "failed" || state === "stale") &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      try {
        new Notification(`${run.work.id} · ${caption}`, {
          tag: `${run.run_id}:${state}`,
          silent: true,
        });
      } catch {
        /* Browser may disallow system notifications. */
      }
    }
  }, [
    state,
    sound,
    notify,
    replay,
    caption,
    run.work.id,
    run.run_id,
    attention,
  ]);
  useEffect(() => {
    for (const item of attention ?? []) {
      if (
        item.level !== "act" ||
        item.state !== "open" ||
        announcedActs.current.has(item.id)
      )
        continue;
      announcedActs.current.add(item.id);
      if (sound)
        audio.current?.play(
          item.kind === "failed"
            ? "failure"
            : item.kind === "silent"
              ? "stale"
              : "ready",
        );
      if (
        notify &&
        document.visibilityState === "hidden" &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(`${run.work.id} · ${item.title}`, {
            tag: item.id,
            silent: true,
          });
        } catch {
          /* Platform policy can decline. */
        }
      }
    }
  }, [attention, sound, notify, run.work.id]);
  const toggleSound = () => {
    const enabled = audio.current ? !sound : true;
    if (enabled && !audio.current) audio.current = createStageSound();
    if (enabled) void audio.current?.resume().catch(() => {});
    else audio.current?.ambience(0, 0, true);
    setSound(enabled);
    try {
      localStorage.setItem("pm-game-sound", enabled ? "on" : "off");
    } catch {
      /* Preference storage is optional. */
    }
  };
  const toggleNotify = async () => {
    if (notify) {
      setNotify(false);
      return;
    }
    if (typeof Notification === "undefined") return;
    try {
      setNotify((await Notification.requestPermission()) === "granted");
    } catch {
      setNotify(false);
    }
  };
  const openPocket = async () => {
    if (pocket && !pocket.closed) {
      pocket.close();
      closePocket();
      return;
    }
    try {
      const target = await documentPip()?.requestWindow({
        width: 320,
        height: 200,
      });
      if (target) {
        copyPipStyles(target);
        setPocket(target);
      }
    } catch {
      /* Unsupported/window-policy refusal does not change run state. */
    }
  };
  return (
    <>
      <div className="stage-presence-controls">
        {documentPip() && (
          <button
            className="stage-presence-button"
            type="button"
            aria-label="Pocket ERA"
            aria-pressed={!!pocket}
            title="Pocket ERA"
            onClick={() => void openPocket()}
          >
            <PictureInPicture2 size={16} />
          </button>
        )}
        {!settingsOnly && (
          <button
            className="stage-presence-button"
            type="button"
            aria-label="Theater"
            title="Theater"
            onClick={theater}
          >
            <Maximize size={16} />
          </button>
        )}
        <button
          className="stage-presence-button"
          type="button"
          aria-label="Sound"
          aria-pressed={sound}
          title="Sound"
          onClick={toggleSound}
        >
          {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        {typeof Notification !== "undefined" && (
          <button
            className="stage-presence-button"
            type="button"
            aria-label="Notify"
            aria-pressed={notify}
            title="Notify"
            onClick={() => void toggleNotify()}
          >
            {notify ? <Bell size={16} /> : <BellOff size={16} />}
          </button>
        )}
      </div>
      {pocket && (
        <PocketEra
          run={run}
          target={pocket}
          state={state}
          caption={caption}
          elapsed={elapsed}
          signals={run.activity
            .map((row) => Date.parse(row.at))
            .filter(Number.isFinite)}
          now={Date.now()}
          onClose={closePocket}
        />
      )}
    </>
  );
}

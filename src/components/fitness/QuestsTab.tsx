"use client";

import { useUpdatePreferences } from "@/features/fitness/hooks";
import { RANK_LABEL, badgeShelf, levelProgress, localWeekStart, weeklyQuests } from "@/lib/fitness/progress";
import type { FitnessBundle, RankId } from "@/lib/fitness/types";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { BadgeFrame } from "./FitnessIcons";
import { useFitnessPalette } from "./fitnessTheme";
import { Meter, Panel, Pill, SectionTitle } from "./fitnessUi";
import { ProgressCore } from "./ProgressCore";

export function QuestsTab({ bundle, readOnly }: { bundle: FitnessBundle; readOnly?: boolean }) {
  const pal = useFitnessPalette();
  const prefs = useUpdatePreferences();
  const lp = levelProgress(bundle.rewards.totals.xp, bundle.rules);
  const week = bundle.weeks.find((w) => w.week_start === localWeekStart());
  const quests = weeklyQuests(week, bundle.live_plan?.version.training_target ?? 0, bundle.rules);
  const badges = badgeShelf(bundle.rules, bundle.rewards.badges);
  const cosmetic = bundle.preferences.cosmetic ?? lp.rank;
  const ranks = [...bundle.rules.ranks].sort((a, b) => a.level - b.level);

  return (
    <div className="space-y-4">
      <Panel>
        <SectionTitle>Weekly quests</SectionTitle>
        <ul className="space-y-3">
          {quests.map((q) => (
            <li key={q.id}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className={cn("flex items-center gap-1.5", pal.ink)}>
                  {q.done && <Check className="w-4 h-4" style={{ color: pal.a }} />}
                  {q.label}
                </span>
                <span className={cn("text-xs tabular-nums", pal.faint)}>{q.progress}/{q.goal} · {q.xp} XP</span>
              </div>
              <Meter value={q.progress} max={q.goal} />
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <SectionTitle>Rank</SectionTitle>
        <ol className="flex items-center justify-between gap-1">
          {ranks.map((r, i) => {
            const reached = lp.level >= r.level;
            return (
              <li key={r.id} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <BadgeFrame unlocked={reached} frame={r.id} color={pal.a} size={40} />
                <span className={cn("text-[11px] font-medium truncate", reached ? pal.ink : pal.faint)}>{RANK_LABEL[r.id]}</span>
                <span className={cn("text-[10px]", pal.faint)}>L{r.level}</span>
                {i < ranks.length - 1 && <span className="sr-only">then</span>}
              </li>
            );
          })}
        </ol>
        {lp.nextRank && (
          <div className="mt-3">
            <Meter value={lp.level - 1 + lp.pct} max={lp.nextRank.level - 1} />
            <p className={cn("text-[11px] mt-1 text-right", pal.faint)}>{RANK_LABEL[lp.nextRank.id]} at L{lp.nextRank.level}</p>
          </div>
        )}
      </Panel>

      <Panel>
        <SectionTitle>Badges</SectionTitle>
        <ul className="grid grid-cols-4 gap-2">
          {badges.map((b) => (
            <li key={b.id} className="flex flex-col items-center text-center gap-1">
              <BadgeFrame unlocked={b.earned} frame={cosmetic} color={pal.a} />
              <span className={cn("text-[11px] leading-tight", b.earned ? pal.ink : pal.faint)}>{b.label}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <SectionTitle>Core style</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {ranks.map((r) => {
            const unlocked = lp.level >= r.level;
            const selected = cosmetic === r.id;
            return (
              <button
                key={r.id}
                disabled={!unlocked || readOnly}
                onClick={() => prefs.mutate({ patch: { cosmetic: r.id as RankId }, previous: { cosmetic: bundle.preferences.cosmetic }, quiet: true })}
                className={cn("rounded-2xl border p-2 flex flex-col items-center disabled:opacity-35", pal.line)}
                style={selected ? { borderColor: pal.a, background: `${pal.a}12` } : undefined}
                aria-pressed={selected}
              >
                <ProgressCore xp={lp.xp} level={lp.level} pct={lp.pct} rank={lp.rank} cosmetic={r.id as RankId} segments={[]} effects={false} size={110} />
                <span className={cn("text-xs mt-1", pal.ink)}>{RANK_LABEL[r.id]}</span>
                {!unlocked && <Pill>L{r.level}</Pill>}
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

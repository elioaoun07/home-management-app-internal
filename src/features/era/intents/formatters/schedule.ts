// Schedule face reply formatter — conversational tone, same spirit as briefingToSpeech.ts

export interface ScheduleData {
  todayCount: number;
  overdueCount: number;
  firstTitle: string | null;
  firstOverdueTitle: string | null;
}

export function formatTodaySchedule(data: ScheduleData): string {
  const { todayCount, overdueCount, firstTitle, firstOverdueTitle } = data;

  const lines: string[] = [];

  if (todayCount === 0 && overdueCount === 0) {
    return "Looks like your slate is clean today. Nothing due and nothing overdue — enjoy it.";
  }

  if (todayCount === 1) {
    lines.push(`You've got one thing lined up today${firstTitle ? `: ${firstTitle}` : ""}.`);
  } else if (todayCount > 1) {
    lines.push(`You've got ${todayCount} things on your plate today${firstTitle ? `, starting with ${firstTitle}` : ""}.`);
  } else {
    lines.push("Nothing new due today.");
  }

  if (overdueCount === 1) {
    lines.push(`You also have one overdue item${firstOverdueTitle ? ` — ${firstOverdueTitle}` : ""}. Might want to tackle that.`);
  } else if (overdueCount > 1) {
    lines.push(`And ${overdueCount} things are overdue${firstOverdueTitle ? `, including ${firstOverdueTitle}` : ""}. Worth catching up on those.`);
  }

  return lines.join(" ");
}

export function formatScheduleError(): string {
  return "I couldn't pull up your schedule right now. Try again in a moment.";
}

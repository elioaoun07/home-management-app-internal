import { useRef } from "react";
import { Activity, BookOpen, FileCode2, GitBranch, ListChecks, Shield } from "lucide-react";
import { LOCAL_CHECKS } from "./localRunModel";

export const LOCAL_RUN_TOOLS = [
  { id: "activity", label: "Activity", icon: Activity },
  { id: "brief", label: "Brief", icon: BookOpen },
  { id: "verification", label: "Verification", icon: ListChecks },
  { id: "changes", label: "Changes", icon: FileCode2 },
  { id: "worktree", label: "Worktree", icon: GitBranch },
  { id: "limits", label: "Host limits", icon: Shield },
] as const;
export type Tool = (typeof LOCAL_RUN_TOOLS)[number]["id"];

export function LocalRunTools({ id, tool, onSelect, passed, files, open = true }: {
  id: string;
  tool: Tool;
  onSelect: (value: Tool) => void;
  passed: number;
  files: number;
  open?: boolean;
}) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (index: number) => {
    const next = (index + LOCAL_RUN_TOOLS.length) % LOCAL_RUN_TOOLS.length;
    onSelect(LOCAL_RUN_TOOLS[next].id);
    tabs.current[next]?.focus();
  };
  return <div className="run-game-tools" role="tablist" aria-label="Session tools">
    {LOCAL_RUN_TOOLS.map((item, index) => <button key={item.id}
      ref={element => { tabs.current[index] = element; }} type="button" role="tab"
      id={`${id}-${item.id}`} aria-controls={`${id}-panel`}
      aria-selected={tool === item.id} aria-expanded={open && tool === item.id}
      tabIndex={tool === item.id ? 0 : -1} onClick={() => onSelect(item.id)}
      onKeyDown={event => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          select(index + (event.key === "ArrowRight" ? 1 : -1));
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          select(event.key === "Home" ? 0 : LOCAL_RUN_TOOLS.length - 1);
        }
      }}>
      <item.icon size={17} /><span>{item.label}</span>
      {item.id === "verification" && <small>{passed}/{LOCAL_CHECKS.length}</small>}
      {item.id === "changes" && files > 0 && <small>{files}</small>}
    </button>)}
  </div>;
}

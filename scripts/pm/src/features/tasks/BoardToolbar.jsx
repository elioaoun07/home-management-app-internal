import { Icon } from "../../components/Icon.jsx";
import { GROUP_LABEL, GROUP_OPTIONS, QUICK_FILTERS, SORT_LABEL, SORT_OPTIONS, isFilterActive, toggleFilterToken } from "./boardState.js";

/**
 * Always-visible search, one-tap quick filters, and grouping/sorting — the same
 * shape as the phone app's board toolbar, so the two surfaces stay learnable as
 * one product.
 *
 * Group/sort are native <select>s on purpose: the OS renders their popups, so
 * they are opaque by construction and get the native wheel picker on a phone.
 */
export function BoardToolbar({ state, onChange, shown, total, extra = null }) {
  const setQuery = (query) => onChange({ ...state, query });
  return <div class="board-toolbar">
    <div class="board-search">
      <Icon name="search" size={14}/>
      <input value={state.query} onInput={(event) => setQuery(event.currentTarget.value)}
        placeholder="Search — or m:Budget s:blocker lane:Now e:S id:BUD"
        spellcheck={false} autocapitalize="none" autocorrect="off" aria-label="Filter tasks"/>
      {state.query && <button class="board-search-clear" onClick={() => setQuery("")} aria-label="Clear filter"><Icon name="close" size={14}/></button>}
    </div>

    <div class="board-chips">
      {QUICK_FILTERS.map(({ key, value, label }) => {
        const active = isFilterActive(state.query, key, value);
        return <button class="chip toggle" key={`${key}:${value}`} data-active={String(active)} aria-pressed={active}
          onClick={() => setQuery(toggleFilterToken(state.query, key, value))}>{label}</button>;
      })}
      <span class="board-chips-end">
        {extra}
        <select class="chip select" aria-label="Group by" value={state.groupBy} onChange={(event) => onChange({ ...state, groupBy: event.currentTarget.value })}>
          {GROUP_OPTIONS.map((option) => <option value={option} key={option}>{GROUP_LABEL[option]}</option>)}
        </select>
        <select class="chip select" aria-label="Sort by" value={state.sortBy} onChange={(event) => onChange({ ...state, sortBy: event.currentTarget.value })}>
          {SORT_OPTIONS.map((option) => <option value={option} key={option}>{SORT_LABEL[option]}</option>)}
        </select>
      </span>
    </div>

    <p class="board-count">{shown === total ? `${total} shown` : `${shown} of ${total}`}</p>
  </div>;
}

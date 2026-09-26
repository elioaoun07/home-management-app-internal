import { describe, expect, it } from "vitest";
import {
  boardFilterPath,
  boardVisibleLane,
  exploreBucket,
  explorePath,
  exploreViewPath,
} from "../../scripts/pm/app/explore-state";
import type { Work } from "../../scripts/pm/app/types";

const queryOf = (path: string) => new URLSearchParams(path.split("?")[1]);

describe("Work search navigation", () => {
  it("retains a searched ID through To do, Done and back", () => {
    const query = new URLSearchParams("q=KIT-11&lane=next");
    const done = queryOf(exploreViewPath(query, "done"));
    expect(done.get("q")).toBe("KIT-11");
    expect(done.get("view")).toBe("done");
    const todo = queryOf(exploreViewPath(done, "todo"));
    expect(todo.get("q")).toBe("KIT-11");
    expect(todo.get("lane")).toBe("next");
    expect(todo.has("view")).toBe(false);
    expect(todo.has("todoView")).toBe(false);
    expect(query.toString()).toBe("q=KIT-11&lane=next");
  });

  it("retains board filters and returns to the previous To do layout", () => {
    const start = new URLSearchParams(
      "view=list&q=recipe+offline&campaigns=Kitchen&kind=feature&status=blocked&lane=Next",
    );
    const done = queryOf(exploreViewPath(start, "done"));
    expect(done.get("q")).toBe("recipe offline");
    const todo = queryOf(exploreViewPath(done, "todo"));
    expect(todo.toString()).toBe(start.toString());
  });

  it("keeps queue filters distinct from the Board mobile column", () => {
    const start = new URLSearchParams("q=Offline&lane=waiting");
    const board = queryOf(exploreViewPath(start, "board"));
    expect(board.get("lane")).toBeNull();
    expect(exploreBucket(board)).toBe("waiting");
    const list = queryOf(
      boardFilterPath("/explore", board, { view: "list", lane: "Next" }),
    );
    expect(list.get("q")).toBe("Offline");
    expect(list.get("lane")).toBe("Next");
    expect(exploreBucket(list)).toBe("waiting");
    const search = queryOf(exploreViewPath(list, "search"));
    expect(search.get("lane")).toBe("waiting");
    expect(search.has("bucket")).toBe(false);
    expect(search.get("q")).toBe("Offline");
  });

  it("keeps the search through Board/List filter changes and clears only q", () => {
    const start = new URLSearchParams("view=board&q=AI+%26+Mobile&bucket=now");
    const next = queryOf(
      boardFilterPath("/explore", start, {
        view: "list",
        campaigns: ["Hub & ERA"],
      }),
    );
    expect(next.get("q")).toBe("AI & Mobile");
    expect(next.get("campaigns")).toBe("Hub & ERA");
    expect(next.get("bucket")).toBe("now");
    const cleared = queryOf(explorePath(next, { q: "" }));
    expect(cleared.has("q")).toBe(false);
    expect(cleared.get("campaigns")).toBe("Hub & ERA");
    expect(cleared.get("view")).toBe("list");
  });

  it("normalizes a campaign drilldown when opening the Board", () => {
    const board = queryOf(
      exploreViewPath(new URLSearchParams("q=KIT&campaign=Kitchen"), "board"),
    );
    expect(board.get("campaigns")).toBe("Kitchen");
    expect(board.has("campaign")).toBe(false);
    expect(board.get("q")).toBe("KIT");
  });

  it.each([
    ["now", "Now"],
    ["next", "Next"],
    ["later", "Later"],
  ])(
    "opens the %s queue on its populated mobile Board column",
    (bucket, column) => {
      const board = queryOf(
        exploreViewPath(new URLSearchParams(`lane=${bucket}&q=task`), "board"),
      );
      expect(board.get("bucket")).toBe(bucket);
      expect(board.get("lane")).toBe(column);
      expect(boardVisibleLane(board, [{ section: column } as Work])).toBe(
        column,
      );
    },
  );

  it("opens Waiting on the first matching column when none was chosen", () => {
    const board = queryOf(
      exploreViewPath(new URLSearchParams("lane=waiting"), "board"),
    );
    const work = [{ section: "Later" }, { section: "Next" }] as Work[];
    expect(boardVisibleLane(board, work)).toBe("Next");
    const chosen = queryOf(boardFilterPath("/explore", board, { lane: "Now" }));
    expect(chosen.get("lane")).toBe("Now");
    expect(boardVisibleLane(chosen, work)).toBe("Now");
    const list = queryOf(boardFilterPath("/explore", chosen, { view: "list" }));
    const back = queryOf(boardFilterPath("/explore", list, { view: "board" }));
    expect(boardVisibleLane(back, work)).toBe("Now");
  });

  it("returns from the Board's Done status to open work with search intact", () => {
    const board = new URLSearchParams(
      "view=board&status=review&q=KIT-11&campaigns=Kitchen",
    );
    const done = queryOf(exploreViewPath(board, "done"));
    const todo = queryOf(exploreViewPath(done, "todo"));
    expect(todo.get("view")).toBe("board");
    expect(todo.has("status")).toBe(false);
    expect(todo.get("q")).toBe("KIT-11");
    expect(todo.get("campaigns")).toBe("Kitchen");
    const legacy = queryOf(exploreViewPath(board, "todo"));
    expect(legacy.get("view")).toBe("board");
    expect(legacy.has("status")).toBe(false);
  });
});

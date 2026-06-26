import { describe, expect, it } from "vitest";
import {
  detectTransactionOutliers,
  normalizeMerchant,
} from "./anomalyDetection";

type Fixture = {
  id: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
};

/** A 12-month household snapshot covering the three target scenarios:
 *  - Food: regular category, one transaction is a genuine spike.
 *  - Gift / Trip: rare categories (one transaction all year), one large amount.
 *  - Rent: large but perfectly constant recurring bill — must never flag.
 *  - Misc: a tiny, harmless one-off — must never flag.
 *  - Shopping: an established but genuinely volatile category — must not
 *    flag its own normal spread, and must not crowd out Gift/Trip.
 */
function buildHousehold(): Fixture[] {
  const months = [
    "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
    "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
  ];
  const foodAmounts = [35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 120]; // Dec spikes
  const shoppingAmounts = [20, 30, 45, 60, 75, 90, 100, 110, 120, 130, 140, 150];
  const rentAmount = 1500;

  const fixtures: Fixture[] = [];
  months.forEach((ym, i) => {
    fixtures.push({ id: `food-${ym}`, amount: foodAmounts[i], category: "Food", date: `${ym}-10` });
    fixtures.push({ id: `shopping-${ym}`, amount: shoppingAmounts[i], category: "Shopping", date: `${ym}-12` });
    fixtures.push({ id: `rent-${ym}`, amount: rentAmount, category: "Rent", date: `${ym}-01` });
  });
  fixtures.push({ id: "gift-mar", amount: 200, category: "Gift", date: "2025-03-15" });
  fixtures.push({ id: "trip-aug", amount: 200, category: "Trip", date: "2025-08-20" });
  fixtures.push({ id: "misc-jan", amount: 3, category: "Misc", date: "2025-01-05" });

  return fixtures;
}

describe("detectTransactionOutliers", () => {
  const outliers = detectTransactionOutliers(buildHousehold());
  const byId = new Map(outliers.map((o) => [o.transactionId, o]));

  it("flags a one-time trip as a rare outlier (scenario 1)", () => {
    expect(byId.get("trip-aug")?.reason).toBe("rare");
  });

  it("flags a spending spike within a regular category (scenario 2)", () => {
    expect(byId.get("food-2025-12")?.reason).toBe("spike");
  });

  it("flags an occasional gift surrounded by empty months (scenario 3)", () => {
    expect(byId.get("gift-mar")?.reason).toBe("rare");
  });

  it("never flags a perfectly constant recurring bill (rent)", () => {
    for (const ym of ["2025-01", "2025-06", "2025-12"]) {
      expect(byId.has(`rent-${ym}`)).toBe(false);
    }
  });

  it("does not flag a tiny one-off", () => {
    expect(byId.has("misc-jan")).toBe(false);
  });

  it("does not flag normal values within a genuinely volatile category", () => {
    for (const ym of ["2025-01", "2025-06", "2025-12"]) {
      expect(byId.has(`shopping-${ym}`)).toBe(false);
    }
  });

  it("does not flag the other 11 normal Food transactions", () => {
    const flaggedFood = outliers.filter((o) => o.category === "Food");
    expect(flaggedFood).toHaveLength(1);
    expect(flaggedFood[0]?.transactionId).toBe("food-2025-12");
  });

  it("returns no outliers when the window spans fewer than 2 months", () => {
    const singleMonth: Fixture[] = [
      { id: "a", amount: 40, category: "Food", date: "2025-06-01" },
      { id: "b", amount: 45, category: "Food", date: "2025-06-10" },
      { id: "c", amount: 500, category: "Food", date: "2025-06-20" },
    ];
    expect(detectTransactionOutliers(singleMonth)).toEqual([]);
  });

  it("returns an empty array for no transactions", () => {
    expect(detectTransactionOutliers([])).toEqual([]);
  });
});

describe("detectTransactionOutliers — bimodal categories", () => {
  /** Groceries: two snack purchases every month (~$8-12) plus one big
   *  monthly shop (~$120-140), recurring all year — not a spike, just the
   *  category's second normal mode. December's big shop is genuinely
   *  unusual even by big-shop standards and should still be caught. */
  function buildGroceries(): Fixture[] {
    const months = [
      "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
      "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
    ];
    const bigShopAmounts = [120, 125, 130, 135, 140, 120, 125, 130, 135, 140, 120, 500];

    const fixtures: Fixture[] = [];
    months.forEach((ym, i) => {
      fixtures.push({ id: `snack-a-${ym}`, amount: 8, category: "Groceries", date: `${ym}-05` });
      fixtures.push({ id: `snack-b-${ym}`, amount: 12, category: "Groceries", date: `${ym}-20` });
      fixtures.push({ id: `bigshop-${ym}`, amount: bigShopAmounts[i], category: "Groceries", date: `${ym}-15` });
    });
    return fixtures;
  }

  const outliers = detectTransactionOutliers(buildGroceries());
  const byId = new Map(outliers.map((o) => [o.transactionId, o]));

  it("does not flag the recurring big shopping trips", () => {
    for (const ym of ["2025-01", "2025-02", "2025-06", "2025-11"]) {
      expect(byId.has(`bigshop-${ym}`)).toBe(false);
    }
  });

  it("does not flag the everyday snack purchases", () => {
    for (const ym of ["2025-01", "2025-06", "2025-12"]) {
      expect(byId.has(`snack-a-${ym}`)).toBe(false);
      expect(byId.has(`snack-b-${ym}`)).toBe(false);
    }
  });

  it("still flags a shopping trip that is unusual even for the big-shop mode", () => {
    expect(byId.get("bigshop-2025-12")?.reason).toBe("spike");
  });

  it("flags nothing else in the category", () => {
    const flagged = outliers.filter((o) => o.category === "Groceries");
    expect(flagged).toHaveLength(1);
    expect(flagged[0]?.transactionId).toBe("bigshop-2025-12");
  });
});

describe("detectTransactionOutliers — near-zero values don't hijack the bimodal split", () => {
  // Real "Food" snack-tier amounts from a live account (anonymized dates kept,
  // descriptions dropped). Includes a $0.01 rounding/refund-style transaction
  // at the very bottom of the range, which produced a 32x ratio gap to the
  // next value ($0.32) — far larger than any real snack/grocery-run gap —
  // and used to hijack splitByLargestGap's chosen boundary.
  const realSnackAmounts = [
    0.01, 0.32, 0.35, 0.35, 0.5, 0.55, 0.63, 0.69, 0.71, 0.78, 0.91, 0.95,
    1, 1, 1, 1.48, 2, 3, 3.3333333333333335, 3.6, 4,
    5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
    6, 8.68, 9, 9.14, 9.33, 9.35, 9.88,
    10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10,
    10.78, 11.06, 11.45, 12.23, 12.55, 12.68, 12.94, 13.18, 13.18, 13.23, 13.23, 13.61, 13.98, 14.14, 14.16, 14.24, 14.69,
    15, 15, 15, 15, 15, 15, 15, 15,
  ];

  function buildRealFood(): Fixture[] {
    const months = [
      "2025-09", "2025-10", "2025-11", "2025-12", "2026-01", "2026-02",
      "2026-03", "2026-04", "2026-05", "2026-06",
    ];
    const fixtures: Fixture[] = realSnackAmounts.map((amount, i) => ({
      id: `snack-${i}`,
      amount,
      category: "Food",
      date: `${months[i % months.length]}-${String(5 + (i % 20)).padStart(2, "0")}`,
    }));
    // The actual flagged transactions from the report, plus two more of the
    // same recurring grocery-run pattern across distinct months.
    const groceryRuns = [
      { amount: 130, ym: "2025-10" },
      { amount: 156, ym: "2025-12" },
      { amount: 170, ym: "2026-02" },
      { amount: 145, ym: "2026-04" },
      { amount: 200, ym: "2026-06" },
    ];
    groceryRuns.forEach((g, i) => {
      fixtures.push({ id: `grocery-${i}`, amount: g.amount, category: "Food", date: `${g.ym}-15` });
    });
    return fixtures;
  }

  const outliers = detectTransactionOutliers(buildRealFood());
  const byId = new Map(outliers.map((o) => [o.transactionId, o]));

  it("does not flag the recurring grocery runs, including the exact reported amounts", () => {
    for (let i = 0; i < 5; i++) {
      expect(byId.has(`grocery-${i}`)).toBe(false);
    }
  });

  it("does not flag any of the real snack-tier transactions, including the $0.01 row", () => {
    const flaggedSnacks = outliers.filter((o) => o.category === "Food");
    expect(flaggedSnacks).toHaveLength(0);
  });
});

describe("detectTransactionOutliers — recurring merchant protects against a messy distribution", () => {
  /** Some "Food" categories have more than two clean tiers (snacks, casual
   *  dining, grocery runs) with no single isolated gap between them — the
   *  amount-based bimodal split can legitimately fail to find a boundary at
   *  all. The same recurring merchant (SPINNEYS) must still not flag, purely
   *  because its description recurs often enough to be trusted regardless of
   *  the amount distribution's shape. */
  function buildMessyFood(): Fixture[] {
    const months = [
      "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
      "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
    ];
    const fixtures: Fixture[] = [];
    months.forEach((ym, i) => {
      fixtures.push({ id: `snack-${ym}`, amount: 5 + (i % 5), category: "Food", date: `${ym}-05` });
    });
    // One-off "casual dining" filler at evenly-spaced price points, breaking
    // any single large gap between snacks and grocery runs.
    const fillers = [20, 35, 50, 65, 80];
    fillers.forEach((amount, i) => {
      fixtures.push({ id: `filler-${i}`, amount, category: "Food", date: `${months[i]}-12` });
    });
    // The recurring SPINNEYS grocery run — same description every time.
    const groceryAmounts = [130, 145, 156, 170, 200];
    groceryAmounts.forEach((amount, i) => {
      fixtures.push({
        id: `spinneys-${i}`,
        amount,
        category: "Food",
        date: `${months[i + 6]}-15`,
        description: "POS Purchase SPINNEYS MTAYLEB MTAYLEB LB 0000",
      });
    });
    return fixtures;
  }

  it("confirms the amount-based split is the thing being defeated (sanity check)", () => {
    // With fillers bridging the gap, no single jump should clear the 2.5x
    // bimodal threshold — i.e. this fixture genuinely stresses the case a
    // pure amount-distribution split can't handle on its own.
    const amounts = buildMessyFood()
      .map((f) => f.amount)
      .sort((a, b) => a - b);
    let maxRatio = 1;
    for (let i = 0; i < amounts.length - 1; i++) {
      if (amounts[i] >= 1) maxRatio = Math.max(maxRatio, amounts[i + 1] / amounts[i]);
    }
    expect(maxRatio).toBeLessThan(2.5);
  });

  it("does not flag the recurring SPINNEYS grocery runs despite no clean amount gap", () => {
    const outliers = detectTransactionOutliers(buildMessyFood());
    const byId = new Map(outliers.map((o) => [o.transactionId, o]));
    for (let i = 0; i < 5; i++) {
      expect(byId.has(`spinneys-${i}`)).toBe(false);
    }
  });
});

describe("normalizeMerchant", () => {
  it("collapses bank-statement ref-code and channel-prefix variants", () => {
    const a = normalizeMerchant("Online Purchase TOTERS BEIRUT LB 0000");
    const b = normalizeMerchant("Online Purchase TOTERS BEIRUT LB 3043");
    const c = normalizeMerchant("POS Purchase SPINNEYS MTAYLEB MTAYLEB LB 7121");
    const d = normalizeMerchant("POS Purchase SPINNEYS MTAYLEB MTAYLEB LB 0000");
    expect(a).toBe(b);
    expect(c).toBe(d);
    expect(a).toBe("toters beirut lb");
    expect(normalizeMerchant("Bill Payment, Invoice # 1261 - for 70311147 to Alfa Prepaid"))
      .toBe(normalizeMerchant("Bill Payment, Invoice # MAGIC11 - for 70311147 to Alfa Prepaid"));
  });

  it("returns empty string for blank descriptions", () => {
    expect(normalizeMerchant("")).toBe("");
    expect(normalizeMerchant(null)).toBe("");
    expect(normalizeMerchant(undefined)).toBe("");
  });
});

describe("detectTransactionOutliers — normalized merchant defeats ref-code noise", () => {
  /** Same real merchant, DIFFERENT trailing reference codes every time — the
   *  raw-description grouping used to see five singletons and protect none.
   *  After normalization they collapse to one recurring merchant. Snacks +
   *  evenly-spaced fillers bridge any amount gap so there is no clean bimodal
   *  split to fall back on — the merchant exemption is the only thing that can
   *  save the big grocery runs. */
  function buildRefCodeFood(): Fixture[] {
    const months = [
      "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
      "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
    ];
    const fixtures: Fixture[] = months.map((ym, i) => ({
      id: `snack-${ym}`,
      amount: 5 + (i % 5),
      category: "Food",
      date: `${ym}-05`,
    }));
    [20, 35, 50, 65, 80].forEach((amount, i) => {
      fixtures.push({ id: `filler-${i}`, amount, category: "Food", date: `${months[i]}-12` });
    });
    // Recurring grocery run — SPINNEYS — but a new ref code each month.
    const runs = [
      { amount: 130, ym: "2025-07", code: "0000" },
      { amount: 145, ym: "2025-08", code: "3043" },
      { amount: 156, ym: "2025-09", code: "7121" },
      { amount: 170, ym: "2025-10", code: "0000" },
      { amount: 200, ym: "2025-11", code: "3043" },
    ];
    runs.forEach((g, i) => {
      fixtures.push({
        id: `spinneys-${i}`,
        amount: g.amount,
        category: "Food",
        date: `${g.ym}-15`,
        description: `POS Purchase SPINNEYS MTAYLEB MTAYLEB LB ${g.code}`,
      });
    });
    return fixtures;
  }

  it("protects a recurring merchant whose ref code changes every transaction", () => {
    const outliers = detectTransactionOutliers(buildRefCodeFood());
    const byId = new Map(outliers.map((o) => [o.transactionId, o]));
    for (let i = 0; i < 5; i++) {
      expect(byId.has(`spinneys-${i}`)).toBe(false);
    }
  });
});

describe("detectTransactionOutliers — rhythmic sparse category promoted to recurring", () => {
  /** Tithing: a small, sparse category (a few entries) paid monthly with
   *  widely VARYING amounts. By size alone it looks like a rare big spend each
   *  time; by rhythm it is a recurring commitment and should never be flagged. */
  function buildWithTithing(tithingDates: { amount: number; date: string }[]) {
    const months = ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06"];
    const fixtures: {
      id: string;
      amount: number;
      category: string;
      date: string;
    }[] = [];
    // Established everyday baseline so the window has a real global spread.
    months.forEach((ym) => {
      for (let k = 0; k < 4; k++) {
        fixtures.push({ id: `food-${ym}-${k}`, amount: 5 + k, category: "Food", date: `${ym}-${10 + k}` });
      }
    });
    tithingDates.forEach((t, i) => {
      fixtures.push({ id: `tithe-${i}`, amount: t.amount, category: "Tithing", date: t.date });
    });
    return fixtures;
  }

  it("suppresses a monthly tithing rhythm with variable amounts", () => {
    const outliers = detectTransactionOutliers(
      buildWithTithing([
        { amount: 200, date: "2025-01-15" },
        { amount: 400, date: "2025-02-15" },
        { amount: 500, date: "2025-03-15" },
      ]),
    );
    const byId = new Map(outliers.map((o) => [o.transactionId, o]));
    expect(byId.has("tithe-0")).toBe(false);
    expect(byId.has("tithe-1")).toBe(false);
    expect(byId.has("tithe-2")).toBe(false);
  });

  it("still flags a large sparse spend with no rhythm (control — only two entries)", () => {
    const outliers = detectTransactionOutliers(
      buildWithTithing([
        { amount: 200, date: "2025-01-15" },
        { amount: 400, date: "2025-02-15" },
      ]),
    );
    const flagged = outliers.filter((o) => o.category === "Tithing");
    expect(flagged.length).toBeGreaterThan(0);
  });
});

describe("detectTransactionOutliers — registered recurring_payments hints", () => {
  function buildWithGym() {
    const months = ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06"];
    const fixtures: {
      id: string;
      amount: number;
      category: string;
      date: string;
      description?: string;
    }[] = [];
    months.forEach((ym) => {
      for (let k = 0; k < 4; k++) {
        fixtures.push({ id: `food-${ym}-${k}`, amount: 5 + k, category: "Food", date: `${ym}-${10 + k}` });
      }
    });
    // A single large, sparse, rhythm-less spend that would normally be "rare".
    fixtures.push({ id: "gym", amount: 80, category: "Gym", date: "2025-03-03", description: "Gold's Gym Annual" });
    return fixtures;
  }

  it("flags the sparse spend when there is no matching hint (control)", () => {
    const outliers = detectTransactionOutliers(buildWithGym());
    const byId = new Map(outliers.map((o) => [o.transactionId, o]));
    expect(byId.get("gym")?.reason).toBe("rare");
  });

  it("suppresses the spend when a recurring_payments hint matches", () => {
    const outliers = detectTransactionOutliers(buildWithGym(), {
      recurringHints: [{ category: "Gym", name: "Gold's Gym", amount: 80 }],
    });
    const byId = new Map(outliers.map((o) => [o.transactionId, o]));
    expect(byId.has("gym")).toBe(false);
  });

  it("matches a hint within the ±40% amount band even if the registered amount drifted", () => {
    const outliers = detectTransactionOutliers(buildWithGym(), {
      recurringHints: [{ category: "Gym", name: "Gold's Gym", amount: 100 }],
    });
    const byId = new Map(outliers.map((o) => [o.transactionId, o]));
    expect(byId.has("gym")).toBe(false);
  });
});

describe("detectTransactionOutliers — a novel mid-size category isn't buried by big envelopes", () => {
  /** The reported bug: a single $260 Health charge — the only one all year —
   *  went unflagged because the floor was the 90th percentile of ALL spending,
   *  which frequent ~$340 grocery runs and a one-off $3000 trip pushed well
   *  above $260. Health is its own envelope; unrelated big categories must not
   *  set its bar. After the fix the floor is a fraction of the MEDIAN
   *  transaction (~$14 here → floored at $50), so $260 surfaces on its own. */
  function buildBuriedHealth(): Fixture[] {
    const months = [
      "2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06",
      "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12",
    ];
    const fixtures: Fixture[] = [];
    months.forEach((ym, i) => {
      // Everyday snacks (low mode) — frequent and tiny.
      fixtures.push({ id: `snack-a-${ym}`, amount: 6, category: "Food", date: `${ym}-04` });
      fixtures.push({ id: `snack-b-${ym}`, amount: 11, category: "Food", date: `${ym}-09` });
      fixtures.push({ id: `snack-c-${ym}`, amount: 14, category: "Food", date: `${ym}-22` });
      // One big grocery run (high mode) — frequent AND large, so it dominates
      // the upper tail / old 90th-percentile floor.
      fixtures.push({ id: `grocery-${ym}`, amount: 320 + (i % 5) * 20, category: "Food", date: `${ym}-15` });
    });
    // One-off trips — large sparse charges that also inflate the top percentile.
    fixtures.push({ id: "trip-aug", amount: 3000, category: "Trip", date: "2025-08-20" });
    fixtures.push({ id: "trip-dec", amount: 2000, category: "Trip", date: "2025-12-18" });
    // The whole point: a single mid-size charge in an otherwise-unused category,
    // SMALLER than the groceries and the trip that used to bury it.
    fixtures.push({ id: "health-jun", amount: 260, category: "Health", date: "2025-06-12" });
    return fixtures;
  }

  const outliers = detectTransactionOutliers(buildBuriedHealth());
  const byId = new Map(outliers.map((o) => [o.transactionId, o]));

  it("flags the lone Health charge even though groceries and the trip are larger", () => {
    expect(byId.get("health-jun")?.reason).toBe("rare");
  });

  it("still flags the one-off trips", () => {
    expect(byId.get("trip-aug")?.reason).toBe("rare");
    expect(byId.get("trip-dec")?.reason).toBe("rare");
  });

  it("does not flag the recurring grocery runs or everyday snacks", () => {
    for (const ym of ["2025-01", "2025-06", "2025-12"]) {
      expect(byId.has(`grocery-${ym}`)).toBe(false);
      expect(byId.has(`snack-a-${ym}`)).toBe(false);
    }
  });
});

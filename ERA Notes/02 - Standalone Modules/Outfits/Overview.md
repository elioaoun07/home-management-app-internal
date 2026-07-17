---
created: 2026-07-17
type: feature-doc
status: design
owner: Elio
tags:
  - module/outfits
  - scope/standalone
  - status/design
---

# Outfits / Wardrobe — Design Study & Implementation Handover

> **Status: DESIGN — nothing is implemented yet.** This is a Fable-authored, execution-ready handover: every design decision is already made and justified so that any agent (including lower-capability models) can implement it phase-by-phase without design judgment. The execution queue lives in [Outfits · 4 · Checklist](<../../10 - Project Management/Outfits/4 - Checklist.md>); the phase narrative in [Outfits · 3 · Action Plan](<../../10 - Project Management/Outfits/3 - Action Plan.md>).
>
> **Implementers: do not re-litigate the Locked Decisions below.** If something here conflicts with reality when you build it, STOP, record the conflict in the PM campaign, and ask the owner.

---

## 1. What this module is

A **standalone, personal-per-user** wardrobe module, like an avatar-creation screen in a game:

1. **Digitize** — photograph each garment; the background is removed on-device into a clean transparent cutout; AI suggests tags (category, colors, season, formality) which the user confirms.
2. **Compose** — a 2D "paper doll" builder: cutouts stacked in body slots (headwear / top / bottom / shoes, + outerwear & accessory overlays); swipe each slot horizontally to mix & match; save combinations as named outfits.
3. **Plan** — drag outfits onto a weekly calendar (one outfit per day), tagged with occasion/event.
4. **Remember** — mark plans as worn; every garment and outfit tracks `times_worn` / `last_worn_at`; when planning an outfit for an event, a banner warns "Last worn Jun 30 at Sarah's wedding · worn 3×" so outfits aren't repeated across events.

**Functional goal (owner's words):** plan the week's outfits ahead, and never accidentally re-wear the same outfit to consecutive events.

---

## 2. Locked decisions (owner-approved 2026-07-17 — do not re-open)

| # | Decision | Rejected alternatives & why |
|---|---|---|
| D1 | **2D paper doll** visualization (background-removed cutouts stacked in slots) | **3D avatar**: no free tool does reliable 3D garment fitting; requires cloud GPUs/paid pipelines; result would be worse than the 2D collage. **AI try-on as core**: 10–20 s per look, quota-limited, occasionally wrong — fine as a Phase-3 novelty, unacceptable as the primary loop. This mirrors what shipped wardrobe apps (Whering, Acloset, Style DNA) actually do. |
| D2 | **Sizing profile only** for body data (height/weight/sizes/fit-notes; no body rendering) | A proportional silhouette is cosmetic work with no functional payoff; real 3D body modeling is out of scope (see D1). |
| D3 | **V1 = catalog → builder → planner → wear log**, in that order | "Everything incl. AI try-on" delays first value and puts the flakiest tech in v1. |
| D4 | **Personal per user — NO household sharing.** Deliberate deviation from Hard Rule 13: routes never join `household_links`; RLS is flat `user_id = auth.uid()` on every table. | Clothing is personal; sharing adds query complexity and privacy surface for no requested value. |
| D5 | **Free tools only; images small.** Client-side compression to WebP; storage **paths** in DB columns; never base64 in DB; private bucket + signed URLs (house pattern). | — |
| D6 | **No offline write queue in v1.** Wardrobe editing is rare, deliberate, and photo-dependent (uploads need connectivity anyway); TanStack cache covers reads. | Recorded so it reads as a decision, not an omission. |

---

## 3. The study — why this architecture

### 3.1 Technology landscape (researched 2026-07-17)

- **Background removal** — [`@imgly/background-removal`](https://github.com/imgly/background-removal-js) is the clear winner: free, runs **entirely in the browser** (ONNX/WASM), so photos never leave the device before the user saves — a privacy and cost win. License is **AGPL** — fine for this personal, unsold app; if the app is ever commercialized this dependency must be revisited (that's the only reason this sentence exists).
- **AI garment tagging** — the app's existing Gemini integration ([free tier includes vision](https://ai.google.dev/gemini-api/docs/image-understanding)) can classify a garment photo into category/colors/season/formality. No new vendor, no new key.
- **AI try-on** (Phase-3 backlog only) — services exist ([FASHN](https://fashn.ai/products/api), [ModelsLab free tier](https://modelslab.com/fashion-api), Gemini image generation) but all are slow/quota-bound/imperfect → not core.
- **Storage** — [Supabase free tier](https://supabase.com/docs/guides/storage/uploads/file-limits) = 1 GB storage, 5 GB egress/month, and **no server-side image transformations on the free plan** → all resizing/encoding must happen client-side before upload. At ~210 KB per garment (see §5), 300 garments ≈ 63 MB — comfortable.

### 3.2 What already exists in this repo (verified 2026-07-17)

**~80% of the infrastructure is already built.** The module is mostly an assembly job:

| Need | Existing template to clone | Path |
|---|---|---|
| Multipart image upload → private bucket → path-in-DB → rollback | Catalogue document-image route | `src/app/api/catalogue/items/[id]/document-image/route.ts` |
| Signed-URL read with ownership check | Catalogue signed-url route (drop its household branch per D4) | `src/app/api/catalogue/document-image/signed-url/route.ts` |
| Camera capture bottom-sheet (`capture="environment"`, preview, states) | Receipt sheet | `src/components/expense/ReceiptSheet.tsx` |
| Canvas compression quality-ladder (shape only — see ⚠️ below) | `compressReceiptImage` | `src/lib/receiptUtils.ts` |
| Weekly drag-to-calendar planner (@dnd-kit grid, drop→confirm sheet) | Meal plan calendar | `src/components/web/WebMealPlanCalendar.tsx` |
| Plan-row model (date + FK + slot + status) with upsert-by-slot POST | `meal_plans` route | `src/app/api/meal-plans/route.ts` |
| Module anatomy: queryKeys factory, safeFetch hooks, optimistic mutations + Undo toasts | Catalogue feature dir | `src/features/catalogue/` (esp. `hooks.ts`, `queryKeys.ts`) |
| Gemini with retry/fallback/429 typing | `generateContentWithFallback` | `src/lib/ai/gemini.ts` |
| Six-surface module scaffold | new-module script | `scripts/new-module.mjs` |

> ⚠️ **STOP condition:** `compressReceiptImage` is **hard-coded to JPEG and flattens alpha**. It must NEVER be used for cutouts. Build a new `src/lib/wardrobeImage.ts` with the same canvas + quality-ladder shape but WebP output and alpha preserved. Do not modify `receiptUtils.ts`.

**Genuinely net-new (only two things):**
1. Client-side background removal (`@imgly/background-removal`, new runtime dep, lazy-loaded).
2. Image (`inlineData`) support in the Gemini helper (a small, non-breaking type widening).

---

## 4. Database schema (the exact DDL — 3 migrations, one per phase)

All tables: `ENABLE ROW LEVEL SECURITY`, one policy per verb, all `USING (user_id = auth.uid())` / `WITH CHECK (user_id = auth.uid())`. **No EXISTS-subquery policies anywhere** (Hard Rule 20); the one child table (`outfit_items`) gets a **denormalized `user_id`** set server-side. Each migration is paired with a `migrations/schema.sql` end-state update in the same session (Hard Rule 24).

### Migration A — Phase 1 — `migrations/<date>_outfits-wardrobe-core.sql`

```sql
CREATE TABLE public.wardrobe_profiles (
  user_id uuid NOT NULL,
  height_cm numeric,
  weight_kg numeric,
  sizes jsonb NOT NULL DEFAULT '{}'::jsonb,   -- {"top":"M","bottom":"32","shoes":"43",...}
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wardrobe_profiles_pkey PRIMARY KEY (user_id),
  CONSTRAINT wardrobe_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

CREATE TABLE public.wardrobe_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  slot text NOT NULL CHECK (slot IN ('top','bottom','shoes','outerwear','accessory','headwear')),
  subcategory text,                            -- "t-shirt", "chinos", "sneakers"
  colors text[] NOT NULL DEFAULT '{}',
  brand text,
  size text,
  season text[] NOT NULL DEFAULT '{}',         -- subset of {'spring','summer','fall','winter'}
  formality text CHECK (formality IN ('casual','smart-casual','business','formal','athletic') OR formality IS NULL),
  style_tags text[] NOT NULL DEFAULT '{}',
  image_path text,                             -- storage path (original webp), never a URL
  cutout_path text,                            -- storage path (alpha webp), null if user kept original
  fit_note text,
  times_worn integer NOT NULL DEFAULT 0,
  last_worn_at timestamptz,
  ai_tagged boolean NOT NULL DEFAULT false,    -- provenance only; tags are user-confirmed before save
  ai_confidence numeric,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wardrobe_items_pkey PRIMARY KEY (id),
  CONSTRAINT wardrobe_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE INDEX wardrobe_items_user_slot_idx ON public.wardrobe_items (user_id, slot) WHERE archived_at IS NULL;
```

**Why `wardrobe_profiles` is its own table and NOT `user_preferences`:** `user_preferences` is a hot, app-wide UI-prefs row read on every page load; sizing is domain data only this module reads, and `sizes jsonb` would bloat that row for nothing. Height/weight inputs must use `type="text" inputMode="decimal"` (Hard Rule 19).

### Migration B — Phase 3 — `migrations/<date>_outfits-composition.sql`

```sql
CREATE TABLE public.outfits (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  name text NOT NULL,
  occasion_hint text,                          -- "work", "date night"
  notes text,
  times_worn integer NOT NULL DEFAULT 0,
  last_worn_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outfits_pkey PRIMARY KEY (id)
);

CREATE TABLE public.outfit_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),  -- DENORMALIZED for flat RLS (Hard Rule 20)
  outfit_id uuid NOT NULL REFERENCES public.outfits(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.wardrobe_items(id) ON DELETE CASCADE,
  slot text NOT NULL CHECK (slot IN ('top','bottom','shoes','outerwear','accessory','headwear')),
  CONSTRAINT outfit_items_pkey PRIMARY KEY (id),
  CONSTRAINT outfit_items_outfit_slot_key UNIQUE (outfit_id, slot)
);
CREATE INDEX outfit_items_outfit_idx ON public.outfit_items (outfit_id);
CREATE INDEX outfit_items_item_idx ON public.outfit_items (item_id);
```

**Junction over jsonb slot-map (decided):** the reverse lookup "which outfits use garment X" is load-bearing (archive/delete warning + per-item wear stats) and is an indexed equality on the junction vs a jsonb `@>` scan; FK + `ON DELETE CASCADE` gives integrity for free; RLS stays flat via the denormalized `user_id` (the API route sets it server-side on insert). `UNIQUE(outfit_id, slot)` = one garment per slot — exactly the paper-doll model (multiple accessories = backlog; drop the unique for `accessory` then).

**No bundle RPC needed for the builder:** items = one query; outfits = one PostgREST embed `select("*, outfit_items(*)")` — clean because `outfit_items` has its own flat `user_id` policy. Revisit only if a screen ever needs items + outfits + plans in one paint.

### Migration C — Phase 4 — `migrations/<date>_outfit-plans.sql`

```sql
CREATE TABLE public.outfit_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  outfit_id uuid NOT NULL REFERENCES public.outfits(id) ON DELETE CASCADE,
  planned_date date NOT NULL,
  occasion text,                               -- free label: "work", "wedding"
  event_name text,                             -- "Sarah's wedding"
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','worn','skipped')),
  worn_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outfit_plans_pkey PRIMARY KEY (id),
  CONSTRAINT outfit_plans_user_date_key UNIQUE (user_id, planned_date)
);
CREATE INDEX outfit_plans_user_date_idx ON public.outfit_plans (user_id, planned_date);
```

- **One outfit per day** in v1 (`UNIQUE(user_id, planned_date)`); duplicate-date POST → `23505` → **409** (Hard Rule 9) → client upserts (mirror `meal_plans`' upsert-by-slot POST, where the "slot" here is just the date).
- **The wear log IS this table** with `status='worn'` — no separate table. "What I wore to event X" = `event_name`; retroactive logging = create a plan for a past date already marked worn.
- Atomic wear counting via a SECURITY DEFINER RPC (route logic would be 4 non-atomic writes):

```sql
CREATE OR REPLACE FUNCTION public.set_outfit_plan_worn(p_plan_id uuid, p_worn boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_outfit uuid; v_user uuid; v_status text; v_delta int;
BEGIN
  SELECT outfit_id, user_id, status INTO v_outfit, v_user, v_status
    FROM outfit_plans WHERE id = p_plan_id;
  IF v_user IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'not found'; END IF;
  IF p_worn AND v_status = 'worn' THEN RETURN; END IF;          -- idempotent
  IF NOT p_worn AND v_status <> 'worn' THEN RETURN; END IF;
  v_delta := CASE WHEN p_worn THEN 1 ELSE -1 END;
  UPDATE outfit_plans SET status = CASE WHEN p_worn THEN 'worn' ELSE 'planned' END,
    worn_at = CASE WHEN p_worn THEN now() ELSE NULL END, updated_at = now()
    WHERE id = p_plan_id;
  UPDATE outfits SET times_worn = greatest(0, times_worn + v_delta),
    last_worn_at = CASE WHEN p_worn THEN now() ELSE last_worn_at END WHERE id = v_outfit;
  UPDATE wardrobe_items w SET times_worn = greatest(0, w.times_worn + v_delta),
    last_worn_at = CASE WHEN p_worn THEN now() ELSE w.last_worn_at END
    FROM outfit_items oi WHERE oi.outfit_id = v_outfit AND oi.item_id = w.id;
END $$;
```

`p_worn=false` is the reverse path that makes the mandatory Undo toast honest (Hard Rule 1). Known v1 approximation: `last_worn_at` is **not rewound** on undo (only counters are) — acceptable; documented here on purpose.

---

## 5. Image pipeline (end-to-end)

**Exactly two derivatives per garment — no separate thumbnail (deliberate YAGNI):**

| Derivative | Spec | Purpose |
|---|---|---|
| `original` | WebP, max 1400 px, ≤ ~150 KB | Reference photo; fallback display if cutout rejected |
| `cutout` | WebP **with alpha**, max 800 px, typically 30–80 KB | Paper-doll layer AND grid thumbnail (browsers downscale fine at 3-across mobile) |

Budget math: ~210 KB/garment → 300 garments ≈ 63 MB of the 1 GB free tier.

Flow:
1. **Capture** — hidden `<input type="file" accept="image/*" capture="environment">` per `ReceiptSheet.tsx`; preview via `createObjectURL`. UI shows flat-lay guidance: *"Lay the garment flat on a plain, contrasting surface."*
2. **Compress original** — new `src/lib/wardrobeImage.ts`: `compressWardrobeImage(file, { maxDim = 1400, maxSizeKB = 150, mimeType = "image/webp" })`. Same canvas + quality-ladder shape as `compressReceiptImage` but **no contrast filter, WebP output, alpha preserved**.
3. **Background removal** — new `src/lib/backgroundRemoval.ts`: `removeGarmentBackground(file): Promise<File>` wrapping `const { removeBackground } = await import("@imgly/background-removal")` — **dynamic import ONLY, never top-level** (the ONNX/WASM bundle + ~40–80 MB model must never enter the PWA shell; model downloads on first use and is browser-cached; show progress + a first-use note). Output `{ format: "image/webp", quality: 0.8 }`, then re-run through `compressWardrobeImage` at `maxDim = 800`.
4. **Approve** — side-by-side original vs cutout on a checkerboard; "Use cutout" / "Keep original" (`cutout_path` stays null on reject; paper doll falls back to the original in a rounded card). This is also the graceful-degradation path if the model fails or the download is refused.
5. **Upload** — `POST /api/outfits/items/[id]/images` (clone the catalogue document-image route): multipart with optional `original` and `cutout` File fields (≥1), **2 MB cap each**, lazy-create private bucket **`wardrobe`** (`public:false`, `fileSizeLimit` 2 MB, `allowedMimeTypes: ["image/webp","image/png","image/jpeg"]`), paths `${user.id}/${itemId}/original.webp` and `${user.id}/${itemId}/cutout.webp`, `upsert:true`; update `image_path`/`cutout_path` via the user-scoped client; roll back the upload on DB failure exactly like the template. DELETE removes both files and nulls both columns. **Item row is created first, images second** — an image-POST failure keeps the item and surfaces a retry (never orphaned uploads).
6. **Batch signed URLs (kills the fan-out)** — `POST /api/outfits/signed-urls`: Zod `{ paths: z.array(z.string()).min(1).max(100) }`; **every** path's first segment must `=== user.id` (403 otherwise — no household branch, per D4); one bulk `supabaseAdmin().storage.from("wardrobe").createSignedUrls(paths, 3600)`; return `{ urls: Record<path, signedUrl> }`.
7. **Client cache** — `src/features/outfits/useSignedUrls.ts`: `useWardrobeImageUrls(paths)` — dedupe + sort paths into the queryKey, `staleTime: 50 * 60_000`, `gcTime: 55 * 60_000` (1 h expiry minus margin). One request per screen per 50 min, not one per image.

---

## 6. AI auto-tag (Phase 2)

- **`src/lib/ai/gemini.ts` widening (minimal, non-breaking):** change `GenerateOptions.contents` parts from `{ text: string }[]` to `Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>` (export as `GeminiPart`). `@google/genai` accepts `inlineData` natively; all existing callers still typecheck — that typecheck IS the non-regression proof.
- **New route `src/app/api/outfits/tag-garment/route.ts`:** auth → multipart `image` (cap 1 MB — client sends the already-compressed original) → base64 → `generateContentWithFallback` with an `inlineData` part + `config: { responseMimeType: "application/json" }`, prompting for `{ name, slot, subcategory, colors, season, formality, style_tags, confidence }` **constrained to the exact enums in §4**. Zod-parse the model output (garbage → 422). Catch `GeminiRateLimitError` → 429 with `retryAfterSeconds` + `daily`, matching existing AI routes.
- **Client:** "Auto-tag" button calls it via `safeFetch(..., { timeoutMs: 60_000 })` (Hard Rule 6 — without the override the 3 s default kills it and falsely flags offline). Results **pre-fill editable form fields** — nothing is written until the user hits Save (repo doctrine: AI proposes, human confirms; `ai_tagged`/`ai_confidence` are provenance only). On 429: toast the cooldown; the manual form stays fully usable — **manual tagging is the primary path, AI is an accelerator**.

---

## 7. UI spec

Feature dir `src/features/outfits/` (`types.ts`, `queryKeys.ts` mirroring the `catalogueKeys` factory, `hooks.ts` with safeFetch mutations + optimistic `onMutate`/rollback + Undo toasts with `ToastIcons`, `useSignedUrls.ts`). Page `src/app/outfits/page.tsx` = thin wrapper. Components in `src/components/outfits/`:

| Component | What it is |
|---|---|
| `OutfitsPage` | Segmented control **Wardrobe \| Outfits \| Planner**; mobile-first; fixed-header offset (Hard Rule 16) |
| `WardrobeGrid` | 3-col grid of cutouts on card background; filter chip rows (slot / season / color); archived behind a toggle; tap → detail |
| `AddGarmentSheet` | 3-step bottom sheet: (1) photo + flat-lay guidance → (2) compress + bg-removal with progress ("first use downloads a ~40 MB model") + cutout approve / Keep-original → (3) tags form + Auto-tag button |
| `GarmentDetailSheet` | Edit tags/fit note; wear stats; archive (with "used in N outfits" warning from the junction reverse lookup); delete |
| `OutfitBuilder` | **The paper doll.** Fixed 3:4 column of stacked `SlotSwiper` rows — headwear ~12% / top ~34% / bottom ~34% / shoes ~20% of height. Outerwear + accessory are chips above the doll opening a mini picker; they render as absolutely-positioned overlay layers (outerwear z-above top; accessory badge top-right). Selection = local `Record<Slot, itemId \| null>`; Save → `SaveOutfitSheet` |
| `SlotSwiper` | The carousel primitive: horizontal CSS snap-scroll (`scroll-snap-type: x mandatory`) of that slot's cutouts + a leading "none" cell — swiping a body region literally swaps that garment |
| `SaveOutfitSheet` | Name + occasion_hint → `POST /api/outfits` with the slot map; server expands to `outfit_items` rows in one insert |
| `OutfitsGallery` | Saved outfits as cards; thumbnail = mini composed stack (same absolute layering, small scale, reusing cached signed URLs); tap → edit in builder; menu → archive/delete |
| `OutfitPlannerCalendar` | Clone of `WebMealPlanCalendar.tsx` reduced to **one row**: droppable cells keyed `"${date}"` (single daily slot vs meal-plan's `"${date}\|${slot}"`); outfits dragged from a bottom tray; DragOverlay; drop → `PlanOutfitSheet`; status pills planned/worn/skipped; "Mark worn" → RPC with Undo wired to `p_worn=false` |
| `PlanOutfitSheet` | Occasion + event_name + the **no-repeat banner**: outfit's `last_worn_at`/`times_worn` + most recent worn plan → "Last worn Jun 30 at Sarah's wedding · worn 3×" — **amber if ≤14 days ago or same `event_name`; warns, never blocks** |
| `SizingProfileSheet` | Height/weight (`type="text" inputMode="decimal"`), per-slot size fields, notes → PUT `/api/outfits/profile` |

API surface (all: auth → Zod → DB → 23505→409 per the `api-route` skill; **none touch `household_links`**): `src/app/api/outfits/route.ts` (outfits list w/ `outfit_items(*)` embed + create), `[id]/route.ts`, `items/route.ts`, `items/[id]/route.ts`, `items/[id]/images/route.ts`, `signed-urls/route.ts`, `plans/route.ts` (GET by date range; POST upsert-by-date), `plans/[id]/route.ts`, `tag-garment/route.ts`, `profile/route.ts`.

---

## 8. Phasing (each an independently shippable PR; DB → API → types → hooks → UI)

See [3 · Action Plan](<../../10 - Project Management/Outfits/3 - Action Plan.md>) for the narrative + per-phase definition of done, and [4 · Checklist](<../../10 - Project Management/Outfits/4 - Checklist.md>) for the checkable queue (OUT-1 …).

1. **Phase 1 — Wardrobe catalog** (scaffold, Migration A, image pipeline, grid + add + detail + profile UI; manual tags only)
2. **Phase 2 — AI auto-tag** (gemini widening, tag-garment route, button)
3. **Phase 3 — Outfit builder** (Migration B, outfits CRUD, builder/gallery, in-use warnings)
4. **Phase 4 — Planner + wear log** (Migration C + RPC, plans routes, calendar, no-repeat sheet, reversible mark-worn)

**Backlog (Phase 2/3 of the vision — one-liners only):** AI try-on via Gemini image generation; AI outfit suggestions from wardrobe + occasion; weather-aware planning; packing-list bridge to Trips; multiple accessories per outfit; `fullbody` slot for dresses; cost-per-wear analytics (bridge to transactions).

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| imgly is AGPL | Fine for a personal, unsold app; revisit deliberately on any commercialization (that decision now trips over this row) |
| ~40–80 MB model download on first use | Lazy dynamic import; browser-cached after first fetch; explicit progress state + first-use note in `AddGarmentSheet`; "Keep original" keeps the module fully usable without cutouts |
| Cutout quality on cluttered backgrounds | Flat-lay guidance copy; always-available "Keep original"; retake is one tap |
| Supabase 1 GB free tier | ~210 KB/garment (two-derivative policy) + 2 MB server cap; 300 garments ≈ 63 MB |
| Signed-URL fan-out on grids | Batch endpoint + 50-min client cache — one request per screen |
| Gemini quota exhaustion | Rides `generateContentWithFallback` retry/fallback; manual tagging is the primary path → zero functional loss |
| Model writes to user data | AI only pre-fills form fields; user confirms before any write (repo doctrine) |

**Skill-factory gate: NO new skill.** Every pattern used is already codified (`api-route`, `db-migration`, `cache-invalidation`, `ui-guardrails`, `add-feature`, `new-module`); the only novel knowledge — the cutout pipeline — lives in two small lib files plus this doc, and is not a recurring cross-task rule set. Revisit only if Phase-2/3 AI features grow real domain invariants.

---

## 10. Handover notes for implementing agents (READ FIRST)

1. **Start every phase with the `start-task` skill**; Phase 1 begins with `node scripts/new-module.mjs --name outfits --title "Outfits" --type standalone --table wardrobe_items --one-liner "Wardrobe catalog, paper-doll outfit builder, weekly outfit planner and wear log." --intent '"what should I wear" / "add a shirt to my wardrobe"'` (dry-run first). The scaffold registers the six index surfaces (feature dir, API route, page, Feature Map, this vault doc's Feature Index row, Atlas); re-run `seed-atlas.mjs` when later phases add pages.
2. **STOP conditions** — if you find yourself doing any of these, stop and re-read this doc:
   - Reusing `compressReceiptImage` for cutouts (JPEG — flattens alpha).
   - Importing `@imgly/background-removal` at top level (bundle bloat; must be `await import(...)`).
   - Storing base64 or signed URLs in DB columns (store storage **paths**).
   - Joining `household_links` in any outfits route, or writing an RLS policy with an EXISTS subquery (D4 + Hard Rule 20).
   - Letting the AI write tags without the user confirming a form.
   - Calling `tag-garment` without `timeoutMs: 60_000` (falsely flags the app offline).
   - Making a toast without an Undo action (Hard Rule 1) — mark-worn's Undo must call the RPC with `p_worn=false`.
3. **Each migration pairs with `schema.sql`** in the same session (Hard Rule 24), and each phase ends with the `finish-task` skill (typecheck, lint, PM update — tick the OUT-n items and stamp file 1).
4. When this doc and reality disagree, reality wins — but record the delta in [1 · Feature State](<../../10 - Project Management/Outfits/1 - Feature State.md>) so the next agent inherits the truth.

**Research sources:** [imgly/background-removal-js](https://github.com/imgly/background-removal-js) · [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding) · [Supabase storage limits](https://supabase.com/docs/guides/storage/uploads/file-limits) · [Supabase image transformations (paid-tier only)](https://supabase.com/docs/guides/storage/serving/image-transformations) · [FASHN try-on API](https://fashn.ai/products/api) · [ModelsLab Fashion API](https://modelslab.com/fashion-api)

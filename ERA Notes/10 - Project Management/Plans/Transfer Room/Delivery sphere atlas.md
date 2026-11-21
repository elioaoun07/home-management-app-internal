---
type: art-and-interaction-specification
status: reference
scope: Local Delivery / ERA sphere identity
---

# ERA delivery sphere atlas

The R137 renderer uses these fifteen topic designs and a neutral General sphere. Each image uses the game’s geometry, materials and doorway viewing angle. The compact header uses the corresponding shared ERA mark where the app has one.

![The implemented ERA spheres, including the Budget trail, Schedule hands and Trips compass.](<Delivery sphere atlas.webp>)

Use this alongside [the first-person level and animation plan](<02 - Watching ERA work.md>). Each run has one recognizable topic sphere. Walking around it reveals its depth. The delivery changes its energy, the player chooses their viewpoint, and the selected topic survives every change of phase, material style and camera.

## Which topics exist?

The top layer currently registers four faces: **Budget, Schedule, Chef (Recipes), and Brain (Catalogue and inventory)**. The shared header mark supports eleven visual identities, including Trips, Health, Home and Meal. Separately, PM tracks eleven campaigns. A campaign owns work; an ERA face is an app interaction surface. Reuse the existing mark whenever a campaign corresponds to one. Add four *delivery sphere designs* for operational campaigns. They do not require adding dashboards to the ERA top layer. [Face registry](../../../../src/features/era/faceRegistry.ts) · [Header mark keys and cues](../../../../src/components/shared/ERAMark.tsx) · [PM campaign registry](../../../../scripts/pm/lint.mjs)

## One model, fifteen authored identities

Start from the actual ERAMark core, ring spacing and transparent margins. Preserve its frontal silhouette at header size. From the aisle, the outer line resolves into an enclosing shell, the middle line into a path carrying evidence, and the core into a diffuse source of light. The three-ring composition comes from the desktop top layer. Let each topic change the geometry **inside** that silhouette. Give its station lintels the same engraved motif for wayfinding. The topic must read in a still, in grey, with particle effects disabled. [ERA top layer](../../../../src/components/era/EraShell.tsx) · [Mark styles](<../../../../ERA Design System/era-mark-handoff/ERAMark.css>)

In the table, **edit** always means a retained edit row. Every visual gesture delivers the same evidence to the same Build station. The hue values of the first eleven rows come from the mark. The final four designs and their starting hues are proposals. Shape and text carry the identity when colors converge.

| Topic / mark | Sphere at rest, viewed from the walkway | One edit, from contact to rest | Illustrated treatment |
| --- | --- | --- | --- |
| Budget · financial · 175° | Two pearl nodes sit at opposite ends of a rising teal ribbon. Seen edge-on, the ribbon has a thin ledger-like spine. | Light runs between the two endpoints and leaves one ruled notch on the edit plate. | Two embossed dots, one sweeping ink line |
| Recipes · recipe · 28° | Three copper vapor curves rise from a shallow bowl-shaped lower shell. | The curves braid once, then a fine amber strand carries the edit outward. | Three tapered brushstrokes with a ceramic lip |
| Schedule · schedule · 256° | Two unequal violet clock hands occupy different depth planes; cast shadows show their separation. | The shorter hand indexes one mark while the longer points to Build. Keep the angle symbolic. | Engraved dial and two chunky pointers |
| Brain / Catalogue · memory · 220° | Three nested recall shells surround a pearl core. They overlap differently from each side. | A shell opens briefly and leaves a translucent leaf at the station. | Three offset nesting discs |
| Hub & ERA · chat · 190° | Paired cyan hum rings face one another across a small gap. | A pulse crosses the gap and continues to the edit. An actual owner question instead settles at the seat. | Two offset contour loops and one visible gap |
| Trips · trip · 155° | A mint compass needle floats inside an inclined ring. Engraved bearings remain legible from its rear. | Needle aligns with Build and one bearing extends to the file. A cancelled setup keeps a parked needle. | Faceted compass rose with a long north point |
| Healthcare · health · 352° | A rose ECG trace wraps a translucent equator. Its characteristic peaks remain visible when still. | A single trace segment travels to the receipt. Its timing follows the recording, separate from any clinical reading. | One flat zigzag around a satin bead |
| Home / household · home · 205° | Two blue roof arcs meet at a ridge over the core. Parallax reveals a second, recessed arch. | One arch opens and the changed segment seats beneath it. | Folded roof planes, visibly different from the compass |
| Fitness · fitness · 40° | Four radial ribs form a compact amber cross at the core. | A compression travels inward; the rib facing Build releases toward the edit. | Four blunt spokes with a foreshortened near end |
| Outfits · outfit · 325° | A magenta diagonal satin band wraps a matte sphere. Stepping sideways reveals the weave. | A single crossing thread catches the light and leaves a diagonal stitch. | Two folded layers and an asymmetric diagonal highlight |
| Meal planning · meal · 42° | Preserve the header's vapor family. Put it over three nested serving arcs, broad enough to distinguish Meal from Recipes when still. | One serving arc advances; its copy settles into the edit surface. | Stacked crescents and one steam cutout |
| Notifications & Alerts · new · 52° | Three interrupted wavefronts open outward from a tiny beacon. | A wavefront opens toward Build, then stops at its named receipt. | Three broken arcs with a broad gap |
| Native App · new · 204° | Two thin rounded device shells at different inclinations share one center. | A change passes from the inner outline to the outer, then to the work. | A nested handset-and-watch silhouette |
| Delivery · new · 164° | An iris has an inner source socket and outer receiving notch. | One segment passes between the sockets. A real handoff sends the signal all the way to the seat. | A six-leaf iris with an open receiving edge |
| PM Tooling · new · 267° | Three indexed tracks with unequal tab counts form a miniature radial instrument. | One tab aligns across all three tracks, then puts a mark on Build. | A notched index wheel and single registration line |

**Neutral identity.** For unknown, conflicting or absent metadata, render the plain ERA core with unmarked rings and the run's available topic label (or **General**). Core light, stations, questions, receipts and replay still work. The existing mark component defaults to Financial. Explicitly request neutral geometry for these runs.

## Resolve a sphere for every current PM campaign

| Owning campaign | ID family | Default design | Examples of explicit refinements |
| --- | --- | --- | --- |
| Budget | BUD | Budget | Accounts, debts, transfers and analytics retain Budget |
| Schedule | SCH | Schedule | Household chores → Home, physical training → Fitness |
| Kitchen | KIT | Recipes | Weekly menu → Meal, inventory/catalogue → Brain |
| Trips | TRIP | Trips | Travel planning and trip evidence retain Trips |
| Hub & ERA | HUB | Hub & ERA | Memory/catalogue → Brain, household coordination → Home |
| Notifications & Alerts | NOTIF | Notifications & Alerts | Reminders delivery retains the campaign beacon |
| Healthcare | HLTH | Healthcare | Explicit workout or training item → Fitness |
| Outfits | OUT | Outfits | Wardrobe and outfits retain Outfits |
| Native App | NAT | Native App | Phone/watch work shares the paired shells |
| Delivery | DLV | Delivery | Supervisor, worker and handoff work share the iris |
| PM Tooling | R (e.g. R131) | PM Tooling | Planning, PM UI and run tooling share indexed tracks |

The examples describe **authored classifications**. A matching word in a title, a log or a filename cannot select one. HUB-118 keeps Hub & ERA unless the work item is explicitly assigned a different topic. TRIP-33 gets Trips as soon as its work item is available, even with only two rows.

1. **Resolve once for the attempt.** Prefer an explicit, valid topic in the frozen work metadata if implemented. For the first cut, a small versioned table keyed by normalized work ID can supply intentional refinements. Otherwise map the exact campaign. For older records missing the campaign use the recognized full work ID and canonical campaign prefix. Honor R131 and dotted IDs. On conflict without an explicit assignment choose General. An unrecognized explicit topic also gets General and its safe display label. [Current work payload](../../../../scripts/pm/app/LocalDelivery.tsx) · [ID grammar](../../../../scripts/pm/shared/work-id.mjs)
2. **Support more than one subject without visual churn.** Pick the owning campaign as primary unless an explicit assignment says otherwise. Show an explicitly recorded secondary topic in the evidence reader. Changing viewpoint, inspecting a budget-related file in a Trips run or playing a different phase cannot repaint the sphere.
3. **Define one art contract.** For each entry deliver a stable key, label, source mark or new symbol, theme-safe palette, monochrome shape, a small 3D motif, illustrated material, resting pose and animation binding points. Attach common phase clips to those points. Keep theme, actor identity, topic and outcome as independent inputs. Use shared neutral room geometry for both art styles.
4. **Finish a contact sheet before calling the set complete.** Render each of the fifteen profiles and General front-on, in three-quarter view and from the rear. For each profile capture rest, edit and host result in both editions. Check the mark at header size, at walking distance, in greyscale, in Blue/Pink and with motion off. Show the same action for each profile so reviewers can judge topic identity independently of the work. Treat the eleven inherited marks as references. The 3D models, sheets and clips are implementation deliverables.
5. **Protect coverage when topics grow.** Compare the canonical campaign set with the campaign mapping and the shared header keys with the authored profiles. An uncovered new entry should fail the design-coverage check and remain usable in the running app via General. Verify stable identity on replay, missing metadata, contradictory campaign/ID, explicit Meal vs Recipes, dotted work IDs and cross-topic edits.

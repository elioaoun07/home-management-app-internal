export const ZONE_IDS = [
  "brief",
  "setup",
  "explore",
  "think",
  "build",
  "bench",
  "seal",
  "verify",
  "handover",
  "test",
  "ship",
] as const;
export type ZoneId = (typeof ZONE_IDS)[number];
export type ZoneGroup = "setup" | "build" | "verify" | "test" | "ship";
export interface BoardPoint {
  x: number;
  y: number;
}
export interface ZoneConfig {
  id: ZoneId;
  number: number;
  label: string;
  group: ZoneGroup;
  pad: BoardPoint & { width: number; depth: number };
  machine: BoardPoint;
  buildStop: BoardPoint | null;
  eraStand: BoardPoint | null;
  legacyStation: "source" | "forge" | "lab" | "review" | "launch";
  tab: "brief" | "activity" | "changes" | "verification";
}
const rows: [
  ZoneId,
  ZoneGroup,
  number,
  boolean,
  BoardPoint,
  BoardPoint | null,
  BoardPoint | null,
][] = [
  [
    "brief",
    "setup",
    0,
    false,
    { x: 64, y: 50 },
    { x: 64, y: 130 },
    { x: 78, y: 108 },
  ],
  [
    "setup",
    "setup",
    1,
    false,
    { x: 192, y: 50 },
    { x: 192, y: 130 },
    { x: 206, y: 108 },
  ],
  ["explore", "build", 2, false, { x: 320, y: 50 }, null, { x: 320, y: 108 }],
  ["think", "build", 3, false, { x: 448, y: 50 }, null, { x: 462, y: 108 }],
  [
    "build",
    "build",
    4,
    false,
    { x: 576, y: 50 },
    { x: 576, y: 130 },
    { x: 591, y: 108 },
  ],
  ["bench", "build", 5, false, { x: 704, y: 50 }, null, { x: 718, y: 108 }],
  ["seal", "build", 5, true, { x: 704, y: 268 }, { x: 704, y: 190 }, null],
  ["verify", "verify", 3, true, { x: 512, y: 268 }, { x: 608, y: 190 }, { x: 636, y: 160 }],
  [
    "handover",
    "test",
    2,
    true,
    { x: 320, y: 268 },
    { x: 320, y: 190 },
    { x: 360, y: 160 },
  ],
  [
    "test",
    "test",
    1,
    true,
    { x: 192, y: 266 },
    { x: 192, y: 266 },
    { x: 232, y: 160 },
  ],
  ["ship", "ship", 0, true, { x: 64, y: 266 }, { x: 64, y: 266 }, null],
];
export const ZONES: readonly ZoneConfig[] = rows.map(
  ([id, group, column, front, machine, buildStop, eraStand], i) => ({
    id,
    number: i + 1,
    label: id.toUpperCase(),
    group,
    pad: {
      x: column * 128 + 8,
      y: front ? 224 : 4,
      width: id === "verify" ? 240 : 112,
      depth: 92,
    },
    machine,
    buildStop,
    eraStand,
    legacyStation:
      id === "explore"
        ? "source"
        : id === "build"
          ? "forge"
          : id === "verify"
            ? "lab"
            : id === "handover" || id === "test"
              ? "review"
              : "launch",
    tab:
      id === "brief"
        ? "brief"
        : id === "build"
          ? "changes"
          : id === "verify"
            ? "verification"
            : "activity",
  }),
);
export const ZONE_BY_ID = Object.fromEntries(
  ZONES.map((zone) => [zone.id, zone]),
) as Record<ZoneId, ZoneConfig>;
export const BOARD = {
  column: 128,
  back: [0, 100],
  aisle: [100, 220],
  front: [220, 320],
  pad: { width: 112, depth: 92, raise: 6 },
  belt: {
    outbound: 130,
    walkway: 160,
    return: 190,
    turnStart: 768,
    turnEnd: 792,
    width: 15,
  },
  slab: { x: -12, y: -12, width: 816, depth: 344, thickness: 14 },
  bounds: { x: -348, y: -112, width: 1172, height: 708 },
  margin: 16,
  machine: {
    width: 72,
    depth: 64,
    backHeight: 100,
    frontHeight: 56,
    shipHeight: 110,
  },
  eraHeight: 92,
  camera: {
    minZoom: 1,
    maxZoom: 2.2,
    ceremonyZoom: 1.06,
    followWidth: 0.28,
    inspectZoom: 2.2,
    transitionMs: 900,
    idleMs: 20_000,
    manualHoldMs: 5_000,
    zoomBuckets: [1, 1.5, 2.2],
    ease: "cubic-bezier(0.4,0,0.2,1)",
  },
  main: { x: -22, y: 24 },
} as const;
export const ZONE_HUES = {
  setup: "#818cf8",
  build: "var(--accent)",
  verify: "#a78bfa",
  test: "#fbbf24",
  ship: "#34d399",
} as const;
export const LAMPS = {
  off: "#374151",
  done: "#34d399",
  owner: "#fbbf24",
  fault: "#f87171",
} as const;
export const TIMING = {
  resize: 150,
  boot: 2500,
  blink: 4200,
  blinkClosed: 130,
  hover: 1800,
  staleFade: 20000,
  recovery: 600,
  sonar: 4000,
  comms: 12000,
  typeCharacter: 28,
  badge: 2500,
  glitch: 280,
  perfWindow: 2000,
  slowFrames: 30,
  facts: 100,
  second: 1000,
  heatHalfLife: 12,
  maxDelta: 0.064,
  counter: 700,
  travel: 1400,
  attentionPulse: 1800,
} as const;
export const HUD = {
  stage: { min: 360, offset: 0, max: 1440 },
  topbar: 44,
  rail: 340,
  collapsedRail: 44,
  railBelow: 720,
  railCollapseBelow: 1100,
  dock: 56,
  mobileDock: 112,
  boardMin: 300,
  drawer: 0.45,
  comms: { width: 360, height: 96 },
  telemetry: { width: 380, height: 110 },
} as const;
export const BUDGET = {
  restCalls: 60,
  beatCalls: 150,
  particles: 150,
  staticDpr: 2,
  motionDpr: 1.5,
  frameMs: 8,
  scriptP95: 3,
  bakeMs: 150,
  dust: 8,
  smoke: 12,
} as const;
export type BoxPart = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  "hull" | "trim" | "zone",
];
// Local machine coordinates, relative to the centre in ZONES. Every fixture fits its pad.
// prettier-ignore
export const MACHINE_PARTS:Record<ZoneId,readonly BoxPart[]>={
  brief:[[-34,-26,6,68,52,10,"trim"],[25,-24,16,9,42,12,"hull"]],
  setup:[[-34,-28,6,68,56,8,"trim"],[-30,-24,14,10,12,76,"hull"],[20,-24,14,10,12,76,"hull"],[-30,-24,90,60,12,8,"hull"],[-24,-20,14,48,40,6,"hull"],[-3,-3,94,6,6,6,"zone"]],
  explore:[[-36,-30,6,72,60,8,"trim"],[-32,-26,14,64,52,78,"hull"]],
  think:[[-32,-28,6,64,56,10,"trim"],[-15,-13,16,30,26,26,"hull"]],
  build:[[-36,-30,6,72,60,8,"trim"],[-32,-24,14,12,16,64,"hull"],[20,-24,14,12,16,64,"hull"],[-32,-24,78,64,16,12,"hull"],[-28,8,14,26,22,32,"hull"],[2,4,14,28,24,10,"trim"]],
  bench:[[-34,-28,6,68,56,9,"trim"],[-30,-24,15,60,48,24,"hull"],[-29,-22,39,58,10,41,"hull"],[24,2,39,9,22,28,"hull"]],
  seal:[[-26,-20,6,52,40,18,"hull"]],
  verify:[[-36,-26,6,72,52,10,"trim"],[-28,-18,16,56,36,25,"hull"]],
  handover:[[-30,-26,6,60,52,9,"trim"],[-12,-12,15,24,24,20,"hull"]],
  test:[[-36,-30,6,72,60,8,"trim"],[-32,-26,14,64,52,22,"hull"],[24,-20,36,6,8,18,"hull"],[8,-20,48,22,8,6,"hull"]],
  ship:[[-36,-30,6,72,60,12,"trim"],[-28,-22,18,15,14,80,"hull"],[-28,-22,98,56,14,10,"hull"],[15,-22,70,12,12,28,"hull"]],
};
// prettier-ignore
export const ART={parts:{brief:[[-24,-23,32,48,8,48,"trim"],[-20,-15,36,40,6,40,"zone"]],setup:[[-8,-6,14,16,12,12,"hull"],[-8,-6,40,16,12,12,"hull"],[-8,-6,66,16,12,12,"hull"]],explore:[[-6,28,34,12,12,9,"zone"]],think:[],build:[[-18,-18,52,36,26,14,"zone"]],bench:[[-25,-23,44,50,6,31,"zone"]],seal:[[-18,-94,63,36,32,8,"zone"]],verify:[[-5,-63,35,10,4,6,"zone"]],handover:[[-22,-17,33,44,8,22,"hull"],[16,-9,33,6,6,22,"zone"]],test:[[0,-22,49,18,12,7,"trim"],[3,-13,48,12,6,6,"zone"]],ship:[[-12,-22,88,40,14,10,"hull"]]},details:{brief:{slope:[-28,-20,16,56,40,20],scan:[0,-12,38,32,3],travel:34},setup:{slices:[[-14,-33,28,26],[-14,-59,28,26],[-14,-85,28,26]],drop:18,lamp:[0,-99]},explore:{frontX:-28,frontY:27},build:{drop:16,glow:[0,-60]},bench:{scan:[0,-16,48,40,3],travel:24},seal:{lamps:[-19,-11,25],lampGap:8,lampSize:5,drop:9},verify:{sweep:28},handover:{slope:[-25,-21,31,50,36,16],roll:10,seal:[19,-6,42,7,7]},test:{lamp:[8,-48]},ship:{ringR:30,ringInner:24,ringZ:12,ringH:6,retract:24}},sprite:{width:256,height:220,originX:128,originY:160},lamp:{x:43,y:34,z:18,r:4,post:12},shadow:{x:12,y:12,r:53,depth:23},stripe:{inset:6,front:9,depth:5,height:1},drawer:{columns:4,rows:6,width:12,height:9,gapX:15,gapY:11,z:20},orb:{r:23,z:69,beads:60,railR:32},head:{x:0,y:-17,z:64,width:12,depth:13,height:14,travel:16},verify:{xs:[608,560,512,464],y:190,z:3,width:10,depth:46,height:55},build:{r:24,height:8,block:10,tileHeight:5,gap:1,layers:6,standZ:3},era:{width:110,height:120,originX:55,originY:112,bodyR:15,bodyZ:25,headR:21,headZ:56,headHeight:29,handR:6,eyeW:6,eyeH:4,eyeGap:13},dust:{radius:2,rangeX:1000,rangeY:400},glow:{size:48,radius:24},spark:{life:.7,speed:40,gravity:30},smoke:{life:1.6,speed:12},label:{offsetY:18,height:34},beltTravel:1800} as const;
// Factual DOM plates use base-world pixels and transform with the same camera.
// prettier-ignore
export const READOUTS={font:9,line:12,paddingX:4,paddingY:2,radius:3,nodeSize:8,nodeGap:7,focusWidth:2,main:{dx:-100,labelDy:-74,baseDy:14,mergeDy:-28,gap:42},signal:{x:16,y:102,width:170},retry:{x:18,y:6,z:60,width:36},lap:{dx:31,dy:-104,width:36},overflow:{dx:40,dy:-45,width:34},count:{dx:0,dy:25,width:26},scenario:{x:22,y:-18,z:48,width:26},check:{z:76,width:48},stale:{dishWidth:18,dishHeight:9,dishY:-68,stem:8,sonarWidth:56,sonarHeight:20,sonarY:3,line:1,sweep:16,scale:2.1},checkLabels:["TYPE","LINT","TEST","PM"]} as const;

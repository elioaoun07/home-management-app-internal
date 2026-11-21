import * as T from "three";
import type { ZoneId } from "../stage/config";

type Finish = T.MeshStandardMaterial;
type Tier = readonly [height: number, width: number, depth: number, z: number];
type Stock = { hull: Finish; panel: Finish; bevel: Finish; pale: Finish; recess: Finish };

// Horizontal sections of a cast housing. Every corner, belt line and folded
// return has a physical face to catch light. Signed UVs follow the casting.
function casting(parent: T.Object3D, material: Finish, tiers: readonly Tier[], x = 0) {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const corner = (tier: Tier, i: number) => {
    const [y, width, depth, center] = tier, w = width / 2, d = depth / 2;
    const cut = Math.min(width * .15, depth * .18);
    const contour = [[-w + cut,d],[w - cut,d],[w,d-cut],[w,-d+cut],
      [w-cut,-d],[-w+cut,-d],[-w,-d+cut],[-w,d-cut]];
    return [x + contour[i][0], y, center + contour[i][1]];
  };
  for (let t = 1; t < tiers.length; t++) {
    for (let i = 0; i < 8; i++) {
      const j = (i + 1) % 8, p = positions.length / 3;
      positions.push(...corner(tiers[t-1], i), ...corner(tiers[t-1], j), ...corner(tiers[t], j), ...corner(tiers[t], i));
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      indices.push(p, p+1, p+2, p, p+2, p+3);
    }
  }
  for (const [end, up] of [[0, false], [tiers.length - 1, true]] as const) {
    const p = positions.length / 3, tier = tiers[end];
    for (let i = 0; i < 8; i++) {
      const v = corner(tier, i);
      positions.push(...v);
      uv.push((v[0] - x) / tier[1] + .5, (v[2] - tier[3]) / tier[2] + .5);
    }
    for (let i = 2; i < 8; i++) indices.push(p, p + (up ? i-1 : i), p + (up ? i : i-1));
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute("position", new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  parent.add(new T.Mesh(geometry, material));
}

function grilleFinish() {
  // Painted service cover with punched vents, captive fasteners and a recessed
  // latch. Store the undercut and contact shading in one reusable surface.
  const sheet = document.createElement("canvas");
  sheet.width = 512; sheet.height = 384;
  const g = sheet.getContext("2d")!;
  const paint = g.createLinearGradient(0, 0, 480, 384);
  paint.addColorStop(0, "#7f8888"); paint.addColorStop(.42, "#5a6263"); paint.addColorStop(1, "#414a4c");
  g.fillStyle = paint; g.fillRect(0, 0, 512, 384);
  g.strokeStyle = "#283135"; g.lineWidth = 7;
  g.beginPath(); g.roundRect(11, 10, 490, 364, 16); g.stroke();
  g.strokeStyle = "#879091"; g.lineWidth = 2; g.stroke();
  const slot = g.createLinearGradient(0, 0, 0, 13);
  slot.addColorStop(0, "#1d2527"); slot.addColorStop(.52, "#111b20");
  slot.addColorStop(.76, "#3d4547"); slot.addColorStop(1, "#949d9d");
  for (let row = 0; row < 7; row++) {
    for (let column = 0; column < 2; column++) {
      g.save();
      g.translate(57 + column * 201, 106 + row * 24);
      g.fillStyle = slot; g.beginPath(); g.roundRect(0, 0, 178, 13, 5); g.fill();
      g.restore();
    }
  }
  for (const x of [33, 479]) for (const y of [32, 351]) {
    const rim = g.createLinearGradient(x-8, y-8, x+8, y+8);
    rim.addColorStop(0, "#c4c6bd"); rim.addColorStop(.43, "#808886"); rim.addColorStop(1, "#323d40");
    g.fillStyle = rim; g.beginPath(); g.arc(x, y, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#283236"; g.beginPath(); g.arc(x, y, 3.3, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = "#263236"; g.beginPath(); g.roundRect(197, 47, 118, 27, 6); g.fill();
  g.fillStyle = "#959d99"; g.fillRect(209, 50, 93, 5);
  const texture = new T.CanvasTexture(sheet);
  texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
  return new T.MeshStandardMaterial({ map: texture, roughness: .55, metalness: .40 });
}

// A die-cast enclosure viewed from its front face. Form its gasket, machined
// bevel and recessed switch field in depth so they catch light when approached.
export function instrumentCase(parent: T.Group, stock: Stock, w: number, h: number, depth: number) {
  const housing = new T.Group(), shell = new T.Group();
  parent.add(housing);
  housing.add(shell);
  shell.rotation.x = Math.PI / 2;
  casting(shell, stock.panel, [
    [-depth * .5, w * .89, h * .82, 0], [-depth * .23, w, h, 0],
    [depth * .25, w, h, 0], [depth * .4, w * .974, h * .92, 0],
  ]);
  casting(shell, stock.bevel, [
    [depth * .40, w * .974, h * .92, 0], [depth * .5, w * .96, h * .86, 0],
  ]);
  casting(shell, stock.recess, [
    [depth * .50, w * .93, h * .82, 0], [depth * .53, w * .922, h * .80, 0],
  ]);
  for (const x of [-1, 1]) for (const y of [-1, 1]) {
    const screw = new T.Mesh(new T.CylinderGeometry(.012, .014, .007, 8), stock.bevel);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(x * w * .426, y * h * .34, depth * .53);
    housing.add(screw);
  }
  return housing;
}

export function workstationKit(stock: Stock) {
  const cover = grilleFinish();
  const bronze = new T.MeshStandardMaterial({color: "#ba9264", roughness: .36, metalness: .72});
  function box(parent: T.Object3D, m: Finish, x: number, y: number, z: number, w: number, h: number, d: number) {
    const part = new T.Mesh(new T.BoxGeometry(w,h,d),m);
    part.position.set(x,y,z); parent.add(part);
    return part;
  }
  function body(bench: T.Group, id: ZoneId) {
    // The instrument rail is cantilevered over a twin spar, leaving the aisle
    // visible through the pedestal. A single collision footprint fits all bays.
    casting(bench, stock.recess, [[.012,1.07,.77,-.015],[.038,1.20,.86,-.015],[.095,1.18,.84,-.015]]);
    casting(bench, stock.hull, [[.092,1.16,.82,-.015],[.13,1.05,.72,-.025],[.16,.94,.63,-.04]]);
    for (const side of [-1,1]) {
      const x = side * .31;
      casting(bench, stock.panel, [[.15,.26,.55,-.025],[.22,.23,.47,-.05],
        [.56,.17,.31,-.15],[.77,.22,.37,-.10],[.84,.29,.51,-.04]], x);
      box(bench, bronze, x,.182,.216,.175,.032,.035);
    }
    const rear = box(bench, stock.recess, 0,.46,-.22,.54,.45,.16);
    const hatch = new T.Mesh(new T.PlaneGeometry(.48,.36), cover);
    hatch.position.z = .082;
    rear.add(hatch);
    casting(bench, stock.recess, [[.77,.84,.52,-.055],[.815,1.07,.69,-.025],[.85,1.20,.81,0]]);
    casting(bench, stock.panel, [[.845,1.17,.80,0],[.872,1.23,.85,0],[.952,1.23,.85,0],[1.,1.12,.76,-.012]]);
    casting(bench, stock.bevel, [[.992,1.13,.775,-.012],[1.011,1.10,.75,-.016]]);
    casting(bench, stock.recess, [[1.011,1.025,.68,-.016],[1.019,1.008,.666,-.016]]);
    for (const side of [-1,1]) {
      box(bench, bronze, side*.52,.912,.421,.079,.032,.017);
      const access = new T.Mesh(new T.PlaneGeometry(.33,.16),cover);
      access.rotation.y = side * Math.PI / 2;
      access.position.set(side * .422,.29,-.075); bench.add(access);
    }
    if (id === "explore" || id === "think" || id === "ship") {
      const height = id === "ship" ? 1.39 : 1.37;
      for (const side of [-1,1]) {
        const x = side * (id === "ship" ? .435 : .32);
        casting(bench, stock.bevel, [[1.02,.16,.32,-.08],[1.10,.12,.25,-.10],[height,.085,.12,-.09]],x);
        const spindle = new T.Mesh(new T.CylinderGeometry(.083,.083,.13,16),bronze);
        spindle.rotation.z = Math.PI/2; spindle.position.set(x,height,-.08); bench.add(spindle);
      }
    }
    if (id === "verify" || id === "build" || id === "brief" || id === "test") {
      const width = id === "verify" ? 1.03 : .86;
      casting(bench,stock.hull,[[1.022,width,.32,-.15],[1.07,width-.06,.28,-.16],
        [1.16,width-.17,.15,-.175]]);
      for (const side of [-1,1]) box(bench, bronze, side * width * .38,1.125,-.067,.09,.033,.04);
    }
  }
  return body;
}

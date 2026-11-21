import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Topic } from "./topics";

type Point = [number, number, number];
const turn = Math.PI * 2;

/** Sculpt the header cue at the scale of the sphere. Each solid reads from both
 * sides and the carrier, inlay and luminous tips each cost one draw call. */
export function topicMotif(topic: Topic, metal: T.Material, enamel: T.Material, light: T.Material) {
  const parts = new Map<T.Material, T.BufferGeometry[]>();
  function add(m: T.Material, part: T.BufferGeometry) {
    const pieces = parts.get(m) ?? [];
    pieces.push(part);
    parts.set(m, pieces);
  }
  function pearl(at: Point, radius: number, m = light) {
    add(m, new T.SphereGeometry(radius, 24, 16).translate(...at));
  }
  function line(points: Point[], width: number, m: T.Material, smooth = false) {
    const path = new T.CurvePath<T.Vector3>();
    const vertices = points.map(p => new T.Vector3(...p));
    if (smooth) path.add(new T.CatmullRomCurve3(vertices));
    else for (let i = 1; i < vertices.length; i++) path.add(new T.LineCurve3(vertices[i-1], vertices[i]));
    add(m, new T.TubeGeometry(path, smooth ? 36 : 52, width, 8, false));
  }
  function ring(radius: number, width: number, m: T.Material, tilt = 0, z = 0, length = turn, angle = 0) {
    add(m, new T.TorusGeometry(radius, width, 8, Math.max(12, Math.ceil(64 * length / turn)), length)
      .rotateZ(angle).rotateY(tilt).translate(0, 0, z));
  }
  function plate(points: [number, number][], depth: number, m: T.Material, z: number, angle = 0) {
    const profile = new T.Shape(points.map(p => new T.Vector2(...p)));
    const geometry = new T.ExtrudeGeometry(profile, {
      depth, bevelEnabled: true, bevelSize: .021, bevelThickness: .022, bevelSegments: 2, steps: 1,
    });
    add(m, geometry.rotateZ(angle).translate(0, 0, z - depth / 2));
  }
  function dial(count: number, radius: number, tilt: number, z: number) {
    for (let i = 0; i < count; i++) {
      const major = i % (count / 4) === 0;
      const h = major ? .17 : count === 12 ? .105 : .07;
      add(major || count === 12 ? light : metal, new T.BoxGeometry(major ? .052 : .032, h, .066)
        .translate(0, radius - h / 2, 0).rotateZ(i * turn / count).rotateY(tilt).translate(0,0,z));
    }
  }

  switch (topic) {
    case "trip": {
      // The compass is a four-faced mineral needle. Its ridge and its underside
      // are real faces, giving the north/south halves different reflections.
      for (const [end, width, m] of [[1.15, .34, light], [-.97, .265, enamel]] as const) {
        const base = [[-width,0,0],[0,0,.28],[width,0,0],[0,0,-.28]];
        for (let i = 0; i < 4; i++) {
          const a = base[i], b = base[(i + 1) % 4];
          const positions=[...(end > 0 ? a : b), ...(end > 0 ? b : a), 0,end,0];
          const gem = new T.BufferGeometry().setAttribute("position", new T.Float32BufferAttribute(positions, 3));
          gem.computeVertexNormals(); gem.setAttribute("uv", new T.Float32BufferAttribute(new Float32Array(6), 2));
          const face = i%2 ? m : end > 0 ? metal : enamel;
          add(face,gem.rotateZ(-.37).translate(0,0,.08));
        }
      }
      ring(1.20,.041,metal,.22,-.045);
      dial(32,1.18,.22,-.045);
      // Trunnions project beyond the compass card without obscuring the needle.
      for (const side of [-1,1]) {
        add(enamel,new T.CylinderGeometry(.082,.082,.13,16)
          .rotateZ(Math.PI/2).translate(side*1.20,0,0).rotateY(.22).translate(0,0,-.045));
        add(metal,new T.CylinderGeometry(.045,.045,.13,12)
          .rotateZ(Math.PI/2).translate(side*1.30,0,0).rotateY(.22).translate(0,0,-.045));
      }
      const axle = new T.CylinderGeometry(.125,.125,.73,24).rotateX(Math.PI/2);
      add(metal,axle);
      ring(.143,.032,metal,0,.31);
      break;
    }
    case "financial": {
      // The two quadratic arcs from ERAMark, with a raised spine following the
      // depth of the transfer. The end nodes remain visible from the side.
      const start: Point = [-1.14,-.65,-.38], end: Point = [1.10,.74,.39];
      const path: Point[] = [start,[-.77,-.59,-.31],[-.42,-.38,-.18],[-.13,-.03,.04],
        [.15,.33,.24],[.50,.57,.37],end];
      line(path,.105,enamel,true);
      line(path.map(([x,y,z]) => [x,y+.062,z+.052]),.039,light,true);
      pearl(start,.20); pearl(end,.20);
      for (const [x,y,z] of [start,end]) {
        add(metal,new T.TorusGeometry(.238,.028,8,36).rotateY(.48).translate(x,y,z));
      }
      break;
    }
    case "schedule": {
      ring(1.17,.043,metal,-.13,-.23); dial(12,1.16,-.13,-.23);
      for (const [length, width, angle, z, m] of [[1.04,.078,-.48,.22,light],[.77,.105,1.24,.045,enamel]] as const) {
        plate([[-width,-.16],[-width,length-.10],[0,length],[width,length-.10],[width,-.16]],
          .09,m,z,angle);
        plate([[-.022,.19],[-.022,length-.15],[.022,length-.15],[.022,.19]],
          .012,m===light?enamel:light,z+.072,angle);
      }
      pearl([0,0,.30],.16); break;
    }
    case "recipe": case "meal": {
      const meal = topic === "meal";
      for (let i = 0; i < (meal ? 3 : 1); i++) {
        const r = .90 - i*.10, y = -.32 - .19*i;
        const profile = [[.02,y-.32],[r*.38,y-.31],[r*.72,y-.21],[r,y],[r*.91,y-.026],[r*.51,y-.22]];
        add(i === 0 ? enamel : metal, new T.LatheGeometry(profile.map(p => new T.Vector2(p[0],p[1])), 48));
        add(light,new T.TorusGeometry(r,.029,8,64).rotateX(Math.PI/2).translate(0,y,0));
      }
      for (const i of meal ? [0] : [-1,0,1]) {
        const x = i*.32;
        line([[x,-.14,.15],[x-.085,.16,.22],[x+.10,.49,.03],[x,.89-.15*Math.abs(i),-.13]],
          i === 0 ? .066 : .047, i === 0 ? light : enamel,true);
      }
      break;
    }
    case "memory": {
      for (let i = 0; i < 3; i++) {
        const r = .60 + i*.24;
        ring(r,.067, i === 1 ? enamel : metal, (i-1)*.49, (i-1)*.27, turn*.87, .64+i*.85);
        ring(r,.030,light,(i-1)*.49,(i-1)*.27,turn*.22,.64+i*.85);
      }
      break;
    }
    case "chat": {
      for (const side of [-1,1]) {
        const plane = (side: number, r: number, w: number, m: T.Material) => add(m,
          new T.TorusGeometry(r,w,8,60).scale(.84,1,1).rotateY(side*.76).rotateZ(side*.19)
            .translate(side*.35, side*.12, side*.16));
        plane(side,.77,.085,enamel); plane(side,.90,.028,light);
      }
      break;
    }
    case "health": {
      const wave: Point[] = [[-1.22,-.06,-.14],[-.66,-.06,.13],[-.48,.25,.33],[-.29,-.38,.43],
        [-.02,.83,.51],[.27,-.62,.44],[.49,-.06,.32],[.78,-.06,.15],[1.22,-.06,-.14]];
      line(wave,.075,light); pearl(wave[0],.105,enamel); pearl(wave.at(-1)!,.105,enamel); break;
    }
    case "home": {
      const roof: [number,number][] = [[-1.08,-.23],[0,.81],[1.08,-.23],[.92,-.36],[0,.49],[-.92,-.36]];
      plate(roof,.24,enamel,-.38); plate(roof,.17,light,.34);
      line([[0,.69,-.52],[0,.69,.48]],.053,metal); break;
    }
    case "fitness": {
      for (let i = 0; i < 4; i++) {
        plate([[-.13,.32],[-.17,.96],[-.08,1.07],[.08,1.07],[.17,.96],[.13,.32]], .30,enamel,0,i*turn/4);
        plate([[-.065,.48],[-.065,.96],[.065,.96],[.065,.48]], .035,light,.18,i*turn/4);
      }
      break;
    }
    case "outfit": {
      add(metal,new T.SphereGeometry(.84,40,24));
      const belt = new T.LatheGeometry([[.87,-.25],[.95,-.20],[.98,0],[.95,.19],[.87,.25]]
        .map(([x,y]) => new T.Vector2(x,y)),60).rotateX(.39).rotateZ(-.62);
      add(enamel,belt);
      for (const y of [-.185,.185]) add(light,new T.TorusGeometry(.952,.024,8,60)
        .rotateX(Math.PI/2).translate(0,y,0).rotateX(.39).rotateZ(-.62));
      break;
    }
    case "notifications": {
      for (let i=0; i<3; i++) {
        const a=-1.21+(i%2)*.26;
        ring(.46+.31*i,.068,i === 1 ? light : enamel,.15*i,(1-i)*.24,turn*.73,a);
      }
      pearl([.18,-.08,.24],.21); break;
    }
    case "native": {
      for (const [w,h,x,y,z,yaw,m] of [[1.03,1.90,-.26,.05,-.21,-.22,enamel],[.77,.95,.48,-.25,.43,.28,light]] as const) {
        const r=.15, shape=new T.Shape();
        shape.moveTo(-w/2+r,-h/2); shape.lineTo(w/2-r,-h/2); shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
        shape.lineTo(w/2,h/2-r); shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2);
        shape.lineTo(-w/2+r,h/2); shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r);
        shape.lineTo(-w/2,-h/2+r); shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
        const p=shape.getPoints(8).map(({x,y})=>new T.Vector3(x,y,0));
        add(m,new T.TubeGeometry(new T.CatmullRomCurve3(p.slice(0,-1),true),80,.068,8,true)
          .rotateY(yaw).translate(x,y,z));
      }
      break;
    }
    case "delivery": {
      for (let i=0; i<6; i++) {
        plate([[.33,.10],[.63,-.61],[1.02,-.35],[1.09,.03],[.72,.36],[.34,.29]],
          .10,i%2 ? enamel : metal,(i%2)*.12,i*turn/6);
      }
      ring(1.15,.053,light,0,0,turn*.85,.37); break;
    }
    case "tooling": {
      for (let i=0;i<3;i++) {
        const count=[5,8,12][i], r=.48+i*.29, z=(1-i)*.20;
        ring(r,.066,i===1?enamel:metal,0,z);
        for (let j=0;j<count;j++) add(light,new T.BoxGeometry(.084,.13,.075)
          .translate(0,r,z+.055).rotateZ(j*turn/count+i*.19));
      }
      plate([[-.043,-.13],[-.043,1.17],[.043,1.17],[.043,-.13]],.068,enamel,.34,-.43); break;
    }
    case "general": break;
  }
  const group = new T.Group();
  group.name = "ERA cue · " + topic;
  for (const [material, items] of parts) {
    // Extrusions use separate vertices for each bevel. Normalize the other
    // primitives before merging so an inlay never disappears on mixed meshes.
    const flat = items.map(item => item.index ? item.toNonIndexed() : item);
    const geometry = mergeGeometries(flat)!;
    group.add(new T.Mesh(geometry,material));
    new Set([...items, ...flat]).forEach(item => item.dispose());
  }
  return group;
}

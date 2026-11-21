// The illustrated room and the observatory's panoramic window share this sky.
// No external textures are needed on a disconnected laptop.
function randomSource(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function canvas(width: number, height: number) {
  const element = document.createElement("canvas");
  element.width = width;
  element.height = height;
  return element;
}

function halo(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string) {
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
  glow.addColorStop(0, color);
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}

function planet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, hue: number, rings = false) {
  const random = randomSource(hue);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rings ? -.29 : .19);
  function ring(front: boolean) {
    for (let k = 1.35; k < 2.55; k += .019) {
      if (k > 2.04 && k < 2.16) continue;
      ctx.strokeStyle = `hsla(${hue + 8}, 36%, ${54 + random() * 28}%, ${.33 + random() * .60})`;
      ctx.lineWidth = r * .015;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * k, r * k * .215, 0, front ? 0 : Math.PI, front ? Math.PI : 2 * Math.PI);
      ctx.stroke();
    }
  }
  if (rings) ring(false);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, 2 * Math.PI);
  ctx.clip();
  ctx.fillStyle = `hsl(${hue}, 45%, 58%)`;
  ctx.fillRect(-r, -r, r * 2, r * 2);
  for (let row = -r; row < r; row += 1.15) {
    const band = Math.sin(row * .24 + Math.sin(row * .095)) + .7 * Math.cos(row * .103);
    ctx.strokeStyle = `hsla(${hue + 5 * band}, ${33 + 6 * band}%, ${58 + 11 * band + random() * 9}%, .95)`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-r, row);
    ctx.bezierCurveTo(-r * .45, row + r * .21, r * .5, row + r * .16, r, row);
    ctx.stroke();
  }
  const terminator = ctx.createRadialGradient(r * .68, -r * .66, r * .10, r * .80, -r * .47, r * 1.87);
  terminator.addColorStop(0, "rgba(255,248,219,.28)");
  terminator.addColorStop(.42, "transparent");
  terminator.addColorStop(.63, "rgba(30,23,47,.36)");
  terminator.addColorStop(.83, "rgba(11,15,34,.94)");
  terminator.addColorStop(1, "#080e20");
  ctx.fillStyle = terminator;
  ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.restore();
  if (rings) ring(true);
  ctx.restore();
}

export function librarySky() {
  const sky = canvas(4096, 704), ctx = sky.getContext("2d")!;
  const random = randomSource(20261121);
  ctx.fillStyle = "#070d1e";
  ctx.fillRect(0, 0, sky.width, sky.height);
  for (let i = 0; i < 1600; i++) {
    const x = random() * sky.width;
    const band = 210 + 100 * Math.sin(x / 652) + 70 * Math.cos(x / 326);
    const y = band + (random() + random() + random() - 1.5) * 174;
    const size = 5 + random() ** 2 * 78;
    const tint = Math.cos(x / 652) > .18 ? "148,104,178" : "91,150,183";
    // Draw across the seam of the cylindrical panorama.
    for (const xx of [x, ...(x < size ? [x + sky.width] : x > sky.width - size ? [x - sky.width] : [])]) {
      halo(ctx, xx, y, size, `rgba(${tint},${.035 + random() * .070})`);
    }
  }
  for (let i = 0; i < 11100; i++) {
    const x = random() * sky.width, y = random() * sky.height;
    const size = .35 + random() ** 6 * 1.8;
    ctx.fillStyle = `rgba(${i % 7 === 0 ? "255,222,178" : "213,232,255"},${.17 + random() * .65})`;
    ctx.fillRect(x, y, size, size);
    if (size > 2.06 && i % 4 === 0) {
      halo(ctx, x, y, size * 3, "rgba(129,186,255,.66)");
      ctx.fillRect(x - 2.6, y, 6.4, .8);
      ctx.fillRect(x, y - 2.6, .8, 6.4);
    }
  }
  ctx.save();
  ctx.translate(1700, 273); ctx.rotate(-.36); ctx.scale(1, .40);
  halo(ctx, 0, 0, 76, "rgba(168,173,229,.48)");
  for (let i = 0; i < 400; i++) {
    const r = random() * 67;
    const a = r / 20 + (i % 2) * Math.PI + (random() - .5) * .95;
    halo(ctx, r * Math.cos(a), r * Math.sin(a), 1 + random() * 6, "rgba(189,203,240,.24)");
  }
  halo(ctx, 0, 0, 22, "rgba(255,216,174,.91)");
  ctx.restore();
  planet(ctx, 2165, 272, 49, 32, true);
  planet(ctx, 2295, 285, 9, 191);
  planet(ctx, 693, 219, 31, 201, true);
  planet(ctx, 3241, 250, 79, 193);
  planet(ctx, 3632, 327, 14, 28);
  planet(ctx, 1263, 223, 47, 13);
  const x = 1882, y = 258;
  halo(ctx, x, y, 132, "rgba(255,155,74,.30)");
  halo(ctx, x, y, 55, "rgba(255,174,81,.80)");
  halo(ctx, x, y, 26, "rgba(255,222,154,.98)");
  const sun = ctx.createRadialGradient(x, y, 5, x, y, 15);
  sun.addColorStop(0, "#fff9dc");
  sun.addColorStop(.76, "#fff1b4");
  sun.addColorStop(.90, "#ffc77f");
  sun.addColorStop(1, "transparent");
  ctx.fillStyle = sun;
  ctx.fillRect(x - 15, y - 15, 30, 30);
  return sky;
}

export interface CabinetArt { name: string; color: string }

export function cabinetFace({ name, color }: CabinetArt) {
  const image = canvas(576, 672), ctx = image.getContext("2d")!;
  ctx.scale(1.5, 1.5);
  const seed = Array.from(name).reduce((value, c) => Math.imul(value, 31) + c.charCodeAt(0), 17);
  const random = randomSource(seed);
  const metal = name === "Budget" || name === "Hub & ERA";
  const wood = ctx.createLinearGradient(0, 0, 384, 20);
  wood.addColorStop(0, metal ? "#243545" : "#5b4334");
  wood.addColorStop(.45, metal ? "#344450" : "#795545");
  wood.addColorStop(1, metal ? "#182a39" : "#49362e");
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, 384, 448);
  // Machining and grain catch the lamps running along the glass.
  for (let i = 0; i < 210; i++) {
    ctx.fillStyle = i % 3 === 0 ? "rgba(242,220,179,.09)" : "rgba(4,12,23,.09)";
    ctx.fillRect(random() * 384, random() * 80, random() + .5, 448);
  }
  ctx.fillStyle = "#17232c";
  ctx.fillRect(12, 10, 360, 50);
  ctx.fillStyle = color;
  ctx.fillRect(18, 18, 4, 34);
  ctx.font = "600 28px 'Segoe UI', sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ecf1e9";
  ctx.fillText(name, 34, 34, 317);
  for (let row = 0; row < 3; row++) {
    const top = 73 + row * 119, bottom = top + 102;
    const shade = ctx.createLinearGradient(0, top, 0, bottom);
    shade.addColorStop(0, "#121821");
    shade.addColorStop(.85, metal ? "#243540" : "#3d302a");
    shade.addColorStop(1, "#141d25");
    ctx.fillStyle = shade;
    ctx.fillRect(14, top, 356, 106);
    let left = 20;
    if (metal) {
      // An outward-facing financial tablet or edge-lit glass slate identifies
      // each digital collection even when its engraved name is out of view.
      const glass = name === "Hub & ERA";
      const x = 24, y = bottom - 89, w = glass ? 99 : 77;
      ctx.fillStyle = glass ? "#648990" : "#abb5b3";
      ctx.beginPath(); ctx.roundRect(x, y, w, 83, glass ? 2 : 6); ctx.fill();
      ctx.fillStyle = glass ? "#173c4d" : "#1d292f";
      ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, 79, glass ? 1 : 5); ctx.fill();
      const screen = ctx.createLinearGradient(x, y, x + w, y + 83);
      screen.addColorStop(0, glass ? "#427b88" : "#365857");
      screen.addColorStop(.5, glass ? "#234c5b" : "#214044");
      screen.addColorStop(1, "#152937");
      ctx.fillStyle = screen;
      ctx.fillRect(x + 6, y + 6, w - 12, 68);
      ctx.strokeStyle = glass ? "#a4e3e9" : "#83cfc4"; ctx.lineWidth = 1.2;
      if (glass) {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath(); ctx.ellipse(x + w / 2, y + 40, 25, 9, i * Math.PI / 3, 0, 2 * Math.PI); ctx.stroke();
        }
      } else {
        ctx.fillStyle = "#9dcac4";
        ctx.fillRect(x + 12, y + 16, 29, 2);
        for (let i = 0; i < 8; i++) {
          const bar = 7 + 25 * random();
          ctx.fillStyle = i === 7 ? "#c2ddd0" : "#589c92";
          ctx.fillRect(x + 12 + i * 7, y + 60 - bar, 4, bar);
        }
      }
      ctx.fillStyle = "#9b9a8a";
      ctx.fillRect(x + 17, bottom - 5, w - 34, 3);
      left = x + w + 9;
    }
    while (left < 341) {
      const width = Math.round(8 + random() * (metal ? 9 : 17));
      const height = Math.round((metal ? 72 : 59) + random() * (metal ? 15 : 39));
      const lightness = 22 + random() * 23;
      const hue = metal ? 168 + random() * 38 : [21, 38, 174, 208, 346][Math.floor(random() * 5)];
      ctx.save();
      ctx.translate(left, bottom);
      if (left > 300 && !metal) ctx.rotate(-.075);
      const spine = ctx.createLinearGradient(0, 0, width, 0);
      spine.addColorStop(0, `hsl(${hue}, 30%, ${lightness - 8}%)`);
      spine.addColorStop(.24, `hsl(${hue}, ${metal ? 22 : 38}%, ${lightness + 7}%)`);
      spine.addColorStop(.78, `hsl(${hue}, ${metal ? 21 : 36}%, ${lightness}%)`);
      spine.addColorStop(1, `hsl(${hue}, 27%, ${lightness - 11}%)`);
      ctx.fillStyle = spine;
      ctx.fillRect(0, -height, width, height);
      ctx.fillStyle = "rgba(255,242,211,.22)";
      ctx.fillRect(1, -height, 2, height);
      ctx.fillStyle = metal ? color : "#ccb782";
      for (const fraction of metal ? [.16] : [.10, .16, .83]) {
        ctx.fillRect(3, -height * (1 - fraction), width - 6, metal ? 5 : 2);
      }
      if (!metal && width > 14) {
        ctx.fillStyle = "#d7c99b";
        ctx.globalAlpha = .7;
        for (let i = 0; i < 3; i++) {
          const length = width * (.28 + .35 * random());
          ctx.fillRect((width - length) / 2, -height * .66 + i * 3, length, .9);
        }
        ctx.strokeStyle = "#b3a17b";
        ctx.lineWidth = 1.0;
        ctx.beginPath(); ctx.arc(width / 2, -height * .34, 1.8, 0, 2 * Math.PI); ctx.stroke();
      }
      ctx.restore();
      left += width + 2 + (random() > .87 ? 10 : 0);
    }
    ctx.fillStyle = metal ? "#738595" : "#ad8260";
    ctx.fillRect(12, bottom + 2, 360, 3);
    ctx.fillStyle = "#c7b592";
    ctx.fillRect(168, bottom + 7, 48, 4);
  }
  return image;
}

export function libraryDeck(cabinets: readonly CabinetArt[], radius: number) {
  const image = canvas(768, 768), ctx = image.getContext("2d")!;
  const scale = image.width / (2 * (radius + 2.8));
  const random = randomSource(1330);
  ctx.fillStyle = "#616a70"; ctx.fillRect(0, 0, image.width, image.height);
  for (let i = 0; i < 18000; i++) {
    ctx.fillStyle = i % 2 === 0 ? "rgba(184,196,202,.10)" : "rgba(22,30,35,.10)";
    ctx.fillRect(random() * 768, random() * 768, 1 + random() * 3, .85);
  }
  ctx.translate(image.width / 2, image.height / 2);
  ctx.scale(scale, scale);
  for (let i = 0; i < cabinets.length; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI * 2 / cabinets.length);
    // The cylinder cap's horizontal texture axis follows world Z.
    ctx.strokeStyle = "#48515a"; ctx.lineWidth = .021;
    ctx.beginPath(); ctx.moveTo(-radius - 2.3, -1.2); ctx.lineTo(-2, -.2); ctx.stroke();
    for (const r of [2.02, radius - 2.35, radius + 1.32]) {
      ctx.beginPath(); ctx.arc(0, 0, r, Math.PI - .5, Math.PI + .5); ctx.stroke();
    }
    ctx.save();
    ctx.translate(-radius + .10, 0); ctx.scale(1.2, 2.1);
    halo(ctx, 0, 0, 1.25, "rgba(4,12,18,.92)");
    ctx.restore();
    ctx.globalAlpha = .38;
    ctx.fillStyle = cabinets[i].color;
    ctx.fillRect(-radius + .65, -.46, .06, .92);
    ctx.restore();
  }
  return image;
}

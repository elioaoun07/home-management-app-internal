import * as T from "three";

// The copper lands and passive components belong to the cassette itself. All
// moving tools and every illuminated result are still driven by delivery data.
export function cassetteLaminate(refresh: () => void) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 512;
  const c = canvas.getContext("2d")!;
  const mask = c.createLinearGradient(0, 512, 350, 0);
  mask.addColorStop(0, "#102a30"); mask.addColorStop(.48, "#244846"); mask.addColorStop(1, "#162d35");
  c.fillStyle = mask;
  c.fillRect(0, 0, 384, 512);
  const border = c.createLinearGradient(0, 0, 384, 500);
  border.addColorStop(0, "#bed4bc"); border.addColorStop(.43, "#536d65"); border.addColorStop(1, "#ac986a");
  c.strokeStyle = border; c.lineWidth = 3; c.strokeRect(6,6,372,500);
  for (let block = 0; block < 3; block++) {
    const y = block * 143 + 20;
    for (let i = 0; i < 12; i++) {
      const top = y + i * 6;
      c.strokeStyle = i % 4 === 0 ? "#b19563" : "#73847b";
      c.lineWidth = i % 4 === 0 ? 2.5 : 1.1;
      c.beginPath();
      c.moveTo(4, top);
      c.lineTo(51 + i * 3, top);
      c.lineTo(75 + i * 3, top + 24);
      c.lineTo(144, top + 24);
      c.stroke();
      c.beginPath();
      c.arc(144, top + 24, 2.2, 0, Math.PI * 2);
      c.fillStyle = "#d8bf89";
      c.fill();
      c.fillStyle = "#a99c81";
      c.fillRect(172 + i * 7, y + 26, 2.7, 22);
      c.fillRect(172 + i * 7, y + 87, 2.7, 22);
    }
    c.fillStyle = "#0c1b20"; c.fillRect(160, y + 47, 109, 52);
    const silicon = c.createLinearGradient(159,y+41,211,y+100);
    silicon.addColorStop(0,"#63706f"); silicon.addColorStop(.07,"#354445");
    silicon.addColorStop(.82,"#213032"); silicon.addColorStop(1,"#101e24");
    c.fillStyle = silicon;
    c.fillRect(160, y + 44, 106, 50);
    c.fillStyle = "#a2af9e"; c.beginPath(); c.arc(169,y+52,2.5,0,2*Math.PI); c.fill();
    for (let pin = 0; pin < 10; pin++) {
      for (const x of [156,267]) {
        c.fillStyle = "#acafa0"; c.fillRect(x, y + 47 + pin * 4.7, 4, 1.8);
      }
    }
    for (let i = 0; i < 6; i++) {
      c.fillStyle = "#acb4b2";
      c.fillRect(295 + (i % 2) * 26, y + 7 + Math.floor(i / 2) * 31, 12, 20);
      c.fillStyle = "#5e5548";
      c.fillRect(295 + (i % 2) * 26, y + 11 + Math.floor(i / 2) * 31, 12, 12);
    }
  }
  for (let i = 0; i < 17; i++) {
    c.fillStyle = "#b39b6b";
    c.fillRect(14 + i * 21, 472, 12, 38);
    c.fillStyle = "#d5bd89";
    c.fillRect(14 + i * 21, 472, 12, 4);
  }
  for (const x of [15,369]) for (const y of [15,456]) {
    c.fillStyle = "#b9a37a"; c.beginPath(); c.arc(x,y,6.8,0,2*Math.PI); c.fill();
    c.fillStyle = "#102127"; c.beginPath(); c.arc(x,y,3.9,0,2*Math.PI); c.fill();
  }
  const map = new T.CanvasTexture(canvas);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 8;
  const material = new T.MeshStandardMaterial({ map, roughness: .57, metalness: .30 });
  let mounted = true;
  material.addEventListener("dispose", () => { mounted = false; });
  new T.TextureLoader().load("/assets/transfer-pcb.webp", texture => {
    if (!mounted) { texture.dispose(); return; }
    texture.colorSpace = T.SRGBColorSpace;
    texture.center.set(.5, .5);
    texture.rotation = Math.PI / 2;
    texture.anisotropy = 8;
    material.map = texture;
    map.dispose();
    refresh();
  });
  return material;
}

export function checkSocketFace(text: string) {
  const c = document.createElement("canvas");
  c.width = 192;
  c.height = 256;
  const g = c.getContext("2d")!;
  const lens = g.createLinearGradient(0, 0, 0, c.height);
  lens.addColorStop(0, "#536069");
  lens.addColorStop(0.11, "#15232b");
  lens.addColorStop(1, "#29343a");
  g.fillStyle = lens;
  g.fillRect(0, 0, c.width, c.height);
  const rim = g.createLinearGradient(15, 18, 158, 174);
  rim.addColorStop(0, "#adb8b5");
  rim.addColorStop(.24, "#68777b");
  rim.addColorStop(.52, "#1e2b2d");
  rim.addColorStop(1, "#68777a");
  g.fillStyle = rim;
  g.beginPath(); g.roundRect(13, 28, 166, 144, 36); g.fill();
  const glass = g.createLinearGradient(48, 29, 98, 166);
  glass.addColorStop(0, "#5e7777"); glass.addColorStop(.28, "#2a4043");
  glass.addColorStop(.50, "#263638"); glass.addColorStop(.51, "#1c2a2e"); glass.addColorStop(1, "#1b252a");
  g.fillStyle = glass;
  g.beginPath(); g.roundRect(19, 34, 154, 132, 29); g.fill();
  g.fillStyle = "#3c4d50";
  for (let y = 56; y < 142; y += 8)
    for (let x = 34; x < 161; x += 8) g.fillRect(x, y, 1.5, 1.5);
  g.fillStyle = "#192429";
  g.fillRect(16, 184, 160, 48);
  g.fillStyle = "#c3ccc6";
  g.font = "500 25px monospace";
  g.textAlign = "center";
  g.fillText(text, 96, 216, 151);
  const map = new T.CanvasTexture(c);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 8;
  return new T.MeshStandardMaterial({ map, metalness: 0.3, roughness: 0.29 });
}

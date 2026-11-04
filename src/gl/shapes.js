// Point-cloud "formations" the particle swarm morphs between.
// Each returns a Float32Array of length count * 3.
// Every shape is a visual metaphor for a part of the resume:
//   0 latentOrb   – embedding space (hero)
//   1 neuralNet   – multi-agent graph (about)
//   2 pipeline    – double-helix data pipeline (experience)
//   3 galaxy      – vector index / retrieval space (work)
//   4 text        – "HELLO" (contact)

const TAU = Math.PI * 2;

function rand(seed) {
  // mulberry32 – deterministic so the swarm looks the same every visit
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(r) {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(TAU * r());
}

export function latentOrb(count) {
  const r = rand(1);
  const out = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const shell = r() < 0.78;
    let x, y, z;
    if (shell) {
      const yy = 1 - (i / (count - 1)) * 2;
      const rad = Math.sqrt(1 - yy * yy);
      const th = golden * i;
      const R = 2.1 + gauss(r) * 0.035;
      x = Math.cos(th) * rad * R;
      y = yy * R;
      z = Math.sin(th) * rad * R;
    } else {
      // inner nebula core
      const R = Math.pow(r(), 0.6) * 1.35;
      const th = r() * TAU;
      const ph = Math.acos(2 * r() - 1);
      x = R * Math.sin(ph) * Math.cos(th);
      y = R * Math.cos(ph);
      z = R * Math.sin(ph) * Math.sin(th);
    }
    out.set([x, y, z], i * 3);
  }
  return out;
}

export function neuralNet(count) {
  // a layered agent graph: planner → specialists → tools → critics → responder
  const r = rand(2);
  const layers = [2, 4, 5, 4, 2];
  const nodes = [];
  const spanX = 7.2;
  layers.forEach((n, li) => {
    const x = -spanX / 2 + (li / (layers.length - 1)) * spanX;
    for (let k = 0; k < n; k++) {
      const y = (k - (n - 1) / 2) * 0.95;
      const z = Math.sin(k * 1.7 + li) * 0.18;
      nodes.push({ x, y, z, li, r: li === 2 ? 0.17 : 0.13 });
    }
  });
  const edges = [];
  for (const a of nodes)
    for (const b of nodes) if (b.li === a.li + 1 && (r() < 0.55 || Math.abs(a.y - b.y) < 1)) edges.push([a, b]);

  const out = new Float32Array(count * 3);
  const nodeShare = 0.5;
  for (let i = 0; i < count; i++) {
    let x, y, z;
    if (r() < nodeShare) {
      const n = nodes[Math.floor(r() * nodes.length)];
      // dense core + thin halo ring
      const ring = r() < 0.3;
      const R = ring ? n.r * 1.9 + gauss(r) * 0.012 : Math.pow(r(), 0.7) * n.r;
      const th = r() * TAU;
      const ph = ring ? Math.PI / 2 + gauss(r) * 0.08 : Math.acos(2 * r() - 1);
      x = n.x + R * Math.sin(ph) * Math.cos(th);
      y = n.y + R * Math.sin(ph) * Math.sin(th);
      z = n.z + R * Math.cos(ph) * 0.6;
    } else {
      const [a, b] = edges[Math.floor(r() * edges.length)];
      const t = r();
      const j = 0.008;
      // gentle arc so edges read as connections, not a mesh
      const bow = Math.sin(t * Math.PI) * 0.12;
      x = a.x + (b.x - a.x) * t + gauss(r) * j;
      y = a.y + (b.y - a.y) * t + bow + gauss(r) * j;
      z = a.z + (b.z - a.z) * t + gauss(r) * j;
    }
    out.set([x, y, z], i * 3);
  }
  return out;
}

export function pipeline(count) {
  const r = rand(3);
  const out = new Float32Array(count * 3);
  const len = 9;
  for (let i = 0; i < count; i++) {
    const t = r();
    const x = -len / 2 + t * len;
    const ang = t * TAU * 2.6;
    const pick = r();
    let y, z;
    if (pick < 0.4) {
      y = Math.cos(ang) * 1.2;
      z = Math.sin(ang) * 1.2;
    } else if (pick < 0.8) {
      y = Math.cos(ang + Math.PI) * 1.2;
      z = Math.sin(ang + Math.PI) * 1.2;
    } else {
      // rungs between the strands
      const k = Math.round(t * 46) / 46;
      const a2 = k * TAU * 2.6;
      const s = r() * 2 - 1;
      y = Math.cos(a2) * 1.2 * s;
      z = Math.sin(a2) * 1.2 * s;
      out.set([-len / 2 + k * len, y, z], i * 3);
      continue;
    }
    out.set([x + gauss(r) * 0.02, y + gauss(r) * 0.04, z + gauss(r) * 0.04], i * 3);
  }
  return out;
}

export function galaxy(count) {
  const r = rand(4);
  const out = new Float32Array(count * 3);
  const arms = 4;
  for (let i = 0; i < count; i++) {
    const rad = Math.pow(r(), 1.6) * 4.2;
    const arm = (Math.floor(r() * arms) / arms) * TAU;
    const spin = rad * 1.05;
    const sc = 0.32 * (1 - rad / 5);
    const x = Math.cos(arm + spin) * rad + gauss(r) * sc;
    const z = Math.sin(arm + spin) * rad + gauss(r) * sc;
    const y = gauss(r) * 0.12 * (1.4 - rad / 4.2);
    out.set([x, y, z], i * 3);
  }
  return out;
}

export function textShape(count, word = 'Hello', fontFamily = '"Instrument Serif"') {
  const r = rand(5);
  const W = 1400, H = 420;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `italic 400 340px ${fontFamily}, Georgia, serif`;
  const tw = ctx.measureText(word).width;
  ctx.fillText(word, W / 2, H / 2 + 20);
  const data = ctx.getImageData(0, 0, W, H).data;
  const px = [];
  for (let y = 0; y < H; y += 1)
    for (let x = 0; x < W; x += 1) if (data[(y * W + x) * 4 + 3] > 128) px.push(x, y);
  const out = new Float32Array(count * 3);
  const scale = 6.6 / tw;
  const n = px.length / 2;
  for (let i = 0; i < count; i++) {
    const k = Math.floor(r() * n) * 2;
    out.set(
      [
        (px[k] - W / 2) * scale + (r() - 0.5) * scale * 2,
        -(px[k + 1] - H / 2) * scale + (r() - 0.5) * scale * 2,
        gauss(r) * 0.08,
      ],
      i * 3
    );
  }
  return out;
}

export function randoms(count) {
  const r = rand(6);
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count * 4; i++) out[i] = r();
  return out;
}

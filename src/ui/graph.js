// Vantage — a small force-directed knowledge graph (agents · memory tiers · retrieval)
// drawn on a 2D canvas. Nodes can be dragged; "messages" travel along edges.

const AGENTS = ['Intent', 'Planner', 'Router', 'Rewriter', 'Retriever', 'Reranker', 'Vision', 'Summarizer',
  'Critic', 'Citations', 'Evaluator', 'Tools', 'Graph', 'Profiler', 'Responder'];
const MEMORY = ['Session', 'Episodic', 'Procedural', 'Profile', 'Agentic'];
const RETRIEVAL = ['BM25', 'Dense·768', 'Cross-encoder', 'OpenSearch'];

const COLORS = { hub: '#ffffff', agent: '#ece8f3', memory: '#9d86ff', retrieval: '#f1b8de' };

export function initGraph(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const nodes = [];
  const edges = [];
  const add = (label, type, r) => {
    const n = { label, type, r, x: (Math.random() - 0.5) * 200, y: (Math.random() - 0.5) * 200, vx: 0, vy: 0, fixed: false };
    nodes.push(n);
    return n;
  };
  const hub = add('LangGraph', 'hub', 9);
  const agents = AGENTS.map((l) => add(l, 'agent', 3.5));
  const mem = MEMORY.map((l) => add(l, 'memory', 6.5));
  const ret = RETRIEVAL.map((l) => add(l, 'retrieval', 5.5));
  agents.forEach((a, i) => {
    edges.push([hub, a, 70]);
    if (i % 3 === 0) edges.push([a, mem[(i / 3) | 0], 60]);
  });
  ret.forEach((r, i) => edges.push([agents[4 + (i % 3)], r, 50]));
  mem.forEach((m, i) => edges.push([m, mem[(i + 1) % mem.length], 70]));
  edges.push([ret[0], ret[1], 50], [ret[1], ret[2], 50], [ret[2], ret[3], 50]);

  const pulses = [];
  let drag = null, hover = null, visible = false;
  const pointer = { x: 0, y: 0 };

  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio, 2);
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
  }
  resize();
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left - W / 2, y: e.clientY - r.top - H / 2 };
  };
  const pick = (p) => nodes.find((n) => (n.x - p.x) ** 2 + (n.y - p.y) ** 2 < (n.r + 10) ** 2);
  canvas.addEventListener('pointerdown', (e) => {
    const p = local(e);
    drag = pick(p);
    if (drag) { drag.fixed = true; canvas.setPointerCapture(e.pointerId); }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = local(e);
    pointer.x = p.x; pointer.y = p.y;
    hover = pick(p);
    canvas.style.cursor = hover ? 'grab' : '';
    if (drag) { drag.x = p.x; drag.y = p.y; drag.vx = drag.vy = 0; }
  });
  const release = () => { if (drag) drag.fixed = false; drag = null; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => (hover = null));

  let t = 0;
  function step() {
    // forces
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy + 0.01;
        const f = 900 / d2;
        const d = Math.sqrt(d2);
        dx /= d; dy /= d;
        a.vx -= dx * f; a.vy -= dy * f;
        b.vx += dx * f; b.vy += dy * f;
      }
    }
    const k = Math.min(W, H) / 330;
    for (const [a, b, len] of edges) {
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - len * k) * 0.012;
      a.vx += (dx / d) * f; a.vy += (dy / d) * f;
      b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
    }
    for (const n of nodes) {
      n.vx -= n.x * 0.004; n.vy -= n.y * 0.004;
      if (n.fixed) continue;
      n.vx *= 0.82; n.vy *= 0.82;
      n.x += n.vx; n.y += n.vy;
      const mx = W / 2 - 20, my = H / 2 - 40;
      n.x = Math.max(-mx, Math.min(mx, n.x));
      n.y = Math.max(-my, Math.min(my - 10, n.y));
    }
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, W / 2 * dpr, H / 2 * dpr);
    ctx.clearRect(-W / 2, -H / 2, W, H);
    ctx.lineWidth = 1;
    for (const [a, b] of edges) {
      const active = hover && (a === hover || b === hover);
      ctx.strokeStyle = active ? 'rgba(199,182,255,0.6)' : 'rgba(236,232,243,0.1)';
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    if (Math.random() < 0.18 && pulses.length < 24) {
      const e = edges[(Math.random() * edges.length) | 0];
      pulses.push({ e, p: 0, dir: Math.random() < 0.5 });
    }
    for (let i = pulses.length - 1; i >= 0; i--) {
      const pu = pulses[i];
      pu.p += 0.022;
      if (pu.p >= 1) { pulses.splice(i, 1); continue; }
      const [a, b] = pu.dir ? [pu.e[0], pu.e[1]] : [pu.e[1], pu.e[0]];
      const x = a.x + (b.x - a.x) * pu.p, y = a.y + (b.y - a.y) * pu.p;
      ctx.fillStyle = COLORS[b.type];
      ctx.globalAlpha = Math.sin(pu.p * Math.PI);
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.font = '500 9.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (const n of nodes) {
      const c = COLORS[n.type];
      const isH = n === hover || n === drag;
      const pulse = n.type === 'hub' ? 1 + Math.sin(t * 0.05) * 0.15 : 1;
      ctx.shadowColor = c; ctx.shadowBlur = isH ? 18 : 6;
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r * pulse * (isH ? 1.5 : 1), 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      if (n.type !== 'agent' || isH || (hover && edges.some(([a, b]) => (a === hover && b === n) || (b === hover && a === n)))) {
        ctx.fillStyle = isH ? '#ece8f3' : 'rgba(236,232,243,0.55)';
        ctx.fillText(n.label.toUpperCase(), n.x, n.y - n.r - 7);
      }
    }
  }

  // settle a bit before first paint
  for (let i = 0; i < 160; i++) { W = W || 400; H = H || 320; step(); }
  function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    t++;
    step();
    draw();
  }
  loop();
}

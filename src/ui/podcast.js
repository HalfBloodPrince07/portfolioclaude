// Podcast Production Pipeline — animated stage tracker, waveform and a fake SSE log.

const STAGES = [
  { name: 'research', logs: ['web.search("history of transformers") → 14 sources', 'extract: 38 claims, 9 quotes'] },
  { name: 'script', logs: ['draft: 1,820 words · 2 hosts', 'pacing target 140–170 wpm'] },
  { name: 'fact_check', logs: ['verified 36/38 claims', 'flagged 2 → rewritten'] },
  { name: 'sound_design', logs: ['inject <pause 400ms> ×12', 'prosody markers: emphasis, rise'] },
  { name: 'tts', logs: ['qwen-tts: synthesising 24 segments', 'avg 156 wpm ✓'] },
  { name: 'export', logs: ['episode.mp3 (18:42)', 'episode.srt · transcript.json'] },
];

export function initPodcast(root) {
  const stagesEl = root.querySelector('[data-pod-stages]');
  const items = [...stagesEl.children];
  const canvas = root.querySelector('[data-wave]');
  const logEl = root.querySelector('[data-pod-log]');
  const ctx = canvas.getContext('2d');
  let W = 0, H = 0, dpr = 1, visible = false;
  let stage = 0, energy = 0.2, lines = [];

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio, 2);
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
  };
  resize();
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(root);

  const pushLog = (html) => {
    lines.push(html);
    lines = lines.slice(-3);
    logEl.innerHTML = lines.join('\n');
  };

  function advance() {
    if (!visible) return;
    items.forEach((li, i) => {
      li.classList.toggle('is-active', i === stage);
      li.classList.toggle('is-done', i < stage);
    });
    const s = STAGES[stage];
    pushLog(`<em>event:</em> progress  <em>stage:</em> ${s.name}`);
    s.logs.forEach((l, i) => setTimeout(() => visible && pushLog(`data: ${l}`), 450 + i * 450));
    stage = (stage + 1) % STAGES.length;
  }
  setInterval(advance, 1700);

  let t = 0;
  function draw() {
    requestAnimationFrame(draw);
    if (!visible || !W) return;
    t += 0.016;
    const target = stage === 5 || stage === 0 ? 1 : stage === 4 ? 0.65 : 0.25; // stage already advanced
    energy += (target - energy) * 0.04;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const bars = Math.floor(W / 6);
    const mid = H / 2;
    for (let i = 0; i < bars; i++) {
      const x = i * 6 + 2;
      const u = i / bars;
      const env = Math.sin(u * Math.PI);
      const n = Math.sin(u * 22 + t * 4) * 0.5 + Math.sin(u * 57 - t * 7) * 0.3 + Math.sin(u * 9 + t * 1.3) * 0.2;
      const h = Math.max(1.5, Math.abs(n) * env * energy * (H * 0.42) + env * 4);
      const g = ctx.createLinearGradient(0, mid - h, 0, mid + h);
      g.addColorStop(0, '#f1b8de'); g.addColorStop(0.5, '#ece8f3'); g.addColorStop(1, '#9d86ff');
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.35 + env * 0.65;
      ctx.fillRect(x, mid - h, 1.5, h * 2);
    }
    ctx.globalAlpha = 1;
  }
  draw();
}

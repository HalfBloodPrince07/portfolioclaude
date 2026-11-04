// Inference lab — two token streams racing: FP16 eager vs TensorRT-LLM INT8.

const ANSWER =
  'Hybrid retrieval first: BM25 catches exact identifiers, the 768-d dense index catches paraphrase. ' +
  'A cross-encoder reranks the top 50 down to 5, the planner decides whether a vision pass is needed for ' +
  'tables and scans, and the generator answers with citations — compiled, quantized, and served at 3× the speed.';

const tokenize = (s) => s.match(/\s*[^\s]{1,5}/g) || [];

export function initLab(section, { onTokens } = {}) {
  const lanes = [...section.querySelectorAll('[data-lane]')].map((el) => ({
    el,
    out: el.querySelector('[data-lane-out]'),
    bar: el.querySelector('[data-lane-bar]'),
    tps: el.querySelector('[data-lane-tps]'),
    time: el.querySelector('[data-lane-time]'),
    rate: el.dataset.lane === 'trt' ? 96 : 32, // tokens / s
    ttft: el.dataset.lane === 'trt' ? 0.14 : 0.42,
  }));
  const btn = section.querySelector('[data-lab-run]');
  const tokens = tokenize(ANSWER);
  let raf = 0, running = false;

  function run() {
    cancelAnimationFrame(raf);
    running = true;
    btn.querySelector('span').textContent = 'Running…';
    const start = performance.now();
    lanes.forEach((l) => { l.shown = 0; l.out.innerHTML = '<span class="caret"></span>'; });
    const tick = (now) => {
      const t = (now - start) / 1000;
      let done = true, total = 0;
      for (const l of lanes) {
        const n = Math.min(tokens.length, Math.max(0, Math.floor((t - l.ttft) * l.rate)));
        if (n !== l.shown) {
          l.shown = n;
          l.out.innerHTML = tokens.slice(0, n).join('') + (n < tokens.length ? '<span class="caret"></span>' : '');
        }
        const finished = n >= tokens.length;
        if (!finished) {
          done = false;
          l.time.textContent = t.toFixed(2) + 's';
          l.tps.textContent = t > l.ttft ? Math.round(l.rate * (0.92 + Math.random() * 0.16)) : 0;
        } else if (!l.final) {
          l.final = true;
          l.tps.textContent = l.rate;
        }
        l.bar.style.transform = `scaleX(${n / tokens.length})`;
        total += n;
      }
      onTokens && onTokens(total);
      if (!done) raf = requestAnimationFrame(tick);
      else {
        running = false;
        btn.querySelector('span').textContent = 'Run again';
        lanes.forEach((l) => (l.final = false));
      }
    };
    raf = requestAnimationFrame(tick);
  }
  btn.addEventListener('click', run);
  lanes.forEach((l) => (l.out.innerHTML = '<span style="color:var(--ink-3)">› awaiting prompt: "How should an enterprise search assistant answer over 10k PDFs?"</span>'));
  return { run, get running() { return running; } };
}

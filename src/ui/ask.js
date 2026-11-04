// "Ask my résumé" — the retrieval half of RAG, running entirely in the browser.
//   1. tokenize + light stemming + stop-words
//   2. query expansion with a small domain synonym map
//   3. BM25 (k1 = 1.2, b = 0.75) over résumé passages
//   4. rerank: phrase (bigram) overlap + title match bonus
//   5. compose: pick the curated answer whose sources best match the top passages,
//      otherwise fall back to an extractive answer — always with citations.
// No network calls, no LLM. Everything shown in the trace is real and timed.

const DOCS = [
  { id: 'sum', sec: 'Summary', title: 'Applied AI Engineer', text: 'Applied AI Engineer with 3.5 years of experience taking complex LLM systems from concept to production. Specializes in multi-agent orchestration with LangGraph, advanced retrieval architectures such as Vision-RAG and hybrid search, and heavy inference optimization.' },
  { id: 'own', sec: 'Summary', title: 'End-to-end ownership', text: 'An end-to-end owner proficient in Python, FastAPI, Docker and AWS Bedrock, dedicated to high-quality user experiences through rigorous prompt engineering and continuous evaluation.' },
  { id: 'cg-sdlc', sec: 'Capgemini', title: 'LangGraph SDLC agents', text: 'Engineered and deployed a LangGraph multi-agent framework to automate end-to-end SDLC workflows, coordinating 5+ specialized agents across code generation, test authoring and PR reviews to reduce manual review time by 40%.' },
  { id: 'cg-trt', sec: 'Capgemini', title: 'TensorRT-LLM inference', text: 'Accelerated open-source LLM inference by 3x for LLaMA and Phi-3 through TensorRT-LLM compilation and model quantization, maintaining near-zero accuracy degradation while driving significant cloud GPU cost reductions.' },
  { id: 'cg-rag', sec: 'Capgemini', title: 'RAG and Vision-RAG pipelines', text: 'Architected and modernized RAG and Vision-RAG pipelines, elevating document understanding accuracy by 28% across complex, multimodal enterprise data inputs.' },
  { id: 'cg-go', sec: 'Capgemini', title: 'LLM test generation for Go', text: 'Developed an automated LLM test-generation Python microservice that parses Go ASTs to automatically emit executable Go test suites and drastically reduce manual QA overhead.' },
  { id: 'cg-cds', sec: 'Capgemini', title: 'Clinical decision support', text: 'Delivered a multi-agent clinical decision support (CDS) solution for a healthcare enterprise, accelerating turnaround times for critical clinician-facing recommendations.' },
  { id: 'cg-std', sec: 'Capgemini', title: 'Agentic architecture standard', text: 'Standardized agentic architecture across 3 enterprise applications by integrating contextual reasoning and task-planning modules for multi-step workflow decomposition.' },
  { id: 'cg-eval', sec: 'Capgemini', title: 'Prompt engineering and evaluation', text: 'Established cross-domain prompt engineering and evaluation standards, measurably reducing hallucination rates and increasing response reliability across 4 customer-facing applications.' },
  { id: 'nec-bdc', sec: 'NEC India', title: 'Secure document generation', text: 'Spearheaded the architecture and development of secure document generation and Business Document Connectivity (BDC) systems, scaling pipeline infrastructure to process 10,000+ enterprise documents monthly.' },
  { id: 'nec-tot', sec: 'NEC India', title: 'Advanced prompting', text: 'Engineered advanced prompting techniques including Tree-of-Thought, Directional Stimulus and RAG frameworks with open-source LLMs Mistral-7B and Nous-Hermes-Llama-2-13B, driving a 30% lift in response contextual relevance.' },
  { id: 'nec-lead', sec: 'NEC India', title: 'Team leadership', text: 'Co-led a cross-functional team of 8 engineers to integrate LLM-driven features into enterprise applications, accelerating feature deployment cycles by 15%.' },
  { id: 'v-agents', sec: 'Vantage', title: 'Local-first semantic search', text: 'Vantage is a local-first semantic document search platform powered by a 15+ agent LangGraph orchestration layer handling dynamic intent classification, multi-step reasoning and per-query retrieval strategies.' },
  { id: 'v-hybrid', sec: 'Vantage', title: 'Hybrid retrieval', text: 'Built a hybrid retrieval architecture combining 768-dimensional dense vector search with BM25 sparse keyword matching, using cross-encoder reranking to maximize top-5 precision. OpenSearch backs the index.' },
  { id: 'v-mem', sec: 'Vantage', title: '5-tier memory', text: 'Architected a cloud-independent 5-tier memory system (session, episodic, procedural, profile, agentic) to maintain cross-session context, surfaced via interactive D3.js knowledge graphs for entity exploration.' },
  { id: 'v-local', sec: 'Vantage', title: 'Single-GPU local inference', text: 'Optimized full-stack local inference, including embeddings, cross-encoder reranking and generation, to run on a single consumer GPU via Ollama with zero cloud API costs.' },
  { id: 'p-agents', sec: 'Podcast Pipeline', title: 'Autonomous podcast agents', text: 'Developed an autonomous multi-agent production system that transforms topic prompts into audio podcasts using cooperating agents for web research, scriptwriting, fact-checking and sound design.' },
  { id: 'p-tts', sec: 'Podcast Pipeline', title: 'Qwen TTS prosody', text: 'Integrated Qwen TTS via local Hugging Face Transformers, enforcing dynamic pacing controls of 140 to 170 words per minute and injecting custom prosody markers for natural, expressive audio delivery.' },
  { id: 'p-sse', sec: 'Podcast Pipeline', title: 'Real-time SSE streaming', text: 'Implemented real-time progress streaming over Server-Sent Events (SSE) to a React and Vite frontend, enabling automated rendering and export of MP3 audio, SRT subtitles and timestamped transcripts.' },
  { id: 's-agents', sec: 'Skills', title: 'LLMs and agents', text: 'LLMs and agents: LangGraph, LangChain, AWS Strands, MCP, A2A message passing, Hugging Face Transformers, PyTorch, TensorFlow, prompt engineering (Tree-of-Thought, RAG, Directional Stimulus), Ragas evaluation.' },
  { id: 's-ret', sec: 'Skills', title: 'Retrieval and search', text: 'Retrieval and search: RAG, Vision-RAG, hybrid search (vector plus BM25), cross-encoder reranking, embeddings, OpenSearch.' },
  { id: 's-inf', sec: 'Skills', title: 'Inference and optimization', text: 'Inference and optimization: TensorRT-LLM, quantization, model compilation, GPU serving tuning, Ollama, LM Studio, local multi-GPU deployment.' },
  { id: 's-back', sec: 'Skills', title: 'Backend and cloud', text: 'Backend and cloud: Python, FastAPI, AWS Bedrock, Lambda and S3, Docker, Linux, SQLite, SQLAlchemy, Pandas, NumPy.' },
  { id: 's-front', sec: 'Skills', title: 'Frontend', text: 'Frontend: React, Vite, JavaScript and TypeScript, D3.js, Server-Sent Events, HTML5 and CSS3.' },
  { id: 'award', sec: 'Achievement', title: 'Capgemini Gem Award 2024', text: 'Earned the Capgemini Gem Award in 2024 for pioneering Agentic AI solutions, advancing multi-agent architectures and enterprise automation.' },
  { id: 'edu', sec: 'Education', title: 'B.Tech Information Technology', text: 'Bachelor of Technology in Information Technology, PSIT College of Engineering, 2019 to 2023.' },
  { id: 'contact', sec: 'Contact', title: 'Contact', text: 'Based in Bangalore, India. Email work.aditya2025@gmail.com, LinkedIn linkedin.com/in/adityanj, GitHub github.com/HalfBloodPrince07. Open to conversations about LLM systems, agents and inference.' },
  { id: 'roles', sec: 'Experience', title: 'Roles timeline', text: 'Applied AI Engineer at Capgemini from May 2024 to present. GenAI Engineer at NEC India from January 2023 to May 2024.' },
];

// curated answers, each grounded in specific passages
const ANSWERS = [
  { src: ['cg-trt', 's-inf', 'v-local'], text: 'By compiling open-source models (LLaMA, Phi-3) with TensorRT-LLM and quantizing them, I cut serving latency by 3× with near-zero accuracy loss — which also meant a real drop in cloud GPU spend [1]. Beyond that I tune GPU serving and run fully local multi-GPU stacks with Ollama and LM Studio [2], down to running a whole RAG system on one consumer GPU [3].' },
  { src: ['cg-sdlc', 'cg-std', 'cg-cds', 'v-agents'], text: 'Agents are my core work. At Capgemini I built a LangGraph framework with 5+ specialised agents for code generation, test authoring and PR review, cutting manual review time by 40% [1]. I standardised agentic architecture across 3 enterprise apps [2] and shipped a multi-agent clinical decision-support system for a healthcare client [3]. On my own, Vantage orchestrates 15+ agents [4].' },
  { src: ['cg-rag', 'v-hybrid', 's-ret'], text: 'I design retrieval that actually reads the page: RAG and Vision-RAG pipelines that lifted document-understanding accuracy by 28% on multimodal enterprise data [1], and hybrid search — 768-d dense vectors plus BM25, reranked by a cross-encoder for top-5 precision [2]. Tooling: embeddings, OpenSearch, rerankers [3].' },
  { src: ['v-agents', 'v-hybrid', 'v-mem', 'v-local'], text: 'Vantage is my local-first semantic search platform: a 15+ agent LangGraph layer handles intent, multi-step reasoning and per-query retrieval strategy [1]. Retrieval is hybrid with cross-encoder reranking [2], a 5-tier memory keeps context across sessions and is explorable as a D3 knowledge graph [3], and the whole stack runs on a single consumer GPU with zero cloud cost [4].' },
  { src: ['p-agents', 'p-tts', 'p-sse'], text: 'The Podcast Pipeline turns a topic into a finished episode with cooperating agents for research, scripting, fact-checking and sound design [1]. Voices come from Qwen TTS with pacing held at 140–170 WPM and custom prosody markers [2], and progress streams live over SSE to a React UI that exports MP3, SRT and transcripts [3].' },
  { src: ['award'], text: 'In 2024 I received the Capgemini Gem Award for pioneering Agentic AI solutions — advancing multi-agent architectures and enterprise automation [1].' },
  { src: ['s-back', 'own'], text: 'On the backend I work in Python and FastAPI, deploy with Docker on Linux, and use AWS — Bedrock, Lambda and S3 [1]. I own systems end to end, from prompt design to evaluation in production [2].' },
  { src: ['contact'], text: 'The best way is email: work.aditya2025@gmail.com. You can also find me on LinkedIn (linkedin.com/in/adityanj) and GitHub (github.com/HalfBloodPrince07). I\'m based in Bangalore [1].' },
  { src: ['edu'], text: 'I hold a B.Tech in Information Technology from PSIT College of Engineering (2019–2023) [1].' },
  { src: ['roles', 'sum', 'nec-lead'], text: 'I\'ve spent 3.5 years shipping LLM systems: Applied AI Engineer at Capgemini since May 2024, and before that GenAI Engineer at NEC India from January 2023 [1][2]. At NEC I also co-led a cross-functional team of 8 engineers [3].' },
  { src: ['cg-eval', 'nec-tot'], text: 'I treat prompts like code: I set cross-domain prompt-engineering and evaluation standards that reduced hallucinations across 4 customer-facing apps [1], and used Tree-of-Thought, Directional Stimulus and RAG prompting with Mistral-7B and Llama-2-13B for a 30% lift in contextual relevance [2].' },
];

const STOP = new Set('a an the and or of to in on for with by at from is are was were be been i you your my me we our it its this that what which who how do does did can could would should tell about have has had any some there their them as into than then so if not no yes please experience work worked use used know tell much many'.split(' '));
const SYN = {
  fast: ['latency', 'inference', 'tensorrt', 'quantization', 'speed'], faster: ['latency', 'inference', 'tensorrt', 'quantization'],
  speed: ['latency', 'inference', 'tensorrt'], optimize: ['optimization', 'inference', 'quantization'], gpu: ['inference', 'tensorrt', 'serving'],
  agent: ['langgraph', 'multi', 'orchestration', 'agentic'], agents: ['langgraph', 'multi', 'orchestration', 'agentic'], agentic: ['agents', 'langgraph'],
  rag: ['retrieval', 'search', 'vision'], retrieval: ['rag', 'search', 'hybrid', 'reranking'], search: ['retrieval', 'hybrid', 'bm25'],
  contact: ['email', 'linkedin', 'reach'], email: ['contact'], hire: ['contact', 'email', 'conversation'], reach: ['contact', 'email'],
  award: ['gem', 'achievement'], awards: ['gem', 'achievement'], won: ['award', 'gem'], recognition: ['award', 'gem'],
  cloud: ['aws', 'bedrock', 'lambda'], aws: ['bedrock', 'lambda', 'cloud'], backend: ['fastapi', 'python', 'docker'],
  study: ['education', 'b.tech', 'college'], degree: ['education', 'college', 'technology'], college: ['education', 'degree'], education: ['degree', 'college'],
  podcast: ['tts', 'audio'], voice: ['tts', 'prosody', 'audio'], years: ['roles', 'engineer'],
  prompt: ['prompting', 'evaluation', 'hallucination'], hallucination: ['evaluation', 'prompt'], eval: ['evaluation', 'ragas'],
  frontend: ['react', 'vite', 'd3'], memory: ['tier', 'episodic', 'session'], healthcare: ['clinical', 'cds'], team: ['led', 'engineers'],
};

const stem = (w) => w.replace(/(ings|ing|ies|ed|es|s)$/,'').replace(/^(.{3,})(ation)$/, '$1');
const tokens = (s) => (s.toLowerCase().match(/[a-z0-9][a-z0-9.\-]*[a-z0-9]|[a-z0-9]/g) || []).filter((t) => !STOP.has(t));

// ---- index -----------------------------------------------------------------------
const index = DOCS.map((d) => {
  const toks = tokens(d.title + ' ' + d.title + ' ' + d.text).map(stem);
  const tf = new Map();
  toks.forEach((t) => tf.set(t, (tf.get(t) || 0) + 1));
  return { d, tf, len: toks.length, bigrams: new Set(toks.slice(1).map((t, i) => toks[i] + ' ' + t)), titleToks: new Set(tokens(d.title).map(stem)) };
});
const avgLen = index.reduce((s, x) => s + x.len, 0) / index.length;
const df = new Map();
index.forEach((x) => x.tf.forEach((_, t) => df.set(t, (df.get(t) || 0) + 1)));
const idf = (t) => Math.log(1 + (index.length - (df.get(t) || 0) + 0.5) / ((df.get(t) || 0) + 0.5));

export function retrieve(q) {
  const t0 = performance.now();
  const base = tokens(q);
  const t1 = performance.now();
  const expanded = new Set(base.map(stem));
  const added = [];
  base.forEach((t) => (SYN[t] || []).forEach((s) => { const st = stem(s); if (!expanded.has(st)) { expanded.add(st); added.push(s); } }));
  const t2 = performance.now();
  const qTerms = [...expanded];
  const baseSet = new Set(base.map(stem));
  const k1 = 1.2, b = 0.75;
  let scored = index.map((x) => {
    let s = 0;
    for (const t of qTerms) {
      const f = x.tf.get(t);
      if (!f) continue;
      const w = baseSet.has(t) ? 1 : 0.45; // expanded terms count less
      s += w * idf(t) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * x.len) / avgLen)));
    }
    return { x, bm25: s };
  }).filter((r) => r.bm25 > 0).sort((a, b2) => b2.bm25 - a.bm25);
  const t3 = performance.now();
  const qStems = base.map(stem);
  const qBigrams = qStems.slice(1).map((t, i) => qStems[i] + ' ' + t);
  scored = scored.slice(0, 8).map((r) => {
    const phrase = qBigrams.filter((bg) => r.x.bigrams.has(bg)).length;
    const title = qStems.filter((t) => r.x.titleToks.has(t)).length;
    return { ...r, score: r.bm25 * (1 + 0.35 * phrase + 0.2 * title) };
  }).sort((a, b2) => b2.score - a.score);
  const t4 = performance.now();
  return {
    hits: scored, base, added,
    timings: { tokenize: t1 - t0, expand: t2 - t1, bm25: t3 - t2, rerank: t4 - t3 },
  };
}

export function compose(hits) {
  if (!hits.length || hits[0].score < 1.2) return null;
  const rank = new Map(hits.map((h, i) => [h.x.d.id, h.score / (i + 1)]));
  let best = null, bestScore = 0;
  for (const a of ANSWERS) {
    const s = a.src.reduce((acc, id, i) => acc + (rank.get(id) || 0) * (i === 0 ? 1.4 : 1), 0) / Math.sqrt(a.src.length);
    if (s > bestScore) { bestScore = s; best = a; }
  }
  if (best && rank.has(best.src[0]) && bestScore > hits[0].score * 0.45) {
    return { text: best.text, sources: best.src.map((id) => DOCS.find((d) => d.id === id)) };
  }
  const top = hits.slice(0, 2).map((h) => h.x.d);
  return { text: top.map((d, i) => `${d.text} [${i + 1}]`).join(' '), sources: top };
}

// ---- UI ----------------------------------------------------------------------------
export function initAsk(root, { onQuery } = {}) {
  const form = root.querySelector('[data-ask-form]');
  const input = root.querySelector('[data-ask-input]');
  const steps = [...root.querySelectorAll('[data-step]')];
  const answerEl = root.querySelector('[data-ask-answer]');
  const srcEl = root.querySelector('[data-ask-sources]');
  const meta = root.querySelector('[data-ask-meta]');
  root.querySelector('[data-ask-count]').textContent = DOCS.length;
  let run = 0;

  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const cite = (s) => esc(s).replace(/\[(\d)\]/g, '<sup class="cite">$1</sup>');

  async function ask(q) {
    q = q.trim();
    if (!q) return;
    const id = ++run;
    onQuery && onQuery();
    input.value = q;
    const res = retrieve(q);
    const ans = compose(res.hits);
    steps.forEach((s) => s.classList.remove('is-done', 'is-active'));
    answerEl.innerHTML = '';
    srcEl.innerHTML = '';
    const fmt = (ms) => (ms < 0.1 ? '<0.1' : ms.toFixed(1)) + 'ms';
    const labels = {
      tokenize: `${res.base.length} terms · ${fmt(res.timings.tokenize)}`,
      expand: `+${res.added.length} synonyms · ${fmt(res.timings.expand)}`,
      bm25: `${res.hits.length ? Math.min(res.hits.length, 8) : 0}/${DOCS.length} hits · ${fmt(res.timings.bm25)}`,
      rerank: `phrase + title · ${fmt(res.timings.rerank)}`,
      compose: ans ? `${ans.sources.length} citations` : 'no grounding',
    };
    for (const s of steps) {
      if (id !== run) return;
      s.classList.add('is-active');
      s.querySelector('[data-step-val]').textContent = labels[s.dataset.step];
      await new Promise((r) => setTimeout(r, 230));
      s.classList.remove('is-active');
      s.classList.add('is-done');
    }
    if (id !== run) return;

    const maxScore = res.hits[0]?.score || 1;
    srcEl.innerHTML = res.hits.slice(0, 4).map((h, i) => {
      const used = ans && ans.sources.includes(h.x.d);
      return `<li class="${used ? 'is-used' : ''}"><span class="src__rank mono">${String(i + 1).padStart(2, '0')}</span>
        <span class="src__body"><span class="src__sec mono">${esc(h.x.d.sec)}</span><span class="src__title">${esc(h.x.d.title)}</span></span>
        <span class="src__score mono">${h.score.toFixed(2)}<i style="--w:${(h.score / maxScore).toFixed(3)}"></i></span></li>`;
    }).join('');

    const text = ans ? ans.text : "I couldn't ground an answer in my résumé for that. Try asking about agents, retrieval, inference speed, Vantage, the podcast pipeline, awards, or how to reach me.";
    const parts = text.match(/\S+\s*/g) || [];
    let out = '';
    for (let i = 0; i < parts.length; i++) {
      if (id !== run) return;
      out += parts[i];
      answerEl.innerHTML = cite(out) + '<span class="caret"></span>';
      await new Promise((r) => setTimeout(r, 16 + Math.random() * 22));
    }
    answerEl.innerHTML = cite(out);
    if (ans) {
      answerEl.innerHTML += `<div class="ask__refs mono">${ans.sources.map((d, i) => `<span><sup class="cite">${i + 1}</sup>${esc(d.sec)} — ${esc(d.title)}</span>`).join('')}</div>`;
    }
    const total = Object.values(res.timings).reduce((a, b) => a + b, 0);
    meta.textContent = `retrieved in ${total < 0.1 ? '<0.1' : total.toFixed(2)}ms · ${DOCS.length} passages · 0 API calls`;
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
  root.querySelectorAll('[data-ask-q]').forEach((b) => b.addEventListener('click', () => ask(b.dataset.askQ || b.textContent)));
  return { ask, focus: () => input.focus({ preventScroll: true }) };
}

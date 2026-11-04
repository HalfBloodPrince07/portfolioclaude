# Aditya Narayan Jha — Portfolio

Personal site of **Aditya Narayan Jha**, Applied AI Engineer (multi-agent systems · Vision-RAG · LLM inference optimization).

An editorial, scroll-driven page built around a **GPU particle simulation**. As you scroll, 64,000 particles physically fly between formations that mirror the résumé:

| Chapter | Formation | Metaphor |
| --- | --- | --- |
| Intro | Latent orb | Embedding space |
| Approach | Layered agent graph | Multi-agent orchestration |
| Experience | Double helix | Production pipelines |
| Work / Ask | Spiral galaxy | Vector index / retrieval space |
| Contact | *Hello* | — |

## Highlights

- **WebGPU compute physics** (three.js `WebGPURenderer` + TSL). Each particle has position and velocity in GPU storage buffers. A compute pass integrates:
  - a damped spring towards its slot in the current formation
  - a noise flow-field that swells while particles are in transit
  - a cursor force that pushes particles away and drags them along, like a fluid

  Fast particles glow brighter. On browsers without WebGPU the same simulation runs on WebGL2 through transform feedback.
- **Ask my résumé** (`src/ui/ask.js`): the retrieval half of RAG, running entirely in the browser.
  - tokenization and stemming, then query expansion
  - BM25 over 28 résumé passages
  - phrase- and title-aware reranking
  - grounded answers with citations and a live, timed pipeline trace

  No API calls and no LLM. Open it with **⌘K / Ctrl+K** or **/**.
- **Inference lab**: a token-streaming race between FP16 eager and TensorRT-LLM INT8.
- **Vantage graph**: a draggable force-directed graph of agents, memory tiers and retrieval components.
- **Podcast Pipeline**: an animated stage tracker with a waveform and an SSE-style event log.
- **Polish**:
  - chapter rail and HUD
  - scroll-coupled rotation and camera dolly
  - Lenis smooth scrolling and GSAP SplitText line reveals
  - magnetic buttons and a custom cursor
- **Accessibility and performance**:
  - optional generative Web Audio soundscape (off by default)
  - Motion and Quality toggles, plus `prefers-reduced-motion` support
  - adaptive quality that drops bloom and resolution on slow GPUs
- **SEO and sharing**: Open Graph and Twitter cards (`public/og.png`) and JSON-LD `Person` structured data.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173. To build for production:

```bash
npm run build      # outputs to dist/
npm run preview    # serve the build locally
```

Debug query params:

| Param | Effect |
| --- | --- |
| `?n=20000` | particle count |
| `?nogl` | disable the GPU layer |
| `?hq` | skip adaptive quality |
| `?steps=4` | extra simulation substeps per frame, for slow or headless capture |

## Deploy to GitHub Pages

1. Create a repo (for example `portfolio`, or `<username>.github.io` for a root URL) and push this folder to `main`.
2. In the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Each push to `main` runs `.github/workflows/deploy.yml`, which builds and publishes `dist/`.

`vite.config.js` uses `base: './'`, so the build works both at `https://<user>.github.io/<repo>/` and on a custom domain.

> **Social previews:** the `og:image`, `og:url` and `twitter:image` tags in `index.html` point to the live site at https://halfbloodprince07.github.io/portfolioclaude/. Update them if you move to a custom domain.

## Editing content

- **Page copy:** `index.html`.
- **Ask my résumé:** the knowledge base is `DOCS` and the curated grounded answers are `ANSWERS`, both in `src/ui/ask.js`.
- **Particle formations:** `src/gl/shapes.js`.
- **Per-section framing:** each section's `data-gl` attribute (`x`, `y`, `scale`, plus `mx`, `my`, `mscale` for mobile).
- **Résumé download:** `public/resume.pdf`.

```
index.html            page content & structure
src/main.js           scroll choreography, reveals, cursor, menu, rail, settings
src/style.css         design system (Instrument Serif · Inter Tight · JetBrains Mono)
src/gl/scene.js       WebGPU/TSL compute particle simulation + bloom
src/gl/shapes.js      point-cloud formations
src/ui/ask.js         in-browser BM25 retrieval + grounded answers
src/ui/*.js           inference lab, Vantage graph, podcast pipeline, sound
```

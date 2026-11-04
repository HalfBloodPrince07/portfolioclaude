# Visual style prompt: "Lavender Night" editorial + GPU particles

> Paste everything below the line into Claude inside the project you want restyled.

---

Restyle this project's visual design to match the system below. **Keep all existing content, data, routes and functionality.** Change only the look, motion and interaction layer, plus small interactive demos where they help prove the content (see §9).

Before you write code:
1. Read the project and summarise what it is, who it's for, and its 3–5 core ideas or claims.
2. Map those ideas to visual metaphors: particle formations (§5) and interactive demos (§9).
3. Propose a short plan, then build it.
4. If the stack is React/Next/Vue/Svelte, apply the same system with that framework's idioms. If it's plain HTML, use Vite + vanilla ES modules.

## 1. Mood & references

- **Feeling:** editorial, calm, cinematic, premium. Aesthetic and professional, **not flashy**. Think a design-agency site at night: restraint, generous space, one accent colour, beautiful serif type, and a living 3D particle field that responds to you.
- **References:** emotion-agency.com (serif + italic headline mix, particle hero, soft lavender), junkbranding.com (immersive depth, HUD and section counters, sound toggle), Igloo Inc and Lusion (Awwwards Sites of the Year: physics-driven particles, scroll choreography, obsessive polish).
- **Principle:** every effect should be quiet on its own and impressive in aggregate. If something draws attention to itself, tone it down.

## 2. Colour tokens (dark only)

```css
--bg: #0b0a12;                        /* deep ink-violet night */
--ink: #ece8f3;                       /* warm off-white text */
--ink-2: rgba(236,232,243,.64);       /* body copy */
--ink-3: rgba(236,232,243,.36);       /* labels, meta */
--line: rgba(236,232,243,.10);        /* hairlines */
--accent: #c7b6ff;                    /* lavender (the ONLY accent) */
--accent-2: #f1b8de;                  /* rose (gradients/particles only) */
--accent-soft: rgba(199,182,255,.10);
--card: rgba(20,18,32,.5);            /* glass panels */
```
- Particle palette: violet `#7c62ff` → rose `#e7a8ff`, with about 10% pure white sparkles.
- No neon, no lime, no saturated gradients on text. Accent is used for emphasis words, active states, numbers' units and thin progress lines.

## 3. Typography

| Role | Font | Treatment |
|---|---|---|
| Display | **Instrument Serif** (400, + italic) | Headlines in UPPERCASE; one emphasis word in *italic, mixed case, lavender* (e.g. `SHIPPING <em>in production</em>`, `<em>Let's</em> TALK`). line-height .86–.95, letter-spacing −0.015em |
| Body | **Inter Tight** 300 | 16–17px, line-height 1.6, colour `--ink-2`; bold = 500 in `--ink` |
| Labels / UI | **JetBrains Mono** 400 | 11px, UPPERCASE, letter-spacing .08em, colour `--ink-3` |

- Sizes: hero `clamp(64px,13.5vw,260px)`, section titles `clamp(54px,10vw,184px)`, sub-titles `clamp(42px,6.2vw,104px)`, big statements `clamp(32px,4.4vw,70px)`.
- **Fit-to-width:** measure each display headline's longest word and shrink the font-size so it never breaks mid-word or overflows on any viewport (re-run on resize).
- Inline italics inside body copy use the serif at ~1.2em with `line-height: .5` so line spacing stays even.
- Section labels: `01  Approach ———` (number in accent, mono, followed by a 48px hairline).

## 4. Layout & surfaces

- Page padding `clamp(16px,4vw,64px)`, section padding `clamp(110px,18vh,200px)` vertical. Lots of air.
- Grids built on hairline borders (`1px var(--line)`): stats in a 3-column ruled grid, lists as ruled rows.
- **Glass cards:** `background: var(--card); backdrop-filter: blur(16px); border: 1px solid var(--line); border-radius: 18px`. On hover, the border tints lavender and a radial spotlight follows the cursor (`radial-gradient(420px circle at var(--mx) var(--my), rgba(199,182,255,.09), transparent 55%)`).
- Pills and chips: 1px hairline, radius 99px, small text, lavender border on hover.
- Sticky side columns for long content (e.g. job title sticky while bullets scroll), with a thin vertical progress line that fills lavender→rose as you read and lights up item numbers.
- **Atmosphere layers (fixed, pointer-events none):**
  - two soft radial glows (lavender top-right, rose bottom-left) with `mix-blend-mode: screen`
  - a vignette
  - SVG fractal-noise grain at 3.5% opacity

## 5. Signature: GPU particle field

A full-screen fixed canvas behind the content, with 60–64k particles (about 22k on mobile) built with **three.js `WebGPURenderer` + TSL**. It falls back to WebGL2 automatically.

- **Formations as metaphors.** Each major section has a point-cloud shape that represents its content. For the AI portfolio these were an embedding orb, a layered agent graph with haloed nodes, a pipeline double helix, a spiral galaxy (vector index) and a word ("Hello") sampled from canvas text. Invent equivalents for this project.
- **Scroll choreography.** Entering a section tweens a `morph` uniform to that formation's index (2.2s, power2.inOut). Per-section framing comes from data attributes (`x, y, scale`, plus mobile `mx, my, mscale`) so the shape sits beside the text, not under it. The total scroll progress adds a slow spin, and scroll velocity adds turbulence and a tiny camera dolly.
- **Physics, not tweens.** A compute pass keeps position + velocity per particle and integrates:
  - a damped spring to the particle's slot (stiffness 7–14 varying per particle, damping `exp(-4.2·dt)`)
  - a noise flow field: weak at rest, strong while in transit
  - a cursor force that pushes particles away and drags them along the cursor's velocity, like fluid
- **Render.** Soft round sprites with additive blending and no depth write. Fast particles get brighter, whiter and slightly larger. Bloom: strength 0.6, radius 0.4, threshold 0.06.
- **Intro.** Particles start as a wide starfield nebula and condense into the first formation as the loader fades.
- Subtle camera parallax follows the mouse.

**Hard-won lessons (follow these):**
1. **Staggered morphs must converge exactly.** Use `local = clamp((fract(morph) − rand·0.45)/0.55, 0, 1)` on top of `floor(morph)`. A plain `morph + (rand−.5)·k` offset leaves every shape permanently blurred.
2. **Only volumetric shapes may spin freely.** Planar shapes (text, graphs, helix) get a bounded sway (±0.16 rad + cursor yaw). Wrap the free angle to [−π, π]. Otherwise text turns edge-on after about 30s.
3. **WebGL2 fallback.** Three runs compute via transform feedback (max 4 outputs) and turns every storage buffer into an output. On WebGL2, feed read-only data as `instancedBufferAttribute(new StorageInstancedBufferAttribute(...))`; use `instancedArray(...).toReadOnly()` only on WebGPU.
4. Cap DPR at 1.75, measure FPS after the intro and drop bloom/DPR below 40fps. Provide `?n=` (count), `?steps=` (substeps for headless capture) and `?nogl` debug params.
5. **Verify settled shapes deterministically.** Step the simulation N times, render one frame, screenshot. Headless browsers run far too slowly to judge real-time motion.

## 6. Motion language

- **Smooth scroll:** Lenis (`lerp .09`) synced to GSAP ScrollTrigger.
- **Reveals:** GSAP SplitText, **line-by-line only**. Masked lines slide up from `yPercent 105`, `expo.out`, 1.5s, stagger .12. Use `autoSplit` so lines re-split on resize.
- **Manifesto paragraphs:** words fade from opacity .16 → 1, scrubbed by scroll.
- **Hero:** lines rise in staggered after the loader. On scroll the lines drift a few % horizontally in opposite directions while the block fades to .2.
- **Loader:** huge serif counter `000 → 100%` with an italic lavender `%`, a hairline progress bar and mono status lines. It fades out (no wipe) as the particles condense.
- **Marquee:** serif, alternating roman/italic words, `◦` separators, slow, reacts to scroll direction and speed. Never rotated.
- **Easing:** `cubic-bezier(.65,0,.25,1)` for UI and `cubic-bezier(.16,1,.3,1)` for entrances. Durations 0.5–0.9s for hovers.
- Respect `prefers-reduced-motion` and offer a Motion toggle (it calms the particle field rather than killing it).

## 7. Micro-interactions

- **Custom cursor** (fine pointers only):
  - a 5px dot plus a 32px hairline ring that lags behind
  - the ring grows to 52px with a lavender border over links
  - on `data-cursor="View"` zones it becomes an 80px off-white disc with a mono label
- **Magnetic buttons:** subtle pull (≈0.2 strength, `power3.out`, not elastic).
- **Tilt cards:** max 4–5°, plus the cursor spotlight.
- **Buttons:** pill with hairline border; on hover the ink fill slides up from the bottom and the text inverts. Arrows nudge diagonally.
- **Nav links:** underline wipes in from the left and out to the right.
- **Accordion rows:** on hover a soft lavender gradient wash, a slight indent, and the title switches to *italic lavender*. The plus icon rotates to ×.
- **Counters:** count up once when they enter the viewport.

## 8. UI chrome

- **Fixed nav:**
  - a logo of a glowing gradient dot plus a serif name with an italic surname
  - mono links
  - a "Let's talk" pill and a round menu button
  - background: an ink gradient with backdrop blur, masked to fade out at the bottom
- **Fullscreen menu:** big serif list items with mono numbers (italic + lavender on hover), plus pill toggles for Sound / Motion / Quality.
- **Bottom HUD (mono, very low contrast):**
  - left: `LAYER 02 / 04`, the current section's name (soft crossfade) and a hairline scroll-progress bar
  - right: renderer name (WebGPU/WebGL2) and particle count
  - **No FPS or debug numbers.**
- **Chapter rail (desktop only):** fixed at the right edge. Hairline ticks, with the active one longer and lavender. Labels appear only while hovering the rail, over a fade-to-ink backdrop, so it never overlaps content.
- **Keyboard:** ⌘K / Ctrl+K / "/" jumps to the main interactive feature.

## 9. "Show, don't tell" demos

For each core claim of this project, build a small, **honest**, interactive proof in a glass panel, in the same style (mono UI, serif output, lavender accents, live numbers). Examples from the original:
- a token-streaming race (baseline vs optimised) with tok/s, TTFT and progress hairlines
- a draggable force-directed graph with pulses travelling along edges and a colour legend
- a pipeline stage tracker (pills light up in sequence) with a live waveform and an SSE-style event log
- an "Ask me" console that runs real retrieval in the browser (BM25 + query expansion + rerank) with a timed step trace, a streamed serif answer, citation chips and ranked sources with score bars. It triggers a particle pulse when queried and works with no API calls.

Label them truthfully (e.g. "toy replay", "runs in your browser, 0 API calls").

## 10. Sound (optional)

A generative Web Audio soundscape: filtered detuned drone, soft UI blips, and a band-passed whoosh on section changes. **Off by default**, with an animated equaliser icon when on.

## 11. Accessibility, performance & polish

- Skip link, `:focus-visible` outlines in lavender, aria labels, `aria-expanded` on toggles, `aria-live` on streamed output.
- Mobile:
  - hide the custom cursor, rail and HUD details
  - fewer particles and stacked layouts
  - remove indents on display type
  - no horizontal overflow
- Pause GPU work when hidden, adaptive quality, lazy-load the 3D module.
- **Open Graph image rendered from the real scene:** the particle orb on the right and the serif name lower-left, 1200×630, using absolute URLs. Add JSON-LD structured data where relevant.

## 12. Do / Don't

**Do:** restraint · one accent · italic serif for emphasis · hairlines · glass · lots of space · slow, physical motion · interactions that reward curiosity · honest demos.

**Don't:**
- neon or lime colours
- wide/heavy display fonts (e.g. Syne 800)
- outlined/stroked text
- per-letter flips or rotations
- scramble/glitch text
- rotated marquees
- elastic bounces
- debug-looking HUD numbers
- anything that competes with the content

## 13. Verification before you finish

- Build passes with zero console errors.
- Screenshot every section at 1440×900 and 390×844. Check typography fit, overlaps (nav, HUD, rail), contrast and no horizontal scroll.
- Screenshot each particle formation in its **settled** state (deterministic stepping) and confirm it is crisp and readable.
- Test the WebGL2 fallback, plus WebGPU if available.
- Report what you verified and what you couldn't.

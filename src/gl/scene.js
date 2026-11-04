import * as THREE from 'three/webgpu';
import {
  Fn, uniform, instancedArray, instanceIndex, floor, instancedBufferAttribute, vec3, vec4, float, mix, max, abs, clamp, exp,
  uv, length, smoothstep, time, sin, cos, mx_noise_vec3, color, normalize, pass, pow, select,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { latentOrb, neuralNet, pipeline, galaxy, textShape, randoms } from './shapes.js';

// formation order: orb, agent graph, pipeline helix, galaxy, "Hello"
const FREE_SPIN = [true, false, false, true, false];

/**
 * LatentField — a GPU particle simulation rendered with three.js' WebGPURenderer.
 *
 * Every particle owns a position + velocity in GPU storage buffers. A compute
 * pass (WebGPU compute shader, or transform feedback on the WebGL2 fallback)
 * integrates per frame:
 *   • a damped spring towards its slot in the current formation,
 *   • a noise flow-field that swells while particles are in transit,
 *   • a cursor force that pushes and drags particles like fluid.
 * The CPU only uploads a handful of uniforms.
 */
export class LatentField {
  constructor(canvas, { count = 60000, bloom: useBloom = true } = {}) {
    this.canvas = canvas;
    this.count = count;
    this.useBloom = useBloom;
    this.mouse = new THREE.Vector2(9999, 9999);
    this.mouseTarget = new THREE.Vector2(9999, 9999);
    this.mousePrev = new THREE.Vector2(9999, 9999);
    this.state = { x: 0, y: 0, scale: 1, rotX: 0 };
    this.velocity = 0;
    this.scrollProgress = 0;
    this.spin = 0;
    this.timeRot = 0;
    this.yaw = 0;
    this.substeps = Math.max(1, Math.min(12, Number(new URLSearchParams(location.search).get('steps')) || 1)); // debug: ?steps=8
  }

  async init() {
    const renderer = new THREE.WebGPURenderer({ canvas: this.canvas, antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.setClearColor(0x000000, 0);
    await renderer.init();
    this.renderer = renderer;
    this.backend = renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2';

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0, 9);
    this.scene = scene;
    this.camera = camera;

    await document.fonts.ready.catch(() => {});
    const N = this.count;

    // ---- formations ------------------------------------------------------------
    const gal = galaxy(N);
    const tilt = 0.55, ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let i = 0; i < N; i++) {
      const y = gal[i * 3 + 1], z = gal[i * 3 + 2];
      gal[i * 3 + 1] = y * ct - z * st;
      gal[i * 3 + 2] = y * st + z * ct;
    }
    // Read-only per-particle data. WebGPU: read-only storage buffers. WebGL2 runs compute
    // through transform feedback (max 4 outputs), so there we feed it as vertex attributes.
    const gpu = renderer.backend.isWebGPUBackend;
    const readOnly = (arr, type, size) => {
      if (gpu) { const b = instancedArray(arr, type).toReadOnly(); return { at: () => b.element(instanceIndex) }; }
      const a = instancedBufferAttribute(new THREE.StorageInstancedBufferAttribute(arr, size));
      return { at: () => a };
    };
    const shapes = [latentOrb(N), neuralNet(N), pipeline(N), gal, textShape(N, 'Hello')].map((a) => readOnly(a, 'vec3', 3));
    const rnd = randoms(N);
    const aR = readOnly(rnd, 'vec4', 4);

    // particles start as a wide nebula and condense during the intro
    const start = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 6 + rnd[i * 4] * 9, th = rnd[i * 4 + 1] * Math.PI * 2, ph = Math.acos(rnd[i * 4 + 2] * 2 - 1);
      start[i * 3] = r * Math.sin(ph) * Math.cos(th);
      start[i * 3 + 1] = r * Math.cos(ph) * 0.6;
      start[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 4;
    }
    const pos = instancedArray(start, 'vec3');
    const vel = instancedArray(N, 'vec3');
    this.buffers = { pos, vel };

    // ---- uniforms ------------------------------------------------------------------
    this.u = {
      morph: uniform(0),
      rotFree: uniform(0),
      rotLock: uniform(0),
      dt: uniform(1 / 60),
      mouse: uniform(new THREE.Vector2(9999, 9999)),
      mouseVel: uniform(new THREE.Vector2(0, 0)),
      mouseForce: uniform(0),
      vel: uniform(0),
      size: uniform(window.innerWidth < 768 ? 0.03 : 0.022),
      intro: uniform(0),
      calm: uniform(1),
      pulse: uniform(0),
    };
    const u = this.u;
    const last = shapes.length - 1;

    // ---- simulation step -------------------------------------------------------------
    this.computeUpdate = Fn(() => {
      const p = pos.element(instanceIndex);
      const v = vel.element(instanceIndex);
      const r = aR.at();

      // blended target slot (per-particle stagger → swarm-like transitions)
      // staggered progress that still lands exactly on each formation
      const mi = floor(u.morph);
      const lf = clamp(u.morph.sub(mi).sub(r.x.mul(0.45)).div(0.55), 0, 1);
      const m = clamp(mi.add(lf), 0, last).toVar();
      const target = vec3(0).toVar();
      const wMax = float(0).toVar();
      const freeW = float(0).toVar();
      shapes.forEach((s, i) => {
        const w = clamp(float(1).sub(abs(m.sub(i))), 0, 1);
        target.addAssign(s.at().mul(w));
        wMax.assign(max(wMax, w));
        if (FREE_SPIN[i]) freeW.addAssign(w);
      });
      // volumetric formations spin freely; planar ones (graph, helix, text) only sway
      const ang = mix(u.rotLock, u.rotFree, freeW);
      const c = cos(ang), sn = sin(ang);
      const tp = vec3(target.x.mul(c).sub(target.z.mul(sn)), target.y, target.x.mul(sn).add(target.z.mul(c)));
      const transit = float(1).sub(wMax).mul(2).add(u.pulse).toVar();

      // spring towards the slot (stiffness varies per particle for organic motion)
      const k = mix(float(7), float(14), r.y).mul(u.intro);
      const acc = tp.sub(p).mul(k).toVar();

      // flow field: gentle shimmer at rest, big swirls in transit / fast scroll
      const t = time.mul(0.18).mul(u.calm);
      const flow = mx_noise_vec3(p.mul(0.42).add(vec3(t, t.mul(0.6), r.z.mul(2))));
      acc.addAssign(flow.mul(float(0.32).add(transit.mul(9)).add(u.vel.mul(6)).mul(u.calm.mul(0.7).add(0.3))));

      // cursor: push away + drag along the cursor's velocity
      const d = p.xy.sub(u.mouse);
      const fall = smoothstep(1.8, 0.0, length(d)).mul(u.mouseForce);
      acc.addAssign(vec3(normalize(d).mul(fall.mul(26)).add(u.mouseVel.mul(fall.mul(9))), fall.mul(r.w.sub(0.5)).mul(30)));

      const nv = v.add(acc.mul(u.dt)).mul(exp(u.dt.mul(-4.2)));
      v.assign(nv);
      p.addAssign(nv.mul(u.dt));
    })().compute(N);

    // ---- render ------------------------------------------------------------------------
    const material = new THREE.SpriteNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const vAttr = vel.toAttribute();
    const rAttr = instancedBufferAttribute(new THREE.InstancedBufferAttribute(rnd, 4));
    const speed = length(vAttr);
    const energy = smoothstep(0.4, 5.0, speed);
    material.positionNode = pos.toAttribute();
    material.scaleNode = u.size.mul(rAttr.w.mul(1.4).add(0.35)).mul(energy.mul(0.6).add(1));

    const violet = color('#7c62ff');
    const rose = color('#e7a8ff');
    const white = color('#ffffff');
    const base = select(rAttr.z.greaterThan(0.9), white, mix(violet, rose, rAttr.y));
    const tint = mix(base, white, energy.mul(0.65));
    const twinkle = sin(time.mul(rAttr.y.mul(3).add(1)).add(rAttr.x.mul(40))).mul(0.3).add(0.75);
    const dd = length(uv().sub(0.5));
    const alpha = pow(smoothstep(0.5, 0.0, dd), 1.6).mul(twinkle).mul(energy.mul(0.5).add(0.42));
    material.colorNode = vec4(tint, alpha);

    const sprite = new THREE.Sprite(material);
    sprite.count = N;
    sprite.frustumCulled = false;
    this.group = new THREE.Group();
    this.group.add(sprite);
    scene.add(this.group);

    // ---- post: bloom -------------------------------------------------------------------
    this.pipeline = new THREE.RenderPipeline(renderer);
    const scenePass = pass(scene, camera);
    const sceneColor = scenePass.getTextureNode('output');
    this.bloomNode = bloom(sceneColor, 0.62, 0.42, 0.06);
    this.outputs = { bloom: sceneColor.add(this.bloomNode), plain: sceneColor };
    this.pipeline.outputNode = this.useBloom ? this.outputs.bloom : this.outputs.plain;

    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this._hit = new THREE.Vector3();
    this._last = performance.now();
    this.resize();

    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pointermove', (e) => this.onPointer(e), { passive: true });
    document.addEventListener('pointerleave', () => this.mouseTarget.set(9999, 9999));
    if (!this.noLoop) renderer.setAnimationLoop(() => this.frame());
    return this;
  }

  pulse(strength = 0.6) {
    this.u.pulse.value = Math.max(this.u.pulse.value, strength);
  }

  setQuality(high) {
    this.useBloom = high;
    this.pipeline.outputNode = high ? this.outputs.bloom : this.outputs.plain;
    this.pipeline.needsUpdate = true;
    this.renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio, 1.75) : 1);
    this.resize();
  }

  onPointer(e) {
    this.ndc = this.ndc || new THREE.Vector2();
    this.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    this._needsRay = true;
  }

  _updateMouse() {
    if (!this.ndc || !this._needsRay) return;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    if (this.raycaster.ray.intersectPlane(this.plane, this._hit)) {
      const g = this.group;
      this.mouseTarget.set((this._hit.x - g.position.x) / g.scale.x, (this._hit.y - g.position.y) / g.scale.y);
    }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.baseZ = w / h < 1 ? (9 / Math.max(w / h, 0.55)) * 0.82 : 9;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  frame() {
    const now = performance.now();
    const dt = Math.min((now - this._last) / 1000, 1 / 30);
    this._last = now;
    const u = this.u;
    const ease = (rate) => 1 - Math.pow(rate, dt);

    // rotation = slow drift + scroll-coupled spin (wrapped), and a bounded sway for planar formations
    this.timeRot += dt * 0.05 * u.calm.value;
    this.spin += (this.scrollProgress * Math.PI * 1.4 - this.spin) * ease(0.05);
    const a = this.timeRot + this.spin;
    u.rotFree.value = Math.atan2(Math.sin(a), Math.cos(a));
    this.yaw += ((this.ndc ? this.ndc.x : 0) * 0.22 - this.yaw) * ease(0.08);
    u.rotLock.value = Math.sin(now * 0.00021) * 0.16 * u.calm.value + this.yaw;

    this._updateMouse();
    const active = this.mouseTarget.x < 999;
    if (active && this.mouse.x > 999) this.mouse.copy(this.mouseTarget);
    this.mousePrev.copy(this.mouse);
    this.mouse.lerp(this.mouseTarget, ease(0.0005));
    if (active) {
      const mvx = (this.mouse.x - this.mousePrev.x) / Math.max(dt, 1e-3);
      const mvy = (this.mouse.y - this.mousePrev.y) / Math.max(dt, 1e-3);
      u.mouseVel.value.x += (Math.max(-12, Math.min(12, mvx)) - u.mouseVel.value.x) * ease(0.02);
      u.mouseVel.value.y += (Math.max(-12, Math.min(12, mvy)) - u.mouseVel.value.y) * ease(0.02);
    }
    u.mouse.value.copy(this.mouse);
    u.mouseForce.value += ((active ? 1 : 0) - u.mouseForce.value) * ease(0.01);
    u.vel.value += (Math.min(Math.abs(this.velocity) * 0.02, 1.2) - u.vel.value) * ease(0.02);
    u.dt.value = dt;
    u.pulse.value *= Math.pow(0.18, dt);

    const g = this.group, s = this.state, e = ease(0.03);
    g.position.x += (s.x - g.position.x) * e;
    g.position.y += (s.y - g.position.y) * e;
    g.scale.setScalar(g.scale.x + (s.scale - g.scale.x) * e);
    g.rotation.x += (s.rotX - g.rotation.x) * e;

    const nx = this.ndc ? this.ndc.x : 0, ny = this.ndc ? this.ndc.y : 0;
    const cam = this.camera.position;
    cam.x += (nx * 0.4 - cam.x) * ease(0.1);
    cam.y += (ny * 0.28 - cam.y) * ease(0.1);
    cam.z += (this.baseZ - Math.abs(this.velocity) * 0.004 - cam.z) * ease(0.1);
    this.camera.lookAt(0, 0, 0);

    for (let i = 0; i < this.substeps; i++) this.renderer.compute(this.computeUpdate);
    this.pipeline.render();
  }
}

// The WebGL paper: a viewport-sized, aspect-matched grid that folds (folds.ts), lit with flat facets.
// At p = 0 and p = 1 it is perfectly flat, unlit and lines up with the live page pixel for pixel.
import * as THREE from 'three';
import { config } from './config';
import { vertex, fragment } from './shaders';
import { MAX_FOLDS, MAX_LINES, type FoldSet, type Frame } from './folds';
import { envelope, smooth } from './timing';
import type { Gate } from '../stagefx';

export type Tex = { tex: THREE.Texture; dark: boolean };

export class PaperEngine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  mesh!: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  material: THREE.ShaderMaterial;
  canvas: HTMLCanvasElement;
  W = 0; H = 0;
  private blank: THREE.DataTexture;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // raw passthrough: page pixels in = pixels out
    this.camera = new THREE.PerspectiveCamera(30, 1, 1, 100000);
    this.blank = new THREE.DataTexture(new Uint8Array([16, 19, 20, 255]), 1, 1);
    this.blank.needsUpdate = true;
    const U = <T,>(value: T) => ({ value });
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: vertex,
      fragmentShader: fragment,
      side: THREE.DoubleSide,
      transparent: false,
      uniforms: {
        uSize: U(new THREE.Vector2(1, 1)), uS: U(1), uCell: U(8),
        uFold: U(Array.from({ length: MAX_FOLDS }, () => new THREE.Vector4())),
        uFoldPar: U(new Array(MAX_FOLDS).fill(-1)), uFoldAng: U(new Array(MAX_FOLDS).fill(0)),
        uFoldRes: U(new Array(MAX_FOLDS).fill(0)), uNF: U(0),
        uLine: U(Array.from({ length: MAX_LINES }, () => new THREE.Vector4())),
        uLineK: U(new Array(MAX_LINES).fill(0)), uNL: U(0),
        uCrease: U(0), uSoft: U(4), uCenter: U(new THREE.Vector3()),
        uComp: U(0), uBall: U(0), uBallCrease: U(config.ballCrease), uRq: U(300), uRb: U(120), uLumps: U(config.ballLumps),
        uLump: U(new THREE.Vector4()), uZw: U(10), uRot: U(new THREE.Matrix3()), uShift: U(new THREE.Vector2()),
        uResDepth: U(config.residualDepth),
        uTexA: U(this.blank as THREE.Texture), uTexB: U(this.blank as THREE.Texture), uMix: U(0),
        uDarkA: U(0), uDarkB: U(0), uShade: U(0), uLight: U(new THREE.Vector3(0, 0, 1)),
        uAmbient: U(config.ambient), uDiffuse: U(config.diffuse), uSheen: U(config.sheen),
        uFoldDark: U(config.foldDarkening), uRimDark: U(config.rimDarkening), uRimLight: U(config.rimLight),
        uBack: U(new THREE.Vector3(...config.backTint)), uShowThrough: U(config.showThrough), uExposure: U(1),
        uResAlpha: U(0), uResMode: U(0), uBake: U(0),
      },
    });
    this.resize();
  }

  /** Size the canvas, the sheet and the camera from the viewport: z = 0 maps 1:1 onto CSS pixels. */
  resize() {
    const W = innerWidth, H = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, config.maxDpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(W, H, false);
    if (W === this.W && H === this.H && this.mesh) return;
    this.W = W; this.H = H;
    const long = Math.max(W, H), seg = Math.round(config.segments);
    const sx = W >= H ? seg : Math.max(8, Math.round(seg * W / long));
    const sy = H > W ? seg : Math.max(8, Math.round(seg * H / long));
    const geo = new THREE.PlaneGeometry(W, H, sx, sy);
    if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.geometry = geo; }
    else { this.mesh = new THREE.Mesh(geo, this.material); this.mesh.frustumCulled = false; this.scene.add(this.mesh); }
    const fov = this.camera.fov * Math.PI / 180;
    this.camera.aspect = W / H;
    this.camera.position.set(0, 0, (H / 2) / Math.tan(fov / 2));
    this.camera.near = 10; this.camera.far = this.camera.position.z * 4;
    this.camera.updateProjectionMatrix();
    const u = this.material.uniforms;
    u.uSize.value.set(W, H);
    u.uS.value = Math.min(W, H);
    const el = config.lightElevation * Math.PI / 180, az = config.lightAngle * Math.PI / 180;
    // image coords (y down) → view space (y up)
    u.uLight.value.set(Math.cos(el) * Math.cos(az), -Math.cos(el) * Math.sin(az), Math.sin(el)).normalize();
  }

  /** Compile the shader up front so the first transition doesn't stall. */
  warm() {
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
    this.renderer.clear();
  }

  texture(canvas: HTMLCanvasElement) {
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.NoColorSpace;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = Math.min(4, this.renderer.capabilities.getMaxAnisotropy());
    this.renderer.initTexture(t); // upload now, never mid-move
    return t;
  }

  setFolds(set: FoldSet, resSeedTilt: () => number) {
    const u = this.material.uniforms;
    set.folds.forEach((f, i) => {
      u.uFold.value[i].set(f.cx, f.cy, f.nx, f.ny);
      u.uFoldPar.value[i] = f.parent;
      u.uFoldRes.value[i] = (f.kind === 'tuck' ? 0.25 : 1) * resSeedTilt();
    });
    u.uNF.value = set.folds.length;
    set.lines.forEach((l, i) => { u.uLine.value[i].set(l.ux, l.uy, l.per, l.ph); u.uLineK.value[i] = l.k; });
    u.uCell.value = Math.max(set.W, set.H) / Math.round(config.segments);
    u.uNL.value = set.lines.length;
    u.uSoft.value = config.foldSoftness * set.S;
    u.uRq.value = set.rq;
    u.uRb.value = config.ballSize * set.S * 0.5;
    u.uZw.value = set.zw;
    u.uLump.value.set(...set.lump);
    u.uLumps.value = config.ballLumps;
    u.uBallCrease.value = config.ballCrease;
    u.uResDepth.value = config.residualDepth;
    // live-tunable lighting
    u.uAmbient.value = config.ambient; u.uDiffuse.value = config.diffuse; u.uSheen.value = config.sheen;
    u.uFoldDark.value = config.foldDarkening; u.uRimDark.value = config.rimDarkening; u.uRimLight.value = config.rimLight;
    u.uBack.value.set(...config.backTint); u.uShowThrough.value = config.showThrough;
  }

  setTextures(a: Tex, b: Tex) {
    const u = this.material.uniforms;
    u.uTexA.value = a.tex; u.uDarkA.value = a.dark ? 1 : 0;
    u.uTexB.value = b.tex; u.uDarkB.value = b.dark ? 1 : 0;
  }

  /**
   * Draw one film frame.
   * @param mix texture crossfade (0 = outgoing, 1 = incoming)
   * @param rot tumble rotation (already includes stop-motion jitter)
   */
  draw(p: number, f: Frame, mix: number, rot: THREE.Matrix3, shift: [number, number], gate: Gate, residual: { mode: 0 | 1 | 2; alpha: number }) {
    const u = this.material.uniforms;
    for (let i = 0; i < f.angles.length; i++) u.uFoldAng.value[i] = f.angles[i];
    u.uCrease.value = f.crease;
    u.uComp.value = f.comp;
    u.uBall.value = f.ball * config.spherize;
    u.uRb.value = f.ballR;
    u.uRq.value = f.stackR;
    u.uCenter.value.set(...f.center);
    u.uShade.value = f.shade;
    u.uMix.value = mix;
    u.uRot.value.copy(rot);
    u.uShift.value.set(shift[0] + gate.x, shift[1] - gate.y);
    u.uExposure.value = gate.exposure;
    u.uResMode.value = residual.mode;
    u.uResAlpha.value = residual.alpha * smooth(0.86, 1, p);
    u.uBake.value = 0;
    this.renderer.render(this.scene, this.camera);
    void envelope;
  }

  /**
   * Render the left-over crease layer (flat sheet, grey values) and return it as an image URL,
   * so the DOM overlay after landing is exactly what the last canvas frame showed.
   */
  async bakeResidual(mode: 1 | 2): Promise<string> {
    const u = this.material.uniforms;
    const W = Math.round(this.W), H = Math.round(this.H);
    const rt = new THREE.WebGLRenderTarget(W, H, { depthBuffer: true });
    const keep = { ang: [...u.uFoldAng.value], c: u.uCrease.value, comp: u.uComp.value, ball: u.uBall.value };
    for (let i = 0; i < MAX_FOLDS; i++) u.uFoldAng.value[i] = 0;
    u.uCrease.value = 0; u.uComp.value = 0; u.uBall.value = 0; u.uCenter.value.set(0, 0, 0);
    u.uRot.value.identity(); u.uShift.value.set(0, 0);
    u.uBake.value = 1; u.uResMode.value = mode;
    this.renderer.setRenderTarget(rt);
    this.renderer.render(this.scene, this.camera);
    const px = new Uint8Array(W * H * 4);
    this.renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
    this.renderer.setRenderTarget(null);
    rt.dispose();
    u.uBake.value = 0;
    keep.ang.forEach((a: number, i: number) => { u.uFoldAng.value[i] = a; });
    u.uCrease.value = keep.c; u.uComp.value = keep.comp; u.uBall.value = keep.ball;
    // flip rows (GL is bottom-up) into a 2D canvas
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    for (let y = 0; y < H; y++) img.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'));
    return blob ? URL.createObjectURL(blob) : c.toDataURL('image/png');
  }

  clear() { this.renderer.setRenderTarget(null); this.renderer.clear(); }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.blank.dispose();
    this.renderer.dispose();
  }
}

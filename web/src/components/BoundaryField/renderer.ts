import * as THREE from "three";
import { EffectComposer, EffectPass, RenderPass } from "postprocessing";
import { PhaseDirector, type BoundaryPhase, type BoundaryVariant } from "./phase-director";
import { CurlSimPass } from "./passes/curl-sim";
import { FilmicEffect, createBloomEffect } from "./passes/filmic";
import { RenderPointsPass } from "./passes/render-points";

export type BoundaryRendererOptions = {
  variant: BoundaryVariant;
  particleGrid: number;
  bloom: boolean;
  dpr: number;
  onPhaseChange?: (phase: BoundaryPhase) => void;
};

export class BoundaryFieldRenderer {
  private renderer: THREE.WebGLRenderer | null = null;
  private composer: EffectComposer | null = null;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private sim: CurlSimPass | null = null;
  private points: RenderPointsPass | null = null;
  private filmic: FilmicEffect | null = null;
  private director: PhaseDirector | null = null;
  private opts: BoundaryRendererOptions | null = null;
  private lastPhase: BoundaryPhase | null = null;
  private lost = false;

  init(canvas: HTMLCanvasElement, opts: BoundaryRendererOptions) {
    this.opts = opts;
    this.director = new PhaseDirector(opts.variant);
    this.camera.position.set(0, 0, opts.variant === "hero" ? 4.6 : 5.2);
    this.scene.background = new THREE.Color("#050608");

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: "high-performance"
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setPixelRatio(opts.dpr);
    this.renderer.setClearColor("#050608", 1);

    this.sim = new CurlSimPass(this.renderer, opts.particleGrid);
    this.points = new RenderPointsPass(opts.particleGrid, opts.variant === "hero" ? 13 : 9);
    this.scene.add(this.points.points);

    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.filmic = new FilmicEffect();
    this.composer.addPass(new EffectPass(this.camera, createBloomEffect(opts.bloom), this.filmic));

    canvas.addEventListener("webglcontextlost", this.onContextLost, false);
    canvas.addEventListener("webglcontextrestored", this.onContextRestored, false);
  }

  frame(now: number, dt: number) {
    if (!this.renderer || !this.composer || !this.director || !this.sim || !this.points || this.lost) return;
    const state = this.director.tick(now, dt);
    const seconds = now / 1000;
    this.sim.step({
      time: seconds,
      hz: Math.min(2.2, Math.max(0.45, dt / 16.67)),
      phase: state.phase,
      intensity: state.intensity,
      shock: state.shock,
      mouse: state.mouse
    });
    this.points.update(this.sim.currentTexture(), state.phase, state.intensity);
    if (this.filmic) this.filmic.timeUniform.value = seconds;
    this.composer.render(dt / 1000);

    if (state.phase !== this.lastPhase) {
      this.lastPhase = state.phase;
      this.opts?.onPhaseChange?.(state.phase);
    }
  }

  setPointer(x: number, y: number) {
    this.director?.setPointer(x, y);
  }

  setScrollProgress(progress: number) {
    this.director?.setActivePhaseFromScroll(progress);
  }

  setFreezePhase(phase: BoundaryPhase | null) {
    this.director?.freeze(phase);
  }

  pulseClick() {
    this.director?.pulseClick();
  }

  resize(width: number, height: number) {
    if (!this.renderer || !this.composer) return;
    const safeWidth = Math.max(1, width);
    const safeHeight = Math.max(1, height);
    this.renderer.setSize(safeWidth, safeHeight, false);
    this.composer.setSize(safeWidth, safeHeight);
    this.camera.aspect = safeWidth / safeHeight;
    this.camera.updateProjectionMatrix();
    this.filmic?.resolutionUniform.value.set(safeWidth, safeHeight);
  }

  dispose(canvas?: HTMLCanvasElement | null) {
    canvas?.removeEventListener("webglcontextlost", this.onContextLost);
    canvas?.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.sim?.dispose();
    this.points?.dispose();
    this.composer?.dispose();
    this.renderer?.dispose();
    this.sim = null;
    this.points = null;
    this.composer = null;
    this.renderer = null;
  }

  private onContextLost = (event: Event) => {
    event.preventDefault();
    this.lost = true;
  };

  private onContextRestored = () => {
    this.lost = false;
  };
}

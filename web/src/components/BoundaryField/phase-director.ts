export type BoundaryPhase = 0 | 1 | 2 | 3;
export type BoundaryVariant = "hero" | "echo";

export type PhaseState = {
  phase: BoundaryPhase;
  intensity: number;
  shock: number;
  mouse: { x: number; y: number };
};

const durations: Record<BoundaryPhase, number> = {
  0: 1800,
  1: 3000,
  2: 3000,
  3: 1500
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export class PhaseDirector {
  private phase: BoundaryPhase = 0;
  private phaseStart = 0;
  private scrollIntensity = 0;
  private variant: BoundaryVariant;
  private shock = 0;
  private pointer = { x: 0, y: 0 };
  private targetPointer = { x: 0, y: 0 };
  private frozenPhase: BoundaryPhase | null = null;

  constructor(variant: BoundaryVariant) {
    this.variant = variant;
  }

  setHeroVsEcho(variant: BoundaryVariant) {
    this.variant = variant;
  }

  setActivePhaseFromScroll(localProgress: number) {
    const progress = clamp01(localProgress);
    const chapterBias = progress < 0.33 ? 0.24 : progress < 0.66 ? 0.48 : 0.9;
    this.scrollIntensity = chapterBias;
  }

  setPointer(x: number, y: number) {
    this.targetPointer.x = x;
    this.targetPointer.y = y;
  }

  pulseClick() {
    this.shock = 1;
  }

  freeze(phase: BoundaryPhase | null) {
    this.frozenPhase = phase;
  }

  tick(now: number, dt: number): PhaseState {
    if (this.phaseStart === 0) this.phaseStart = now;
    const multiplier = this.variant === "echo" ? 1.5 : 1;
    const elapsed = now - this.phaseStart;

    if (this.frozenPhase === null && elapsed > durations[this.phase] * multiplier) {
      this.phase = (((this.phase + 1) % 4) as BoundaryPhase);
      this.phaseStart = now;
    }

    this.pointer.x += (this.targetPointer.x - this.pointer.x) * 0.08;
    this.pointer.y += (this.targetPointer.y - this.pointer.y) * 0.08;
    this.shock *= Math.pow(0.05, Math.min(dt, 64) / 1000);

    const activePhase = this.frozenPhase ?? this.phase;
    const phaseBoost = activePhase === 2 ? 0.36 : activePhase === 3 ? 0.5 : activePhase === 1 ? 0.2 : 0;
    const base = this.variant === "echo" ? 0.34 : 0.54;

    return {
      phase: activePhase,
      intensity: clamp01(base + this.scrollIntensity * 0.38 + phaseBoost + this.shock * 0.22),
      shock: this.shock,
      mouse: { ...this.pointer }
    };
  }
}

import { BlendFunction, BloomEffect, Effect } from "postprocessing";
import { Uniform, Vector2 } from "three";
import { filmicFragment } from "../shaders/filmic.frag";

export class FilmicEffect extends Effect {
  readonly timeUniform: Uniform<number>;
  readonly resolutionUniform: Uniform<Vector2>;

  constructor() {
    const timeUniform = new Uniform(0);
    const resolutionUniform = new Uniform(new Vector2(1, 1));
    super("FilmicEffect", filmicFragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ["uTime", timeUniform],
        ["uResolution", resolutionUniform]
      ])
    });
    this.timeUniform = timeUniform;
    this.resolutionUniform = resolutionUniform;
  }
}

export function createBloomEffect(enabled: boolean) {
  return new BloomEffect({
    intensity: enabled ? 1.08 : 0,
    mipmapBlur: true,
    luminanceThreshold: 0.82,
    luminanceSmoothing: 0.035
  });
}

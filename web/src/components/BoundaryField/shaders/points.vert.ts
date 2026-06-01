export const pointsVertex = `
precision highp float;

uniform sampler2D uPositions;
uniform float uPhase;
uniform float uIntensity;
uniform float uBaseSize;
attribute vec2 reference;
attribute float danger;
varying vec3 vColor;
varying float vAlpha;

vec3 safeColor = vec3(0.427, 0.941, 0.839);
vec3 blockedColor = vec3(1.0, 0.329, 0.212);

void main() {
  vec3 pos = texture2D(uPositions, reference).xyz;
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  float phaseDanger = smoothstep(1.2, 2.4, uPhase) * danger;
  vColor = mix(safeColor, blockedColor, phaseDanger);
  vAlpha = mix(0.07, 0.18, uIntensity) + phaseDanger * 0.12;
  gl_PointSize = clamp(uBaseSize / max(0.5, -mvPosition.z), 0.65, 4.0);
}
`;

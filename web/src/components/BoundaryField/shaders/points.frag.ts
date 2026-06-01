export const pointsFragment = `
precision highp float;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 p = gl_PointCoord - 0.5;
  float d = length(p);
  float sprite = 1.0 - smoothstep(0.12, 0.5, d);
  gl_FragColor = vec4(vColor * sprite * 1.8, sprite * vAlpha);
}
`;

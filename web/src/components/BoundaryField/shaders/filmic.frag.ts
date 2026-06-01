export const filmicFragment = `
uniform float uTime;
uniform vec2 uResolution;

float grainHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 c = uv - 0.5;
  float ca = 0.002 + dot(c, c) * 0.02;
  vec3 scene = inputColor.rgb;
  vec3 shiftedR = texture2D(inputBuffer, uv + c * ca).rgb;
  vec3 shiftedB = texture2D(inputBuffer, uv - c * ca).rgb;
  vec3 col = vec3(shiftedR.r, scene.g, shiftedB.b);
  col = col / (1.0 + col);
  col *= smoothstep(1.15, 0.35, length(c) * 1.4);
  col += (grainHash(uv * uResolution + uTime) - 0.5) * 0.02;
  outputColor = vec4(col, 1.0);
}
`;

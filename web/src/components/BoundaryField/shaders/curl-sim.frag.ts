export const curlSimFragment = `
precision highp float;

uniform sampler2D uPositions;
uniform float uTime;
uniform float uHZ;
uniform float uCurlScale;
uniform float uCurlSpeed;
uniform vec2 uMouse;
uniform float uMouseForce;
uniform float uShock;
uniform float uPhase;
uniform float uIntensity;
varying vec2 vUv;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}

vec3 snoiseVec3(vec3 x) {
  return vec3(
    noise(x + vec3(0.0, 19.1, 37.2)),
    noise(x + vec3(11.7, 0.0, 23.4)),
    noise(x + vec3(31.5, 47.2, 0.0))
  ) * 2.0 - 1.0;
}

vec3 curlNoise(vec3 p) {
  const float e = 0.12;
  vec3 dx = vec3(e, 0.0, 0.0);
  vec3 dy = vec3(0.0, e, 0.0);
  vec3 dz = vec3(0.0, 0.0, e);
  vec3 p_x0 = snoiseVec3(p - dx);
  vec3 p_x1 = snoiseVec3(p + dx);
  vec3 p_y0 = snoiseVec3(p - dy);
  vec3 p_y1 = snoiseVec3(p + dy);
  vec3 p_z0 = snoiseVec3(p - dz);
  vec3 p_z1 = snoiseVec3(p + dz);
  float x = p_y1.z - p_y0.z - p_z1.y + p_z0.y;
  float y = p_z1.x - p_z0.x - p_x1.z + p_x0.z;
  float z = p_x1.y - p_x0.y - p_y1.x + p_y0.x;
  return normalize(vec3(x, y, z) / (2.0 * e));
}

void main() {
  vec3 pos = texture2D(uPositions, vUv).xyz;
  vec3 c = curlNoise(pos * uCurlScale + uTime * uCurlSpeed * 0.04);
  pos += c * uCurlSpeed * 0.008 * uHZ * (0.65 + uIntensity);

  vec2 ellipse = vec2(1.72, 0.98);
  vec2 normalized = pos.xy / ellipse;
  float boundaryDistance = length(normalized);
  vec2 normal = normalize(normalized + 0.0001) / ellipse;
  float outside = smoothstep(0.92, 1.22, boundaryDistance);
  pos.xy -= normal * outside * 0.016 * uHZ;

  vec2 mouseDelta = uMouse - pos.xy * 0.22;
  pos.xy += mouseDelta * uMouseForce * 0.004 * uHZ;

  float dangerous = smoothstep(0.54, 0.95, vUv.x) * smoothstep(0.22, 0.78, vUv.y);
  float blockedPhase = smoothstep(1.4, 2.2, uPhase) * (1.0 - smoothstep(2.8, 3.3, uPhase));
  vec2 shellTarget = normalize(vec2(pos.x + 0.2, pos.y * 0.75) + 0.001) * ellipse * 0.96;
  pos.xy = mix(pos.xy, shellTarget, dangerous * blockedPhase * 0.025 * uHZ);

  float shockWave = uShock * exp(-abs(boundaryDistance - 0.82) * 9.0);
  pos.xy += normalize(pos.xy + 0.001) * shockWave * 0.035 * uHZ;

  pos.z *= 0.985;
  pos.z += c.z * 0.006 * uHZ;
  gl_FragColor = vec4(pos, 1.0);
}
`;

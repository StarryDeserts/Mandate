import * as THREE from "three";
import { curlSimFragment } from "../shaders/curl-sim.frag";

const passVertex = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export type CurlSimUniforms = {
  time: number;
  hz: number;
  phase: number;
  intensity: number;
  shock: number;
  mouse: { x: number; y: number };
};

export class CurlSimPass {
  readonly size: number;
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private scene = new THREE.Scene();
  private material: THREE.ShaderMaterial;
  private targets: [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget];
  private read = 0;

  constructor(renderer: THREE.WebGLRenderer, size: number) {
    this.renderer = renderer;
    this.size = size;
    this.targets = [this.createTarget(), this.createTarget()];
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uPositions: { value: this.seedTexture() },
        uTime: { value: 0 },
        uHZ: { value: 1 },
        uCurlScale: { value: 1.9 },
        uCurlSpeed: { value: 1.35 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uMouseForce: { value: 0.65 },
        uShock: { value: 0 },
        uPhase: { value: 0 },
        uIntensity: { value: 0.5 }
      },
      vertexShader: passVertex,
      fragmentShader: curlSimFragment,
      depthWrite: false,
      depthTest: false
    });

    this.scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    this.renderer.setRenderTarget(this.targets[0]);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(this.targets[1]);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.material.uniforms.uPositions.value = this.targets[this.read].texture;
  }

  step(uniforms: CurlSimUniforms) {
    const write = 1 - this.read;
    this.material.uniforms.uPositions.value = this.targets[this.read].texture;
    this.material.uniforms.uTime.value = uniforms.time;
    this.material.uniforms.uHZ.value = uniforms.hz;
    this.material.uniforms.uPhase.value = uniforms.phase;
    this.material.uniforms.uIntensity.value = uniforms.intensity;
    this.material.uniforms.uShock.value = uniforms.shock;
    this.material.uniforms.uMouse.value.set(uniforms.mouse.x, uniforms.mouse.y);

    this.renderer.setRenderTarget(this.targets[write]);
    this.renderer.render(this.scene, this.camera);
    this.renderer.setRenderTarget(null);
    this.read = write;
  }

  currentTexture(): THREE.Texture {
    return this.targets[this.read].texture;
  }

  dispose() {
    this.targets.forEach((target) => target.dispose());
    this.material.dispose();
  }

  private createTarget() {
    return new THREE.WebGLRenderTarget(this.size, this.size, {
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false
    });
  }

  private seedTexture() {
    const data = new Float32Array(this.size * this.size * 4);
    for (let i = 0; i < this.size * this.size; i += 1) {
      const t = i / (this.size * this.size);
      const angle = t * Math.PI * 34.0;
      const lane = (i % this.size) / this.size;
      const radius = 0.25 + Math.sqrt(lane) * 0.95;
      const arc = 0.82 + Math.sin(t * 48.0) * 0.18;
      data[i * 4 + 0] = Math.cos(angle) * radius * arc * 1.18;
      data[i * 4 + 1] = Math.sin(angle) * radius * arc * 0.72;
      data[i * 4 + 2] = (Math.random() - 0.5) * 0.14;
      data[i * 4 + 3] = 1;
    }

    const texture = new THREE.DataTexture(data, this.size, this.size, THREE.RGBAFormat, THREE.FloatType);
    texture.needsUpdate = true;
    return texture;
  }
}

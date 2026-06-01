import * as THREE from "three";
import { pointsFragment } from "../shaders/points.frag";
import { pointsVertex } from "../shaders/points.vert";

export class RenderPointsPass {
  readonly points: THREE.Points;
  readonly material: THREE.ShaderMaterial;
  private geometry: THREE.BufferGeometry;

  constructor(gridSize: number, baseSize: number) {
    const count = gridSize * gridSize;
    const positions = new Float32Array(count * 3);
    const references = new Float32Array(count * 2);
    const danger = new Float32Array(count);

    for (let y = 0; y < gridSize; y += 1) {
      for (let x = 0; x < gridSize; x += 1) {
        const i = y * gridSize + x;
        positions[i * 3 + 0] = 0;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = 0;
        references[i * 2 + 0] = (x + 0.5) / gridSize;
        references[i * 2 + 1] = (y + 0.5) / gridSize;
        danger[i] = Math.pow(x / gridSize, 1.5) * (0.35 + Math.sin(y * 0.23) * 0.2);
      }
    }

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    this.geometry.setAttribute("reference", new THREE.BufferAttribute(references, 2));
    this.geometry.setAttribute("danger", new THREE.BufferAttribute(danger, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uPositions: { value: null },
        uPhase: { value: 0 },
        uIntensity: { value: 0.5 },
        uBaseSize: { value: baseSize }
      },
      vertexShader: pointsVertex,
      fragmentShader: pointsFragment,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });

    this.points = new THREE.Points(this.geometry, this.material);
  }

  update(texture: THREE.Texture, phase: number, intensity: number) {
    this.material.uniforms.uPositions.value = texture;
    this.material.uniforms.uPhase.value = phase;
    this.material.uniforms.uIntensity.value = intensity;
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}

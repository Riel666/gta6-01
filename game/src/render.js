// The three.js view: renderer, sun-soaked sky, lights and the third-person
// camera that orbits the player (or the player's car) from a mouse drag.
// The game renders at the window size with a capped pixel ratio so even a
// software renderer stays smooth.

import * as THREE from 'three';
import { CAMERA, PALETTE } from './config.js';

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 120, 520);

  const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 1.9);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xbfd9ff, 0.35);
  fill.position.set(-80, 60, -120);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 8, -14);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    renderer,
    scene,
    camera,
    // Orbit state: yaw follows the player, pitch clamps so the camera never
    // goes under the ground or straight overhead.
    yaw: 0,
    pitch: 0.32,
    camPos: new THREE.Vector3(0, 8, -14),
    render() { renderer.render(scene, camera); },
    updateCamera(targetX, targetZ, targetHeading, dt, inCar, orbit) {
      this.yaw -= orbit.dx * 0.005;
      this.pitch = Math.max(0.08, Math.min(1.1, this.pitch + orbit.dy * 0.004));
      // Ease the yaw toward the player's heading when driving; on foot the
      // camera stays where the player left it.
      if (inCar) {
        let dh = targetHeading - this.yaw;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        this.yaw += dh * Math.min(1, dt * 1.5);
      }
      const dist = inCar ? CAMERA.carDist : CAMERA.footDist;
      const height = inCar ? CAMERA.carHeight : CAMERA.footHeight;
      const cx = targetX - Math.sin(this.yaw) * Math.cos(this.pitch) * dist;
      const cz = targetZ - Math.cos(this.yaw) * Math.cos(this.pitch) * dist;
      const cy = height + Math.sin(this.pitch) * dist * 0.6;
      const k = Math.min(1, dt * 10);
      this.camPos.x += (cx - this.camPos.x) * k;
      this.camPos.y += (cy - this.camPos.y) * k;
      this.camPos.z += (cz - this.camPos.z) * k;
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(targetX, 1.6, targetZ);
    },
  };
}

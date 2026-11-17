// Solmar City: a sun-soaked coastal grid city built from plain three.js boxes.
// Roads run every 60 m on both axes, buildings fill the blocks between them, and
// the south edge is a beach with the sea beyond it. Everything is procedural, so
// the same seed always builds the same city. Returns the building colliders the
// physics uses and a marker factory for mission beacons.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

const ROAD_Y = 0.02;
const WALK_Y = 0.04;

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function box(w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lambert(color));
  mesh.position.set(x, y, z);
  return mesh;
}

/** A tall light beam plus a pulsing ground ring that marks a mission target. */
export function createMarker() {
  const group = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.4, 60, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
  );
  beam.position.y = 30;
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.2, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.08;
  group.add(beam);
  group.add(ring);
  group.userData.ring = ring;
  group.userData.beam = beam;
  return group;
}

export function createCity(scene, rng) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Ground: grassy green under the city, sand on the beach, blue sea beyond.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, CITY.half * 2), lambert(PALETTE.ground));
  ground.rotation.x = -Math.PI / 2;
  group.add(ground);
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, CITY.beachZ - CITY.seaZ + 120), lambert(PALETTE.sand));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.01, (CITY.beachZ + CITY.half) / 2 + 8);
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY.half * 2 + 400, 220),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.92 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.03, CITY.seaZ + 110);
  group.add(sea);

  // Roads: dark strips along every grid line, with pale centre dashes.
  const roadMat = lambert(PALETTE.road);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
  for (let c = -CITY.half; c <= CITY.half; c += CITY.block) {
    const roadX = new THREE.Mesh(new THREE.PlaneGeometry(CITY.roadHalf * 2, CITY.half * 2), roadMat);
    roadX.rotation.x = -Math.PI / 2;
    roadX.position.set(c, ROAD_Y, 0);
    group.add(roadX);
    const roadZ = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, CITY.roadHalf * 2), roadMat);
    roadZ.rotation.x = -Math.PI / 2;
    roadZ.position.set(0, ROAD_Y, c);
    group.add(roadZ);
    for (let d = -CITY.half + 15; d < CITY.half; d += 30) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 3), dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(c, ROAD_Y + 0.005, d);
      group.add(dash);
    }
  }

  // Sidewalks: pale strips hugging each road.
  const walkMat = lambert(PALETTE.sidewalk);
  for (let c = -CITY.half; c <= CITY.half; c += CITY.block) {
    for (const off of [-CITY.roadHalf - 1.5, CITY.roadHalf + 1.5]) {
      const w1 = new THREE.Mesh(new THREE.PlaneGeometry(3, CITY.half * 2), walkMat);
      w1.rotation.x = -Math.PI / 2;
      w1.position.set(c + off, WALK_Y, 0);
      group.add(w1);
      const w2 = new THREE.Mesh(new THREE.PlaneGeometry(CITY.half * 2, 3), walkMat);
      w2.rotation.x = -Math.PI / 2;
      w2.position.set(0, WALK_Y, c + off);
      group.add(w2);
    }
  }

  // Buildings: 1-3 boxes per block, heights 8-42 m, warm sun-bleached colours.
  // Corner blocks hold the landmarks: police station, hospital, garage, safehouse.
  const landmarks = {
    '-270,-270': { color: 0x2e5fa3, h: 16, label: 'PD' },
    '270,-270': { color: 0xe8e8e8, h: 20, label: 'HOSP' },
    '90,90': { color: 0xd35400, h: 12, label: 'GARAGE' },
    '-90,210': { color: 0x8e44ad, h: 14, label: 'SAFE' },
  };
  const roofMat = lambert(0x5a5f66);
  const windowMat = new THREE.MeshLambertMaterial({ color: 0x2c3e50, emissive: 0x1a2a3a });
  for (let bx = -CITY.half + CITY.block / 2; bx < CITY.half; bx += CITY.block) {
    for (let bz = -CITY.half + CITY.block / 2; bz < CITY.half; bz += CITY.block) {
      if (bz > CITY.beachZ - CITY.block / 2) continue; // beach: no buildings
      if (Math.abs(bx) < 35 && Math.abs(bz) < 35) continue; // central plaza
      const key = `${bx},${bz}`;
      const lm = landmarks[key];
      if (lm) {
        const b = box(38, lm.h, 38, lm.color, bx, lm.h / 2, bz);
        group.add(b);
        const roof = box(40, 1, 40, 0x333a40, bx, lm.h + 0.5, bz);
        group.add(roof);
        colliders.push({ minX: bx - 19, maxX: bx + 19, minZ: bz - 19, maxZ: bz + 19 });
        continue;
      }
      const n = rng.int(1, 3);
      for (let i = 0; i < n; i += 1) {
        const w = rng.range(12, 22);
        const d = rng.range(12, 22);
        const h = rng.range(8, 42);
        const ox = (i % 2 === 0 ? -1 : 1) * rng.range(4, 11);
        const oz = (i < 2 ? -1 : 1) * rng.range(4, 11);
        const x = bx + ox;
        const z = bz + oz;
        const b = box(w, h, d, rng.pick(PALETTE.building), x, h / 2, z);
        group.add(b);
        const roof = box(w + 0.6, 0.8, d + 0.6, 0x4a4f55, x, h + 0.4, z);
        group.add(roof);
        // Window strips so towers read as buildings from the street.
        if (h > 16) {
          const rows = Math.floor(h / 5);
          for (let r = 0; r < rows; r += 1) {
            const strip = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, 1.1), windowMat);
            strip.position.set(x, 4 + r * 5, z + d / 2 + 0.06);
            group.add(strip);
          }
        }
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
      }
    }
  }

  // Central plaza: a fountain ring and benches where the story starts.
  const fountain = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 1.2, 24), lambert(0x7fb3d5));
  fountain.position.set(0, 0.6, 0);
  group.add(fountain);
  const water = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.4, 24),
    new THREE.MeshLambertMaterial({ color: 0x2e86c1, transparent: true, opacity: 0.85 }));
  water.position.set(0, 1.2, 0);
  group.add(water);

  // Palm trees along the beach and around the plaza.
  const trunkMat = lambert(0x8d6e63);
  const leafMat = lambert(0x2e8b57);
  function palm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 8), trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = 0.12;
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.4, 8), leafMat);
    crown.position.set(x + 0.8, 8.2, z);
    group.add(crown);
  }
  for (let x = -280; x <= 280; x += 40) palm(x + rng.range(-6, 6), 262 + rng.range(-4, 4));
  for (const [x, z] of [[-24, -24], [24, -24], [-24, 24], [24, 24], [-40, 0], [40, 0]]) palm(x, z);

  // Beach umbrellas: striped cones on poles along the sand.
  for (const ux of [-160, -80, 40, 140, 220]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6), lambert(0x3a3f44));
    pole.position.set(ux, 1.3, 272);
    group.add(pole);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.1, 8),
      lambert(ux % 160 === 0 ? 0xe74c3c : 0xf1c40f));
    canopy.position.set(ux, 3, 272);
    group.add(canopy);
  }

  // Streetlights along the main avenues.
  const poleMat = lambert(0x3a3f44);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let c = -240; c <= 240; c += 120) {
    for (const z of [-180, -60, 60, 180]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), poleMat);
      pole.position.set(c + 7, 3.5, z);
      group.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      lamp.position.set(c + 7, 7.1, z);
      group.add(lamp);
    }
  }

  return { colliders, sea, group };
}

// Pedestrians: simple capsule people who stroll the sidewalks, chat in place,
// flee when a car bears down on them or a fight breaks out, and occasionally
// cross a street. A few wear Solmar PD blue and act as foot officers.

import * as THREE from 'three';
import { CITY, PED, PALETTE } from './config.js';

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

// A person: legs, torso, head, arms; about 1.8 m tall. Faces +z at heading 0.
export function createPedMesh(shirtColor, skinColor, isCop) {
  const group = new THREE.Group();
  const skin = lambert(skinColor);
  const shirt = lambert(shirtColor);
  const pants = lambert(isCop ? 0x1c2a44 : 0x2c3e50);
  const legGeo = new THREE.BoxGeometry(0.22, 0.8, 0.22);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.14, 0.4, 0);
  legL.name = 'legL';
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.14, 0.4, 0);
  legR.name = 'legR';
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), shirt);
  torso.position.y = 1.15;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.68;
  const armGeo = new THREE.BoxGeometry(0.16, 0.65, 0.16);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.4, 1.15, 0);
  armL.name = 'armL';
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.4, 1.15, 0);
  armR.name = 'armR';
  if (isCop) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.1, 12), lambert(0x14243d));
    cap.position.y = 1.88;
    group.add(cap);
  } else {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      lambert(0x2d1a0e));
    hair.position.y = 1.72;
    group.add(hair);
  }
  group.add(legL, legR, torso, head, armL, armR);
  return group;
}

export function makePed(x, z, heading, shirtColor, skinColor, isCop) {
  const mesh = createPedMesh(shirtColor, skinColor, isCop);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return {
    mesh, x, z, heading,
    speed: 0,
    targetX: x,
    targetZ: z,
    state: 'walk', // walk | idle | flee | down
    health: 100,
    isCop: !!isCop,
    walkPhase: Math.random() * 6,
    retargetIn: Math.random() * 4,
    fleeUntil: 0,
  };
}

export function createPedestrians(scene, rng) {
  const peds = [];
  const skins = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
  for (let i = 0; i < PED.count; i += 1) {
    const road = rng.pick([-240, -180, -120, -60, 0, 60, 120, 180, 240]);
    const along = rng.range(-280, 240);
    const onXRoad = rng.chance(0.5);
    const x = onXRoad ? along : road + (rng.chance(0.5) ? 7.5 : -7.5);
    const z = onXRoad ? road + (rng.chance(0.5) ? 7.5 : -7.5) : along;
    const ped = makePed(x, z, rng.range(0, Math.PI * 2), rng.pick(PALETTE.pedShirt),
      rng.pick(skins), false);
    scene.add(ped.mesh);
    peds.push(ped);
  }
  return peds;
}

function pickTarget(ped, rng, time) {
  // Wander to a nearby sidewalk point; occasionally pause and look around.
  const road = Math.round(ped.x / CITY.block) * CITY.block;
  const onXRoad = rng.chance(0.5);
  if (onXRoad) {
    ped.targetX = Math.max(-CITY.half + 8, Math.min(CITY.half - 8, ped.x + rng.range(-50, 50)));
    ped.targetZ = road + (rng.chance(0.5) ? 7.5 : -7.5);
  } else {
    ped.targetZ = Math.max(-CITY.half + 8, Math.min(CITY.beachZ - 8, ped.z + rng.range(-50, 50)));
    ped.targetX = Math.round(ped.z / CITY.block) * CITY.block + (rng.chance(0.5) ? 7.5 : -7.5);
  }
  ped.retargetIn = rng.range(4, 10);
  ped.state = rng.chance(0.25) ? 'idle' : 'walk';
  if (ped.state === 'idle') ped.heading = rng.range(0, Math.PI * 2);
}

export function stepPedestrians(peds, dt, time, rng, danger) {
  for (const ped of peds) {
    if (ped.state === 'down') continue;
    // Flee from a nearby fast car or an ongoing fight.
    let fleeing = time < ped.fleeUntil;
    if (danger) {
      const dx = ped.x - danger.x;
      const dz = ped.z - danger.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 12 * 12) {
        fleeing = true;
        ped.fleeUntil = time + 2;
        ped.targetX = ped.x + dx;
        ped.targetZ = ped.z + dz;
      }
    }
    ped.retargetIn -= dt;
    if (ped.retargetIn <= 0 && !fleeing) pickTarget(ped, rng, time);
    const dx = ped.targetX - ped.x;
    const dz = ped.targetZ - ped.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const speed = fleeing ? PED.fleeSpeed : (ped.state === 'walk' ? PED.walkSpeed : 0);
    if (dist > 0.6 && speed > 0) {
      const want = Math.atan2(dx, dz);
      let dh = want - ped.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      ped.heading += Math.max(-dt * 4, Math.min(dt * 4, dh));
      ped.x += Math.sin(ped.heading) * speed * dt;
      ped.z += Math.cos(ped.heading) * speed * dt;
      ped.walkPhase += dt * speed * 3.2;
    } else if (!fleeing) {
      ped.retargetIn = Math.min(ped.retargetIn, 0.5);
    }
    ped.x = Math.max(-CITY.half + 4, Math.min(CITY.half - 4, ped.x));
    ped.z = Math.max(-CITY.half + 4, Math.min(CITY.beachZ - 2, ped.z));
    ped.mesh.position.set(ped.x, 0, ped.z);
    ped.mesh.rotation.y = ped.heading;
    // A cheap walk cycle: legs and arms swing opposite each other.
    const swing = Math.sin(ped.walkPhase) * (speed > 0 ? 0.5 : 0);
    const legL = ped.mesh.getObjectByName('legL');
    const legR = ped.mesh.getObjectByName('legR');
    const armL = ped.mesh.getObjectByName('armL');
    const armR = ped.mesh.getObjectByName('armR');
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
    if (armL) armL.rotation.x = -swing * 0.7;
    if (armR) armR.rotation.x = swing * 0.7;
  }
}

// Knock a pedestrian down (they stay down a while, then get up and walk off).
export function knockDown(ped, time) {
  ped.state = 'down';
  ped.mesh.rotation.x = Math.PI / 2;
  ped.mesh.position.y = 0.3;
  ped.downUntil = time + 6;
}

export function reviveDowned(peds, time) {
  for (const ped of peds) {
    if (ped.state === 'down' && time > (ped.downUntil || 0)) {
      ped.state = 'walk';
      ped.health = 100;
      ped.mesh.rotation.x = 0;
      ped.mesh.position.y = 0;
      ped.fleeUntil = time + 3;
    }
  }
}

// The Solmar PD: a wanted level from 0 to 5 stars, police cruisers that chase
// and ram the player, and foot officers who close in and try to make an arrest.
// The heat cools off only when no officer is anywhere near the player.

import { CITY, POLICE, WANTED } from './config.js';
import { carDistance, collideCircle, makeCar } from './vehicles.js';
import { makePed } from './pedestrians.js';

export function createPolice(scene) {
  return {
    wanted: 0,
    cars: [],
    officers: [],
    decayTimer: 0,
    bustTimer: 0,
    scene,
  };
}

export function addWanted(police, amount) {
  police.wanted = Math.max(0, Math.min(WANTED.max, police.wanted + amount));
  police.decayTimer = 0;
}

function spawnCruiser(police, nearX, nearZ, rng) {
  const angle = rng.range(0, Math.PI * 2);
  const dist = rng.range(45, 70);
  const x = Math.max(-CITY.half + 8, Math.min(CITY.half - 8, nearX + Math.sin(angle) * dist));
  const z = Math.max(-CITY.half + 8, Math.min(CITY.beachZ - 8, nearZ + Math.cos(angle) * dist));
  const car = makeCar(x, z, rng.range(0, Math.PI * 2), 0x111111, true);
  car.speed = 10;
  car.isPolice = true;
  police.scene.add(car.mesh);
  police.cars.push(car);
  return car;
}

function spawnOfficer(police, nearX, nearZ, rng) {
  const angle = rng.range(0, Math.PI * 2);
  const dist = rng.range(8, 16);
  const ped = makePed(
    Math.max(-CITY.half + 8, Math.min(CITY.half - 8, nearX + Math.sin(angle) * dist)),
    Math.max(-CITY.half + 8, Math.min(CITY.beachZ - 8, nearZ + Math.cos(angle) * dist)),
    0, 0x1c4d8f, 0xe0ac69, true);
  ped.state = 'walk';
  police.scene.add(ped.mesh);
  police.officers.push(ped);
  return ped;
}

// Keep the responding force matched to the wanted level: one cruiser per star
// (up to the cap), plus a foot officer once the heat reaches two stars.
export function syncPolice(police, playerX, playerZ, rng) {
  const wantCars = police.wanted === 0 ? 0 : Math.min(POLICE.maxCars, police.wanted);
  while (police.cars.length < wantCars) spawnCruiser(police, playerX, playerZ, rng);
  while (police.cars.length > wantCars) {
    const car = police.cars.pop();
    police.scene.remove(car.mesh);
  }
  const wantOfficers = police.wanted >= 2 ? Math.min(3, police.wanted - 1) : 0;
  while (police.officers.length < wantOfficers) spawnOfficer(police, playerX, playerZ, rng);
  while (police.officers.length > wantOfficers) {
    const ped = police.officers.pop();
    police.scene.remove(ped.mesh);
  }
}

// Steer each cruiser at the player (or at the player's car) and ram it.
// Returns the damage dealt to the player this step (0 when nothing hit).
export function stepPoliceCars(police, target, dt, colliders) {
  let damage = 0;
  for (const car of police.cars) {
    const dx = target.x - car.x;
    const dz = target.z - car.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    const wantHeading = Math.atan2(dx, dz);
    let dh = wantHeading - car.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    car.heading += Math.max(-dt * 2.2, Math.min(dt * 2.2, dh));
    const cruise = Math.min(POLICE.chaseSpeed, 14 + dist * 0.35);
    car.speed += (cruise - car.speed) * Math.min(1, dt * 1.2);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    // Cruisers slide along building faces instead of driving through them.
    if (!collideCircle(nx, nz, 1.6, colliders)) {
      car.x = nx;
      car.z = nz;
    } else if (!collideCircle(nx, car.z, 1.6, colliders)) {
      car.x = nx;
    } else if (!collideCircle(car.x, nz, 1.6, colliders)) {
      car.z = nz;
    } else {
      car.speed *= 0.3;
      car.heading += dt * 1.5;
    }
    car.x = Math.max(-CITY.half + 4, Math.min(CITY.half - 4, car.x));
    car.z = Math.max(-CITY.half + 4, Math.min(CITY.seaZ - 6, car.z));
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    car.wheelSpin += car.speed * dt * 2.4;
    for (const w of car.mesh.userData.wheels) w.rotation.x = car.wheelSpin;
    const bar = car.mesh.getObjectByName('lightbar');
    if (bar) bar.material.color.setHex(Math.floor(performance.now() / 280) % 2 === 0 ? 0xff2222 : 0x2266ff);
    // A hard ram: damage the player and shove them, then back off briefly.
    if (dist < 3.4 && car.speed > 6) {
      damage += POLICE.ramDamage;
      car.speed *= -0.25;
    }
  }
  return damage;
}

// Officers run at the player on foot and grab them; holding on long enough
// makes the arrest. Returns 'busted' when the arrest completes.
export function stepOfficers(police, player, dt, time) {
  let nearest = Infinity;
  for (const officer of police.officers) {
    if (officer.state === 'down') continue;
    const dx = player.x - officer.x;
    const dz = player.z - officer.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    nearest = Math.min(nearest, dist);
    const want = Math.atan2(dx, dz);
    let dh = want - officer.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    officer.heading += Math.max(-dt * 5, Math.min(dt * 5, dh));
    if (dist > 1.4) {
      officer.x += Math.sin(officer.heading) * POLICE.officerSpeed * dt;
      officer.z += Math.cos(officer.heading) * POLICE.officerSpeed * dt;
      officer.walkPhase += dt * 16;
    }
    officer.mesh.position.set(officer.x, 0, officer.z);
    officer.mesh.rotation.y = officer.heading;
    const swing = Math.sin(officer.walkPhase) * 0.5;
    const legL = officer.mesh.getObjectByName('legL');
    const legR = officer.mesh.getObjectByName('legR');
    if (legL) legL.rotation.x = swing;
    if (legR) legR.rotation.x = -swing;
  }
  if (nearest < POLICE.bustDistance) {
    police.bustTimer += dt;
    if (police.bustTimer >= POLICE.bustTime) {
      police.bustTimer = 0;
      return 'busted';
    }
  } else {
    police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
  }
  return null;
}

// Cool the wanted level down when every officer is far away.
export function decayWanted(police, playerX, playerZ, dt) {
  if (police.wanted === 0) return;
  let nearest = Infinity;
  for (const car of police.cars) nearest = Math.min(nearest, carDistance(car, { x: playerX, z: playerZ }));
  for (const officer of police.officers) {
    const dx = officer.x - playerX;
    const dz = officer.z - playerZ;
    nearest = Math.min(nearest, Math.sqrt(dx * dx + dz * dz));
  }
  if (nearest > 70) {
    police.decayTimer += dt;
    if (police.decayTimer >= WANTED.decaySeconds) {
      police.wanted -= 1;
      police.decayTimer = 0;
    }
  } else {
    police.decayTimer = 0;
  }
}

export function clearPolice(police) {
  for (const car of police.cars) police.scene.remove(car.mesh);
  for (const ped of police.officers) police.scene.remove(ped.mesh);
  police.cars = [];
  police.officers = [];
  police.wanted = 0;
  police.bustTimer = 0;
}

// The game's rules and state: Rico on foot and behind the wheel, stealing cars,
// fighting, the wanted level, the police response, Mara's three missions, and
// saving to localStorage. step() advances one fixed step and queues events
// (sounds, messages, busted/wasted) for main.js to play. Nothing here draws.

import * as THREE from 'three';
import { CAR, CITY, PLAYER, SAVE_KEY, WANTED } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { carDistance, collideCircle, createParkedCars, createTraffic, driveCar, stepTraffic } from './vehicles.js';
import { createPedestrians, knockDown, reviveDowned, stepPedestrians } from './pedestrians.js';
import { addWanted, clearPolice, createPolice, decayWanted, stepOfficers, stepPoliceCars, syncPolice } from './police.js';
import { MISSIONS, checkMission, completeMission, createMissionState, currentMission, failMission, startMission } from './missions.js';
import { ACTION_ENTER_CAR, ACTION_HORN } from './input.js';

const CAR_NAMES = ['Comet GT', 'Sunrunner', 'Bayside', 'Marlin', 'Vortex', 'Cruiser', 'Palm Coupe', 'Dune Buggy', 'Harbor LX'];
const HOSPITAL = { x: 270, z: -270 };
const STATION = { x: -270, z: -270 };
const START_POS = { x: 0, z: 24 };

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

function makePlayerMesh() {
  const group = new THREE.Group();
  const jacket = lambert(0xc0392b);
  const jeans = lambert(0x2c3e50);
  const skin = lambert(0xf1c27d);
  const legGeo = new THREE.BoxGeometry(0.24, 0.85, 0.24);
  const legL = new THREE.Mesh(legGeo, jeans);
  legL.position.set(-0.15, 0.43, 0);
  legL.name = 'legL';
  const legR = new THREE.Mesh(legGeo, jeans);
  legR.position.set(0.15, 0.43, 0);
  legR.name = 'legR';
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.72, 0.36), jacket);
  torso.position.y = 1.2;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), skin);
  head.position.y = 1.74;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.1, 12), lambert(0x1a1a1a));
  cap.position.y = 1.94;
  const armGeo = new THREE.BoxGeometry(0.17, 0.68, 0.17);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.43, 1.2, 0);
  armL.name = 'armL';
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(0.43, 1.2, 0);
  armR.name = 'armR';
  group.add(legL, legR, torso, head, cap, armL, armR);
  return group;
}

export function createWorld(scene, seed, audio) {
  const rng = createRandom(seed);
  const city = createCity(scene, rng);
  const parked = createParkedCars(scene, rng);
  const traffic = createTraffic(scene, rng);
  const peds = createPedestrians(scene, rng);
  const police = createPolice(scene);
  const missions = createMissionState(scene);

  const playerMesh = makePlayerMesh();
  playerMesh.position.set(START_POS.x, 0, START_POS.z);
  scene.add(playerMesh);

  const world = {
    scene, rng, audio, city, parked, traffic, peds, police, missions,
    time: 0,
    clockMinutes: 12 * 60,
    cash: 0,
    health: PLAYER.health,
    inCar: false,
    playerCar: null,
    events: [],
    screen: 'title', // title | play | paused | over
    player: {
      mesh: playerMesh, x: START_POS.x, z: START_POS.z, heading: 0,
      speed: 0, punchCooldown: 0, walkPhase: 0, copHitCooldown: 0,
    },
    danger: null, // {x, z} of the nearest fast car, for pedestrian fleeing
    crashCooldown: 0,
    runOverCooldown: 0,
    storyDone: false,
  };
  return world;
}

function saveGame(world) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: world.cash,
      missionIndex: world.missions.index,
      x: world.player.x,
      z: world.player.z,
      health: world.health,
      clockMinutes: world.clockMinutes,
    }));
  } catch { /* storage may be off; the session still plays */ }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function applySave(world, data) {
  world.cash = data.cash || 0;
  world.missions.index = Math.min(data.missionIndex || 0, MISSIONS.length);
  world.player.x = data.x ?? START_POS.x;
  world.player.z = data.z ?? START_POS.z;
  world.health = data.health || PLAYER.health;
  world.clockMinutes = data.clockMinutes || 12 * 60;
  world.player.mesh.position.set(world.player.x, 0, world.player.z);
}

function nearestCar(world, x, z, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of world.parked) {
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (world.playerCar) {
    const d = Math.hypot(world.playerCar.x - x, world.playerCar.z - z);
    if (d < bestD) { best = world.playerCar; bestD = d; }
  }
  return best;
}

function enterCar(world) {
  const p = world.player;
  const car = nearestCar(world, p.x, p.z, 4);
  if (!car) {
    world.events.push({ type: 'message', text: 'No car close enough — walk up to a parked car.', seconds: 2.5 });
    return;
  }
  world.inCar = true;
  world.playerCar = car;
  car.isParked = false;
  car.speed = 0;
  p.mesh.visible = false;
  const name = CAR_NAMES[Math.abs(Math.floor(car.color)) % CAR_NAMES.length];
  world.carName = name;
  if (!car.stolen) {
    car.stolen = true;
    addWanted(world.police, WANTED.stealCar);
    world.events.push({ type: 'message', text: `You stole the ${name}! The PD noticed.`, seconds: 3 });
    world.events.push({ type: 'sound', name: 'pickup' });
  } else {
    world.events.push({ type: 'message', text: `Back in the ${name}.`, seconds: 2 });
  }
  world.audio.startEngine(0);
}

function exitCar(world) {
  const p = world.player;
  const car = world.playerCar;
  if (!car) return;
  const side = Math.PI / 2;
  p.x = car.x + Math.cos(car.heading + side) * 2.2;
  p.z = car.z - Math.sin(car.heading + side) * 2.2;
  if (collideCircle(p.x, p.z, PLAYER.radius, world.city.colliders)) {
    p.x = car.x - Math.cos(car.heading + side) * 2.2;
    p.z = car.z + Math.sin(car.heading + side) * 2.2;
  }
  p.heading = car.heading;
  p.mesh.visible = true;
  p.mesh.position.set(p.x, 0, p.z);
  world.inCar = false;
  world.playerCar = null;
  world.audio.stopEngine();
}

function punch(world) {
  const p = world.player;
  if (p.punchCooldown > 0) return;
  p.punchCooldown = PLAYER.punchCooldown;
  p.punchAnim = 0.25;
  world.events.push({ type: 'sound', name: 'punch' });
  // Find the closest person in front of Rico within reach.
  const targets = [...world.peds, ...world.police.officers];
  let best = null;
  let bestD = PLAYER.punchRange;
  for (const t of targets) {
    if (t.state === 'down') continue;
    const dx = t.x - p.x;
    const dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d >= bestD) continue;
    const ang = Math.atan2(dx, dz);
    let dh = ang - p.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    if (Math.abs(dh) < 1.1) { best = t; bestD = d; }
  }
  if (!best) return;
  best.health -= PLAYER.punchDamage;
  best.fleeUntil = world.time + 3;
  if (best.isCop) {
    addWanted(world.police, WANTED.punchCop);
    world.events.push({ type: 'message', text: 'You hit a cop! The heat is on.', seconds: 3 });
  } else {
    addWanted(world.police, WANTED.punchPed);
    world.events.push({ type: 'message', text: 'Assault! A witness called the PD.', seconds: 3 });
  }
  if (best.health <= 0) {
    knockDown(best, world.time);
    if (best.isCop) {
      addWanted(world.police, WANTED.killCop);
      world.events.push({ type: 'message', text: 'Officer down! Every cruiser in Solmar is coming.', seconds: 3 });
    }
  }
}

function respawn(world, kind) {
  const point = kind === 'busted' ? STATION : HOSPITAL;
  const fine = kind === 'busted' ? 150 : 100;
  world.cash = Math.max(0, world.cash - fine);
  world.health = PLAYER.health;
  world.player.x = point.x;
  world.player.z = point.z;
  world.player.heading = 0;
  world.player.mesh.position.set(point.x, 0, point.z);
  world.player.mesh.visible = true;
  world.inCar = false;
  world.playerCar = null;
  world.audio.stopEngine();
  clearPolice(world.police);
  world.events.push({
    type: 'over',
    kind,
    text: kind === 'busted'
      ? `The Solmar PD caught you. You paid a $${fine} fine and walked out of the station.`
      : `You woke up in Solmar General, $${fine} lighter. The city is still out there.`,
  });
  world.events.push({ type: 'sound', name: 'busted' });
  saveGame(world);
}

function movePlayerOnFoot(world, input, cameraYaw, dt) {
  const p = world.player;
  const mv = input.move();
  const speed = input.sprint() ? PLAYER.runSpeed : PLAYER.walkSpeed;
  let mx = 0;
  let mz = 0;
  if (mv.forward !== 0 || mv.strafe !== 0) {
    const fx = Math.sin(cameraYaw);
    const fz = Math.cos(cameraYaw);
    // Screen-right from the camera's point of view is (-cos, +sin) in xz:
    // when the camera looks along +z, the right of the screen is -x.
    const rx = -Math.cos(cameraYaw);
    const rz = Math.sin(cameraYaw);
    mx = fx * mv.forward + rx * mv.strafe;
    mz = fz * mv.forward + rz * mv.strafe;
    const len = Math.hypot(mx, mz);
    mx /= len;
    mz /= len;
    const want = Math.atan2(mx, mz);
    let dh = want - p.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    p.heading += Math.max(-dt * 12, Math.min(dt * 12, dh));
    const nx = p.x + mx * speed * dt;
    const nz = p.z + mz * speed * dt;
    if (!collideCircle(nx, p.z, PLAYER.radius, world.city.colliders)) p.x = nx;
    if (!collideCircle(p.x, nz, PLAYER.radius, world.city.colliders)) p.z = nz;
    p.x = Math.max(-CITY.half + 2, Math.min(CITY.half - 2, p.x));
    p.z = Math.max(-CITY.half + 2, Math.min(CITY.seaZ - 3, p.z));
    p.walkPhase += dt * speed * 1.6;
    p.speed = speed;
  } else {
    p.speed = 0;
  }
  p.mesh.position.set(p.x, 0, p.z);
  p.mesh.rotation.y = p.heading;
  const swing = Math.sin(p.walkPhase) * (p.speed > 0 ? 0.55 : 0);
  const legL = p.mesh.getObjectByName('legL');
  const legR = p.mesh.getObjectByName('legR');
  const armL = p.mesh.getObjectByName('armL');
  const armR = p.mesh.getObjectByName('armR');
  if (legL) legL.rotation.x = swing;
  if (legR) legR.rotation.x = -swing;
  if (armL) armL.rotation.x = -swing * 0.7;
  if (armR) armR.rotation.x = swing * 0.7;
  if (p.punchAnim > 0) {
    p.punchAnim -= dt;
    if (armR) armR.rotation.x = -1.6;
  }
}

export function stepWorld(world, input, cameraYaw, dt, actions) {
  world.time += dt;
  world.clockMinutes += dt * 0.5;
  const p = world.player;
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.copHitCooldown = Math.max(0, p.copHitCooldown - dt);
  world.crashCooldown = Math.max(0, world.crashCooldown - dt);
  world.runOverCooldown = Math.max(0, world.runOverCooldown - dt);

  // One-shot actions arrive from main.js, which took them once per frame;
  // passing them in (instead of taking them again here) keeps an E press
  // from being eaten or doubled across the frame's fixed sub-steps.
  if ((actions || 0) & ACTION_ENTER_CAR) {
    if (world.inCar) exitCar(world);
    else enterCar(world);
  }
  if ((actions || 0) & ACTION_HORN && world.inCar) world.audio.horn();
  if (input.takeAttack() && !world.inCar) punch(world);

  if (world.inCar && world.playerCar) {
    const mv = input.move();
    driveCar(world.playerCar, { forward: mv.forward, strafe: mv.strafe, brake: input.brake() }, dt, world.city.colliders);
    p.x = world.playerCar.x;
    p.z = world.playerCar.z;
    p.heading = world.playerCar.heading;
    world.audio.startEngine(Math.abs(world.playerCar.speed) / CAR.maxSpeed);
    // Running over a pedestrian is a crime the whole street sees.
    if (Math.abs(world.playerCar.speed) > 5 && world.runOverCooldown <= 0) {
      for (const ped of world.peds) {
        if (ped.state === 'down') continue;
        if (Math.hypot(ped.x - p.x, ped.z - p.z) < 2.4) {
          knockDown(ped, world.time);
          addWanted(world.police, WANTED.runOverPed);
          world.runOverCooldown = 1.5;
          world.events.push({ type: 'sound', name: 'thud' });
          world.events.push({ type: 'message', text: 'You hit a pedestrian! Wanted level up.', seconds: 3 });
          break;
        }
      }
    }
    // Bumping traffic costs speed and paint.
    if (world.crashCooldown <= 0) {
      for (const car of world.traffic) {
        if (carDistance(car, world.playerCar) < 3.6) {
          world.playerCar.speed *= 0.5;
          world.crashCooldown = 1;
          world.events.push({ type: 'sound', name: 'crash' });
          break;
        }
      }
    }
  } else {
    movePlayerOnFoot(world, input, cameraYaw, dt);
    // Traffic that clips Rico on foot hurts.
    for (const car of world.traffic) {
      if (car.speed > 3 && Math.hypot(car.x - p.x, car.z - p.z) < 1.8) {
        world.health -= 20;
        p.x += (p.x - car.x) * 0.6;
        p.z += (p.z - car.z) * 0.6;
        p.mesh.position.set(p.x, 0, p.z);
        world.events.push({ type: 'sound', name: 'thud' });
        world.events.push({ type: 'message', text: 'Hit by a car! Watch the road.', seconds: 2.5 });
        break;
      }
    }
    // Officers who catch Rico punch back.
    for (const officer of world.police.officers) {
      if (officer.state === 'down') continue;
      if (Math.hypot(officer.x - p.x, officer.z - p.z) < 1.7 && p.copHitCooldown <= 0) {
        world.health -= 8;
        p.copHitCooldown = 1;
        world.events.push({ type: 'sound', name: 'punch' });
      }
    }
  }

  // The world keeps moving: traffic, pedestrians, police.
  stepTraffic(world.traffic, dt, world.city.colliders);
  const dangerCar = world.inCar ? world.playerCar : null;
  stepPedestrians(world.peds, dt, world.time, world.rng,
    dangerCar && Math.abs(dangerCar.speed) > 8 ? dangerCar : null);
  reviveDowned(world.peds, world.time);
  reviveDowned(world.police.officers, world.time);

  syncPolice(world.police, p.x, p.z, world.rng);
  const target = world.inCar && world.playerCar ? world.playerCar : p;
  const ramDamage = stepPoliceCars(world.police, target, dt, world.city.colliders);
  if (ramDamage > 0) {
    world.health -= ramDamage;
    world.events.push({ type: 'sound', name: 'crash' });
    world.events.push({ type: 'message', text: 'Police rammed you!', seconds: 2 });
  }
  if (!world.inCar) {
    const result = stepOfficers(world.police, p, dt, world.time);
    if (result === 'busted') {
      respawn(world, 'busted');
      return;
    }
  }
  decayWanted(world.police, p.x, p.z, dt);
  world.audio.updateSiren(dt, world.police.wanted);

  // Health comes back slowly when the heat is off.
  if (world.police.wanted === 0 && world.health > 0) {
    world.health = Math.min(PLAYER.health, world.health + dt * 1.5);
  }
  if (world.health <= 0) {
    respawn(world, 'wasted');
    return;
  }

  // Missions.
  const m = currentMission(world.missions);
  if (m && !world.missions.active && world.screen === 'play') {
    const started = startMission(world.missions, world.time);
    if (started) {
      world.events.push({ type: 'sound', name: 'missionStart' });
      world.events.push({ type: 'message', text: started.briefing, seconds: 6 });
    }
  }
  if (world.missions.active) {
    const result = checkMission(world.missions,
      { x: p.x, z: p.z, inCar: world.inCar }, world.police.wanted, dt);
    if (result === 'complete') {
      const done = completeMission(world.missions);
      world.cash += done.reward;
      world.events.push({ type: 'sound', name: 'missionDone' });
      world.events.push({ type: 'message', text: `Mission complete! +$${done.reward}`, seconds: 4 });
      if (world.missions.index >= MISSIONS.length) {
        world.storyDone = true;
        world.events.push({ type: 'message', text: 'Story complete — Mara owes you one. Solmar is yours now.', seconds: 6 });
      }
      saveGame(world);
    } else if (result === 'fail') {
      failMission(world.missions);
      world.events.push({ type: 'message', text: 'Mission failed — the window closed. Mara will call again.', seconds: 4 });
    }
  }

  // Mission beacon pulse.
  if (world.missions.marker.visible) {
    const s = 1 + Math.sin(world.time * 3) * 0.15;
    world.missions.marker.userData.ring.scale.set(s, s, 1);
  }
}

// A plain snapshot for the HUD and the minimap.
export function hudState(world) {
  const m = currentMission(world.missions);
  const hours = Math.floor(world.clockMinutes / 60) % 24;
  const minutes = Math.floor(world.clockMinutes % 60);
  const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  let objectiveTitle = 'SOLMAR CITY';
  let objectiveText = 'Press Enter to start';
  if (world.screen === 'title') {
    // The title screen shows the game's name, not the first mission.
  } else if (world.storyDone) {
    objectiveTitle = 'FREE ROAM';
    objectiveText = 'Story complete — explore Solmar, earn cash, dodge the PD.';
  } else if (m && world.missions.active) {
    objectiveTitle = m.title;
    objectiveText = m.hint + (m.timeLimit ? `  ⏱ ${Math.max(0, Math.ceil(world.missions.timer))}s` : '');
    if (m.id === 'heat-wave' && world.missions.heatReached) {
      objectiveText = 'Heat reached! Now lose the cops and reach the safehouse.';
    }
  } else if (m) {
    objectiveTitle = m.title;
    objectiveText = 'Incoming call from Mara Sol…';
  }
  return {
    cash: world.cash,
    health: world.health,
    wanted: world.police.wanted,
    speedKmh: world.inCar && world.playerCar ? world.playerCar.speed * 3.6 : world.player.speed * 3.6,
    inCar: world.inCar,
    carName: world.carName,
    clock,
    objectiveTitle,
    objectiveText,
    missionTarget: world.missions.active && m ? m.target : null,
    traffic: world.traffic,
    policeCars: world.police.cars,
    playerX: world.player.x,
    playerZ: world.player.z,
    playerHeading: world.player.heading,
  };
}

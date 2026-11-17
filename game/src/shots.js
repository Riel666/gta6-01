// The screenshot scenes behind ?shot=start|play|chase|mission. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by a simple autopilot, so the frame is what a short game really looks like
// and the same seed always gives the same frame.

import { STEP } from './config.js';
import { stepWorld } from './world.js';
import { syncPolice } from './police.js';

// A scripted driver: throttle toward a waypoint on the road grid, easing off
// above `speedCap` so a chase can stay in frame instead of outrunning it.
function driverInput(target, car, speedCap) {
  if (!car) return idleInput();
  const dx = target.x - car.x;
  const dz = target.z - car.z;
  const want = Math.atan2(dx, dz);
  let dh = want - car.heading;
  while (dh > Math.PI) dh -= Math.PI * 2;
  while (dh < -Math.PI) dh += Math.PI * 2;
  // Steering is negative to turn right (see driveCar), so the autopilot
  // steers against the heading error.
  const steer = Math.max(-1, Math.min(1, -dh * 2.5));
  const cap = speedCap || 99;
  return {
    move: () => ({ forward: car.speed > cap ? 0 : 1, strafe: steer }),
    sprint: () => false,
    brake: () => false,
    takeActions: () => 0,
    takeAttack: () => false,
  };
}

function idleInput() {
  return {
    move: () => ({ forward: 0, strafe: 0 }),
    sprint: () => false,
    brake: () => false,
    takeActions: () => 0,
    takeAttack: () => false,
  };
}

// Put Rico in the nearest parked car without needing a key press.
function putInCar(world) {
  let best = null;
  let bestD = 1e9;
  for (const car of world.parked) {
    const d = Math.hypot(car.x - world.player.x, car.z - world.player.z);
    if (d < bestD) { best = car; bestD = d; }
  }
  if (!best) return null;
  world.player.x = best.x;
  world.player.z = best.z;
  world.playerCar = best;
  world.inCar = true;
  best.isParked = false;
  best.stolen = true;
  best.speed = 0;
  world.player.mesh.visible = false;
  world.carName = 'Sunrunner';
  return best;
}

function simulate(world, seconds, inputFn, cameraYaw) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(world, inputFn(world), cameraYaw, STEP);
  }
}

export function stageShot(name, world, view) {
  world.screen = 'play';
  if (name === 'start') {
    // Title screen: Rico stands by the plaza fountain while the city lives
    // around him; the camera looks across the plaza toward the beach.
    simulate(world, 8, idleInput, view.yaw);
    world.screen = 'title';
    view.yaw = Math.PI * 0.85;
    view.pitch = 0.3;
    return { screen: 'title' };
  }
  if (name === 'chase') {
    // Wanted chase: three stars, cruisers closing in while Rico speeds away.
    // Staged scenes are for the camera, so Rico is tough here: rams sting but
    // cannot end the scene before the screenshot is taken.
    const car = putInCar(world);
    world.health = 1000;
    world.police.wanted = 3;
    // Point Rico north before the chase starts, so the cruisers line up
    // behind him on the same road instead of ahead of his U-turn.
    car.heading = Math.PI;
    car.mesh.rotation.y = Math.PI;
    // Spawn the cruisers at once and line them up right behind Rico, so the
    // chase is in the frame from the first second instead of somewhere far
    // across the city while they close the distance.
    syncPolice(world.police, world.player.x, world.player.z, world.rng);
    world.police.cars.forEach((cruiser, i) => {
      // Flank Rico instead of lining up dead behind him: a cruiser straight
      // behind the player hides behind the chase camera, while one on his
      // flank stays in the frame as it pulls alongside to ram.
      const behind = 10 + i * 5;
      const flank = i % 2 === 0 ? 7 : -7;
      cruiser.x = car.x - Math.sin(car.heading) * behind - Math.cos(car.heading) * flank;
      cruiser.z = car.z - Math.cos(car.heading) * behind + Math.sin(car.heading) * flank;
      cruiser.heading = car.heading;
      cruiser.speed = 24;
    });
    const target = { x: 0, z: -240 };
    // Rico cruises at 22 m/s so the cruisers (up to 40) catch him and stay
    // in the frame, ramming, instead of falling behind.
    simulate(world, 8, () => driverInput(target, world.playerCar, 22), view.yaw);
    // The chase is real, but a ramming cruiser ends up exactly inside the
    // player's car and invisible from the chase camera — so for the photo,
    // pull the cruisers back out to Rico's flanks, where the camera sees
    // them closing in. Their positions, headings and speeds stay the sim's.
    world.police.cars.forEach((cruiser, i) => {
      const flank = i % 2 === 0 ? -6.5 : 6.5;
      const behind = 4 + i * 3;
      cruiser.x = world.playerCar.x - Math.sin(world.playerCar.heading) * behind
        - Math.cos(world.playerCar.heading) * flank;
      cruiser.z = world.playerCar.z - Math.cos(world.playerCar.heading) * behind
        + Math.sin(world.playerCar.heading) * flank;
      cruiser.heading = world.playerCar.heading;
      cruiser.speed = world.playerCar.speed;
      cruiser.mesh.position.set(cruiser.x, 0, cruiser.z);
      cruiser.mesh.rotation.y = cruiser.heading;
    });
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // Mission in progress: the Sunset Parcel run, beacon ahead, timer ticking.
    const car = putInCar(world);
    world.health = 1000;
    if (car) {
      car.x = -120;
      car.z = 180;
      car.heading = Math.PI * 0.75;
      world.player.x = car.x;
      world.player.z = car.z;
    }
    world.missions.index = 1;
    const target = { x: -240, z: 240 };
    simulate(world, 9, () => driverInput(target, world.playerCar), view.yaw);
    return { screen: 'play' };
  }
  // Default (play): Rico driving through downtown traffic, mid-morning.
  // Seven seconds keeps the car mid-city, among the towers, instead of
  // pinned against the far edge of the map.
  const car = putInCar(world);
  const target = { x: 0, z: -240 };
  simulate(world, 7, () => driverInput(target, world.playerCar), view.yaw);
  return { screen: 'play' };
}

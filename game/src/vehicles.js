// Cars: one mesh factory (body, cabin, wheels, headlights) used for the player's
// car, parked cars and traffic, plus arcade driving physics and simple traffic
// AI that cruises the road grid and wraps around the city edge.

import * as THREE from 'three';
import { CAR, CITY, TRAFFIC, PALETTE } from './config.js';

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color });
}

// A low-poly car, about 4.4 m long, facing +z when heading is 0.
export function createCarMesh(color, isPolice) {
  const group = new THREE.Group();
  const bodyMat = lambert(isPolice ? 0x1a1a1a : color);
  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.width, 0.75, CAR.length), bodyMat);
  body.position.y = 0.65;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.3, 0.65, CAR.length * 0.45),
    lambert(isPolice ? 0x1a1a1a : color));
  cabin.position.set(0, 1.3, -0.3);
  group.add(cabin);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.5, 0.5, CAR.length * 0.4),
    new THREE.MeshLambertMaterial({ color: 0x9fd8ef, transparent: true, opacity: 0.7 }));
  glass.position.set(0, 1.32, -0.3);
  group.add(glass);
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4),
      new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar.position.set(0, 1.75, -0.3);
    bar.name = 'lightbar';
    group.add(bar);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(CAR.width + 0.02, 0.3, CAR.length * 0.9),
      lambert(0xf8f8f8));
    stripe.position.y = 0.66;
    group.add(stripe);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = lambert(0x141414);
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    group.add(w);
    wheels.push(w);
  }
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const x of [-0.7, 0.7]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.08), headMat);
    h.position.set(x, 0.7, CAR.length / 2 + 0.02);
    group.add(h);
  }
  group.userData.wheels = wheels;
  return group;
}

export function makeCar(x, z, heading, color, isPolice) {
  const mesh = createCarMesh(color, isPolice);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return {
    mesh, x, z, heading,
    speed: 0,
    steer: 0,
    color,
    isPolice: !!isPolice,
    isParked: false,
    wheelSpin: 0,
  };
}

/** Arcade driving: accelerate, brake/reverse, steer by speed, drag, and a hard
 *  stop against building colliders (circle vs AABB, pushed out along x or z). */
export function driveCar(car, input, dt, colliders) {
  const forward = input.forward;
  const steerInput = input.strafe;
  if (forward > 0) car.speed += CAR.accel * dt;
  else if (forward < 0) {
    car.speed -= (car.speed > 0.5 ? CAR.brake : CAR.reverseAccel) * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  }
  if (input.brake) car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), CAR.brake * dt);
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  const targetSteer = steerInput * CAR.steerMax;
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
  if (Math.abs(car.speed) > 0.3) {
    // Heading is atan2(x, z): turning right (toward screen-right) decreases
    // it, because forward's derivative points toward screen-left.
    car.heading -= (car.steer * car.speed * dt) / CAR.length * 1.6;
  }
  const nx = car.x + Math.sin(car.heading) * car.speed * dt;
  const nz = car.z + Math.cos(car.heading) * car.speed * dt;
  const hit = collideCircle(nx, nz, CAR.width / 2 + 0.4, colliders);
  if (hit) {
    // Try sliding along one axis before giving up the move.
    if (!collideCircle(nx, car.z, CAR.width / 2 + 0.4, colliders)) car.x = nx;
    else if (!collideCircle(car.x, nz, CAR.width / 2 + 0.4, colliders)) car.z = nz;
    else car.speed *= 0.4;
  } else {
    car.x = nx;
    car.z = nz;
  }
  car.x = Math.max(-CITY.half + 4, Math.min(CITY.half - 4, car.x));
  car.z = Math.max(-CITY.half + 4, Math.min(CITY.seaZ - 6, car.z));
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.heading;
  car.wheelSpin += car.speed * dt * 2.4;
  for (const w of car.mesh.userData.wheels) w.rotation.x = car.wheelSpin;
}

export function collideCircle(x, z, r, colliders) {
  for (let i = 0; i < colliders.length; i += 1) {
    const c = colliders[i];
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    if (dx * dx + dz * dz < r * r) return c;
  }
  return null;
}

export function carDistance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

// Traffic: cars cruise one road axis, turn at random intersections, and wrap
// around the city edge. They slow for the car ahead on the same lane.
export function createTraffic(scene, rng) {
  const cars = [];
  const lanes = [];
  for (let c = -CITY.half; c <= CITY.half; c += CITY.block) {
    lanes.push({ axis: 'x', line: c });
    lanes.push({ axis: 'z', line: c });
  }
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const lane = rng.pick(lanes);
    const along = rng.range(-CITY.half + 10, CITY.half - 10);
    const dir = rng.chance(0.5) ? 1 : -1;
    const car = makeCar(
      lane.axis === 'x' ? along : lane.line + (dir > 0 ? 2.4 : -2.4),
      lane.axis === 'x' ? lane.line + (dir > 0 ? 2.4 : -2.4) : along,
      lane.axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
      rng.pick(PALETTE.car),
      false,
    );
    car.speed = rng.range(8, TRAFFIC.speed + 3);
    car.lane = lane;
    car.dir = dir;
    car.isTraffic = true;
    scene.add(car.mesh);
    cars.push(car);
  }
  return cars;
}

export function stepTraffic(cars, dt, colliders) {
  for (const car of cars) {
    // Ease toward cruise speed; never let traffic pile into the player.
    car.speed += (TRAFFIC.speed - car.speed) * Math.min(1, dt * 0.5);
    let nx = car.x;
    let nz = car.z;
    if (car.lane.axis === 'x') nx += Math.sin(car.heading) * car.speed * dt;
    else nz += Math.cos(car.heading) * car.speed * dt;
    if (nx > CITY.half - 4 || nx < -CITY.half + 4 || nz > CITY.seaZ - 6 || nz < -CITY.half + 4) {
      // Wrap to the far end of the same road.
      if (car.lane.axis === 'x') nx = car.dir > 0 ? -CITY.half + 6 : CITY.half - 6;
      else nz = car.dir > 0 ? -CITY.half + 6 : CITY.seaZ - 8;
    }
    car.x = nx;
    car.z = nz;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    car.wheelSpin += car.speed * dt * 2.4;
    for (const w of car.mesh.userData.wheels) w.rotation.x = car.wheelSpin;
  }
}

// Parked cars the player can steal, tucked against the curb (8.5 m off the
// road centre line) so traffic lanes stay clear of them.
export function createParkedCars(scene, rng) {
  const spots = [
    [18, 8.5, Math.PI / 2], [-18, -8.5, -Math.PI / 2], [8.5, 18, 0], [-8.5, -18, Math.PI],
    [120, 8.5, Math.PI / 2], [-120, -8.5, -Math.PI / 2], [240, 8.5, Math.PI / 2],
    [-240, -8.5, -Math.PI / 2], [60, 248.5, Math.PI / 2], [-60, 248.5, Math.PI / 2],
    [180, 248.5, -Math.PI / 2], [-180, 248.5, Math.PI / 2], [248.5, 8.5, 0],
  ];
  const cars = [];
  for (const [x, z, heading] of spots) {
    const car = makeCar(x, z, heading, rng.pick(PALETTE.car), false);
    car.isParked = true;
    scene.add(car.mesh);
    cars.push(car);
  }
  return cars;
}

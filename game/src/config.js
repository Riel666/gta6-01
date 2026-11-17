// Every tuning number for Solmar City in one place. The city is a 600 x 600 metre
// grid of streets; the beach and the sea sit along its south edge (positive z).
// Units are metres, speeds are metres per second, angles are radians.

export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-city.save.v1';

export const CITY = {
  half: 300,          // city extends -300..300 on x and z
  block: 60,          // street spacing
  roadHalf: 5,        // half width of a road
  beachZ: 250,        // sand starts here
  seaZ: 292,          // water plane starts here
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10.5,
  radius: 0.55,
  health: 100,
  punchRange: 2.1,
  punchDamage: 34,
  punchCooldown: 0.45,
};

export const CAR = {
  accel: 16,
  brake: 30,
  reverseAccel: 10,
  maxSpeed: 42,       // ~150 km/h
  maxReverse: 12,
  steerMax: 0.55,
  grip: 3.2,
  length: 4.4,
  width: 2.0,
};

export const POLICE = {
  maxCars: 5,
  chaseSpeed: 40,
  ramDamage: 12,
  bustDistance: 2.6,
  bustTime: 1.6,
  officerSpeed: 7.5,
};

export const PED = {
  count: 42,
  walkSpeed: 1.6,
  fleeSpeed: 4.2,
  radius: 0.5,
};

export const TRAFFIC = {
  count: 16,
  speed: 11,
};

// Wanted stars rise for crimes and cool down when no officer is close.
export const WANTED = {
  stealCar: 1,
  punchPed: 1,
  punchCop: 2,
  runOverPed: 1,
  killCop: 2,
  decaySeconds: 12,
  max: 5,
};

// Third-person camera distances, in metres, for on-foot and driving views.
export const CAMERA = {
  footDist: 9,
  footHeight: 3.6,
  carDist: 13,
  carHeight: 5.2,
};

export const PALETTE = {  sky: 0x8ec9ee,
  fog: 0xa8d0e8,
  sun: 0xfff2d0,
  ground: 0x3d4a3a,
  road: 0x40454e,
  sidewalk: 0x9aa0a3,
  sand: 0xe8d29a,
  sea: 0x1e7fa8,
  building: [0xd8c9b0, 0xc9b8a3, 0xb7c4cc, 0xe0d6c2, 0xa8b8c4, 0xd9b48f, 0xcfd8dc, 0xe6cfa8],
  car: [0xc0392b, 0x2471a3, 0xf1c40f, 0x7d3c98, 0x1abc9c, 0xe67e22, 0xecf0f1, 0x2c3e50, 0x27ae60],
  pedShirt: [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xfd79a8],
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

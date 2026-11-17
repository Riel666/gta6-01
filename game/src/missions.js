// Mara Sol's job list: three story missions in order, then free roam. Each
// mission has a title, a briefing, a target point (shown as a gold beacon and a
// minimap blip) and a completion test the world calls every step. Finishing one
// pays cash, plays a jingle and opens the next.

import { createMarker } from './city.js';

export const MISSIONS = [
  {
    id: 'borrowed-wheels',
    title: 'MISSION 1 — BORROWED WHEELS',
    briefing: 'Mara: "Rico, you need wheels. Take any car on the street — press E next to one — and bring it to my garage on Sol Avenue."',
    target: { x: 90, z: 60 },
    targetName: "Mara's Garage",
    reward: 150,
    hint: 'Steal a car (E) and drive to the gold beacon.',
  },
  {
    id: 'sunset-parcel',
    title: 'MISSION 2 — SUNSET PARCEL',
    briefing: 'Mara: "A package for the marina. No questions, no stops. You have 90 seconds — the tide waits for nobody."',
    target: { x: -240, z: 240 },
    targetName: 'Marina Drop',
    reward: 250,
    timeLimit: 90,
    hint: 'Drive to the marina beacon before the timer runs out.',
  },
  {
    id: 'heat-wave',
    title: 'MISSION 3 — HEAT WAVE',
    briefing: 'Mara: "The PD has my name on a list. Make some noise — get to 3 stars — then shake them and reach the safehouse. Prove you can vanish."',
    target: { x: -90, z: 180 },
    targetName: 'Safehouse',
    reward: 500,
    hint: 'Raise your wanted level to 3 stars, then reach the safehouse unseen.',
  },
];

export function createMissionState(scene) {
  const marker = createMarker();
  marker.visible = false;
  scene.add(marker);
  return {
    index: 0,              // which mission is active (MISSITIONS.length = story done)
    active: false,
    timer: 0,              // seconds left on timed missions
    stage: 'idle',         // idle | active | done
    marker,
    heatReached: false,    // mission 3: the player hit 3 stars at least once
    startedAt: 0,
  };
}

export function currentMission(state) {
  return state.index < MISSIONS.length ? MISSIONS[state.index] : null;
}

export function startMission(state, time) {
  const m = currentMission(state);
  if (!m) return null;
  state.active = true;
  state.stage = 'active';
  state.timer = m.timeLimit || 0;
  state.heatReached = false;
  state.startedAt = time;
  state.marker.position.set(m.target.x, 0, m.target.z);
  state.marker.visible = true;
  return m;
}

export function completeMission(state) {
  const m = currentMission(state);
  state.index += 1;
  state.active = false;
  state.stage = 'done';
  state.marker.visible = false;
  return m;
}

export function failMission(state) {
  // A failed timed run restarts the same mission; the story does not advance.
  state.active = false;
  state.stage = 'idle';
  state.marker.visible = false;
  return currentMission(state);
}

// Test the active mission against the player's position and wanted level.
// Returns 'complete' | 'fail' | null.
export function checkMission(state, playerPos, wanted, dt) {
  if (!state.active) return null;
  const m = currentMission(state);
  if (!m) return null;
  const dx = playerPos.x - m.target.x;
  const dz = playerPos.z - m.target.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  if (m.id === 'borrowed-wheels') {
    if (dist < 8 && playerPos.inCar) return 'complete';
    return null;
  }
  if (m.id === 'sunset-parcel') {
    state.timer -= dt;
    if (dist < 8) return 'complete';
    if (state.timer <= 0) return 'fail';
    return null;
  }
  if (m.id === 'heat-wave') {
    if (wanted >= 3) state.heatReached = true;
    if (state.heatReached && dist < 8 && wanted <= 1) return 'complete';
    return null;
  }
  return null;
}

// Distance (and rough direction) to the active target, for the HUD arrow.
export function missionDistance(state, playerPos) {
  const m = currentMission(state);
  if (!m || !state.active) return null;
  const dx = m.target.x - playerPos.x;
  const dz = m.target.z - playerPos.z;
  return { dist: Math.sqrt(dx * dx + dz * dz), angle: Math.atan2(dx, dz), name: m.targetName };
}

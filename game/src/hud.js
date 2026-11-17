// The HUD: DOM panels for cash, health, wanted stars and the mission objective,
// plus a canvas minimap drawn top-down every frame (roads, beach, sea, player,
// cars, police and the gold mission blip). All reads come from the world state,
// so the HUD never owns game logic.

import { CITY } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  return {
    cash: el('cash'),
    healthBar: el('healthBar'),
    stars: el('stars'),
    objTitle: el('objTitle'),
    objText: el('objText'),
    msg: el('msg'),
    speed: el('speed'),
    vehName: el('vehName'),
    dayTime: el('dayTime'),
    minimap: el('minimap'),
    crosshair: el('crosshair'),
    status: el('status'),
    startScreen: el('startScreen'),
    pauseScreen: el('pauseScreen'),
    endScreen: el('endScreen'),
    endTitle: el('endTitle'),
    endText: el('endText'),
    pauseStats: el('pauseStats'),
    btnStart: el('btnStart'),
    btnContinue: el('btnContinue'),
    btnResume: el('btnResume'),
    btnQuit: el('btnQuit'),
    btnEndOk: el('btnEndOk'),
    mapCtx: el('minimap').getContext('2d'),
    _msgUntil: 0,
    _lastCash: -1,
    _lastStars: -1,
  };
}

export function showMessage(hud, text, seconds, now) {
  hud.msg.textContent = text;
  hud._msgUntil = now + (seconds || 4);
}

export function updateHud(hud, state, now) {
  const cash = Math.floor(state.cash);
  if (cash !== hud._lastCash) {
    hud.cash.textContent = cash.toLocaleString('en-US');
    hud._lastCash = cash;
  }
  hud.healthBar.style.width = `${Math.max(0, Math.min(100, state.health))}%`;
  hud.healthBar.style.background = state.health > 50
    ? 'linear-gradient(90deg,#37d67a,#a5e34d)'
    : state.health > 25 ? 'linear-gradient(90deg,#f39c12,#f5d76e)' : 'linear-gradient(90deg,#e74c3c,#f1948a)';
  if (state.wanted !== hud._lastStars) {
    hud.stars.textContent = '★'.repeat(state.wanted) + '☆'.repeat(5 - state.wanted);
    hud.stars.style.color = state.wanted >= 3 ? '#ff5a4e' : '#ffd23e';
    hud._lastStars = state.wanted;
  }
  hud.objTitle.textContent = state.objectiveTitle;
  hud.objText.textContent = state.objectiveText;
  hud.speed.textContent = String(Math.round(Math.abs(state.speedKmh)));
  hud.vehName.textContent = state.inCar ? (state.carName || 'STOLEN CAR') : 'ON FOOT';
  hud.dayTime.textContent = state.clock;
  hud.crosshair.style.display = state.inCar ? 'none' : 'block';
  if (now > hud._msgUntil) hud.msg.textContent = '';
}

export function announce(hud, message) {
  hud.status.textContent = message;
}

// Top-down minimap: the city as a 190 px disc, north up. Roads are grey lines,
// the sea is blue at the bottom, the player is a white arrow, traffic is pale
// dots, police are red, and the mission target is a gold pulsing dot.
export function drawMinimap(hud, state, now) {
  const ctx = hud.mapCtx;
  const S = 190;
  const scale = S / (CITY.half * 2 + 40);
  const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];
  ctx.clearRect(0, 0, S, S);
  ctx.save();
  ctx.beginPath();
  ctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#2f4a2c';
  ctx.fillRect(0, 0, S, S);
  // Sea and sand along the south edge.
  const [, seaY] = toMap(0, CITY.seaZ);
  ctx.fillStyle = '#1e7fa8';
  ctx.fillRect(0, seaY, S, S - seaY);
  const [, beachY] = toMap(0, CITY.beachZ);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(0, beachY, S, seaY - beachY);
  // Roads.
  ctx.strokeStyle = '#3a3f47';
  ctx.lineWidth = 4;
  for (let c = -CITY.half; c <= CITY.half; c += CITY.block) {
    const [x] = toMap(c, 0);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, S); ctx.stroke();
    const [, z] = toMap(0, c);
    ctx.beginPath(); ctx.moveTo(0, z); ctx.lineTo(S, z); ctx.stroke();
  }
  // Mission blip.
  if (state.missionTarget) {
    const [mx, mz] = toMap(state.missionTarget.x, state.missionTarget.z);
    const pulse = 5 + Math.sin(now * 4) * 2;
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(mx, mz, pulse, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx, mz, pulse + 3, 0, Math.PI * 2); ctx.stroke();
  }
  // Traffic dots.
  ctx.fillStyle = '#cfd8dc';
  for (const car of state.traffic) {
    const [x, z] = toMap(car.x, car.z);
    ctx.fillRect(x - 1.5, z - 1.5, 3, 3);
  }
  // Police dots.
  ctx.fillStyle = '#ff3b30';
  for (const car of state.policeCars) {
    const [x, z] = toMap(car.x, car.z);
    ctx.beginPath(); ctx.arc(x, z, 3.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player arrow, rotated to the heading.
  const [px, pz] = toMap(state.playerX, state.playerZ);  ctx.save();
  ctx.translate(px, pz);
  ctx.rotate(state.playerHeading);
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.restore();
  // A small N marks north at the top of the disc.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('N', S / 2, 13);
  ctx.restore();
}

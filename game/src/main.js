// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), the camera follows,
// and the HUD and minimap are repainted. The game moves between four screens:
// title, play, paused and over (busted / wasted).
//
// ?seed=N fixes the city. ?shot=start|play|chase|mission (with &seed=N) stages
// that scene instead of running the loop, paints it a few times and sets
// window.__shotReady for a screenshot.

import { STEP } from './config.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createView } from './render.js';
import { applySave, createWorld, hudState, loadSave, stepWorld } from './world.js';
import { createHud, drawMinimap, showMessage, updateHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261117;

const canvas = document.getElementById('scene');
const view = createView(canvas);
const audio = createAudio();
const input = createInput(canvas);
const world = createWorld(view.scene, seed, audio);
// A read-only debug handle for automated play-tests (never used by the game).
window.__solmar = world;

const hud = createHud();

function setScreen(name) {
  world.screen = name;
  hud.startScreen.classList.toggle('hidden', name !== 'title');
  hud.pauseScreen.classList.toggle('hidden', name !== 'paused');
  hud.endScreen.classList.toggle('hidden', name !== 'over');
}

function startNewGame() {
  audio.unlock();
  setScreen('play');
  showMessage(hud, 'Mara Sol is calling…', 3, world.time);
}

function continueGame() {
  audio.unlock();
  const save = loadSave();
  if (save) applySave(world, save);
  setScreen('play');
  showMessage(hud, 'Welcome back to Solmar, Rico.', 3, world.time);
}

function drainEvents() {
  for (const event of world.events) {
    if (event.type === 'sound') {
      if (event.name === 'punch') audio.punch();
      else if (event.name === 'thud') audio.thud();
      else if (event.name === 'pickup') audio.pickup();
      else if (event.name === 'missionDone') audio.missionDone();
      else if (event.name === 'missionStart') audio.missionStart();
      else if (event.name === 'busted') audio.busted();
      else if (event.name === 'crash') audio.crash();
    } else if (event.type === 'message') {
      showMessage(hud, event.text, event.seconds, world.time);
    } else if (event.type === 'over') {
      hud.endTitle.textContent = event.kind === 'busted' ? 'BUSTED' : 'WASTED';
      hud.endText.textContent = event.text;
      setScreen('over');
    }
  }
  world.events.length = 0;
}

function runShot(name) {
  const staged = stageShot(name, world, view);
  setScreen(staged.screen);
  updateHud(hud, hudState(world), world.time);
  drawMinimap(hud, hudState(world), world.time);
  // Snap the chase camera onto the target before the first paint: the
  // camera lerps toward its position, and a shot has only a few frames.
  const target0 = world.inCar && world.playerCar ? world.playerCar : world.player;
  for (let i = 0; i < 3; i += 1) {
    view.updateCamera(target0.x, target0.z, target0.heading, 1, world.inCar, { dx: 0, dy: 0 });
  }
  let painted = 0;
  function paint() {
    const state = hudState(world);
    const target = world.inCar && world.playerCar ? world.playerCar : world.player;
    view.updateCamera(target.x, target.z, target.heading, 1 / 60, world.inCar, { dx: 0, dy: 0 });
    view.render();
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  const saved = loadSave();
  hud.btnContinue.style.display = saved ? '' : 'none';

  hud.btnStart.addEventListener('click', startNewGame);
  hud.btnContinue.addEventListener('click', continueGame);
  hud.btnResume.addEventListener('click', () => setScreen('play'));
  hud.btnQuit.addEventListener('click', () => setScreen('title'));
  hud.btnEndOk.addEventListener('click', () => setScreen('play'));
  canvas.addEventListener('pointerdown', () => audio.unlock());

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      showMessage(hud, muted ? 'Sound muted' : 'Sound on', 2, world.time);
    }
    if (world.screen === 'title' && (actions & ACTION_CONFIRM)) startNewGame();
    else if (world.screen === 'over' && (actions & ACTION_CONFIRM)) setScreen('play');
    else if (world.screen === 'play' && (actions & ACTION_PAUSE)) {
      setScreen('paused');
      hud.pauseStats.textContent = `Cash $${Math.floor(world.cash)} · Missions ${world.missions.index}/3 · Wanted ${world.police.wanted}★`;
    } else if (world.screen === 'paused' && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      setScreen('play');
    }
    // One-shot actions are taken once per frame here; the enter-car flag is
    // handed to the first fixed sub-step only, so a press never double-fires.
    if (world.screen === 'play') {
      let firstStep = true;
      while (accumulator >= STEP) {
        stepWorld(world, input, view.yaw, STEP, firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
        if (world.screen !== 'play') { accumulator = 0; break; }
      }
      drainEvents();
    } else {
      accumulator = 0;
    }
    const orbit = input.takeOrbit();
    const state = hudState(world);
    const target = world.inCar && world.playerCar ? world.playerCar : world.player;
    view.updateCamera(target.x, target.z, target.heading, 1 / 60, world.inCar, orbit);
    view.render();
    updateHud(hud, state, world.time);
    drawMinimap(hud, state, world.time);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.screen === 'play') setScreen('paused');
  });

  setScreen('title');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

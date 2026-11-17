// Keyboard and mouse input. Held keys are read every frame; one-shot presses
// (enter car, pause, confirm, mute) are queued as bit flags and taken once by
// the loop, so a press between two frames is never lost or counted twice.
// The camera orbits while the pointer is dragged; a click without a drag is
// an attack, so dragging never punches by accident.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_MUTE = 8;
export const ACTION_HORN = 16;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDown = false;
  let dragged = false;
  let lastX = 0;
  let lastY = 0;
  let orbitDX = 0;
  let orbitDY = 0;
  let attackQueued = false;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    if (event.code === 'KeyE') actions |= ACTION_ENTER_CAR;
    if (event.code === 'KeyM') actions |= ACTION_MUTE;
    if (event.code === 'KeyH') actions |= ACTION_HORN;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
    }
  }
  function onKeyUp(event) { keys.delete(event.code); }

  canvas.addEventListener('pointerdown', (event) => {
    mouseDown = true;
    dragged = false;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('pointermove', (event) => {
    if (!mouseDown) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;
    orbitDX += dx;
    orbitDY += dy;
  });
  window.addEventListener('pointerup', () => {
    if (mouseDown && !dragged) attackQueued = true;
    mouseDown = false;
  });
  window.addEventListener('blur', () => { keys.clear(); mouseDown = false; });
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    held(code) { return keys.has(code); },
    // -1/0/1 for forward and strafe, from WASD or the arrow keys.
    move() {
      const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0)
        - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0)
        - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      return { forward: f, strafe: s };
    },
    sprint() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    brake() { return keys.has('Space'); },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeOrbit() {
      const o = { dx: orbitDX, dy: orbitDY };
      orbitDX = 0;
      orbitDY = 0;
      return o;
    },
    takeAttack() {
      const a = attackQueued;
      attackQueued = false;
      return a;
    },
  };
}

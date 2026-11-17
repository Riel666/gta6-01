// A tiny deterministic random-number generator (mulberry32) so the city layout,
// traffic colours and pedestrian looks are the same every visit for a given seed.

export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) { return min + next() * (max - min); },
    int(min, max) { return Math.floor(next() * (max - min + 1)) + min; },
    pick(list) { return list[Math.floor(next() * list.length)]; },
    chance(p) { return next() < p; },
    // A fresh generator continuing this one's sequence, for a subsystem
    // (traffic colours, pedestrian looks) that wants its own stream.
    fork() { return createRandom(Math.floor(next() * 4294967296)); },
  };
}

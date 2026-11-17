# Solmar City — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Riel666/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Riel666/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar City** is a 3D open-world crime game that runs entirely in a desktop
browser from static files — no build step, no network requests, no audio files.

You are **Rico Vale**, a wheelman fresh out of the Marina lockup with empty
pockets and one name in your phone: **Mara Sol**, the fixer who runs Solmar's
night trade. Do her jobs, earn your cut, and stay one step ahead of the
Solmar PD — in a sun-soaked coastal city where every parked car is an
opportunity.

## What is in the game

- **An explorable city** — a 600 × 600 m street grid with towers, a central
  plaza with a fountain, palm-lined beach and open sea, all built procedurally
  in three.js.
- **On foot and by car** — walk, sprint, steal any parked car (press E) and
  drive it with arcade physics, brakes and a horn.
- **Traffic and pedestrians** — cars cruise the road grid and people stroll
  the sidewalks, chat, and flee when a fight breaks out or a car bears down.
- **Wanted level and police** — stealing, assault and hit-and-runs raise your
  stars (0–5). Cruisers chase and ram you; foot officers close in and try to
  make an arrest. Lose them and the heat cools off.
- **Missions and a story** — three jobs from Mara Sol: steal a car for her
  garage, run a parcel to the marina against the clock, then make some noise
  and vanish to the safehouse. Each pays cash; finishing all three completes
  the story.
- **Combat** — punch with a mouse click, on foot; officers fight back.
- **HUD with minimap** — cash, health, wanted stars, mission objective and
  timer, speedometer, and a live top-down minimap with the mission beacon.
- **Start screen, pause, save** — progress (cash, missions, position) saves
  automatically to localStorage; continue from the title screen.
- **Sound** — every effect (engine, sirens, punches, crashes, mission
  jingles) is synthesized live with the Web Audio API. M mutes.

## How to run it

```sh
node serve.ts
```

Then open <http://localhost:8080> in a desktop browser (Chrome works best).

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrows | Move / drive |
| Mouse drag | Orbit camera |
| E | Steal / enter / exit car |
| Click | Punch |
| Space | Brake (in a car) |
| Shift | Sprint |
| H | Horn |
| P / Esc | Pause |
| M | Mute sound |

## How it is built

- `game/index.html` — page shell, HUD panels, start/pause screens.
- `game/src/config.js` — all tuning numbers and colours.
- `game/src/random.js` — seeded RNG so the city is the same every visit.
- `game/src/city.js` — the procedural city: roads, buildings, beach, sea.
- `game/src/vehicles.js` — car meshes, arcade driving, traffic AI, parked cars.
- `game/src/pedestrians.js` — walking, fleeing and knocked-down pedestrians.
- `game/src/police.js` — wanted level, chasing cruisers, arresting officers.
- `game/src/missions.js` — Mara Sol's three story missions.
- `game/src/world.js` — game state, player, combat, saving.
- `game/src/hud.js` — HUD panels and the minimap.
- `game/src/render.js` — three.js view and third-person camera.
- `game/src/audio.js` — synthesized WebAudio sound effects.
- `game/src/input.js` — keyboard and mouse input.
- `game/src/shots.js` — staged screenshot scenes.
- `game/src/main.js` — boot and the game loop.
- `game/vendor/three/three.module.min.js` — three.js (vendored).

Everything in the game — city, characters, vehicles, names, story, art and
sounds — is original. No assets, names or music from any commercial game.

## License

MIT — see `LICENSE`.

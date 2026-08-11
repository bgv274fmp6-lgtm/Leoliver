# 🏹 Archer Duel — 2 Player Archery PVP

A local two-player archery duel that runs entirely in the browser — no build
step, no dependencies, just HTML5 Canvas and vanilla JavaScript.

## How to play

Open `index.html` in a browser (or serve the folder with any static server,
e.g. `python3 -m http.server`), then press **SPACE** to start.

Each player aims their bow, draws it back to charge power, and releases to
fire an arrow. Gravity pulls every arrow into an arc, so you'll need to
angle your shot to reach your opponent. Landing a hit drains their health;
a headshot deals extra damage. First archer to drop their rival to 0 HP
wins the duel.

### Controls

| Action              | Player 1 (blue)  | Player 2 (red)      |
|---------------------|-------------------|----------------------|
| Aim up / down       | `W` / `S`         | `↑` / `↓`            |
| Draw bow (hold)     | Hold `A`          | Hold `→`             |
| Shoot (release)     | Release `A`       | Release `→`          |
| Start / Restart     | `SPACE`           | `SPACE`              |

- Holding the draw key charges your shot's power (and range) up to a cap —
  watch the power bar over your archer's head.
- You can keep adjusting your aim while drawing the bow.
- Each archer can only have one arrow in flight at a time, so missed shots
  cost you tempo.
- Body hits deal 18 damage; headshots deal 34.

## Files

- `index.html` — page structure, HUD, and controls legend
- `style.css` — layout and visual styling
- `game.js` — game loop, physics, input handling, rendering, and audio

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

---

# 🏗️ Wrecking Ball Blitz

A single-player demolition game in `wrecking-ball/index.html`. Like Archer
Duel, it runs in the browser with no build step: open the file directly.

## How to play

Swing a wrecking ball from a crane and smash the buildings on the four lots.

- Every block you smash earns points. Bigger buildings pay more per block.
- Hits in quick succession build a **combo** multiplier (up to ×4).
- Knock a building down (85% of its blocks) for a bonus worth half the
  building's value. A new building rises on the lot right away.
- Bigger buildings are sturdier, so you need a faster swing to break them.
- Each job is on a timer. At the end you get a grade (S, A, B, C or D) based on
  blocks smashed, and a better grade pays a bigger bonus.

### Upgrade yard

Your points go into a bank you can spend between jobs:

| Upgrade    | Effect                                                              |
|------------|---------------------------------------------------------------------|
| **Luck**   | Bigger buildings appear more often: Shack → House → Apartments → Office → Skyscraper → Mega Tower → Golden Tower. The shop shows the exact odds for each level. |
| Heavy ball | A bigger ball that smashes more per hit and slows down less.        |
| Overtime   | Adds 10 seconds to every job.                                       |

Progress is saved in the browser's local storage.

### Controls

| Action                     | Keyboard            | Mouse / touch                     |
|----------------------------|---------------------|-----------------------------------|
| Move the crane             | `←` `→` or `A` `D`  | The crane follows your pointer    |
| Shorten / lengthen chain   | `↑` `↓` or `W` `S`  | Move the pointer higher or lower  |
| Start a job                | `Space`             | Click **Start**                   |
| Mute                       | `M`                 | **Sound** button                  |

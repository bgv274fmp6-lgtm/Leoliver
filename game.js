// ============================================================================
// ARCHER DUEL — 2 Player local PVP archery game
//
// Player 1 (blue, left):  W/S aim, hold A to draw bow, release A to shoot
// Player 2 (red, right):  Up/Down aim, hold -> to draw bow, release -> shoot
// ============================================================================

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Canvas is drawn at a fixed internal resolution; CSS scales it responsively.
const W = canvas.width;
const H = canvas.height;
const GROUND_Y = H - 90;

// ---- Tunable constants -----------------------------------------------------
const GRAVITY = 780;              // px/s^2
const MIN_ANGLE = -55;            // degrees (down)
const MAX_ANGLE = 75;             // degrees (up)
const AIM_SPEED = 85;             // degrees per second
const CHARGE_TIME = 1.05;         // seconds to reach full power
const MIN_SHOT_SPEED = 260;       // px/s at 0 power
const MAX_SHOT_SPEED = 760;       // px/s at full power
const MIN_POWER_TO_FIRE = 0.08;   // taps below this don't fire
const ARROW_LEN = 26;
const BODY_HIT_RADIUS = 26;
const HEAD_HIT_RADIUS = 15;
const BODY_DAMAGE = 18;
const HEAD_DAMAGE = 34;
const MAX_HEALTH = 100;

// ---- Audio (tiny synthesized SFX, no external assets) ---------------------
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  return audioCtx;
}
function beep({ freq = 440, dur = 0.12, type = 'sine', gain = 0.15, slideTo = null }) {
  const ac = ensureAudio();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ac.currentTime + dur);
  g.gain.setValueAtTime(gain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + dur + 0.02);
}
const sfx = {
  draw: () => beep({ freq: 180, dur: 0.06, type: 'triangle', gain: 0.05 }),
  shoot: (power) => beep({ freq: 260 + power * 260, dur: 0.14, type: 'sawtooth', gain: 0.12, slideTo: 90 }),
  hitBody: () => beep({ freq: 120, dur: 0.18, type: 'square', gain: 0.18, slideTo: 40 }),
  hitHead: () => beep({ freq: 520, dur: 0.2, type: 'square', gain: 0.2, slideTo: 900 }),
  thud: () => beep({ freq: 90, dur: 0.1, type: 'sine', gain: 0.08 }),
  win: () => { beep({ freq: 523, dur: 0.15 }); setTimeout(() => beep({ freq: 659, dur: 0.15 }), 130); setTimeout(() => beep({ freq: 784, dur: 0.3 }), 260); },
};

// ---- Game state -------------------------------------------------------------
function makePlayer(opts) {
  return {
    ...opts,
    health: MAX_HEALTH,
    angle: 25,          // degrees, positive = up
    charging: false,
    power: 0,
    arrowInFlight: false,
    wobble: 0,           // hit-reaction timer
  };
}

const p1 = makePlayer({ x: 130, dir: 1, color: '#3fa7ff', darkColor: '#1f4f8f', name: 'P1', bowKey: 'a', upKey: 'w', downKey: 's' });
const p2 = makePlayer({ x: W - 130, dir: -1, color: '#ff5a5a', darkColor: '#8f1f1f', name: 'P2', bowKey: 'arrowright', upKey: 'arrowup', downKey: 'arrowdown' });
const players = [p1, p2];

let arrows = [];       // {x,y,vx,vy,owner,active,stuck,life}
let popups = [];       // floating damage numbers {x,y,text,color,life}
let particles = [];    // small hit-spark particles
let round = 1;
let state = 'menu';    // 'menu' | 'playing' | 'gameover'
let winner = null;
let shake = 0;

const keys = {};

// ---- Input ------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === ' ') {
    e.preventDefault();
    if (state === 'menu' || state === 'gameover') startRound(state === 'menu' ? 1 : round);
    return;
  }
  if (['w', 's', 'a', 'arrowup', 'arrowdown', 'arrowright'].includes(k)) e.preventDefault();
  if (keys[k]) return; // ignore key-repeat
  keys[k] = true;
  handleKeyDown(k);
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  keys[k] = false;
  handleKeyUp(k);
});

function handleKeyDown(k) {
  if (state !== 'playing') return;
  for (const p of players) {
    if (k === p.bowKey && !p.arrowInFlight && !p.charging) {
      p.charging = true;
      p.power = 0;
      sfx.draw();
    }
  }
}

function handleKeyUp(k) {
  if (state !== 'playing') return;
  for (const p of players) {
    if (k === p.bowKey && p.charging) {
      fireArrow(p);
    }
  }
}

function fireArrow(p) {
  const power = p.power;
  p.charging = false;
  p.power = 0;
  if (power < MIN_POWER_TO_FIRE) return; // too weak a tap, no shot
  const rad = (p.angle * Math.PI) / 180;
  const speed = MIN_SHOT_SPEED + power * (MAX_SHOT_SPEED - MIN_SHOT_SPEED);
  const bowPos = bowPosition(p);
  arrows.push({
    x: bowPos.x,
    y: bowPos.y,
    vx: Math.cos(rad) * p.dir * speed,
    vy: -Math.sin(rad) * speed,
    owner: p,
    active: true,
    stuck: false,
    life: 0,
  });
  p.arrowInFlight = true;
  sfx.shoot(power);
}

function bowPosition(p) {
  const shoulderY = GROUND_Y - 74;
  return { x: p.x + p.dir * 12, y: shoulderY - 4 };
}

// ---- Round / game flow --------------------------------------------------------
function startRound(newRound) {
  round = newRound;
  for (const p of players) {
    p.health = MAX_HEALTH;
    p.angle = 25;
    p.charging = false;
    p.power = 0;
    p.arrowInFlight = false;
    p.wobble = 0;
  }
  arrows = [];
  popups = [];
  particles = [];
  winner = null;
  state = 'playing';
  document.getElementById('overlay').classList.add('hidden');
  document.getElementById('round-label').textContent = `ROUND ${round}`;
  updateHUD();
}

function endGame(loser) {
  state = 'gameover';
  winner = loser === p1 ? p2 : p1;
  sfx.win();
  const overlay = document.getElementById('overlay');
  document.getElementById('overlay-title').textContent = `${winner.name} WINS!`;
  document.getElementById('overlay-msg').textContent =
    winner === p1 ? 'Player 1 claims the duel.' : 'Player 2 claims the duel.';
  document.getElementById('overlay-sub').innerHTML = 'Press <b>SPACE</b> to play again';
  overlay.classList.remove('hidden');
}

// ---- Update -------------------------------------------------------------------
let lastTime = performance.now();
function update(dt) {
  if (state !== 'playing') return;

  for (const p of players) {
    // Aiming
    const up = keys[p.upKey];
    const down = keys[p.downKey];
    if (up && !down) p.angle = Math.min(MAX_ANGLE, p.angle + AIM_SPEED * dt);
    if (down && !up) p.angle = Math.max(MIN_ANGLE, p.angle - AIM_SPEED * dt);

    // Charging power
    if (p.charging) {
      p.power = Math.min(1, p.power + dt / CHARGE_TIME);
    }

    if (p.wobble > 0) p.wobble = Math.max(0, p.wobble - dt * 3);
  }

  // Arrows
  for (const a of arrows) {
    if (!a.active) continue;
    a.life += dt;
    a.vy += GRAVITY * dt;
    a.x += a.vx * dt;
    a.y += a.vy * dt;

    // Off-screen cleanup
    if (a.x < -50 || a.x > W + 50 || a.y > H + 80) {
      a.active = false;
      a.owner.arrowInFlight = false;
      continue;
    }

    // Ground collision
    if (a.y >= GROUND_Y) {
      a.y = GROUND_Y;
      a.active = false;
      a.stuck = true;
      a.owner.arrowInFlight = false;
      sfx.thud();
      spawnParticles(a.x, GROUND_Y, '#8a7350', 6);
      continue;
    }

    // Player collision (only against the non-owner)
    const target = a.owner === p1 ? p2 : p1;
    const headC = { x: target.x, y: GROUND_Y - 88 };
    const bodyC = { x: target.x, y: GROUND_Y - 55 };
    const dHead = Math.hypot(a.x - headC.x, a.y - headC.y);
    const dBody = Math.hypot(a.x - bodyC.x, a.y - bodyC.y);

    if (dHead <= HEAD_HIT_RADIUS) {
      applyHit(target, HEAD_DAMAGE, true, a);
      a.active = false;
      a.owner.arrowInFlight = false;
    } else if (dBody <= BODY_HIT_RADIUS) {
      applyHit(target, BODY_DAMAGE, false, a);
      a.active = false;
      a.owner.arrowInFlight = false;
    }
  }
  // Prune old stuck arrows / inactive arrows after a while
  arrows = arrows.filter((a) => a.active || (a.stuck && a.life < 8));

  // Popups
  for (const t of popups) {
    t.life -= dt;
    t.y -= dt * 28;
  }
  popups = popups.filter((t) => t.life > 0);

  // Particles
  for (const pt of particles) {
    pt.life -= dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += GRAVITY * 0.6 * dt;
  }
  particles = particles.filter((pt) => pt.life > 0);

  if (shake > 0) shake = Math.max(0, shake - dt * 4);

  updateHUD();
}

function applyHit(target, dmg, headshot, arrow) {
  target.health = Math.max(0, target.health - dmg);
  target.wobble = 1;
  shake = Math.min(1, shake + (headshot ? 0.8 : 0.5));
  popups.push({
    x: arrow.x,
    y: arrow.y - 10,
    text: headshot ? `HEADSHOT -${dmg}` : `-${dmg}`,
    color: headshot ? '#ffd54a' : '#ff8a8a',
    life: 1.1,
  });
  spawnParticles(arrow.x, arrow.y, headshot ? '#ffd54a' : '#ff5a5a', headshot ? 14 : 9);
  if (headshot) sfx.hitHead(); else sfx.hitBody();

  if (target.health <= 0) {
    setTimeout(() => endGame(target), 350);
  }
}

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 60 + Math.random() * 160;
    particles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 60,
      life: 0.4 + Math.random() * 0.4,
      color,
      r: 1.5 + Math.random() * 2,
    });
  }
}

function updateHUD() {
  document.getElementById('hp1').style.width = `${p1.health}%`;
  document.getElementById('hp2').style.width = `${p2.health}%`;
}

// ---- Drawing ------------------------------------------------------------------
function drawBackground() {
  // Sky/ground gradient is via CSS on the canvas element's own background;
  // we still draw ground details + sun + clouds/hills for depth.
  ctx.clearRect(0, 0, W, H);

  // sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, '#16233d');
  sky.addColorStop(0.6, '#2c4a72');
  sky.addColorStop(1, '#5f83a8');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, GROUND_Y + 4);

  // sun
  ctx.beginPath();
  ctx.fillStyle = 'rgba(255, 232, 170, 0.85)';
  ctx.arc(W / 2, 90, 34, 0, Math.PI * 2);
  ctx.fill();

  // distant hills
  ctx.fillStyle = '#33502f';
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.quadraticCurveTo(W * 0.25, GROUND_Y - 50, W * 0.5, GROUND_Y - 10);
  ctx.quadraticCurveTo(W * 0.75, GROUND_Y - 60, W, GROUND_Y - 15);
  ctx.lineTo(W, GROUND_Y);
  ctx.closePath();
  ctx.fill();

  // ground
  const groundGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  groundGrad.addColorStop(0, '#4a6b3d');
  groundGrad.addColorStop(0.15, '#3a5730');
  groundGrad.addColorStop(1, '#20301a');
  ctx.fillStyle = groundGrad;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  // ground line highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(W, GROUND_Y);
  ctx.stroke();

  // range distance markers
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  for (let x = 0; x < W; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x, GROUND_Y + 8);
    ctx.stroke();
  }
}

function aimVector(p) {
  const rad = (p.angle * Math.PI) / 180;
  return { x: Math.cos(rad) * p.dir, y: -Math.sin(rad) };
}

function drawArcher(p) {
  const hipY = GROUND_Y - 46;
  const shoulderY = GROUND_Y - 74;
  const headY = GROUND_Y - 88;
  const headR = 13;
  const wob = p.wobble;
  const shakeX = wob * Math.sin(performance.now() / 30) * 4;

  ctx.save();
  ctx.translate(shakeX, 0);

  // Flash red tint if just hit
  const tint = wob > 0 ? `rgba(255,60,60,${0.35 * wob})` : null;

  // legs
  ctx.strokeStyle = p.darkColor;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(p.x, hipY);
  ctx.lineTo(p.x - 12, GROUND_Y);
  ctx.moveTo(p.x, hipY);
  ctx.lineTo(p.x + 12, GROUND_Y);
  ctx.stroke();

  // torso
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(p.x, hipY);
  ctx.lineTo(p.x, shoulderY);
  ctx.stroke();

  // aim direction
  const v = aimVector(p);
  const perp = { x: -v.y, y: v.x };

  // back arm (draw arm, connects to string pull point)
  const bow = bowPosition(p);
  const pull = p.charging
    ? { x: bow.x - v.x * (10 + p.power * 34), y: bow.y - v.y * (10 + p.power * 34) }
    : { x: bow.x - v.x * 8, y: bow.y - v.y * 8 };

  ctx.strokeStyle = p.color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(p.x, shoulderY);
  ctx.lineTo(pull.x, pull.y);
  ctx.stroke();

  // bow (curved stave)
  const bowTop = { x: bow.x + perp.x * 20, y: bow.y + perp.y * 20 };
  const bowBottom = { x: bow.x - perp.x * 20, y: bow.y - perp.y * 20 };
  const bulge = { x: bow.x - v.x * 10, y: bow.y - v.y * 10 };

  ctx.strokeStyle = '#8a5a2b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(bowTop.x, bowTop.y);
  ctx.quadraticCurveTo(bulge.x, bulge.y, bowBottom.x, bowBottom.y);
  ctx.stroke();

  // bowstring
  ctx.strokeStyle = '#e8dfc8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(bowTop.x, bowTop.y);
  ctx.lineTo(pull.x, pull.y);
  ctx.lineTo(bowBottom.x, bowBottom.y);
  ctx.stroke();

  // front arm (bow arm)
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(p.x, shoulderY);
  ctx.lineTo(bow.x, bow.y);
  ctx.stroke();

  // nocked arrow while charging (or idle rest arrow)
  const nockLen = p.charging ? 8 + p.power * 34 : 8;
  const tipX = bow.x + v.x * 20;
  const tipY = bow.y + v.y * 20;
  const nockX = bow.x - v.x * (nockLen - 20);
  const nockY = bow.y - v.y * (nockLen - 20);
  ctx.strokeStyle = '#c9a86a';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(pull.x, pull.y);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  drawArrowhead(tipX, tipY, v, '#d8d8d8');

  // head
  ctx.beginPath();
  ctx.fillStyle = p.color;
  ctx.arc(p.x, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  // hit tint overlay
  if (tint) {
    ctx.beginPath();
    ctx.fillStyle = tint;
    ctx.arc(p.x, headY, headR + 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // hurtbox indicator radii (subtle) -- helps players read hit zones
  ctx.restore();

  // power bar above head while charging
  if (p.charging) {
    const barW = 60;
    const bx = p.x - barW / 2;
    const by = headY - 34;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(bx, by, barW, 8);
    ctx.fillStyle = p.power > 0.85 ? '#ffd54a' : p.color;
    ctx.fillRect(bx, by, barW * p.power, 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, barW, 8);
  }

  // "arrow in flight, can't draw" indicator
  if (p.arrowInFlight && !p.charging) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('...', p.x, headY - 26);
  }
}

function drawArrowhead(x, y, v, color) {
  const ang = Math.atan2(v.y, v.x);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(8, 0);
  ctx.lineTo(-2, -4);
  ctx.lineTo(-2, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawArrows() {
  for (const a of arrows) {
    const ang = Math.atan2(a.vy, a.vx);
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.active ? ang : 0);
    // shaft
    ctx.strokeStyle = '#c9a86a';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-ARROW_LEN / 2, 0);
    ctx.lineTo(ARROW_LEN / 2, 0);
    ctx.stroke();
    // fletching
    ctx.strokeStyle = a.owner.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-ARROW_LEN / 2, 0);
    ctx.lineTo(-ARROW_LEN / 2 - 5, -4);
    ctx.moveTo(-ARROW_LEN / 2, 0);
    ctx.lineTo(-ARROW_LEN / 2 - 5, 4);
    ctx.stroke();
    ctx.restore();
    // head
    if (a.active) drawArrowhead(a.x, a.y, { x: Math.cos(ang), y: Math.sin(ang) }, '#eee');
  }
}

function drawTrajectoryPreview(p) {
  // subtle dotted preview while charging, helps aiming feel responsive
  if (!p.charging) return;
  const rad = (p.angle * Math.PI) / 180;
  const speed = MIN_SHOT_SPEED + p.power * (MAX_SHOT_SPEED - MIN_SHOT_SPEED);
  let x = bowPosition(p).x;
  let y = bowPosition(p).y;
  let vx = Math.cos(rad) * p.dir * speed;
  let vy = -Math.sin(rad) * speed;
  ctx.fillStyle = `rgba(255,255,255,0.35)`;
  const dt = 0.045;
  for (let i = 0; i < 26; i++) {
    vy += GRAVITY * dt;
    x += vx * dt;
    y += vy * dt;
    if (y > GROUND_Y || x < 0 || x > W) break;
    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawPopups() {
  ctx.textAlign = 'center';
  for (const t of popups) {
    ctx.globalAlpha = Math.max(0, Math.min(1, t.life));
    ctx.fillStyle = t.color;
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}

function drawParticles() {
  for (const pt of particles) {
    ctx.globalAlpha = Math.max(0, pt.life * 1.5);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawAimGuides() {
  // small angle indicator arcs near each archer's feet
  for (const p of players) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(p.angle)}°`, p.x, GROUND_Y + 20);
  }
}

function render() {
  ctx.save();
  if (shake > 0) {
    const s = shake * 6;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }

  drawBackground();
  drawTrajectoryPreview(p1);
  drawTrajectoryPreview(p2);
  drawArrows();
  drawArcher(p1);
  drawArcher(p2);
  drawParticles();
  drawPopups();
  drawAimGuides();

  ctx.restore();
}

// ---- Main loop -----------------------------------------------------------------
function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(loop);
}

// Kick things off: show menu overlay, start render loop (idle scene visible behind menu)
document.getElementById('overlay').classList.remove('hidden');
requestAnimationFrame(loop);

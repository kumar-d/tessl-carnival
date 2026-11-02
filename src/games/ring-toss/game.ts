import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const RINGS_PER_ROUND = 10;
/** Seconds a ring spends in the air. */
export const FLIGHT_TIME = 0.8;
/** How close to a bottle's neck a ring has to land to ring it. */
export const NECK_RADIUS = 22;
/** The fixed launcher in the lower-left corner that every ring leaves from. */
export const LAUNCHER = { x: 70, y: 440 } as const;
/** The launcher aims between these angles, in radians: negative is up the screen. */
export const MIN_ANGLE = (-75 * Math.PI) / 180;
export const MAX_ANGLE = (-5 * Math.PI) / 180;
/** How far a ring flies at no charge and at full charge. */
export const MIN_RANGE = 120;
export const MAX_RANGE = 640;
/** Seconds of holding it takes to charge a throw to full strength. */
export const CHARGE_TIME = 2;

export type Row = 'back' | 'middle' | 'front';

const ROWS: { row: Row; y: number; points: number }[] = [
  { row: 'back', y: 150, points: 30 },
  { row: 'middle', y: 240, points: 20 },
  { row: 'front', y: 330, points: 10 },
];
const BOTTLES_PER_ROW = 3;
const BOTTLE_SPACING = 140;

export interface Bottle {
  row: Row;
  /** Where the neck is: the spot a ring has to land on. */
  x: number;
  y: number;
  ringed: boolean;
}

export interface Ring {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Seconds since the throw. */
  age: number;
}

export interface Landing {
  x: number;
  y: number;
  points: number;
  age: number;
}

export interface RingTossState {
  bottles: Bottle[];
  ring: Ring | null;
  landings: Landing[];
  /** The launcher's aim, in radians, between MIN_ANGLE and MAX_ANGLE. */
  aim: number;
  /** Strength from 0 to 1 while a throw is charging, or null when it isn't. */
  charge: number | null;
  ringsLeft: number;
  score: number;
  phase: 'playing' | 'over';
}

export function createState(): RingTossState {
  const bottles = ROWS.flatMap(({ row, y }) =>
    Array.from({ length: BOTTLES_PER_ROW }, (_, i) => ({
      row,
      x: WIDTH / 2 + (i - 1) * BOTTLE_SPACING,
      y,
      ringed: false,
    })),
  );
  return {
    bottles,
    ring: null,
    landings: [],
    aim: (MIN_ANGLE + MAX_ANGLE) / 2,
    charge: null,
    ringsLeft: RINGS_PER_ROUND,
    score: 0,
    phase: 'playing',
  };
}

/** Back row is worth 30, middle 20, front 10. */
export function scoreForRow(row: Row): number {
  return ROWS.find((r) => r.row === row)?.points ?? 0;
}

/** The bottle whose neck is under the point, if any. */
export function bottleAt(state: RingTossState, x: number, y: number): Bottle | undefined {
  return state.bottles.find((b) => Math.hypot(x - b.x, y - b.y) <= NECK_RADIUS);
}

/** Points the launcher towards the point, kept within its aiming range. */
export function aimAt(state: RingTossState, x: number, y: number): void {
  const angle = Math.atan2(y - LAUNCHER.y, x - LAUNCHER.x);
  state.aim = Math.min(Math.max(angle, MIN_ANGLE), MAX_ANGLE);
}

/** Where a ring thrown at this angle and strength (0 to 1) comes down. */
export function landingPoint(angle: number, strength: number): { x: number; y: number } {
  const distance = MIN_RANGE + (MAX_RANGE - MIN_RANGE) * Math.min(Math.max(strength, 0), 1);
  return {
    x: LAUNCHER.x + Math.cos(angle) * distance,
    y: LAUNCHER.y + Math.sin(angle) * distance,
  };
}

/** Starts charging a throw. Returns false if a throw can't start now. */
export function startCharge(state: RingTossState): boolean {
  if (state.phase !== 'playing' || state.ring || state.ringsLeft === 0 || state.charge !== null) {
    return false;
  }
  state.charge = 0;
  return true;
}

/** Drops a charging throw without spending a ring. */
export function cancelCharge(state: RingTossState): void {
  state.charge = null;
}

/** Throws one ring at the angle and strength. Returns false if nothing was thrown. */
export function throwRing(state: RingTossState, angle: number, strength: number): boolean {
  if (state.phase !== 'playing' || state.ring || state.ringsLeft === 0) return false;
  const to = landingPoint(angle, strength);
  state.ring = { fromX: LAUNCHER.x, fromY: LAUNCHER.y, toX: to.x, toY: to.y, age: 0 };
  state.ringsLeft -= 1;
  return true;
}

/** Throws the charging ring along the launcher's aim. Returns false if nothing was thrown. */
export function releaseCharge(state: RingTossState): boolean {
  if (state.charge === null) return false;
  const strength = state.charge;
  state.charge = null;
  return throwRing(state, state.aim, strength);
}

/** Scores a ring that has landed at the point, and returns the points it scored. */
export function landRing(state: RingTossState, x: number, y: number): number {
  const bottle = bottleAt(state, x, y);
  let points = 0;
  if (bottle && !bottle.ringed) {
    bottle.ringed = true;
    points = scoreForRow(bottle.row);
    state.score += points;
  }
  state.landings.push({ x, y, points, age: 0 });
  return points;
}

/** Where the ring is now, arcing up on its way from the launcher. Longer throws arc higher. */
export function ringPosition(ring: Ring): { x: number; y: number } {
  const t = Math.min(ring.age / FLIGHT_TIME, 1);
  const height = Math.hypot(ring.toX - ring.fromX, ring.toY - ring.fromY) * 0.3;
  return {
    x: ring.fromX + (ring.toX - ring.fromX) * t,
    y: ring.fromY + (ring.toY - ring.fromY) * t - Math.sin(Math.PI * t) * height,
  };
}

/** Advances the game by `dt` seconds. */
export function step(state: RingTossState, dt: number): void {
  for (const landing of state.landings) landing.age += dt;
  state.landings = state.landings.filter((l) => l.age < 1);

  if (state.charge !== null) state.charge = Math.min(state.charge + dt / CHARGE_TIME, 1);

  if (state.ring) {
    state.ring.age += dt;
    if (state.ring.age >= FLIGHT_TIME) {
      const { toX, toY } = state.ring;
      state.ring = null;
      landRing(state, toX, toY);
    }
  }

  if (state.ringsLeft === 0 && !state.ring) state.phase = 'over';
}

function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.strokeStyle = theme.colors.accent;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(x, y, size, size * 0.45, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function draw(ctx: CanvasRenderingContext2D, state: RingTossState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // Table.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(WIDTH / 2 - 230, 100, 460, 270);

  for (const bottle of state.bottles) {
    ctx.fillStyle = colors.water;
    ctx.fillRect(bottle.x - 14, bottle.y + 4, 28, 30);
    ctx.fillRect(bottle.x - 5, bottle.y - 14, 10, 20);
    ctx.fillStyle = colors.surface;
    ctx.fillRect(bottle.x - 6, bottle.y - 18, 12, 6);
    if (bottle.ringed) drawRing(ctx, bottle.x, bottle.y, 20);
  }

  // Row values beside the table.
  ctx.fillStyle = colors.muted;
  ctx.font = canvasFont('small', 'bold');
  ctx.textAlign = 'left';
  for (const { y, points } of ROWS) ctx.fillText(`${points}`, WIDTH / 2 + 240, y + 20);

  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'center';
  for (const landing of state.landings) {
    ctx.globalAlpha = 1 - landing.age;
    if (landing.points > 0) {
      ctx.fillStyle = colors.accent;
      ctx.fillText(`+${landing.points}`, landing.x, landing.y - 30 - landing.age * 30);
    } else {
      ctx.strokeStyle = colors.danger;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(landing.x - 8, landing.y - 8);
      ctx.lineTo(landing.x + 8, landing.y + 8);
      ctx.moveTo(landing.x + 8, landing.y - 8);
      ctx.lineTo(landing.x - 8, landing.y + 8);
      ctx.stroke();
      ctx.fillStyle = colors.danger;
      ctx.fillText('Miss', landing.x, landing.y - 20);
    }
  }
  ctx.globalAlpha = 1;

  if (state.ring) {
    const { x, y } = ringPosition(state.ring);
    drawRing(ctx, x, y, 20);
  }

  // Launcher, its aim arrow and, while a throw charges, the strength meter.
  ctx.fillStyle = colors.surface;
  ctx.beginPath();
  ctx.arc(LAUNCHER.x, LAUNCHER.y, 18, 0, Math.PI * 2);
  ctx.fill();
  if (!state.ring) drawRing(ctx, LAUNCHER.x, LAUNCHER.y, 12);
  if (state.phase === 'playing') {
    const tipX = LAUNCHER.x + Math.cos(state.aim) * 70;
    const tipY = LAUNCHER.y + Math.sin(state.aim) * 70;
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(LAUNCHER.x, LAUNCHER.y);
    ctx.lineTo(tipX, tipY);
    for (const side of [-1, 1]) {
      const back = state.aim + Math.PI + side * 0.5;
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(tipX + Math.cos(back) * 12, tipY + Math.sin(back) * 12);
    }
    ctx.stroke();

    const meter = { x: 16, y: 380, width: 12, height: 80 };
    ctx.fillStyle = colors.surface;
    ctx.fillRect(meter.x, meter.y, meter.width, meter.height);
    const filled = (state.charge ?? 0) * meter.height;
    ctx.fillStyle = colors.accent;
    ctx.fillRect(meter.x, meter.y + meter.height - filled, meter.width, filled);
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 1;
    ctx.strokeRect(meter.x, meter.y, meter.width, meter.height);
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 120, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Rings ${state.ringsLeft}/${RINGS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of rings! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click or tap to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const ringToss: CarnivalGame = {
  id: 'ring-toss',
  name: 'Ring Toss',
  description: 'Land rings on the bottle necks with 10 throws. The back row scores most.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    // Keep presses and drags on the canvas from scrolling or zooming the page.
    const touchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';

    let state = createState();
    let scoreRecorded = false;
    let pointer: number | null = null;

    const toCanvas = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
      };
    };
    const aimFrom = (event: PointerEvent) => {
      const { x, y } = toCanvas(event);
      aimAt(state, x, y);
    };
    const onMove = (event: PointerEvent) => {
      if (pointer === null || event.pointerId === pointer) aimFrom(event);
    };
    const onDown = (event: PointerEvent) => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
        return;
      }
      if (pointer !== null) return;
      aimFrom(event);
      if (!startCharge(state)) return;
      pointer = event.pointerId;
      // Keep getting this pointer's moves and release even if it leaves the canvas.
      canvas.setPointerCapture?.(event.pointerId);
    };
    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      pointer = null;
      aimFrom(event);
      releaseCharge(state);
    };
    const onCancel = (event: PointerEvent) => {
      if (event.pointerId !== pointer) return;
      pointer = null;
      cancelCharge(state);
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onCancel);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(ringToss.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onCancel);
      canvas.style.touchAction = touchAction;
    };
  },
};

export default ringToss;

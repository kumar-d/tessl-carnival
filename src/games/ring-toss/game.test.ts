import { describe, expect, it } from 'vitest';
import {
  CHARGE_TIME,
  FLIGHT_TIME,
  LAUNCHER,
  MAX_ANGLE,
  MAX_RANGE,
  MIN_ANGLE,
  MIN_RANGE,
  RINGS_PER_ROUND,
  aimAt,
  bottleAt,
  cancelCharge,
  createState,
  landRing,
  landingPoint,
  releaseCharge,
  ringPosition,
  scoreForRow,
  startCharge,
  step,
  throwRing,
  type Bottle,
  type Row,
} from './game';

function bottleIn(row: Row) {
  const bottle = createState().bottles.find((b) => b.row === row);
  if (!bottle) throw new Error(`No bottle in the ${row} row`);
  return bottle;
}

/** The angle and strength that land a ring on the bottle's neck. */
function shotAt(bottle: Bottle) {
  const dx = bottle.x - LAUNCHER.x;
  const dy = bottle.y - LAUNCHER.y;
  return {
    angle: Math.atan2(dy, dx),
    strength: (Math.hypot(dx, dy) - MIN_RANGE) / (MAX_RANGE - MIN_RANGE),
  };
}

/** Throws a ring and lets it land. */
function toss(state: ReturnType<typeof createState>, angle: number, strength: number) {
  const thrown = throwRing(state, angle, strength);
  step(state, FLIGHT_TIME);
  return thrown;
}

function tossAt(state: ReturnType<typeof createState>, bottle: Bottle) {
  const { angle, strength } = shotAt(bottle);
  return toss(state, angle, strength);
}

/** A throw that lands short of the table. */
const SHORT = { angle: MAX_ANGLE, strength: 0 };

describe('ring toss', () => {
  it('starts with a 3x3 grid of empty bottles, 10 rings and no score', () => {
    const state = createState();
    expect(state.bottles).toHaveLength(9);
    for (const row of ['front', 'middle', 'back'] as const) {
      expect(state.bottles.filter((b) => b.row === row)).toHaveLength(3);
    }
    expect(state.bottles.every((b) => !b.ringed)).toBe(true);
    expect(state.ringsLeft).toBe(RINGS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.ring).toBeNull();
    expect(state.charge).toBeNull();
    expect(state.aim).toBeGreaterThanOrEqual(MIN_ANGLE);
    expect(state.aim).toBeLessThanOrEqual(MAX_ANGLE);
    expect(state.phase).toBe('playing');
  });

  it('launches every ring from the lower-left corner', () => {
    expect(LAUNCHER.x).toBeLessThan(200);
    expect(LAUNCHER.y).toBeGreaterThan(400);
    const state = createState();
    throwRing(state, -0.5, 0.5);
    expect(state.ring).toMatchObject({ fromX: LAUNCHER.x, fromY: LAUNCHER.y });
  });

  it('throws further with more strength', () => {
    const near = landingPoint(-0.5, 0.2);
    const far = landingPoint(-0.5, 0.8);
    const distance = (p: { x: number; y: number }) =>
      Math.hypot(p.x - LAUNCHER.x, p.y - LAUNCHER.y);
    expect(distance(far)).toBeGreaterThan(distance(near));
    expect(distance(landingPoint(-0.5, 0))).toBeCloseTo(MIN_RANGE);
    expect(distance(landingPoint(-0.5, 1))).toBeCloseTo(MAX_RANGE);
    expect(distance(landingPoint(-0.5, 5))).toBeCloseTo(MAX_RANGE);
  });

  it('throws higher up the table with a steeper angle', () => {
    const flat = landingPoint(MAX_ANGLE, 0.5);
    const steep = landingPoint(MIN_ANGLE, 0.5);
    expect(steep.y).toBeLessThan(flat.y);
    expect(steep.x).toBeLessThan(flat.x);
  });

  it('flies the ring in an arc above the straight line to its landing point', () => {
    const state = createState();
    throwRing(state, -0.5, 0.6);
    const ring = state.ring!;
    ring.age = FLIGHT_TIME / 2;
    const middle = ringPosition(ring);
    expect(middle.y).toBeLessThan((ring.fromY + ring.toY) / 2 - 20);
    ring.age = FLIGHT_TIME;
    const end = ringPosition(ring);
    expect(end.x).toBeCloseTo(ring.toX);
    expect(end.y).toBeCloseTo(ring.toY);
  });

  it('can reach every bottle in every row and column', () => {
    for (const bottle of createState().bottles) {
      const { angle, strength } = shotAt(bottle);
      expect(angle).toBeGreaterThanOrEqual(MIN_ANGLE);
      expect(angle).toBeLessThanOrEqual(MAX_ANGLE);
      expect(strength).toBeGreaterThanOrEqual(0);
      expect(strength).toBeLessThanOrEqual(1);
    }
  });

  it('keeps the aim within the launcher range', () => {
    const state = createState();
    aimAt(state, LAUNCHER.x, 0);
    expect(state.aim).toBe(MIN_ANGLE);
    aimAt(state, 800, LAUNCHER.y + 50);
    expect(state.aim).toBe(MAX_ANGLE);
  });

  it('does not hit a bottle just because the aim points at it', () => {
    const state = createState();
    const bottle = bottleIn('back');
    aimAt(state, bottle.x, bottle.y);
    startCharge(state);
    step(state, 0.1);
    releaseCharge(state);
    step(state, FLIGHT_TIME);
    expect(state.score).toBe(0);
    expect(state.ringsLeft).toBe(RINGS_PER_ROUND - 1);
  });

  it('hits a bottle with the right angle and charge', () => {
    const state = createState();
    const bottle = bottleIn('middle');
    const { angle, strength } = shotAt(bottle);
    state.aim = angle;
    startCharge(state);
    step(state, strength * CHARGE_TIME);
    releaseCharge(state);
    step(state, FLIGHT_TIME);
    expect(state.score).toBe(20);
  });

  it('charges while held and caps at full strength', () => {
    const state = createState();
    expect(startCharge(state)).toBe(true);
    step(state, CHARGE_TIME / 2);
    expect(state.charge).toBeCloseTo(0.5);
    step(state, CHARGE_TIME * 2);
    expect(state.charge).toBe(1);
  });

  it('scores 10 for the front row, 20 for the middle and 30 for the back', () => {
    expect(scoreForRow('front')).toBe(10);
    expect(scoreForRow('middle')).toBe(20);
    expect(scoreForRow('back')).toBe(30);

    for (const [row, points] of [
      ['front', 10],
      ['middle', 20],
      ['back', 30],
    ] as const) {
      const state = createState();
      tossAt(state, bottleIn(row));
      expect(state.score).toBe(points);
    }
  });

  it('rings a bottle when the ring lands on its neck', () => {
    const state = createState();
    const bottle = bottleIn('middle');
    expect(bottleAt(state, bottle.x + 5, bottle.y - 5)).toBeDefined();
    expect(landRing(state, bottle.x + 5, bottle.y - 5)).toBe(20);
    expect(state.bottles.filter((b) => b.ringed)).toHaveLength(1);
  });

  it('scores nothing for a miss', () => {
    const state = createState();
    toss(state, SHORT.angle, SHORT.strength);
    expect(state.score).toBe(0);
    expect(state.bottles.every((b) => !b.ringed)).toBe(true);
    expect(state.ringsLeft).toBe(RINGS_PER_ROUND - 1);
    expect(state.landings[0].points).toBe(0);
  });

  it('misses with a poor shot just off a bottle', () => {
    const state = createState();
    const { angle, strength } = shotAt(bottleIn('back'));
    toss(state, angle, strength + 0.1);
    toss(state, angle + 0.1, strength);
    expect(state.score).toBe(0);
  });

  it('scores a bottle only once per round', () => {
    const state = createState();
    const bottle = bottleIn('back');
    tossAt(state, bottle);
    tossAt(state, bottle);
    expect(state.score).toBe(30);
    expect(state.landings.at(-1)?.points).toBe(0);
  });

  it('only scores the ring once it lands', () => {
    const state = createState();
    const { angle, strength } = shotAt(bottleIn('front'));
    throwRing(state, angle, strength);
    step(state, FLIGHT_TIME / 2);
    expect(state.score).toBe(0);
    expect(state.ring).not.toBeNull();
    step(state, FLIGHT_TIME / 2);
    expect(state.score).toBe(10);
    expect(state.ring).toBeNull();
  });

  it('does not spend a ring on a cancelled throw', () => {
    const state = createState();
    startCharge(state);
    step(state, 0.5);
    cancelCharge(state);
    expect(state.charge).toBeNull();
    expect(releaseCharge(state)).toBe(false);
    expect(state.ring).toBeNull();
    expect(state.ringsLeft).toBe(RINGS_PER_ROUND);
  });

  it('ignores throws while a ring is in flight', () => {
    const state = createState();
    expect(throwRing(state, SHORT.angle, SHORT.strength)).toBe(true);
    const target = state.ring?.toX;
    expect(throwRing(state, MIN_ANGLE, 1)).toBe(false);
    expect(startCharge(state)).toBe(false);
    expect(state.ringsLeft).toBe(RINGS_PER_ROUND - 1);
    expect(state.ring?.toX).toBe(target);
  });

  it('ends the round once the tenth ring lands, and not before', () => {
    const state = createState();
    for (let i = 0; i < RINGS_PER_ROUND - 1; i++) toss(state, SHORT.angle, SHORT.strength);
    expect(state.phase).toBe('playing');

    throwRing(state, SHORT.angle, SHORT.strength);
    expect(state.ringsLeft).toBe(0);
    step(state, FLIGHT_TIME / 2);
    expect(state.phase).toBe('playing');
    step(state, FLIGHT_TIME / 2);
    expect(state.phase).toBe('over');
    expect(throwRing(state, SHORT.angle, SHORT.strength)).toBe(false);
    expect(startCharge(state)).toBe(false);
  });

  it('can score every bottle in one round', () => {
    const state = createState();
    for (const bottle of [...state.bottles]) tossAt(state, bottle);
    expect(state.score).toBe(3 * (10 + 20 + 30));
  });
});

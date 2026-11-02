import { describe, expect, it } from 'vitest';
import {
  FLIGHT_TIME,
  RINGS_PER_ROUND,
  createState,
  landRing,
  scoreForRow,
  step,
  throwRing,
  type Row,
} from './game';

function bottleIn(row: Row) {
  const bottle = createState().bottles.find((b) => b.row === row);
  if (!bottle) throw new Error(`No bottle in the ${row} row`);
  return bottle;
}

/** Throws a ring at the point and lets it land. */
function toss(state: ReturnType<typeof createState>, x: number, y: number) {
  const thrown = throwRing(state, x, y);
  step(state, FLIGHT_TIME);
  return thrown;
}

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
    expect(state.phase).toBe('playing');
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
      const bottle = bottleIn(row);
      toss(state, bottle.x, bottle.y);
      expect(state.score).toBe(points);
    }
  });

  it('rings a bottle when the ring lands on its neck', () => {
    const state = createState();
    const bottle = bottleIn('middle');
    expect(landRing(state, bottle.x + 5, bottle.y - 5)).toBe(20);
    expect(state.bottles.filter((b) => b.ringed)).toHaveLength(1);
  });

  it('scores nothing for a miss', () => {
    const state = createState();
    toss(state, 10, 10);
    expect(state.score).toBe(0);
    expect(state.bottles.every((b) => !b.ringed)).toBe(true);
    expect(state.ringsLeft).toBe(RINGS_PER_ROUND - 1);
    expect(state.landings[0].points).toBe(0);
  });

  it('scores a bottle only once per round', () => {
    const state = createState();
    const bottle = bottleIn('back');
    toss(state, bottle.x, bottle.y);
    toss(state, bottle.x, bottle.y);
    expect(state.score).toBe(30);
    expect(state.landings.at(-1)?.points).toBe(0);
  });

  it('only scores the ring once it lands', () => {
    const state = createState();
    const bottle = bottleIn('front');
    throwRing(state, bottle.x, bottle.y);
    step(state, FLIGHT_TIME / 2);
    expect(state.score).toBe(0);
    expect(state.ring).not.toBeNull();
    step(state, FLIGHT_TIME / 2);
    expect(state.score).toBe(10);
    expect(state.ring).toBeNull();
  });

  it('ignores throws while a ring is in flight', () => {
    const state = createState();
    expect(throwRing(state, 10, 10)).toBe(true);
    expect(throwRing(state, 20, 20)).toBe(false);
    expect(state.ringsLeft).toBe(RINGS_PER_ROUND - 1);
    expect(state.ring?.toX).toBe(10);
  });

  it('ends the round once the tenth ring lands, and not before', () => {
    const state = createState();
    for (let i = 0; i < RINGS_PER_ROUND - 1; i++) toss(state, 10, 10);
    expect(state.phase).toBe('playing');

    throwRing(state, 10, 10);
    expect(state.ringsLeft).toBe(0);
    step(state, FLIGHT_TIME / 2);
    expect(state.phase).toBe('playing');
    step(state, FLIGHT_TIME / 2);
    expect(state.phase).toBe('over');
    expect(throwRing(state, 10, 10)).toBe(false);
  });

  it('can score every bottle in one round', () => {
    const state = createState();
    for (const bottle of state.bottles) toss(state, bottle.x, bottle.y);
    expect(state.score).toBe(3 * (10 + 20 + 30));
  });
});

import { describe, it, expect } from 'vitest';
import { canTransition, assertTransition } from './state-machine';

describe('canTransition', () => {
  it('allows pending -> planned', () => {
    expect(canTransition('pending', 'planned')).toBe(true);
  });

  it('allows planned -> approved', () => {
    expect(canTransition('planned', 'approved')).toBe(true);
  });

  it('allows planned -> cancelled', () => {
    expect(canTransition('planned', 'cancelled')).toBe(true);
  });

  it('allows approved -> executing', () => {
    expect(canTransition('approved', 'executing')).toBe(true);
  });

  it('allows executing -> completed', () => {
    expect(canTransition('executing', 'completed')).toBe(true);
  });

  it('allows executing -> cancelled', () => {
    expect(canTransition('executing', 'cancelled')).toBe(true);
  });

  it('rejects pending -> executing (must go through planned -> approved)', () => {
    expect(canTransition('pending', 'executing')).toBe(false);
  });

  it('rejects completed -> executing (terminal state)', () => {
    expect(canTransition('completed', 'executing')).toBe(false);
  });

  it('rejects cancelled -> pending (terminal state)', () => {
    expect(canTransition('cancelled', 'pending')).toBe(false);
  });
});

describe('assertTransition', () => {
  it('throws on invalid transition pending -> executing', () => {
    expect(() => assertTransition('pending', 'executing')).toThrow('Invalid state transition: pending -> executing');
  });

  it('does not throw on valid transition planned -> approved', () => {
    expect(() => assertTransition('planned', 'approved')).not.toThrow();
  });
});

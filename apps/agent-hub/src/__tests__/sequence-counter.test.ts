import { describe, it, expect } from 'vitest';
import { SequenceCounter } from '../events/sequence-counter';

describe('SequenceCounter', () => {
  it('returns 1 on first call for a new run', async () => {
    const counter = new SequenceCounter();
    const seq = await counter.next('run-1');
    expect(seq).toBe(1);
  });

  it('returns incrementing numbers for the same run', async () => {
    const counter = new SequenceCounter();
    const s1 = await counter.next('run-1');
    const s2 = await counter.next('run-1');
    const s3 = await counter.next('run-1');
    expect(s1).toBe(1);
    expect(s2).toBe(2);
    expect(s3).toBe(3);
  });

  it('returns independent sequences for different runs', async () => {
    const counter = new SequenceCounter();
    const a1 = await counter.next('run-a');
    const b1 = await counter.next('run-b');
    const a2 = await counter.next('run-a');
    const b2 = await counter.next('run-b');
    expect(a1).toBe(1);
    expect(b1).toBe(1);
    expect(a2).toBe(2);
    expect(b2).toBe(2);
  });

  it('reset clears counter for that run', async () => {
    const counter = new SequenceCounter();
    await counter.next('run-1');
    await counter.next('run-1');
    counter.reset('run-1');
    const seq = await counter.next('run-1');
    expect(seq).toBe(1);
  });

  it('reset does not affect other runs', async () => {
    const counter = new SequenceCounter();
    await counter.next('run-a');
    await counter.next('run-a');
    await counter.next('run-b');
    counter.reset('run-a');
    const bNext = await counter.next('run-b');
    expect(bNext).toBe(2);
  });
});

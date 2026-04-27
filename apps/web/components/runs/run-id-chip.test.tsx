import { describe, it, expect } from 'vitest';
import { shortSlug } from './run-id-chip';

// TODO(13-02-test): Component-render tests (RunIdChip click → clipboard write,
// 1500ms revert) are intentionally omitted in this plan because the apps/web
// workspace does not currently depend on @testing-library/react,
// @testing-library/jest-dom, or a DOM-emulating environment (jsdom/happy-dom).
// Adding those would (a) be out of scope for a UI bug-fix plan and (b) risk a
// race with Plan 13-01 which is editing apps/web hooks in parallel during this
// wave. The component itself is small (single useState + setTimeout) and is
// covered by manual UAT per .planning/phases/13-.../13-02-PLAN.md verification.
// Follow-up: install @testing-library/react + happy-dom in a dedicated test
// infrastructure plan, then expand this file with the four it() blocks
// originally drafted in 13-02-PLAN.md Task 1.

describe('shortSlug', () => {
  it('takes the first 8 chars and prefixes with #', () => {
    expect(shortSlug('275423d3-0485-475b-bc0c-bba1631918bf')).toBe('#275423d3');
  });

  it('handles strings shorter than 8 chars', () => {
    expect(shortSlug('abc')).toBe('#abc');
  });

  it('handles empty input', () => {
    expect(shortSlug('')).toBe('#');
  });
});

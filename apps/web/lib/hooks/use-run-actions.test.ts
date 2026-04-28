import { describe, it, expect } from 'vitest';
import { buildSendMessageBody } from './use-run-actions';

describe('buildSendMessageBody', () => {
  it('always includes content', () => {
    const body = buildSendMessageBody({ content: 'hello' });
    expect(body).toEqual({ content: 'hello' });
  });

  it('omits attachmentIds when undefined', () => {
    const body = buildSendMessageBody({ content: 'hi' });
    expect('attachmentIds' in body).toBe(false);
  });

  it('omits attachmentIds when empty array', () => {
    const body = buildSendMessageBody({ content: 'hi', attachmentIds: [] });
    expect('attachmentIds' in body).toBe(false);
  });

  it('includes attachmentIds when one or more provided', () => {
    const body = buildSendMessageBody({
      content: 'see attached',
      attachmentIds: ['art-1', 'art-2'],
    });
    expect(body).toEqual({
      content: 'see attached',
      attachmentIds: ['art-1', 'art-2'],
    });
  });

  it('includes targetAgent only when truthy', () => {
    expect(
      buildSendMessageBody({ content: 'hi', targetAgent: 'mo' }),
    ).toEqual({ content: 'hi', targetAgent: 'mo' });
    expect(
      'targetAgent' in
        buildSendMessageBody({ content: 'hi', targetAgent: undefined }),
    ).toBe(false);
  });

  it('includes metadata when provided', () => {
    expect(
      buildSendMessageBody({ content: 'hi', metadata: { verbosity: 3 } }),
    ).toEqual({ content: 'hi', metadata: { verbosity: 3 } });
  });

  it('forwards all three optional fields together when present', () => {
    const body = buildSendMessageBody({
      content: '@jarvis look at these',
      attachmentIds: ['art-1'],
      targetAgent: 'jarvis',
      metadata: { verbosity: 2 },
    });
    expect(body).toEqual({
      content: '@jarvis look at these',
      attachmentIds: ['art-1'],
      targetAgent: 'jarvis',
      metadata: { verbosity: 2 },
    });
  });
});

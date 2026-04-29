import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  extractAttachment,
  extractImageDescription,
  EXTRACT_CAP,
  _resetClientForTest,
} from './extract-attachment';

// SDK mock — must be hoisted via vi.mock so the mock applies before
// extract-attachment.ts evaluates its `import Anthropic from ...` statement.
const messagesCreateMock = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: messagesCreateMock },
  })),
}));

const fixturesDir = path.join(__dirname, '__fixtures__');
const readFixture = (name: string) =>
  fs.readFileSync(path.join(fixturesDir, name));

describe('extractAttachment', () => {
  it('extracts text from a PDF', async () => {
    const buf = readFixture('tiny.pdf');
    const text = await extractAttachment(buf, 'application/pdf');
    expect(text).not.toBeNull();
    expect(text!.length).toBeGreaterThan(0);
    // The fixture is a "Hello World" PDF
    expect(text!).toMatch(/Hello/i);
  });

  it('extracts text from a TXT file', async () => {
    const buf = readFixture('tiny.txt');
    const text = await extractAttachment(buf, 'text/plain');
    expect(text).toContain('hello phase 17 attachments');
  });

  it('extracts text from a markdown file', async () => {
    const buf = readFixture('tiny.md');
    const text = await extractAttachment(buf, 'text/markdown');
    expect(text).toContain('# Phase 17');
  });

  it('returns null for PNG images', async () => {
    const buf = readFixture('tiny.png');
    const text = await extractAttachment(buf, 'image/png');
    expect(text).toBeNull();
  });

  it('returns null for JPEG images', async () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG SOI marker
    const text = await extractAttachment(buf, 'image/jpeg');
    expect(text).toBeNull();
  });

  it('returns null for WEBP images', async () => {
    const buf = Buffer.alloc(20);
    const text = await extractAttachment(buf, 'image/webp');
    expect(text).toBeNull();
  });

  it('returns null for unrecognized mime types', async () => {
    const buf = Buffer.from('whatever');
    const text = await extractAttachment(buf, 'application/octet-stream');
    expect(text).toBeNull();
  });

  it('truncates oversized text with marker', async () => {
    const oversized = 'x'.repeat(EXTRACT_CAP + 1000);
    const buf = Buffer.from(oversized, 'utf-8');
    const text = await extractAttachment(buf, 'text/plain');
    expect(text).not.toBeNull();
    expect(text!.length).toBeGreaterThan(EXTRACT_CAP);
    expect(text!.startsWith('x')).toBe(true);
    // First EXTRACT_CAP chars are the input, then the marker:
    expect(text!.slice(EXTRACT_CAP)).toMatch(
      /\[\.\.\. truncated, original \d+ bytes \.\.\.\]/,
    );
  });

  it('returns null on malformed PDF (extraction failure)', async () => {
    // Logs a warning we don't want polluting test output:
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const buf = Buffer.from('not a real pdf at all');
    const text = await extractAttachment(buf, 'application/pdf');
    expect(text).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});

// DOCX path — mocked at the mammoth boundary because committing a real .docx
// fixture is more complex than the mock and the surface under test is just
// "did we call extractRawText and pass through .value with the cap?"
vi.mock('mammoth', async () => {
  return {
    default: {
      extractRawText: vi.fn().mockResolvedValue({ value: 'hello docx' }),
    },
  };
});

describe('extractAttachment DOCX path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts text via mammoth.extractRawText', async () => {
    const buf = Buffer.from('docx-bytes');
    const text = await extractAttachment(
      buf,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(text).toBe('hello docx');
  });
});

describe('extractImageDescription', () => {
  // The module caches `client` and `warnedMissingKey` across calls — reset
  // before each test so behaviour is deterministic regardless of order.
  // The env var is also save/restored so a missing-key test does not bleed
  // into a later happy-path test.
  let savedKey: string | undefined;

  beforeEach(() => {
    savedKey = process.env.ANTHROPIC_API_KEY;
    messagesCreateMock.mockReset();
    _resetClientForTest();
  });

  afterEach(() => {
    if (savedKey === undefined) {
      delete process.env.ANTHROPIC_API_KEY;
    } else {
      process.env.ANTHROPIC_API_KEY = savedKey;
    }
  });

  it('returns null when ANTHROPIC_API_KEY is absent (and never calls the SDK)', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]); // PNG header
    const out = await extractImageDescription(buf, 'image/png');
    expect(out).toBeNull();
    expect(messagesCreateMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'ANTHROPIC_API_KEY missing — image descriptions disabled',
    );
    warnSpy.mockRestore();
  });

  it('returns null for non-image mimes even when API key is set', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const buf = Buffer.from('whatever');
    expect(await extractImageDescription(buf, 'application/pdf')).toBeNull();
    expect(await extractImageDescription(buf, 'text/plain')).toBeNull();
    expect(await extractImageDescription(buf, 'text/markdown')).toBeNull();
    expect(
      await extractImageDescription(
        buf,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBeNull();
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });

  it('calls Anthropic.messages.create with the correct image content block', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    messagesCreateMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'A test description' }],
    });

    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]); // PNG-ish
    const out = await extractImageDescription(buf, 'image/png');

    expect(out).toBe('A test description');
    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
    const arg = messagesCreateMock.mock.calls[0]![0];
    expect(arg.model).toBe('claude-haiku-4-5-20251001');
    expect(arg.max_tokens).toBe(300);
    expect(arg.messages).toHaveLength(1);
    expect(arg.messages[0].role).toBe('user');
    expect(arg.messages[0].content).toHaveLength(2);
    const imageBlock = arg.messages[0].content[0];
    expect(imageBlock.type).toBe('image');
    expect(imageBlock.source.type).toBe('base64');
    expect(imageBlock.source.media_type).toBe('image/png');
    expect(imageBlock.source.data).toBe(buf.toString('base64'));
    const textBlock = arg.messages[0].content[1];
    expect(textBlock.type).toBe('text');
    expect(textBlock.text).toBe(
      "Describe this image factually in 2-4 sentences. Note key visual elements, text content if any, and overall composition. Do not interpret or speculate — just describe what's visible.",
    );
  });

  it('returns the trimmed text from the SDK response', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    messagesCreateMock.mockResolvedValueOnce({
      content: [{ type: 'text', text: '   A trimmed description.   \n' }],
    });

    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // JPEG
    const out = await extractImageDescription(buf, 'image/jpeg');
    expect(out).toBe('A trimmed description.');
  });

  it('falls back to claude-sonnet-4-6 when the Haiku call rejects', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    messagesCreateMock
      .mockRejectedValueOnce(new Error('haiku exploded'))
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: 'fallback description' }],
      });

    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const out = await extractImageDescription(buf, 'image/png');

    expect(out).toBe('fallback description');
    expect(messagesCreateMock).toHaveBeenCalledTimes(2);
    expect(messagesCreateMock.mock.calls[0]![0].model).toBe(
      'claude-haiku-4-5-20251001',
    );
    expect(messagesCreateMock.mock.calls[1]![0].model).toBe(
      'claude-sonnet-4-6',
    );
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns null AND logs a warning when both Haiku and Sonnet calls reject', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    messagesCreateMock
      .mockRejectedValueOnce(new Error('haiku 500'))
      .mockRejectedValueOnce(new Error('sonnet 500'));

    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const out = await extractImageDescription(buf, 'image/png');

    expect(out).toBeNull();
    expect(messagesCreateMock).toHaveBeenCalledTimes(2);
    // One warn per failure (no specific count contract — just at least both):
    expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    warnSpy.mockRestore();
  });

  it('returns null when SDK resolves without a text block', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    messagesCreateMock.mockResolvedValueOnce({ content: [] });

    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
    const out = await extractImageDescription(buf, 'image/png');
    expect(out).toBeNull();
    // We only made the one call — no fallback to Sonnet, since the call
    // succeeded; it's just empty. (Caller treats empty as "no description".)
    expect(messagesCreateMock).toHaveBeenCalledTimes(1);
  });
});

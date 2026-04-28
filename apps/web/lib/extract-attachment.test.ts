import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { extractAttachment, EXTRACT_CAP } from './extract-attachment';

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

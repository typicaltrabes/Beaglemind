/**
 * Phase 17.1-06 (DEFECT-17-B) — UserMessageAttachments component.
 *
 * Lucas's WhatsApp-style transcript fix: a user message bubble must render
 * attachment chips (image inline + ArtifactCard for documents) below the
 * text — never the extracted text dump. This test pins the rendering
 * contract: image/* gets an <img> with the download URL, application/pdf
 * gets an ArtifactCard with View+Download, text/markdown gets ArtifactCard
 * with Download only (markdown is NOT in PREVIEWABLE_MIMES).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';

// Mock the metadata hook BEFORE importing the component — the component
// reaches for it during render and we want deterministic synchronous fixtures.
const fixtures = new Map<
  string,
  { id: string; filename: string; mimeType: string; sizeBytes: number }
>();

vi.mock('@/lib/use-artifact-metadata', () => ({
  useArtifactMetadata: (ids: string[]) => ({
    metadata: ids
      .map((id) => fixtures.get(id))
      .filter((m): m is NonNullable<ReturnType<typeof fixtures.get>> => Boolean(m)),
    loading: false,
    error: null,
  }),
}));

import { UserMessageAttachments } from './user-message-attachments';

const PDF_ID = 'a1111111-1111-4111-8111-111111111111';
const PNG_ID = 'b2222222-2222-4222-8222-222222222222';
const MD_ID = 'c3333333-3333-4333-8333-333333333333';
const TXT_ID = 'd4444444-4444-4444-8444-444444444444';

describe('UserMessageAttachments', () => {
  beforeEach(() => {
    fixtures.clear();
    fixtures.set(PDF_ID, {
      id: PDF_ID,
      filename: 'deal-deck.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1_280_000,
    });
    fixtures.set(PNG_ID, {
      id: PNG_ID,
      filename: 'screenshot.png',
      mimeType: 'image/png',
      sizeBytes: 38_000,
    });
    fixtures.set(MD_ID, {
      id: MD_ID,
      filename: 'notes.md',
      mimeType: 'text/markdown',
      sizeBytes: 4_200,
    });
    fixtures.set(TXT_ID, {
      id: TXT_ID,
      filename: 'notes.txt',
      mimeType: 'text/plain',
      sizeBytes: 1_100,
    });
  });

  it('renders nothing when attachmentIds is empty', () => {
    const { container } = render(<UserMessageAttachments attachmentIds={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders an inline <img> using the download URL for image/png attachments', () => {
    render(<UserMessageAttachments attachmentIds={[PNG_ID]} />);
    const img = screen.getByRole('img', { name: 'screenshot.png' });
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe(`/api/artifacts/${PNG_ID}/download`);
    expect(img.getAttribute('loading')).toBe('lazy');
    // max-h-60 caps the rendered thumbnail (~240px) so chart-heavy images
    // don't blow up the bubble.
    expect(img.getAttribute('class') ?? '').toContain('max-h-60');
  });

  it('renders an ArtifactCard with a View button for application/pdf', () => {
    render(<UserMessageAttachments attachmentIds={[PDF_ID]} />);
    expect(screen.getByText('deal-deck.pdf')).toBeTruthy();
    // PDF is in PREVIEWABLE_MIMES → ArtifactCard exposes a View button.
    const viewBtn = screen.getByRole('button', { name: /view/i });
    expect(viewBtn).toBeTruthy();
    // Download is always present on ArtifactCard — rendered as an <a>, picked
    // up by the accessible-name "Download" string regardless of role.
    expect(screen.getByText('Download')).toBeTruthy();
  });

  it('renders an ArtifactCard with Download but NO View for text/markdown (not in PREVIEWABLE_MIMES)', () => {
    render(<UserMessageAttachments attachmentIds={[MD_ID]} />);
    expect(screen.getByText('notes.md')).toBeTruthy();
    expect(screen.getByText('Download')).toBeTruthy();
    // Markdown isn't in PREVIEWABLE_MIMES (set is { pdf, docx }) so View is
    // suppressed.
    expect(screen.queryByRole('button', { name: /view/i })).toBeNull();
  });

  it('renders a mixed list (PDF + PNG + TXT) — all three appear, in input order', () => {
    const { container } = render(
      <UserMessageAttachments attachmentIds={[PDF_ID, PNG_ID, TXT_ID]} />,
    );
    // Filename presence covers the document chips.
    expect(screen.getByText('deal-deck.pdf')).toBeTruthy();
    expect(screen.getByText('notes.txt')).toBeTruthy();
    // Image chip — alt text identifies it.
    expect(screen.getByRole('img', { name: 'screenshot.png' })).toBeTruthy();

    // Order check: the rendered chips should appear in the same order as the
    // input attachmentIds. Walk the children and assert the ordering by
    // looking for distinguishing text/role on each direct child.
    const root = container.firstElementChild;
    expect(root).toBeTruthy();
    const childCount = root!.children.length;
    expect(childCount).toBe(3);
    // First child contains the PDF filename.
    expect(within(root!.children[0] as HTMLElement).getByText('deal-deck.pdf')).toBeTruthy();
    // Second child contains the image.
    expect(within(root!.children[1] as HTMLElement).getByRole('img')).toBeTruthy();
    // Third child contains the TXT filename.
    expect(within(root!.children[2] as HTMLElement).getByText('notes.txt')).toBeTruthy();
  });
});

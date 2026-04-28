/**
 * Client helper for posting a single user-attached file to the run-scoped
 * staging endpoint built in Plan 17-02. Modeled on `litellm-client.ts`:
 * thin fetch wrapper + typed error class + JSON-shaped response.
 *
 * Critical: this MUST NOT set the `Content-Type` header manually. The
 * browser is responsible for inserting the multipart boundary into the
 * Content-Type when the body is a FormData instance — manually setting
 * the header strips the boundary and the server rejects the request.
 */

export class AttachmentUploadError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AttachmentUploadError';
  }
}

export interface UploadResponse {
  artifactId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export async function uploadAttachment(
  runId: string,
  file: File,
): Promise<UploadResponse> {
  const fd = new FormData();
  fd.append('file', file);

  const res = await fetch(`/api/runs/${runId}/attachments`, {
    method: 'POST',
    body: fd,
    // NOTE: do NOT set Content-Type — the browser sets it with the
    // multipart boundary parameter required for the server to parse.
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new AttachmentUploadError(
      res.status,
      errBody.error ?? res.statusText ?? 'Upload failed',
    );
  }

  return (await res.json()) as UploadResponse;
}

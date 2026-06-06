import { PDFParse } from 'pdf-parse';

const MAX_RESUME_PDF_BYTES = 5 * 1024 * 1024;

export type ResumeParseErrorCode =
  | 'invalid_file_type'
  | 'file_too_large'
  | 'empty_file'
  | 'empty_extraction'
  | 'parse_failed';

export class ResumeParseError extends Error {
  constructor(
    public readonly code: ResumeParseErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ResumeParseError';
  }
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function parsePdfResume(input: {
  bytes: Uint8Array;
  fileName?: string;
  mimeType?: string;
}): Promise<{ resumeText: string }> {
  const { bytes, fileName, mimeType } = input;
  const normalizedName = fileName?.toLowerCase() ?? '';

  if (mimeType !== 'application/pdf' && !normalizedName.endsWith('.pdf')) {
    throw new ResumeParseError(
      'invalid_file_type',
      'Please upload a PDF file. DOCX and OCR-based uploads are not supported in this flow.',
    );
  }

  if (bytes.byteLength === 0) {
    throw new ResumeParseError('empty_file', 'This PDF appears to be empty.');
  }

  if (bytes.byteLength > MAX_RESUME_PDF_BYTES) {
    throw new ResumeParseError(
      'file_too_large',
      'This PDF is too large for the current upload flow. Keep it under 5 MB.',
    );
  }

  let extractedText = '';

  try {
    const parser = new PDFParse({ data: Buffer.from(bytes) });
    try {
      const parsed = await parser.getText();
      extractedText = normalizeExtractedText(parsed.text ?? '');
    } finally {
      await parser.destroy();
    }
  } catch {
    throw new ResumeParseError(
      'parse_failed',
      'We could not read text from that PDF. Try a text-based PDF export.',
    );
  }

  if (!extractedText) {
    throw new ResumeParseError(
      'empty_extraction',
      'We could not extract readable text from that PDF. Try a text-based PDF export.',
    );
  }

  return { resumeText: extractedText };
}

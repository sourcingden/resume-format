import { Router, Request, Response } from 'express';
import multer from 'multer';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ─── LibreOffice convert (converts buffer → buffer) ────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const libre = require('libreoffice-convert');
const libreConvert = promisify(libre.convert) as (
  buffer: Buffer,
  ext: string,
  filter: string | undefined
) => Promise<Buffer>;

// ─── PDF text extraction (Node-side, no worker needed) ─────────────────────
// We call pdfjs-dist in "legacy" mode (no Web Worker) on the server.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');

export const cdrRouter = Router();

// multer – store uploads in memory (files are typically < 50 MB for resumes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB max
  fileFilter: (_req, file, cb) => {
    const ok =
      file.originalname.toLowerCase().endsWith('.cdr') ||
      file.mimetype === 'application/x-cdr' ||
      file.mimetype === 'image/x-cdr' ||
      file.mimetype === 'application/cdr';
    if (!ok) {
      cb(new Error('Only .cdr files are accepted'));
    } else {
      cb(null, true);
    }
  },
});

// ─── Helpers ───────────────────────────────────────────────────────────────

function normalizeText(text: string): string {
  return text
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl')
    .replace(/\uFFFD/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\u00AD/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ +$/gm, '')
    .replace(/(\n\s*){3,}/g, '\n\n')
    .trim();
}

async function extractTextFromPdfBuffer(pdfBuffer: Buffer): Promise<string> {
  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfBuffer) });
  const pdfDoc = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();

    interface PdfTextItem {
      str: string;
      transform: number[];
      width: number;
      height: number;
    }

    const items = (content.items as PdfTextItem[])
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
        height: it.height,
      }));

    if (items.length === 0) {
      pageTexts.push('');
      continue;
    }

    // Simple single-column extraction: sort top→bottom (PDF Y is bottom-up)
    const sorted = items.sort((a, b) => b.y - a.y);
    let pageText = '';
    let lastY: number | null = null;

    for (const item of sorted) {
      if (lastY !== null) {
        const yDelta = Math.abs(lastY - item.y);
        if (yDelta > 3) {
          pageText += '\n';
        } else if (!pageText.endsWith(' ') && !pageText.endsWith('\n') && item.str !== ' ') {
          pageText += ' ';
        }
      }
      pageText += item.str;
      lastY = item.y;
    }

    pageTexts.push(pageText.trim());
  }

  return normalizeText(pageTexts.join('\n\n'));
}

// ─── Route: POST /api/convert-cdr ──────────────────────────────────────────
cdrRouter.post(
  '/convert-cdr',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    const file = req.file;

    if (!file) {
      res.status(400).json({ error: 'No .cdr file uploaded.' });
      return;
    }

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cdr-'));
    const tmpCdr = path.join(tmpDir, file.originalname);
    const tmpPdf = path.join(tmpDir, file.originalname.replace(/\.cdr$/i, '.pdf'));

    try {
      console.log(`[CDR] Converting: ${file.originalname} (${file.size} bytes)`);

      // Step 1 — write CDR to temp dir (needed by some LibreOffice versions)
      await fs.writeFile(tmpCdr, file.buffer);

      // Step 2 — convert CDR → PDF using LibreOffice headless
      let pdfBuffer: Buffer;
      try {
        pdfBuffer = await libreConvert(file.buffer, '.pdf', undefined);
      } catch (convErr) {
        console.error('[CDR] LibreOffice conversion failed:', convErr);
        const errMsg = (convErr as Error).message ?? String(convErr);
        if (
          errMsg.includes('soffice') ||
          errMsg.includes('spawn') ||
          errMsg.includes('ENOENT')
        ) {
          res.status(503).json({
            error:
              'LibreOffice is not installed. Please run: brew install --cask libreoffice',
          });
        } else {
          res.status(500).json({ error: `CDR→PDF conversion failed: ${errMsg}` });
        }
        return;
      }

      // Step 3 — extract text from the resulting PDF
      const text = await extractTextFromPdfBuffer(pdfBuffer);

      if (!text.trim()) {
        // Text might be embedded as curves — signal the client
        res.status(422).json({
          error:
            'No readable text found in the CDR file. ' +
            'The text may have been converted to curves in CorelDRAW. ' +
            'Please export as PDF with actual text, or paste the resume text manually.',
        });
        return;
      }

      console.log(`[CDR] Extracted ${text.length} chars from ${file.originalname}`);
      res.json({ text });
    } catch (err) {
      console.error('[CDR] Unexpected error:', err);
      res.status(500).json({ error: `Conversion error: ${(err as Error).message}` });
    } finally {
      // Clean up temp files
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      if (fsSync.existsSync(tmpPdf))
        await fs.unlink(tmpPdf).catch(() => {});
    }
  }
);

import { Router, Request, Response } from 'express';
import multer from 'multer';
import { promisify } from 'util';
import * as fs from 'fs/promises';
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

// ─── Route: POST /api/convert-cdr ──────────────────────────────────────────
// Converts a CDR file to PDF and returns the PDF binary.
// Text extraction is handled on the frontend by the existing extractTextFromPDF().
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

    try {
      console.log(`[CDR] Converting: ${file.originalname} (${file.size} bytes)`);

      // Convert CDR → PDF using LibreOffice headless
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
            error: 'LibreOffice is not installed. Please run: brew install --cask libreoffice',
          });
        } else {
          res.status(500).json({ error: `CDR→PDF conversion failed: ${errMsg}` });
        }
        return;
      }

      console.log(`[CDR] Converted to PDF (${pdfBuffer.length} bytes), sending to client`);

      // Return the PDF binary — the frontend will extract text using its own pdfjs pipeline
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `inline; filename="${file.originalname.replace(/\.cdr$/i, '.pdf')}"`);
      res.send(pdfBuffer);
    } catch (err) {
      console.error('[CDR] Unexpected error:', err);
      res.status(500).json({ error: `Conversion error: ${(err as Error).message}` });
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }
);

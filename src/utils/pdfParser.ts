import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure the worker to use the local version
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Cluster X-positions into columns using a gap-threshold approach.
 * Returns an array of column X-start values, sorted left→right.
 */
function detectColumns(items: TextItem[], pageWidth: number): number[] {
  if (items.length === 0) return [0];

  const xPositions = [...new Set(items.map(i => Math.round(i.x)))].sort((a, b) => a - b);
  const GAP_THRESHOLD = pageWidth * 0.12; // 12% of page width signals a new column

  const columnStarts: number[] = [xPositions[0]];
  for (let i = 1; i < xPositions.length; i++) {
    if (xPositions[i] - xPositions[i - 1] > GAP_THRESHOLD) {
      columnStarts.push(xPositions[i]);
    }
  }
  return columnStarts;
}

/**
 * Given column start X positions, assign each item to its column.
 */
function assignToColumn(itemX: number, columnStarts: number[]): number {
  let col = 0;
  for (let i = 0; i < columnStarts.length; i++) {
    if (itemX >= columnStarts[i] - 5) col = i;
  }
  return col;
}

/**
 * Normalize extracted text:
 * - Fix common ligature sequences (ﬁ→fi, ﬂ→fl, etc.)
 * - Remove Unicode replacement characters
 * - Collapse excessive whitespace / blank lines
 */
function normalizeText(text: string): string {
  return text
    // Common PDF ligature artifacts
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl')
    .replace(/\uFB05/g, 'st')
    .replace(/\uFB06/g, 'st')
    // Unicode replacement character
    .replace(/\uFFFD/g, '')
    // Non-breaking spaces → regular space
    .replace(/\u00A0/g, ' ')
    // Soft hyphens (invisible)
    .replace(/\u00AD/g, '')
    // Collapse runs of spaces to single space per line
    .replace(/[^\S\n]+/g, ' ')
    // Remove trailing spaces on each line
    .replace(/ +$/gm, '')
    // Collapse 3+ consecutive blank lines to 2
    .replace(/(\n\s*){3,}/g, '\n\n')
    .trim();
}

export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const allPageTexts: string[] = [];

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      const pageWidth = viewport.width;
      const content = await page.getTextContent();

      // Build typed item list
      const items: TextItem[] = (content.items as any[])
        .filter(it => it.str && it.str.trim())
        .map(it => ({
          str: it.str as string,
          x: it.transform[4] as number,
          y: it.transform[5] as number,
          width: it.width as number,
          height: it.height as number,
        }));

      if (items.length === 0) {
        allPageTexts.push('');
        continue;
      }

      // Detect columns
      const columnStarts = detectColumns(items, pageWidth);
      const isMultiColumn = columnStarts.length >= 2;

      let pageText: string;

      if (isMultiColumn) {
        // Group items by column, then sort each column top→bottom
        const columns: TextItem[][] = columnStarts.map(() => []);
        for (const item of items) {
          const col = assignToColumn(item.x, columnStarts);
          columns[col].push(item);
        }

        const columnTexts = columns.map(colItems => {
          const sorted = colItems.sort((a, b) => b.y - a.y); // PDF Y is bottom-up
          let colText = '';
          let lastY: number | null = null;

          for (const item of sorted) {
            if (lastY !== null) {
              const yDelta = Math.abs(lastY - item.y);
              if (yDelta > item.height * 0.6) {
                colText += '\n';
              } else if (!colText.endsWith(' ') && !colText.endsWith('\n') && item.str !== ' ') {
                colText += ' ';
              }
            }
            colText += item.str;
            lastY = item.y;
          }
          return colText.trim();
        });

        pageText = columnTexts.filter(Boolean).join('\n\n');
      } else {
        // Single column: sort top→bottom
        const sorted = items.sort((a, b) => b.y - a.y);
        let colText = '';
        let lastY: number | null = null;

        for (const item of sorted) {
          if (lastY !== null) {
            const yDelta = Math.abs(lastY - item.y);
            if (yDelta > 3) {
              colText += '\n';
            } else if (!colText.endsWith(' ') && !colText.endsWith('\n') && item.str !== ' ') {
              colText += ' ';
            }
          }
          colText += item.str;
          lastY = item.y;
        }
        pageText = colText.trim();
      }

      allPageTexts.push(pageText);
    }

    return normalizeText(allPageTexts.join('\n\n'));
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to parse PDF file. Please try pasting the text instead.');
  }
}

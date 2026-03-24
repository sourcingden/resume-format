import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Configure the worker to use the local version
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      
      let pageText = '';
      let lastY: number | null = null;
      
      for (const item of content.items as any[]) {
        if (!item.str) continue;
        
        const currentY = item.transform[5];
        if (lastY !== null && Math.abs(currentY - lastY) > 3) {
           pageText += '\n';
        } else if (lastY !== null && pageText.length > 0 && !pageText.endsWith(' ') && !pageText.endsWith('\n') && item.str !== ' ') {
            pageText += ' ';
        }
        
        pageText += item.str;
        lastY = currentY;
      }
      text += pageText + '\n\n';
    }
    
    return text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to parse PDF file. Please try pasting the text instead.');
  }
}

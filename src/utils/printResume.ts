/**
 * Prints the resume preview element as a PDF using the browser's native print dialog.
 * This captures the existing HTML/CSS exactly as rendered (including header/footer images,
 * Tailwind classes, fonts), giving pixel-perfect output matching the on-screen preview.
 */
export function printResume(
  sourceElement: HTMLElement,
  fileName: string
): void {
  // Collect all stylesheets from the current document
  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((link) => link.outerHTML)
    .join('\n');

  const styleTags = Array.from(document.querySelectorAll('style'))
    .map((style) => `<style>${style.innerHTML}</style>`)
    .join('\n');

  // Clone the element so we don't mutate the live DOM
  const cloned = sourceElement.cloneNode(true) as HTMLElement;

  // Build a standalone HTML document with all styles and the resume content
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${fileName}</title>
  ${styleLinks}
  ${styleTags}
  <style>
    * { -webkit-print-color-adjust: exact !important; color-adjust: exact !important; print-color-adjust: exact !important; }
    body { margin: 0; padding: 0; background: white; }
    @media print {
      @page { margin: 0; size: A4; }
      body { margin: 0; padding: 0; }
      .avoid-break { break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${cloned.outerHTML}
</body>
</html>`;

  // Open a hidden iframe, write the content, and trigger print
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) {
    document.body.removeChild(iframe);
    throw new Error('Could not access iframe document');
  }

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  // Wait for images to load before printing
  iframe.onload = () => {
    const images = Array.from(iframeDoc.images);
    const imagePromises = images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.onload = () => resolve();
            img.onerror = () => resolve(); // don't block on broken images
          }
        })
    );

    Promise.all(imagePromises).then(() => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        // Clean up the iframe after printing
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 200);
    });
  };
}

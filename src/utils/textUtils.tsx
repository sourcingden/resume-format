import React from 'react';

/**
 * Parses a string containing Markdown-style bold markers (**text**)
 * and line breaks, returning an array of React elements.
 */
export function formatBoldText(text: string): React.ReactNode[] {
  if (!text) return [];
  
  const parts = text.split(/(\*\*.*?\*\*|\n)/g);
  return parts.map((part, i) => {
    if (part === '\n') {
      return <br key={i} />;
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

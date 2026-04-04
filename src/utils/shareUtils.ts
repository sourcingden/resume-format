import LZString from 'lz-string';
import { ResumeData } from '../types';

/**
 * Compresses and encodes resume data into a URL-safe string
 */
export const encodeResumeToURL = (data: ResumeData): string => {
  const jsonString = JSON.stringify(data);
  return LZString.compressToEncodedURIComponent(jsonString);
};

/**
 * Decodes and decompresses resume data from a URL-safe string
 */
export const decodeResumeFromURL = (encodedStr: string): ResumeData | null => {
  try {
    const jsonString = LZString.decompressFromEncodedURIComponent(encodedStr);
    if (!jsonString) return null;
    
    const data = JSON.parse(jsonString) as ResumeData;
    return data;
  } catch (error) {
    console.error('Failed to decode resume from URL:', error);
    return null;
  }
};

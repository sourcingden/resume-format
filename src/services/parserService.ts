import OpenAI from 'openai';
import { ResumeData, resumeSchema } from '../types';

const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || '';
const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: API_KEY,
  dangerouslyAllowBrowser: true,
});

const SYSTEM_PROMPT = `
You are an expert resume parser. Your task is to extract structured data from the provided resume text.
Return ONLY a valid JSON object matching the following TypeScript interface:

interface ResumeData {
  analysis: string; // Step-by-step reasoning about the candidate's core expertise, identifying ambiguities, and planning the extraction. This acts as an implicit chain-of-thought to improve extraction fidelity.
  jobTitle: string;
  name: string;
  hrSummary: string;
  skills: {
    category: string;
    items: string[];
  }[];
  experience: {
    role: string;
    company: string;
    dates: string;
    description: string;
    responsibilities: string[];
    techStack: string; // Comma separated list of technologies used in this role
  }[];
  education: {
    degree: string;
    institution: string;
    dates: string;
  }[];
  languages: {
    language: string;
    level: string;
  }[];
  achievements: string[]; // Notable achievements, awards, or recognitions (each as a short string)
  certifications: {
    title: string;
    issuer: string;
    date: string;
  }[];
  publications: {
    title: string;
    details: string; // Authors, journal/conference, year, DOI, etc.
  }[];
  projects: {
    title: string;
    description: string;
    technologies: string; // Comma separated list
    link: string;
  }[];
}

Rules:
0. MUST provide detailed reasoning in the "analysis" field FIRST, before extracting other fields.
1. Extract the name and current/target job title accurately.
2. The hrSummary should be a brief professional overview.
3. Group skills into meaningful categories (e.g., Programming Languages, Frameworks, Tools).
4. For each experience entry:
   - Identify the role, company, and dates (e.g., "May 2021 - Present").
   - Extract a general description if available.
   - List specific responsibilities as an array of strings.
   - Extract the specific tech stack used in that role.
5. Extract education history including degree, institution, and dates.
6. Extract languages and proficiency levels.
7. DO NOT extract any contact information (emails, phone numbers, LinkedIn, or other social links). Ensure candidate privacy.
8. Extract achievements as a concise list of accomplishments, awards, or honours.
9. Extract certifications with title, issuer, and date.
10. Extract publications with title and bibliographic details.
11. Extract projects with title, description, technologies used, and any links.
12. IMPORTANT: When extracting "hrSummary", "description" (in experience), or projects' "description", you MUST use Markdown-style bolding (\`**text**\`) strictly for highlighting key technologies, massive achievements, or impact metrics (e.g., "\`**React, TypeScript**\`", "\`**+40% performance**\`").
13. If a field is missing, use an empty string or empty array as appropriate.
14. Ensure the output is strictly valid JSON. No markdown code blocks, just the JSON.
`;

const MAX_RETRIES = 3;

function extractRetryDelaySec(error: unknown): number {
  try {
    const msg = (error as Error)?.message ?? '';

    // Try to extract retry-after from error message
    const match1 = msg.match(/retry(?:[-_ ]?after)?[\"'\\s:]+([0-9.]+)/i);
    if (match1 && match1[1]) {
      return Math.ceil(parseFloat(match1[1]));
    }

    const match2 = msg.match(/retry in ([0-9.]+)\s*s/i);
    if (match2 && match2[1]) {
      return Math.ceil(parseFloat(match2[1]));
    }

    // Try JSON extraction
    const jsonStart = msg.indexOf('{');
    if (jsonStart !== -1) {
      const body = JSON.parse(msg.slice(jsonStart));
      const details = body?.error?.details ?? [];
      for (const detail of details) {
        if (detail['@type']?.includes('RetryInfo') && detail.retryDelay) {
          return parseInt(detail.retryDelay, 10) || 60;
        }
      }
    }
  } catch (e) {
    // ignore parse errors
  }
  return 60;
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof OpenAI.RateLimitError) return true;
  const msg = (error as Error)?.message ?? '';
  return msg.includes('429') || msg.includes('rate_limit') || msg.includes('RESOURCE_EXHAUSTED');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Strips illegal ASCII control characters from a string (not inside JSON yet).
 * Keeps \t (0x09), \n (0x0A), \r (0x0D) which JSON allows escaped.
 */
function sanitizeJson(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/**
 * Robustly extracts the first top-level JSON object from a model response.
 * Handles:
 *  - Markdown code fences (```json ... ``` or ``` ... ```)
 *  - Extra commentary text before/after the JSON
 *  - Unbalanced trailing text after the closing brace
 * Throws if no valid JSON object boundary can be found.
 */
function extractJson(raw: string): string {
  const cleaned = sanitizeJson(raw);

  const start = cleaned.indexOf('{');
  if (start === -1) throw new SyntaxError('No JSON object found in model response.');

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];

    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }

  throw new SyntaxError('JSON object in model response appears to be truncated.');
}

export async function parseResume(
  text: string,
  onProgress?: (progress: number, status: string) => void
): Promise<ResumeData> {
  if (!API_KEY) {
    throw new Error('VITE_DEEPSEEK_API_KEY is not configured. Please add it to your environment.');
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (onProgress) onProgress(20, 'Connecting to AI parser...');

      const stream = await client.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Resume Text:\n${text}` },
        ],
        stream: true,
        response_format: { type: 'json_object' },
        max_tokens: 8192,
      });

      let textResponse = '';
      let receivedBytes = 0;
      const EST_EXPECTED_BYTES = 2000;

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (delta) {
          textResponse += delta;
          receivedBytes += delta.length;

          if (onProgress) {
            const factor = Math.min(1, receivedBytes / EST_EXPECTED_BYTES);
            // Progress from 20% to 90%
            const currentP = 20 + (factor * 70);
            onProgress(currentP, 'Streaming structured data...');
          }
        }
      }

      if (onProgress) onProgress(92, 'Extracting JSON structure...');
      const rawData = JSON.parse(extractJson(textResponse));

      if (onProgress) onProgress(96, 'Validating data schema...');
      // Validate structural integrity and default missing fields using Zod
      const parsedData = resumeSchema.parse(rawData);

      if (onProgress) onProgress(100, 'Formatting results...');
      return refineData(parsedData);
    } catch (error) {
      const isLastAttempt = attempt === MAX_RETRIES;

      if (isRateLimitError(error)) {
        const delaySec = extractRetryDelaySec(error);
        console.warn(`DeepSeek rate limit hit (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delaySec}s…`);

        if (isLastAttempt) {
          throw new Error(
            `The AI service is currently rate-limited. Please wait about ${delaySec} seconds and try again.`
          );
        }

        await sleep(delaySec * 1000);
        continue;
      }

      console.error('Error parsing resume with DeepSeek or validating structure:', error);
      throw new Error('Failed to parse resume using AI or invalid data format returned. Please try again.');
    }
  }

  throw new Error('Unexpected error in parseResume.');
}

function refineData(data: ResumeData): ResumeData {
  // Professional refinement of experience fields and listification
  data.experience = data.experience
    .filter(e => e.company || e.role)
    .map(e => {
      let responsibilities = e.responsibilities;
      let description = e.description.trim();

      // Auto-listification if the model didn't quite get the array right but sent a long string
      if (responsibilities.length === 0 && description.length > 50) {
        const sentences = description.split(/[\.!\?][\s\n]+/).filter(s => s.trim().length > 10);
        if (sentences.length > 1) {
          responsibilities = sentences.map(s => s.trim());
          description = '';
        }
      }

      return {
        ...e,
        company: e.company.trim(),
        role: e.role.trim(),
        dates: e.dates.trim(),
        description,
        responsibilities: responsibilities.map(r => r.trim()),
      };
    });

  return data;
}

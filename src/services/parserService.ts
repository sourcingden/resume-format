import OpenAI from 'openai';
import { ResumeData, resumeSchema } from '../types';
import { ZodError } from 'zod';

const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || '';
const client = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: API_KEY,
  dangerouslyAllowBrowser: true,
});

// ─── Quirky cycling status words shown during AI processing ───────────────────
const THINKING_WORDS = [
  'Waffling…',
  'Oscillating…',
  'Catastrophizing…',
  'Spiraling…',
  'Hedging…',
  'Faffing…',
  'Kerfuffling…',
  'Bouncing…',
  'Twinkling…',
  'Overdosing…',
  'Dancing…',
  'Levitating…',
  'Discombobulating…',
  'Existentialising…',
  'Caffeinating…',
  'Pruning…',
  'Flibbertigibetting…',
  'Finagling…',
  'Gliding…',
  'Gerrymandering…',
  'Flexing…',
  'Zesting…',
];

// ─── System prompt ─────────────────────────────────────────────────────────────
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
2. The hrSummary should be a brief professional overview (2-4 sentences).
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
14. Stay strictly grounded in the source text — do NOT hallucinate or invent details not present.
15. Ensure the output is strictly valid JSON. No markdown code blocks, just the JSON.
16. CRITICAL: ALL output fields MUST be in English. If the resume contains text in any other language (Ukrainian, Russian, etc.), translate every field — including language names, proficiency levels (e.g. "Рідна мова" → "Native", "Вище середнього" → "Upper Intermediate"), job titles, company names, descriptions, responsibilities, degree names, institution names, achievements, and any other content — into English before outputting. The final JSON must contain zero non-English text.
`;

const MAX_RETRIES = 3;
const SIMPLE_RESUME_THRESHOLD = 1500; // characters

// ─── Utility helpers ───────────────────────────────────────────────────────────

function extractRetryDelaySec(error: unknown): number {
  try {
    const msg = (error as Error)?.message ?? '';
    const match1 = msg.match(/retry(?:[-_ ]?after)?[\"'\\\s:]+([0-9.]+)/i);
    if (match1?.[1]) return Math.ceil(parseFloat(match1[1]));
    const match2 = msg.match(/retry in ([0-9.]+)\s*s/i);
    if (match2?.[1]) return Math.ceil(parseFloat(match2[1]));
    const jsonStart = msg.indexOf('{');
    if (jsonStart !== -1) {
      const body = JSON.parse(msg.slice(jsonStart));
      for (const detail of body?.error?.details ?? []) {
        if (detail['@type']?.includes('RetryInfo') && detail.retryDelay) {
          return parseInt(detail.retryDelay, 10) || 60;
        }
      }
    }
  } catch {
    // ignore
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

function sanitizeJson(raw: string): string {
  // eslint-disable-next-line no-control-regex
  return raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

/**
 * Robustly extracts the first top-level JSON object from a model response.
 * Handles markdown fences, leading commentary, and trailing noise.
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

/**
 * Determines which DeepSeek model to use based on resume complexity.
 *  - Short / plain text  → deepseek-chat  (V3, fast & cheap)
 *  - Long / complex      → deepseek-reasoner (R1, better reasoning)
 */
function selectModel(text: string): { model: string; label: string } {
  if (text.length < SIMPLE_RESUME_THRESHOLD) {
    return { model: 'deepseek-chat', label: 'V3' };
  }
  return { model: 'deepseek-reasoner', label: 'R1' };
}

/**
 * Format Zod validation errors into a compact human-readable string
 * that can be fed back to the LLM as a correction prompt.
 */
function formatZodErrors(err: ZodError): string {
  return err.issues
    .map(e => `• ${e.path.join('.')}: ${e.message}`)
    .join('\n');
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function parseResume(
  text: string,
  onProgress?: (progress: number, status: string) => void
): Promise<ResumeData> {
  if (!API_KEY) {
    throw new Error('VITE_DEEPSEEK_API_KEY is not configured. Please add it to your environment.');
  }

  const { model } = selectModel(text);
  let thinkingIdx = 0;

  // Rotate through quirky thinking words while streaming
  let thinkingInterval: ReturnType<typeof setInterval> | null = null;
  const startThinkingRotation = (baseProgress: number) => {
    if (!onProgress) return;
    thinkingInterval = setInterval(() => {
      onProgress(baseProgress, THINKING_WORDS[thinkingIdx % THINKING_WORDS.length]);
      thinkingIdx++;
    }, 1800);
  };
  const stopThinkingRotation = () => {
    if (thinkingInterval) { clearInterval(thinkingInterval); thinkingInterval = null; }
  };

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      onProgress?.(15, 'Routing to model…');
      await sleep(300);

      onProgress?.(20, THINKING_WORDS[0]);
      startThinkingRotation(20);

      // ── First pass: stream the full response ──────────────────────────────
      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Resume Text:\n${text}` },
      ];

      const stream = await client.chat.completions.create({
        model,
        messages,
        stream: true,
        response_format: { type: 'json_object' },
        max_tokens: 16384,
        temperature: 0.6,
      });

      let textResponse = '';
      let receivedBytes = 0;
      const EST_EXPECTED_BYTES = 3000;

      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (!delta) continue; // skip empty keep-alive chunks
        textResponse += delta;
        receivedBytes += delta.length;

        // Advance progress 20→85 as tokens arrive (rough estimate)
        const factor = Math.min(1, receivedBytes / EST_EXPECTED_BYTES);
        const currentP = 20 + factor * 65;
        // Let the rotating words show — only update the number
        if (onProgress) onProgress(currentP, THINKING_WORDS[thinkingIdx % THINKING_WORDS.length]);
      }

      stopThinkingRotation();
      onProgress?.(88, 'Extracting JSON structure…');
      const rawData = JSON.parse(extractJson(textResponse));

      onProgress?.(93, 'Validating schema…');

      // ── Validation with feedback re-ask loop ──────────────────────────────
      let parsedData: ResumeData;
      try {
        parsedData = resumeSchema.parse(rawData);
      } catch (zodErr) {
        if (zodErr instanceof ZodError) {
          // Send errors back to LLM for self-correction (one round)
          onProgress?.(95, 'Fixing validation errors…');
          const errorSummary = formatZodErrors(zodErr);

          const correctionStream = await client.chat.completions.create({
            model,
            messages: [
              ...messages,
              { role: 'assistant', content: textResponse },
              {
                role: 'user',
                content: `The JSON you returned failed schema validation with these errors:\n${errorSummary}\n\nPlease return the corrected JSON object only, fixing all listed issues.`,
              },
            ],
            stream: true,
            response_format: { type: 'json_object' },
            max_tokens: 16384,
            temperature: 0.4,
          });

          let correctedResponse = '';
          for await (const chunk of correctionStream) {
            const delta = chunk.choices?.[0]?.delta?.content ?? '';
            if (delta) correctedResponse += delta;
          }

          const correctedData = JSON.parse(extractJson(correctedResponse));
          parsedData = resumeSchema.parse(correctedData); // throws if still invalid
        } else {
          throw zodErr;
        }
      }

      onProgress?.(100, 'Done!');
      return refineData(parsedData);
    } catch (error) {
      stopThinkingRotation();
      const isLastAttempt = attempt === MAX_RETRIES;

      if (isRateLimitError(error)) {
        const delaySec = extractRetryDelaySec(error);
        console.warn(`DeepSeek rate limit hit (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delaySec}s…`);
        if (isLastAttempt) {
          throw new Error(`The AI service is currently rate-limited. Please wait about ${delaySec} seconds and try again.`);
        }
        onProgress?.(10, `Rate limited — retrying in ${delaySec}s…`);
        await sleep(delaySec * 1000);
        continue;
      }

      console.error('Error parsing resume with DeepSeek or validating structure:', error);
      throw new Error('Failed to parse resume using AI or invalid data format returned. Please try again.');
    }
  }

  throw new Error('Unexpected error in parseResume.');
}

// ─── Post-processing ───────────────────────────────────────────────────────────

function refineData(data: ResumeData): ResumeData {
  data.experience = data.experience
    .filter(e => e.company || e.role)
    .map(e => {
      let responsibilities = e.responsibilities;
      let description = e.description.trim();

      // Auto-listification if the model sent a long description instead of an array
      if (responsibilities.length === 0 && description.length > 50) {
        const sentences = description.split(/[.!?][\s\n]+/).filter(s => s.trim().length > 10);
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
        responsibilities: responsibilities.map(r => r.trim()).filter(Boolean),
      };
    });

  return data;
}

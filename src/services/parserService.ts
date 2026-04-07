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
You are an expert resume parser. Extract structured data from the provided resume text.
Return ONLY a valid JSON object matching this interface:

interface ResumeData {
  jobTitle: string;
  name: string;
  hrSummary: string; // 2-3 sentences max
  skills: { category: string; items: string[] }[];
  experience: {
    role: string;
    company: string;
    dates: string;
    description: string; // 1 sentence max
    responsibilities: string[]; // max 5 bullet points per role
    techStack: string; // comma-separated
  }[];
  education: { degree: string; institution: string; dates: string }[];
  languages: { language: string; level: string }[];
  achievements: string[];
  certifications: { title: string; issuer: string; date: string }[];
  publications: { title: string; details: string }[];
  projects: { title: string; description: string; technologies: string; link: string }[];
}

Rules:
1. Extract name and job title accurately.
2. Group skills into categories (e.g., Languages, Frameworks, Tools).
3. Keep responsibilities concise — max 5 per role, one sentence each.
4. DO NOT include contact information (emails, phones, social links).
5. Use **bold** for key technologies and metrics in hrSummary and descriptions.
6. Use empty string or empty array for missing fields.
7. Stay grounded in source text — do NOT hallucinate.
8. Output strictly valid JSON, no markdown fences.
9. ALL fields MUST be in English. Translate any non-English content.
10. Be concise — keep total output under 4000 tokens.
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
 * Attempts to repair a truncated JSON string by closing unclosed strings,
 * arrays, and objects. Best-effort — may still produce invalid JSON.
 */
function tryRepairTruncatedJson(truncated: string): string {
  let repaired = truncated;

  // If we're inside an unterminated string, close it
  let inString = false;
  let escape = false;
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; }
  }
  if (inString) {
    // Trim back to last clean break if possible (e.g., comma, space)
    const lastQuote = repaired.lastIndexOf('"');
    if (lastQuote > 0) {
      repaired = repaired.slice(0, lastQuote + 1);
    } else {
      repaired += '"';
    }
  }

  // Remove any trailing comma before we close brackets
  repaired = repaired.replace(/,\s*$/, '');

  // Count unclosed braces and brackets
  let braces = 0;
  let brackets = 0;
  inString = false;
  escape = false;
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braces++;
    else if (ch === '}') braces--;
    else if (ch === '[') brackets++;
    else if (ch === ']') brackets--;
  }

  // Close unclosed brackets then braces
  for (let i = 0; i < brackets; i++) repaired += ']';
  for (let i = 0; i < braces; i++) repaired += '}';

  return repaired;
}

/**
 * Robustly extracts the first top-level JSON object from a model response.
 * Handles markdown fences, leading commentary, trailing noise, and truncation.
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

  // JSON is truncated — attempt repair
  console.warn('JSON response truncated — attempting repair…');
  const truncatedJson = cleaned.slice(start);
  const repaired = tryRepairTruncatedJson(truncatedJson);

  // Verify the repaired JSON is parseable
  try {
    JSON.parse(repaired);
    return repaired;
  } catch {
    throw new SyntaxError(
      'JSON object in model response was truncated and could not be repaired. '
      + 'The resume may be too complex. Try shortening it or removing some sections.'
    );
  }
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
 * Build extra params — deepseek-reasoner does not support temperature or response_format.
 */
function modelParams(model: string, temperature: number): Record<string, unknown> {
  if (model === 'deepseek-reasoner') return {};
  return { temperature, response_format: { type: 'json_object' } };
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
        max_tokens: 8192,
        ...modelParams(model, 0.6),
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
              // Use only plain content (no reasoning_content) for multi-turn compatibility
              { role: 'assistant', content: textResponse || '{}' },
              {
                role: 'user',
                content: `The JSON you returned failed schema validation with these errors:\n${errorSummary}\n\nPlease return the corrected JSON object only, fixing all listed issues.`,
              },
            ],
            stream: true,
            max_tokens: 8192,
            ...modelParams(model, 0.4),
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

      const errMsg = (error instanceof Error) ? error.message : String(error);
      console.error('Error parsing resume with DeepSeek or validating structure:', error);
      if (isLastAttempt) {
        throw new Error(`Failed to parse resume: ${errMsg}`);
      }
      // Retry on non-rate-limit transient errors
      onProgress?.(10, `Retrying… (attempt ${attempt + 1}/${MAX_RETRIES})`);
      await sleep(2000);
      continue;
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

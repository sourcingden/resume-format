import OpenAI from 'openai';
import { ResumeData } from '../types';

export type TypstProgress = (pct: number, status: string) => void;

// ─── Constants ────────────────────────────────────────────────────────────────
const API_KEY = import.meta.env.VITE_DEEPSEEK_API_KEY || '';
const BASE_URL = import.meta.env.BASE_URL ?? '/';
const ACCENT_COLOR = '#1d4ed8';
const CHARS_PER_PAGE = 3200; // rough chars of body text per A4 page

// ─── WASM compiler singleton ──────────────────────────────────────────────────
let _compiler: any = null;
let _initPromise: Promise<any> | null = null;

async function getCompiler(): Promise<any> {
  if (_compiler) return _compiler;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    // Dynamic import to keep WASM out of the main bundle
    const wasmMod = await import('@myriaddreamin/typst-ts-web-compiler');
    const initWasm: (input?: any) => Promise<any> = (wasmMod as any).default;
    const { TypstCompilerBuilder } = wasmMod as any;

    // Point the WASM loader at the pre-built .wasm binary
    const wasmUrl = new URL(
      '/node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm',
      window.location.origin,
    ).href;
    await initWasm({ module_or_path: fetch(wasmUrl) });

    // Load the app's Exo2 fonts so the PDF uses them
    const fetchFont = async (name: string): Promise<Uint8Array> => {
      const r = await fetch(`${BASE_URL}fonts/${name}`);
      return new Uint8Array(await r.arrayBuffer());
    };
    const [regular, bold] = await Promise.all([
      fetchFont('Exo2-Regular.ttf'),
      fetchFont('Exo2-Bold.ttf'),
    ]);

    const builder = new TypstCompilerBuilder();
    builder.set_dummy_access_model();
    await builder.add_raw_font(regular);
    await builder.add_raw_font(bold);

    _compiler = await builder.build();
    return _compiler;
  })();

  return _initPromise;
}

// ─── Typst text escaping ──────────────────────────────────────────────────────
function esc(s: string): string {
  if (!s) return '';
  return s
    .replace(/\\/g, '\\\\')
    .replace(/#/g, '\\#')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/@/g, '\\@')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')
    .replace(/~/g, '\\~')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>');
}

/** Convert **bold** markdown to Typst *bold* */
function richText(s: string): string {
  if (!s) return '';
  return s.split(/(\*\*.*?\*\*)/g).map(part => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return `*${esc(part.slice(2, -2))}*`;
    }
    return esc(part);
  }).join('');
}

/** Bullet list items */
function bulletList(items: string[]): string {
  return items.map(item => `  - #text(fill: rgb("${ACCENT_COLOR}"))[\u2022] ${richText(item)}`).join('\n');
}

// ─── Typst source generator ───────────────────────────────────────────────────
function generateTypstSource(data: ResumeData): string {
  const hasImages = true; // will fall back gracefully if images fail

  const sectionTitle = (label: string) =>
    `#v(8pt)
#grid(
  columns: (4pt, 1fr),
  column-gutter: 8pt,
  rect(width: 4pt, height: 14pt, fill: rgb("${ACCENT_COLOR}"), radius: 2pt),
  text(weight: "bold", size: 12pt, fill: rgb("#1f2937"))[${esc(label)}]
)
#line(length: 100%, stroke: 0.5pt + rgb("#E5E7EB"))
#v(4pt)`;

  // ── Experience entries ─────────────────────────────────────────────────────
  const experienceBlock = (data.experience ?? []).map(exp => `
#block(breakable: false)[
  #grid(
    columns: (1fr, auto),
    text(size: 11pt, weight: "bold", fill: rgb("#1f2937"))[${esc(exp.role)}],
    text(size: 9pt, fill: rgb("#6B7280"), style: "italic")[${esc(exp.dates)}]
  )
  #text(size: 10pt, weight: "bold", fill: rgb("${ACCENT_COLOR}"))[${esc(exp.company).toUpperCase()}]
  #v(3pt)
  ${exp.description ? `#par[${richText(exp.description)}]` : ''}
  ${exp.responsibilities?.length ? `
  #v(4pt)
  #text(size: 10pt, weight: "bold")[Key responsibilities & achievements:]
  #v(2pt)
  ${exp.responsibilities.map(r => `  - ${richText(r)}`).join('\n')} ` : ''}
  ${exp.techStack ? `
  #v(4pt)
  #rect(radius: 3pt, fill: rgb("#F9FAFB"), stroke: 0.5pt + rgb("#E5E7EB"), inset: (x: 8pt, y: 4pt))[#text(size: 9pt)[*Technologies:* ${esc(exp.techStack)}]]` : ''}
]
#v(10pt)`).join('\n');

  // ── Projects ───────────────────────────────────────────────────────────────
  const projectsBlock = (data.projects ?? []).map(p => `
#block(breakable: false)[
  #grid(
    columns: (1fr, auto),
    text(size: 11pt, weight: "bold")[${esc(p.title)}],
    ${p.link ? `text(size: 9pt, fill: rgb("${ACCENT_COLOR}"))[${esc(p.link)}]` : 'none'}
  )
  #v(2pt)
  #par[${richText(p.description)}]
  ${p.technologies ? `#v(3pt)\n  #text(size: 9pt)[*Tech:* ${esc(p.technologies)}]` : ''}
]
#v(8pt)`).join('\n');

  // ── Education ─────────────────────────────────────────────────────────────
  const educationBlock = (data.education ?? []).map(e => `
#block(breakable: false, inset: (left: 6pt), stroke: (left: 1.5pt + rgb("#E5E7EB")))[
  #text(size: 10pt, weight: "bold")[${esc(e.degree)}]
  #linebreak()
  #text(size: 9pt, fill: rgb("${ACCENT_COLOR}"))[${esc(e.institution)}]
  #linebreak()
  #text(size: 9pt, fill: rgb("#6B7280"))[${esc(e.dates)}]
]
#v(8pt)`).join('\n');

  // ── Certifications ─────────────────────────────────────────────────────────
  const certsBlock = (data.certifications ?? []).map(c => `
#block(breakable: false, inset: (left: 6pt), stroke: (left: 1.5pt + rgb("#E5E7EB")))[
  #text(size: 10pt, weight: "bold")[${esc(c.title)}]
  #linebreak()
  #text(size: 9pt, fill: rgb("#6B7280"))[${esc(c.issuer)}${c.date ? ` · ${esc(c.date)}` : ''}]
]
#v(8pt)`).join('\n');

  // ── Languages ─────────────────────────────────────────────────────────────
  const langsBlock = (data.languages ?? []).map(l =>
    `  - *${esc(l.language)}:* ${esc(l.level)}`).join('\n');

  // ── Achievements ──────────────────────────────────────────────────────────
  const achievementsBlock = (data.achievements ?? []).map(a => `  - ${richText(a)}`).join('\n');

  // ── Publications ──────────────────────────────────────────────────────────
  const publicationsBlock = (data.publications ?? []).map(p => `
#block(breakable: false)[
  #text(size: 10pt, weight: "bold")[${esc(p.title)}]
  ${p.details ? `#linebreak()\n  #text(size: 9pt, fill: rgb("#6B7280"))[${esc(p.details)}]` : ''}
]
#v(6pt)`).join('\n');

  // ── Skills ────────────────────────────────────────────────────────────────
  const skillsBlock = (data.skills ?? []).map(s =>
    `  - *${esc(s.category)}:* ${s.items.map(esc).join(', ')}`).join('\n');

  // ── Page setup ────────────────────────────────────────────────────────────
  const pageHeader = hasImages
    ? `align(top, move(dx: -60pt, dy: -90pt, image("header.png", width: 595.28pt, height: 90pt, fit: "stretch")))`
    : `align(top, rect(width: 100%, height: 6pt, fill: rgb("${ACCENT_COLOR}")))`;

  const pageFooter = hasImages
    ? `align(bottom, move(dx: -60pt, dy: 60pt, image("footer.png", width: 595.28pt, height: 60pt, fit: "stretch")))`
    : `align(bottom, rect(width: 100%, height: 6pt, fill: rgb("${ACCENT_COLOR}")))`;

  return `
#set page(
  paper: "a4",
  margin: (top: 95pt, bottom: 65pt, left: 60pt, right: 60pt),
  header: context {
    ${pageHeader}
  },
  footer: context {
    ${pageFooter}
  }
)

#set text(font: "Exo 2", size: 10pt, fill: rgb("#374151"))
#set par(leading: 0.55em, justify: true)
#show list: set list(marker: none)

// ── Name & Title ─────────────────────────────────────────────────────────────
#text(size: 16pt, weight: "bold", fill: rgb("${ACCENT_COLOR}"), tracking: 1.5pt)[${esc(data.jobTitle).toUpperCase()}]
#linebreak()
#text(size: 30pt, weight: "bold", tracking: 2pt)[${esc(data.name).toUpperCase()}]
#v(16pt)

${data.hrSummary ? `
${sectionTitle('HR Summary')}
#par[${richText(data.hrSummary)}]
#v(8pt)
` : ''}

${skillsBlock ? `
${sectionTitle('Skills')}
${skillsBlock}
#v(8pt)
` : ''}

${experienceBlock ? `
${sectionTitle('Job Experience')}
${experienceBlock}
` : ''}

${projectsBlock ? `
${sectionTitle('Projects')}
${projectsBlock}
` : ''}

${(educationBlock || certsBlock || langsBlock || achievementsBlock || publicationsBlock) ? `
#grid(
  columns: (1fr, 1fr),
  column-gutter: 24pt,
  [
    ${educationBlock ? `${sectionTitle('Education')}\n${educationBlock}` : ''}
    ${certsBlock ? `${sectionTitle('Certifications')}\n${certsBlock}` : ''}
  ],
  [
    ${langsBlock ? `${sectionTitle('Languages')}\n${langsBlock}\n#v(8pt)` : ''}
    ${achievementsBlock ? `${sectionTitle('Achievements')}\n${achievementsBlock}\n#v(8pt)` : ''}
    ${publicationsBlock ? `${sectionTitle('Publications')}\n${publicationsBlock}` : ''}
  ]
)
` : ''}
`.trim();
}

// ─── DeepSeek layout fitting ──────────────────────────────────────────────────
async function fitContent(data: ResumeData, targetPages: number): Promise<ResumeData> {
  const totalChars = JSON.stringify(data).length;
  const budget = targetPages * CHARS_PER_PAGE;
  if (totalChars <= budget * 1.1) return data; // within 10% headroom, no fitting needed

  const client = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: API_KEY,
    dangerouslyAllowBrowser: true,
  });

  const charBudgets = {
    hrSummary: Math.min(500, Math.floor(budget * 0.12)),
    descriptionPerRole: Math.floor(budget * 0.06),
    responsibilitiesPerRole: Math.floor(budget * 0.08),
  };

  const resp = await client.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: `You are a professional resume editor. Your task is to condense a resume to fit exactly ${targetPages} page(s) in a Typst PDF template.
You MUST:
- Keep all jobs, companies, dates, technologies, education, languages, certifications, achievements, and publications.
- Only shorten the "hrSummary", "description" (in experience), "responsibilities" (in experience), and "description" (in projects).
- Preserve all *facts* and *impact metrics*. Do not invent or remove facts.
- hrSummary: max ${charBudgets.hrSummary} chars.
- Each experience.description: max ${charBudgets.descriptionPerRole} chars.
- Each experience.responsibilities array total: max ${charBudgets.responsibilitiesPerRole} chars combined.
- Return ONLY the valid JSON object with the same schema, no markdown.`,
      },
      {
        role: 'user',
        content: JSON.stringify(data),
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 8192,
  });

  try {
    const raw = resp.choices[0].message.content ?? '{}';
    return { ...data, ...JSON.parse(raw) };
  } catch {
    return data; // fallback to original if fitting fails
  }
}

// ─── PDF compilation ──────────────────────────────────────────────────────────
async function compileToPDF(source: string): Promise<Uint8Array> {
  const compiler = await getCompiler();
  compiler.reset();

  // Inject resume source
  await compiler.add_source('/main.typ', source);

  // Inject header/footer images into virtual file-system
  try {
    const [headerResp, footerResp] = await Promise.all([
      fetch(`${BASE_URL}header.png`),
      fetch(`${BASE_URL}footer.png`),
    ]);
    if (headerResp.ok) compiler.map_shadow('/header.png', new Uint8Array(await headerResp.arrayBuffer()));
    if (footerResp.ok) compiler.map_shadow('/footer.png', new Uint8Array(await footerResp.arrayBuffer()));
  } catch {
    // Images unavailable — template will fall back to colored bars
  }

  // Compile to PDF
  compiler.compile('/main.typ', null, 'pdf', 0);
  const artifact = compiler.get_artifact('pdf', 0);

  if (!artifact?.result) {
    throw new Error('Typst compilation produced no output. Check the template for syntax errors.');
  }
  return new Uint8Array(artifact.result);
}

// ─── Main export function ─────────────────────────────────────────────────────
export async function exportTypstPDF(
  data: ResumeData,
  targetPages: number,
  onProgress?: TypstProgress,
): Promise<void> {
  if (!API_KEY) throw new Error('VITE_DEEPSEEK_API_KEY is not configured.');

  onProgress?.(5, 'Loading Typst engine…');
  // Pre-warm the WASM (downloads ~8 MB the first time)
  await getCompiler();

  onProgress?.(25, 'Fitting layout with AI…');
  const fittedData = await fitContent(data, targetPages);

  onProgress?.(55, 'Generating Typst source…');
  const source = generateTypstSource(fittedData);

  onProgress?.(65, 'Compiling PDF…');
  const pdfBytes = await compileToPDF(source);

  onProgress?.(95, 'Preparing download…');
  const blob = new Blob([pdfBytes.buffer.slice(0) as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const candidateName = data.name || 'Candidate';
  const position = data.jobTitle || 'Position';
  link.href = url;
  link.download = `${position} - ${candidateName} - CV 2026 (Typst).pdf`;
  link.click();
  URL.revokeObjectURL(url);

  onProgress?.(100, 'Done!');
}

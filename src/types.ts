import { z } from 'zod';

export const resumeSchema = z.object({
  analysis: z.string().default(''),
  hiddenSections: z.array(z.string()).default([]),
  jobTitle: z.string().default('Unknown Title'),
  name: z.string().default('Unknown Name'),
  hrSummary: z.string().default(''),
  skills: z.array(z.object({
    category: z.string().default('General'),
    items: z.array(z.string()).default([])
  })).default([]),
  experience: z.array(z.object({
    role: z.string().default(''),
    company: z.string().default(''),
    dates: z.string().default(''),
    description: z.string().default(''),
    responsibilities: z.array(z.string()).default([]),
    techStack: z.string().default('')
  })).default([]),
  education: z.array(z.object({
    degree: z.string().default(''),
    institution: z.string().default(''),
    dates: z.string().default('')
  })).default([]),
  languages: z.array(z.object({
    language: z.string().default(''),
    level: z.string().default('')
  })).default([]),
  achievements: z.array(z.string()).default([]),
  certifications: z.array(z.object({
    title: z.string().default(''),
    issuer: z.string().default(''),
    date: z.string().default('')
  })).default([]),
  publications: z.array(z.object({
    title: z.string().default(''),
    details: z.string().default('')
  })).default([]),
  projects: z.array(z.object({
    title: z.string().default(''),
    description: z.string().default(''),
    technologies: z.string().default(''),
    link: z.string().default('')
  })).default([]),
});

export type ResumeData = z.infer<typeof resumeSchema>;

import React, { useRef } from 'react';
import { ResumeData } from '../types';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// ─── RichTextarea: Textarea with Cmd+B bold hotkey ───────────────────────────
interface RichTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}

function RichTextarea({ onChange, value, ...props }: RichTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      const el = ref.current;
      if (!el) return;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const text = el.value;
      const selected = text.slice(start, end);
      const before = text.slice(0, start);
      const after = text.slice(end);
      const newValue = `${before}**${selected}**${after}`;
      // Synthetic event for React controlled inputs
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      nativeInputValueSetter?.call(el, newValue);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      // Restore cursor: after **{selection}**
      const cursorPos = selected.length === 0 ? start + 2 : end + 4;
      requestAnimationFrame(() => {
        el.setSelectionRange(cursorPos, cursorPos);
      });
    }
  };

  return (
    <Textarea
      ref={ref}
      value={value}
      onChange={onChange}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

interface Props {
  data: ResumeData;
  onChange: (data: ResumeData) => void;
}

export function ResumeEditor({ data, onChange }: Props) {

  const updateField = (field: keyof ResumeData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const updateArrayItem = (arrayField: keyof ResumeData, index: number, itemField: string, value: any) => {
    const newArray = [...(data[arrayField] as any[])];
    newArray[index] = { ...newArray[index], [itemField]: value };
    updateField(arrayField, newArray);
  };

  const addArrayItem = (arrayField: keyof ResumeData, defaultItem: any) => {
    const newArray = [...((data[arrayField] as any[]) || []), defaultItem];
    updateField(arrayField, newArray);
  };

  const removeArrayItem = (arrayField: keyof ResumeData, index: number) => {
    const newArray = [...(data[arrayField] as any[])];
    newArray.splice(index, 1);
    updateField(arrayField, newArray);
  };

  return (
    <div className="space-y-6 pb-20">
      <Accordion type="multiple" defaultValue={["basicInfo"]} className="w-full space-y-4">
        
        {/* Basic Info */}
        <AccordionItem value="basicInfo" className="border bg-card rounded-xl shadow-sm px-4">
          <AccordionTrigger className="hover:no-underline font-semibold text-lg py-4">Basic Info</AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  type="text"
                  value={data.name || ''}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>Position Title</Label>
                <Input
                  type="text"
                  value={data.jobTitle || ''}
                  onChange={(e) => updateField('jobTitle', e.target.value)}
                  placeholder="e.g. Senior Software Engineer"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>HR Summary</Label>
              <RichTextarea
                value={data.hrSummary || ''}
                onChange={(e) => updateField('hrSummary', e.target.value)}
                className="h-32 resize-none"
                placeholder="Briefly describe your expertise. Use **bold** to highlight key terms."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tip: Use <code className="bg-muted px-1 rounded">**text**</code> for <strong>bolding</strong> or press <kbd className="bg-muted px-1 rounded text-xs">⌘B</kbd>.
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Skills */}
        <AccordionItem value="skills" className="border bg-card rounded-xl shadow-sm px-4">
          <AccordionTrigger className="hover:no-underline font-semibold text-lg py-4">Skills</AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            {(data.skills || []).map((skill, index) => (
              <div key={index} className="p-4 bg-muted/20 border rounded-lg relative group transition-all hover:bg-muted/40">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => removeArrayItem('skills', index)} 
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <div className="space-y-4 pt-2 pr-6">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Category</Label>
                    <Input
                      type="text"
                      value={skill.category}
                      onChange={(e) => updateArrayItem('skills', index, 'category', e.target.value)}
                      placeholder="e.g. Frontend"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Items (comma separated)</Label>
                    <Input
                      type="text"
                      value={skill.items.join(', ')}
                      onChange={(e) => updateArrayItem('skills', index, 'items', e.target.value.split(',').map(s => s.trim()))}
                      placeholder="React, Vue, Tailwind..."
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button 
              variant="outline" 
              className="w-full mt-2 border-dashed"
              onClick={() => addArrayItem('skills', { category: 'New Category', items: [] })}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Skill Category
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Experience */}
        <AccordionItem value="experience" className="border bg-card rounded-xl shadow-sm px-4">
          <AccordionTrigger className="hover:no-underline font-semibold text-lg py-4">Job Experience</AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            {(data.experience || []).map((exp, index) => (
              <div key={index} className="p-4 bg-muted/20 border rounded-lg relative group transition-all hover:bg-muted/40 space-y-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => removeArrayItem('experience', index)} 
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-6 pt-2">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Role</Label>
                    <Input type="text" value={exp.role} onChange={(e) => updateArrayItem('experience', index, 'role', e.target.value)} placeholder="e.g. Frontend Developer" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Company</Label>
                    <Input type="text" value={exp.company} onChange={(e) => updateArrayItem('experience', index, 'company', e.target.value)} placeholder="e.g. Acme Corp" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Dates</Label>
                  <Input type="text" value={exp.dates} onChange={(e) => updateArrayItem('experience', index, 'dates', e.target.value)} placeholder="e.g. Jan 2020 - Present" />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Description</Label>
                  <RichTextarea
                    value={exp.description} 
                    onChange={(e) => updateArrayItem('experience', index, 'description', e.target.value)} 
                    className="h-24 resize-none" 
                    placeholder="General description of your role. Use **bold** for impact."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Responsibilities (one per line)</Label>
                  <RichTextarea
                    value={(exp.responsibilities || []).join('\n')} 
                    onChange={(e) => updateArrayItem('experience', index, 'responsibilities', e.target.value.split('\n').filter(s => s.trim() !== ''))} 
                    className="h-32 resize-none" 
                    placeholder="Implemented feature X...&#10;Optimized database Y..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Tech Stack</Label>
                  <Input type="text" value={exp.techStack || ''} onChange={(e) => updateArrayItem('experience', index, 'techStack', e.target.value)} placeholder="React, Node.js, AWS" />
                </div>
              </div>
            ))}
            <Button 
              variant="outline" 
              className="w-full mt-2 border-dashed"
              onClick={() => addArrayItem('experience', { role: 'New Role', company: 'Company', dates: '2020 - Present', description: '', responsibilities: [], techStack: '' })}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Experience
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Education */}
        <AccordionItem value="education" className="border bg-card rounded-xl shadow-sm px-4">
          <AccordionTrigger className="hover:no-underline font-semibold text-lg py-4">Education</AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            {(data.education || []).map((edu, index) => (
              <div key={index} className="p-4 bg-muted/20 border rounded-lg relative group transition-all hover:bg-muted/40 space-y-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => removeArrayItem('education', index)} 
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <div className="space-y-4 pr-6 pt-2">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Degree</Label>
                    <Input type="text" value={edu.degree} onChange={(e) => updateArrayItem('education', index, 'degree', e.target.value)} placeholder="e.g. Master's in Computer Science" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Institution</Label>
                      <Input type="text" value={edu.institution} onChange={(e) => updateArrayItem('education', index, 'institution', e.target.value)} placeholder="e.g. Stanford University" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Dates</Label>
                      <Input type="text" value={edu.dates} onChange={(e) => updateArrayItem('education', index, 'dates', e.target.value)} placeholder="e.g. 2016 - 2020" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <Button 
              variant="outline" 
              className="w-full mt-2 border-dashed"
              onClick={() => addArrayItem('education', { degree: 'Degree', institution: 'Institution', dates: '2016 - 2020' })}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Education
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Languages */}
        <AccordionItem value="languages" className="border bg-card rounded-xl shadow-sm px-4">
          <AccordionTrigger className="hover:no-underline font-semibold text-lg py-4">Languages</AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            {(data.languages || []).map((lang, index) => (
              <div key={index} className="p-4 bg-muted/20 border rounded-lg relative group transition-all hover:bg-muted/40 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => removeArrayItem('languages', index)} 
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <div className="space-y-2 pr-6 pt-2">
                  <Label className="text-muted-foreground">Language</Label>
                  <Input type="text" value={lang.language} onChange={(e) => updateArrayItem('languages', index, 'language', e.target.value)} placeholder="e.g. English" />
                </div>
                <div className="space-y-2 md:pt-2">
                  <Label className="text-muted-foreground">Level</Label>
                  <select
                    value={lang.level}
                    onChange={(e) => updateArrayItem('languages', index, 'level', e.target.value)}
                    className="flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1"
                  >
                    {!['Elementary proficiency', 'Limited working proficiency', 'Professional working proficiency', 'Full professional proficiency', 'Native or bilingual proficiency'].includes(lang.level) && (
                      <option value={lang.level}>{lang.level}</option>
                    )}
                    <option value="Elementary proficiency">Elementary proficiency</option>
                    <option value="Limited working proficiency">Limited working proficiency</option>
                    <option value="Professional working proficiency">Professional working proficiency</option>
                    <option value="Full professional proficiency">Full professional proficiency</option>
                    <option value="Native or bilingual proficiency">Native or bilingual proficiency</option>
                  </select>
                </div>
              </div>
            ))}
            <Button 
              variant="outline" 
              className="w-full mt-2 border-dashed"
              onClick={() => addArrayItem('languages', { language: 'Language', level: 'Native or bilingual proficiency' })}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Language
            </Button>
          </AccordionContent>
        </AccordionItem>

        {/* Projects */}
        <AccordionItem value="projects" className="border bg-card rounded-xl shadow-sm px-4">
          <AccordionTrigger className="hover:no-underline font-semibold text-lg py-4">Projects</AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            {(data.projects || []).map((proj, index) => (
              <div key={index} className="p-4 bg-muted/20 border rounded-lg relative group transition-all hover:bg-muted/40 space-y-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => removeArrayItem('projects', index)} 
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
                <div className="space-y-4 pr-6 pt-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Project Title</Label>
                      <Input type="text" value={proj.title} onChange={(e) => updateArrayItem('projects', index, 'title', e.target.value)} placeholder="e.g. E-commerce App" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Project Link</Label>
                      <Input type="text" value={proj.link || ''} onChange={(e) => updateArrayItem('projects', index, 'link', e.target.value)} placeholder="https://github.com/..." />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Technologies</Label>
                    <Input type="text" value={proj.technologies || ''} onChange={(e) => updateArrayItem('projects', index, 'technologies', e.target.value)} placeholder="React, Node.js..." />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Description</Label>
                    <RichTextarea
                      value={proj.description} 
                      onChange={(e) => updateArrayItem('projects', index, 'description', e.target.value)} 
                      className="h-24 resize-none"
                      placeholder="Describe what you built. Use **bold** for key features."
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button 
              variant="outline" 
              className="w-full mt-2 border-dashed"
              onClick={() => addArrayItem('projects', { title: 'Project Title', description: '', technologies: '', link: '' })}
            >
              <Plus className="w-4 h-4 mr-2" /> Add Project
            </Button>
          </AccordionContent>
        </AccordionItem>

      </Accordion>
    </div>
  );
}

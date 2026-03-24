import React, { forwardRef } from 'react';
import { ResumeData } from '../types';
import { formatBoldText } from '../utils/textUtils';

interface Props {
  data: ResumeData;
}

export const ResumePreview = forwardRef<HTMLDivElement, Props>(({ data }, ref) => {
  return (
    <>
      <style>{`
        @media print {
          @page { 
            margin: 0; 
            size: A4;
          }
          .resume-page {
            margin: 0 !important;
            padding: 0 !important;
            width: 210mm !important;
            min-height: 891mm !important; /* Exactly 3 A4 pages */
          }
          .resume-content {
            width: 210mm !important;
          }
          .avoid-break {
            break-inside: avoid;
          }
        }
      `}</style>

      <div
        ref={ref}
        className="resume-page bg-white w-[210mm] mx-auto relative text-slate-800 font-sans pb-40 min-h-[891mm]"
      >
        {/* Header */}
        <div className="w-full">
          <img 
            src={`${import.meta.env.BASE_URL}header.png`} 
            alt="Newxel Header" 
            className="w-full block" 
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        {/* Content area */}
        <div className="resume-content px-16 pt-20 pb-10 relative z-10 space-y-8">
          
          <div className="border-b-2 border-slate-200 pb-6 mb-8 text-center">
            <h1 className="text-5xl font-extrabold uppercase tracking-widest text-slate-900 mb-2">
              {data.name}
            </h1>
            <h2 className="text-2xl font-semibold uppercase tracking-widest text-blue-700">
              {data.jobTitle}
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-10">
            {data.hrSummary && (
              <div className="avoid-break bg-slate-50 p-6 rounded-lg border border-slate-100 shadow-sm">
                <h3 className="text-xl font-bold uppercase tracking-wider text-slate-900 mb-4 flex items-center">
                  <span className="w-2 h-6 bg-blue-600 mr-3 rounded-sm"></span> HR Summary
                </h3>
                <p className="text-base leading-relaxed text-slate-700">{formatBoldText(data.hrSummary)}</p>
              </div>
            )}

            {data.skills && data.skills.length > 0 && (
              <div className="avoid-break">
                 <h3 className="text-xl font-bold uppercase tracking-wider text-slate-900 mb-4 flex items-center">
                  <span className="w-2 h-6 bg-blue-600 mr-3 rounded-sm"></span> Skills
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {data.skills.map((skill, index) => (
                    <div key={index} className="text-sm">
                      <strong className="text-slate-900 mr-2">{skill.category}:</strong> 
                      <span className="text-slate-700">{skill.items.join(', ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.experience && data.experience.length > 0 && (
              <div>
                 <h3 className="text-xl font-bold uppercase tracking-wider text-slate-900 mb-6 flex items-center">
                  <span className="w-2 h-6 bg-blue-600 mr-3 rounded-sm"></span> Job Experience
                </h3>
                <div className="space-y-8 border-l-2 border-slate-200 ml-3 pl-6">
                  {data.experience.map((exp, index) => (
                    <div key={index} className="avoid-break relative">
                      <div className="absolute -left-[31px] top-1.5 w-3 h-3 bg-blue-600 rounded-full ring-4 ring-white" />
                      <div className="flex justify-between items-baseline mb-1">
                        <h4 className="font-bold text-lg text-slate-900">{exp.role}</h4>
                        <span className="text-sm font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">{exp.dates}</span>
                      </div>
                      <h5 className="font-semibold text-base text-blue-600 uppercase mb-3">{exp.company}</h5>
                      
                      <p className="text-sm mb-4 leading-relaxed text-slate-700">{formatBoldText(exp.description)}</p>

                      {exp.responsibilities && exp.responsibilities.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm font-bold text-slate-900 mb-2">Key responsibilities & achievements:</p>
                          <ul className="list-disc pl-5 space-y-1.5 text-slate-700 marker:text-blue-500">
                          {exp.responsibilities.map((resp, idx) => (
                            <li key={idx} className="text-sm leading-relaxed">{formatBoldText(resp)}</li>
                          ))}
                        </ul>
                        </div>
                      )}

                      {exp.techStack && (
                        <div className="mt-3 bg-slate-50 border border-slate-200 rounded px-4 py-2 inline-block">
                          <p className="text-sm text-slate-700">
                            <span className="font-bold text-slate-900 mr-2">Technologies:</span> {exp.techStack}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {data.projects && data.projects.length > 0 && (
              <div>
                <h3 className="text-xl font-bold uppercase tracking-wider text-slate-900 mb-6 flex items-center">
                  <span className="w-2 h-6 bg-blue-600 mr-3 rounded-sm"></span> Projects
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {data.projects.map((proj, index) => (
                    <div key={index} className="avoid-break bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm flex flex-col items-start h-full">
                       <h4 className="font-bold text-base text-slate-900 mb-2">{proj.title}</h4>
                      <p className="text-sm mb-3 text-slate-700 leading-relaxed flex-grow">{formatBoldText(proj.description)}</p>
                      
                      {proj.technologies && (
                        <p className="text-xs font-medium text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded w-full mb-3">
                          <span className="font-bold text-slate-900">Tech:</span> {proj.technologies}
                        </p>
                      )}

                      {proj.link && (
                        <a href={proj.link} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline mt-auto inline-flex items-center">
                          View Project <span className="ml-1">→</span>
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-8">
                {data.education && data.education.length > 0 && (
                  <div className="avoid-break">
                    <h3 className="text-xl font-bold uppercase tracking-wider text-slate-900 mb-6 flex items-center">
                      <span className="w-2 h-6 bg-blue-600 mr-3 rounded-sm"></span> Education
                    </h3>
                    <div className="space-y-5">
                      {data.education.map((edu, index) => (
                        <div key={index} className="avoid-break border-l-2 border-slate-200 pl-4 py-1">
                          <h4 className="font-bold text-base text-slate-900">{edu.degree}</h4>
                          <p className="text-sm text-blue-600 font-medium my-1">{edu.institution}</p>
                          <p className="text-xs text-slate-500 bg-slate-100 inline-block px-2 py-0.5 rounded">{edu.dates}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {data.certifications && data.certifications.length > 0 && (
                  <div className="avoid-break">
                    <h3 className="text-xl font-bold uppercase tracking-wider text-slate-900 mb-6 flex items-center">
                      <span className="w-2 h-6 bg-blue-600 mr-3 rounded-sm"></span> Certifications
                    </h3>
                    <div className="space-y-4">
                      {data.certifications.map((cert, index) => (
                        <div key={index} className="avoid-break border-l-2 border-slate-200 pl-4 py-1">
                          <h4 className="font-bold text-base text-slate-900">{cert.title}</h4>
                          <p className="text-sm text-slate-600 mt-1">
                            {cert.issuer}{cert.date ? ` • ${cert.date}` : ''}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-8">
                {data.languages && data.languages.length > 0 && (
                  <div className="avoid-break">
                    <h3 className="text-xl font-bold uppercase tracking-wider text-slate-900 mb-6 flex items-center">
                      <span className="w-2 h-6 bg-blue-600 mr-3 rounded-sm"></span> Languages
                    </h3>
                    <div className="space-y-3">
                      {data.languages.map((lang, index) => (
                        <div key={index} className="flex justify-between items-center bg-slate-50 px-4 py-2 rounded border border-slate-100">
                          <span className="font-bold text-slate-900">{lang.language}</span>
                          <span className="text-sm text-slate-600 font-medium">{lang.level}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {data.achievements && data.achievements.length > 0 && (
                  <div className="avoid-break">
                    <h3 className="text-xl font-bold uppercase tracking-wider text-slate-900 mb-6 flex items-center">
                      <span className="w-2 h-6 bg-blue-600 mr-3 rounded-sm"></span> Achievements
                    </h3>
                    <ul className="list-disc pl-5 space-y-2 text-slate-700 marker:text-blue-500">
                      {data.achievements.map((item, index) => (
                        <li key={index} className="text-sm">{formatBoldText(item)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {data.publications && data.publications.length > 0 && (
                  <div className="avoid-break">
                    <h3 className="text-xl font-bold uppercase tracking-wider text-slate-900 mb-6 flex items-center">
                      <span className="w-2 h-6 bg-blue-600 mr-3 rounded-sm"></span> Publications
                    </h3>
                    <div className="space-y-4">
                      {data.publications.map((pub, index) => (
                        <div key={index} className="avoid-break bg-slate-50 p-4 rounded-lg border border-slate-100 shadow-sm">
                          <h4 className="font-bold text-sm text-slate-900">{pub.title}</h4>
                          {pub.details && <p className="text-sm text-slate-700 mt-2 leading-relaxed">{pub.details}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>

        {/* Footer - pinned to the absolute bottom of the 3-page block */}
        <div className="absolute bottom-0 left-0 w-full">
          <img 
            src={`${import.meta.env.BASE_URL}footer.png`} 
            alt="Newxel Footer" 
            className="w-full block" 
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      </div>
    </>
  );
});

ResumePreview.displayName = 'ResumePreview';

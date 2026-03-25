import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { ResumeData } from '../types';

// Register Exo 2 font from local bundled files
Font.register({
  family: 'Exo 2',
  fonts: [
    { src: `${import.meta.env.BASE_URL}fonts/Exo2-Regular.ttf`, fontWeight: 'normal' },
    { src: `${import.meta.env.BASE_URL}fonts/Exo2-Bold.ttf`, fontWeight: 'bold' },
  ]
});

const BLUE = '#1d4ed8';
const BORDER_GRAY = '#E5E7EB';
const TEXT_DARK = '#1f2937';
const TEXT_BODY = '#374151';
const TEXT_MUTED = '#6B7280';

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 0,
    backgroundColor: '#FFFFFF',
    fontFamily: 'Helvetica',
    position: 'relative',
  },
  headerImage: { width: '100%', marginTop: -40 },
  footerImage: { width: '100%' },
  content: {
    paddingHorizontal: 60,
    paddingTop: 20,
    paddingBottom: 70,
  },

  // ── Name / title block ──────────────────────────────────────────────────────
  jobTitle: {
    fontFamily: 'Exo 2',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: BLUE,
    marginBottom: 4,
  },
  name: {
    fontFamily: 'Exo 2',
    fontSize: 32,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 30,
  },

  // ── Section container ───────────────────────────────────────────────────────
  section: { marginBottom: 22 },

  // ── Section title with accent bar ──────────────────────────────────────────
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_GRAY,
    paddingBottom: 5,
  },
  accentBar: {
    width: 4,
    height: 16,
    backgroundColor: BLUE,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: TEXT_DARK,
    letterSpacing: 0.8,
  },

  // ── Body text ───────────────────────────────────────────────────────────────
  text: { fontSize: 10, lineHeight: 1.5, color: TEXT_BODY },

  // ── Experience items ────────────────────────────────────────────────────────
  item: { marginBottom: 14 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 2 },
  itemTitle: { fontSize: 11, fontWeight: 'bold', color: TEXT_DARK, flex: 1 },
  itemDates: {
    fontSize: 9,
    color: TEXT_MUTED,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemSubtitle: { fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', color: BLUE, marginBottom: 5 },

  // ── Bullet list ─────────────────────────────────────────────────────────────
  list: { marginLeft: 10, marginTop: 4 },
  listItem: { flexDirection: 'row', marginBottom: 3 },
  bullet: { width: 10, fontSize: 10, color: BLUE },
  listItemText: { flex: 1, fontSize: 10, lineHeight: 1.4, color: TEXT_BODY },

  // ── Tech stack row ──────────────────────────────────────────────────────────
  techRow: {
    marginTop: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: BORDER_GRAY,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  techText: { fontSize: 9, color: TEXT_BODY },
  techBold: { fontSize: 9, fontWeight: 'bold', color: TEXT_DARK },

  // ── Two-column grid ─────────────────────────────────────────────────────────
  twoColGrid: { flexDirection: 'row', gap: 24 },
  twoColLeft: { flex: 1 },
  twoColRight: { flex: 1 },

  // ── Education / cert entries ────────────────────────────────────────────────
  eduItem: {
    borderLeftWidth: 2,
    borderLeftColor: BORDER_GRAY,
    paddingLeft: 8,
    paddingVertical: 2,
    marginBottom: 10,
  },
  eduDegree: { fontSize: 10, fontWeight: 'bold', color: TEXT_DARK, marginBottom: 2 },
  eduInstitution: { fontSize: 10, color: BLUE, marginBottom: 3 },
  eduDates: { fontSize: 9, color: TEXT_MUTED },

  // ── Skills ───────────────────────────────────────────────────────────────────
  skillCategory: { fontWeight: 'bold', color: TEXT_DARK },
});

// ─── Section title component with blue accent bar ───────────────────────────

const SectionTitle = ({ label }: { label: string }) => (
  <View style={styles.sectionTitleRow}>
    <View style={styles.accentBar} />
    <Text style={styles.sectionTitle}>{label}</Text>
  </View>
);

// ─── Rich text: renders **bold** markdown inline ─────────────────────────────

const RichText = ({ text, style }: { text: string; style: any }) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <Text style={style}>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <Text key={i} style={{ fontWeight: 'bold' }}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
};

// ─── Experience entry (extracted to avoid duplicate code) ────────────────────

const ExperienceItem = ({ exp }: { exp: ResumeData['experience'][0] }) => (
  <View style={styles.item}>
    {/* Role + dates on same row */}
    <View style={styles.itemHeader}>
      <Text style={styles.itemTitle}>{exp.role}</Text>
      {exp.dates ? <Text style={styles.itemDates}>{exp.dates}</Text> : null}
    </View>
    <Text style={styles.itemSubtitle}>{exp.company}</Text>
    <RichText text={exp.description} style={styles.text} />

    {exp.responsibilities && exp.responsibilities.length > 0 && (
      <View style={{ marginTop: 6 }}>
        <Text style={[styles.text, { fontWeight: 'bold', marginBottom: 3 }]}>
          Key responsibilities &amp; achievements:
        </Text>
        <View style={styles.list}>
          {exp.responsibilities.map((resp, idx) => (
            <View key={idx} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <RichText text={resp} style={styles.listItemText} />
            </View>
          ))}
        </View>
      </View>
    )}

    {exp.techStack ? (
      <View style={styles.techRow}>
        <Text style={styles.techText}>
          <Text style={styles.techBold}>Technologies: </Text>
          {exp.techStack}
        </Text>
      </View>
    ) : null}
  </View>
);

// ─── Main component ──────────────────────────────────────────────────────────

interface Props {
  data: ResumeData;
}

export const ResumePDF = ({ data }: Props) => {
  const currentPath = window.location.origin + window.location.pathname;
  const headerUrl = new URL(import.meta.env.BASE_URL + 'header.png', currentPath).href;
  const footerUrl = new URL(import.meta.env.BASE_URL + 'footer.png', currentPath).href;

  return (
    <Document title={`${data.jobTitle} - ${data.name} - Newxel CV 2026`}>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View>
          <Image src={headerUrl} style={styles.headerImage} />
        </View>

        <View style={styles.content}>
          {/* ── Hero ── */}
          <Text style={styles.jobTitle}>{data.jobTitle}</Text>
          <Text style={styles.name}>{data.name}</Text>

          {/* ── HR Summary ── */}
          {data.hrSummary && (
            <View style={styles.section}>
              <SectionTitle label="HR Summary" />
              <RichText text={data.hrSummary} style={styles.text} />
            </View>
          )}

          {/* ── Skills ── */}
          {data.skills && data.skills.length > 0 && (
            <View style={styles.section}>
              <SectionTitle label="Skills" />
              {data.skills.map((skill, index) => (
                <View key={index} style={styles.listItem}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.listItemText}>
                    <Text style={styles.skillCategory}>{skill.category}: </Text>
                    {skill.items.join(', ')}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* ── Experience ──
              First entry: keep title + first item together (no orphan heading).
              Remaining entries: each wrapped with wrap={false} so they don't
              split mid-block for short entries, but long entries are allowed
              to flow across pages via the outer wrap={true} (default). */}
          {data.experience && data.experience.length > 0 && (
            <View style={styles.section}>
              {/* Section title bound to first entry */}
              <View wrap={false}>
                <SectionTitle label="Job Experience" />
                <ExperienceItem exp={data.experience[0]} />
              </View>

              {data.experience.slice(1).map((exp, index) => (
                // minPresenceAhead keeps ≥40pt of the entry on the page
                // where the header starts — avoids orphan role/company lines
                <View key={index} minPresenceAhead={40}>
                  <ExperienceItem exp={exp} />
                </View>
              ))}
            </View>
          )}

          {/* ── Projects ── */}
          {data.projects && data.projects.length > 0 && (
            <View style={styles.section}>
              <View wrap={false}>
                <SectionTitle label="Projects" />
                <View style={styles.item}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>{data.projects[0].title}</Text>
                    {data.projects[0].link ? (
                      <Text style={[styles.text, { color: BLUE }]}>{data.projects[0].link}</Text>
                    ) : null}
                  </View>
                  <RichText text={data.projects[0].description} style={styles.text} />
                  {data.projects[0].technologies ? (
                    <View style={styles.techRow}>
                      <Text style={styles.techText}>
                        <Text style={styles.techBold}>Technologies: </Text>
                        {data.projects[0].technologies}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {data.projects.slice(1).map((proj, index) => (
                <View key={index} style={styles.item} minPresenceAhead={30}>
                  <View style={styles.itemHeader}>
                    <Text style={styles.itemTitle}>{proj.title}</Text>
                    {proj.link ? (
                      <Text style={[styles.text, { color: BLUE }]}>{proj.link}</Text>
                    ) : null}
                  </View>
                  <RichText text={proj.description} style={styles.text} />
                  {proj.technologies ? (
                    <View style={styles.techRow}>
                      <Text style={styles.techText}>
                        <Text style={styles.techBold}>Technologies: </Text>
                        {proj.technologies}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {/* ── Two-column grid: Education+Certifications | Languages+Achievements ── */}
          {(
            (data.education && data.education.length > 0) ||
            (data.certifications && data.certifications.length > 0) ||
            (data.languages && data.languages.length > 0) ||
            (data.achievements && data.achievements.length > 0) ||
            (data.publications && data.publications.length > 0)
          ) && (
            <View style={styles.twoColGrid}>
              {/* Left column */}
              <View style={styles.twoColLeft}>
                {data.education && data.education.length > 0 && (
                  <View style={[styles.section, { marginBottom: 18 }]}>
                    <SectionTitle label="Education" />
                    {data.education.map((edu, index) => (
                      <View key={index} style={styles.eduItem} minPresenceAhead={20}>
                        <Text style={styles.eduDegree}>{edu.degree}</Text>
                        <Text style={styles.eduInstitution}>{edu.institution}</Text>
                        <Text style={styles.eduDates}>{edu.dates}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {data.certifications && data.certifications.length > 0 && (
                  <View style={styles.section}>
                    <SectionTitle label="Certifications" />
                    {data.certifications.map((cert, index) => (
                      <View key={index} style={styles.eduItem} minPresenceAhead={20}>
                        <Text style={styles.eduDegree}>{cert.title}</Text>
                        <Text style={styles.eduDates}>
                          {cert.issuer}{cert.date ? ` · ${cert.date}` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Right column */}
              <View style={styles.twoColRight}>
                {data.languages && data.languages.length > 0 && (
                  <View style={[styles.section, { marginBottom: 18 }]}>
                    <SectionTitle label="Languages" />
                    {data.languages.map((lang, index) => (
                      <View key={index} style={styles.listItem}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.listItemText}>
                          <Text style={{ fontWeight: 'bold' }}>{lang.language}: </Text>
                          {lang.level}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {data.achievements && data.achievements.length > 0 && (
                  <View style={[styles.section, { marginBottom: 18 }]}>
                    <SectionTitle label="Achievements" />
                    {data.achievements.map((item, index) => (
                      <View key={index} style={styles.listItem}>
                        <Text style={styles.bullet}>•</Text>
                        <RichText text={item} style={styles.listItemText} />
                      </View>
                    ))}
                  </View>
                )}

                {data.publications && data.publications.length > 0 && (
                  <View style={styles.section}>
                    <SectionTitle label="Publications" />
                    {data.publications.map((pub, index) => (
                      <View key={index} style={{ marginBottom: 8 }} minPresenceAhead={20}>
                        <Text style={styles.eduDegree}>{pub.title}</Text>
                        {pub.details ? (
                          <Text style={[styles.text, { color: TEXT_MUTED }]}>{pub.details}</Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Spacer pushes footer to the bottom */}
        <View style={{ flexGrow: 1 }} />

        {/* Footer */}
        <Image src={footerUrl} style={[styles.footerImage, { marginBottom: -40 }]} />
      </Page>
    </Document>
  );
};

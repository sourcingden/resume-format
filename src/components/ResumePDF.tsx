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
  jobTitle: {
    fontFamily: 'Exo 2',
    fontSize: 16,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    color: '#1d4ed8',
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
  section: { marginBottom: 25 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 4,
  },
  text: { fontSize: 10, lineHeight: 1.5, color: '#374151' },
  item: { marginBottom: 15 },
  itemTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 2 },
  itemSubtitle: { fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 2 },
  itemDates: { fontSize: 9, color: '#1f2937', marginBottom: 6 },
  list: { marginLeft: 10 },
  listItem: { flexDirection: 'row', marginBottom: 2 },
  bullet: { width: 10, fontSize: 10 },
  listItemText: { flex: 1, fontSize: 10, lineHeight: 1.4 },
  skillCategory: { fontWeight: 'bold' },
});

interface Props {
  data: ResumeData;
}

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

export const ResumePDF = ({ data }: Props) => {
  // Use the URL API to robustly resolve relative paths based on the current page location
  // This prevents malformed URLs like "https://domain.com./header.png"
  const currentPath = window.location.origin + window.location.pathname;
  const headerUrl = new URL(import.meta.env.BASE_URL + 'header.png', currentPath).href;
  const footerUrl = new URL(import.meta.env.BASE_URL + 'footer.png', currentPath).href;

  return (
    <Document title={`${data.jobTitle} - ${data.name} - Newxel CV 2026`}>
      <Page size="A4" style={styles.page}>
        {/* Header — only on the first page */}
        <View>
          <Image src={headerUrl} style={styles.headerImage} />
        </View>

        <View style={styles.content}>
          <Text style={styles.jobTitle}>{data.jobTitle}</Text>
          <Text style={styles.name}>{data.name}</Text>

          {data.hrSummary && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>HR Summary</Text>
              <RichText text={data.hrSummary} style={styles.text} />
            </View>
          )}

          {data.skills && data.skills.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Skills</Text>
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

          {data.experience && data.experience.length > 0 && (
            <View style={styles.section}>
              {/* Ensure section title stays with the first job */}
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Job Experience</Text>
                <Text style={styles.itemTitle}>{data.experience[0].role}</Text>
                <Text style={styles.itemSubtitle}>{data.experience[0].company}</Text>
                <Text style={styles.itemDates}>{data.experience[0].dates}</Text>
              </View>

              <View style={styles.item}>
                <RichText text={data.experience[0].description} style={styles.text} />

                  {data.experience[0].responsibilities && data.experience[0].responsibilities.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={[styles.text, { fontWeight: 'bold', marginBottom: 4 }]}>
                        Key responsibilities & achievements:
                      </Text>
                      <View style={styles.list}>
                        {data.experience[0].responsibilities.map((resp, idx) => (
                          <View key={idx} style={styles.listItem}>
                            <Text style={styles.bullet}>•</Text>
                            <RichText text={resp} style={styles.listItemText} />
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  {data.experience[0].techStack && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.text}>
                        <Text style={{ fontWeight: 'bold' }}>Technologies: </Text>
                        {data.experience[0].techStack}
                      </Text>
                    </View>
                  )}
              </View>

              {/* Render remaining items */}
              {data.experience.slice(1).map((exp, index) => (
                <View key={index} style={styles.item} wrap={false}>
                  <Text style={styles.itemTitle}>{exp.role}</Text>
                  <Text style={styles.itemSubtitle}>{exp.company}</Text>
                  <Text style={styles.itemDates}>{exp.dates}</Text>
                  <RichText text={exp.description} style={styles.text} />

                  {exp.responsibilities && exp.responsibilities.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={[styles.text, { fontWeight: 'bold', marginBottom: 4 }]}>
                        Key responsibilities & achievements:
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

                  {exp.techStack && (
                    <View style={{ marginTop: 8 }}>
                      <Text style={styles.text}>
                        <Text style={{ fontWeight: 'bold' }}>Technologies: </Text>
                        {exp.techStack}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {data.education && data.education.length > 0 && (
            <View style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>Education</Text>
              {data.education.map((edu, index) => (
                <View key={index} style={{ marginBottom: 10 }}>
                  <Text style={styles.itemTitle}>{edu.degree}</Text>
                  <Text style={styles.text}>{edu.institution}</Text>
                  <Text style={styles.itemDates}>{edu.dates}</Text>
                </View>
              ))}
            </View>
          )}

          {data.languages && data.languages.length > 0 && (
            <View style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>Languages</Text>
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
            <View style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>Achievements</Text>
              {data.achievements.map((item, index) => (
                <View key={index} style={styles.listItem}>
                  <Text style={styles.bullet}>•</Text>
                  <RichText text={item} style={styles.listItemText} />
                </View>
              ))}
            </View>
          )}

          {data.certifications && data.certifications.length > 0 && (
            <View style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>Certifications</Text>
              {data.certifications.map((cert, index) => (
                <View key={index} style={{ marginBottom: 8 }}>
                  <Text style={styles.itemTitle}>{cert.title}</Text>
                  <Text style={styles.itemDates}>
                    {cert.issuer}{cert.date ? ` · ${cert.date}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {data.publications && data.publications.length > 0 && (
            <View style={styles.section} wrap={false}>
              <Text style={styles.sectionTitle}>Publications</Text>
              {data.publications.map((pub, index) => (
                <View key={index} style={{ marginBottom: 8 }}>
                  <Text style={styles.itemTitle}>{pub.title}</Text>
                  {pub.details ? (
                    <Text style={[styles.text, { color: '#4B5563' }]}>{pub.details}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}

          {data.projects && data.projects.length > 0 && (
            <View style={styles.section}>
              <View wrap={false}>
                <Text style={styles.sectionTitle}>Projects</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={styles.itemTitle}>{data.projects[0].title}</Text>
                  {data.projects[0].link && <Text style={[styles.text, { color: '#1d4ed8' }]}>{data.projects[0].link}</Text>}
                </View>
              </View>

              <View style={styles.item}>
                <RichText text={data.projects[0].description} style={styles.text} />
                  {data.projects[0].technologies && (
                    <View style={{ marginTop: 4 }}>
                      <Text style={styles.text}>
                        <Text style={{ fontWeight: 'bold' }}>Technologies: </Text>
                        {data.projects[0].technologies}
                      </Text>
                    </View>
                  )}
              </View>

              {data.projects.slice(1).map((proj, index) => (
                <View key={index} style={styles.item} wrap={false}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                    <Text style={styles.itemTitle}>{proj.title}</Text>
                    {proj.link && <Text style={[styles.text, { color: '#1d4ed8' }]}>{proj.link}</Text>}
                  </View>
                  <RichText text={proj.description} style={styles.text} />
                  {proj.technologies && (
                    <View style={{ marginTop: 4 }}>
                      <Text style={styles.text}>
                        <Text style={{ fontWeight: 'bold' }}>Technologies: </Text>
                        {proj.technologies}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

        </View>

        {/* Footer — fixed so it appears on every page */}
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }} fixed>
          <Image src={footerUrl} style={styles.footerImage} />
        </View>
      </Page>
    </Document>
  );
};

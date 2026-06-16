const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---\r?\n/;

const ANSWER_HEADINGS = [
  /^##\s+Что ответить на собесе\s*$/m,
  /^##\s+How to answer in an interview\s*$/m,
];

export const stripFrontmatter = (raw: string): string => raw.replace(FRONTMATTER, '');

export const cleanInterviewAnswer = (section: string): string => {
  const withoutComponents = section
    .replace(/<[^>]+>/g, ' ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1');
  const lines = withoutComponents
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s+/, '').trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  return lines.join('\n\n').replace(/\s+/g, ' ').trim();
};

export const extractInterviewAnswer = (raw: string): string | undefined => {
  const body = stripFrontmatter(raw);
  for (const heading of ANSWER_HEADINGS) {
    const match = heading.exec(body);
    if (!match) continue;
    const start = match.index + match[0].length;
    const rest = body.slice(start);
    const nextHeading = rest.search(/^##\s+/m);
    const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);
    const cleaned = cleanInterviewAnswer(section);
    if (cleaned.length >= 3) return cleaned;
  }
  return undefined;
};

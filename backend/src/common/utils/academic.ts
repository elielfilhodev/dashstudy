export const ACADEMIC_LEVEL_LABELS: Record<string, string> = {
  GRADUACAO: 'Graduação',
  MESTRADO: 'Mestrado',
  DOUTORADO: 'Doutorado',
  TECNOLOGO: 'Tecnólogo',
};

const COURSE_CREST_COLORS = [
  { crestColor: '#0f766e', crestBackground: '#ccfbf1' },
  { crestColor: '#1d4ed8', crestBackground: '#dbeafe' },
  { crestColor: '#7c2d12', crestBackground: '#ffedd5' },
  { crestColor: '#6d28d9', crestBackground: '#ede9fe' },
  { crestColor: '#be123c', crestBackground: '#ffe4e6' },
  { crestColor: '#166534', crestBackground: '#dcfce7' },
  { crestColor: '#334155', crestBackground: '#e2e8f0' },
  { crestColor: '#a16207', crestBackground: '#fef3c7' },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function normalizeCourseName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

export function slugifyCourseName(name: string): string {
  const base = normalizeCourseName(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return base || 'curso';
}

export function inferCourseCrestIcon(courseName: string): string {
  const name = normalizeCourseName(courseName);

  if (/(computacao|sistemas|software|dados|informatica|tecnologia)/.test(name))
    return 'code';
  if (/(direito|juridico|juridica)/.test(name)) return 'scale';
  if (/(medicina|enfermagem|saude|biomedicina|farmacia)/.test(name))
    return 'health';
  if (/(engenharia|arquitetura|civil|eletrica|mecanica|producao)/.test(name))
    return 'engineering';
  if (/(administracao|gestao|contabeis|economia|negocios)/.test(name))
    return 'business';
  if (
    /(psicologia|pedagogia|educacao|letras|historia|filosofia|sociologia)/.test(
      name,
    )
  )
    return 'humanities';
  if (/(biologia|quimica|fisica|matematica|estatistica)/.test(name))
    return 'science';
  if (
    /(design|artes|musica|cinema|comunicacao|jornalismo|publicidade)/.test(name)
  )
    return 'creative';

  return 'graduation-cap';
}

export function courseDefaults(courseName: string) {
  const name = courseName.trim().replace(/\s+/g, ' ');
  const normalizedName = normalizeCourseName(name);
  const hash = hashString(normalizedName);
  const palette = COURSE_CREST_COLORS[hash % COURSE_CREST_COLORS.length];

  return {
    name,
    normalizedName,
    slug: `${slugifyCourseName(name)}-${hash.toString(36).slice(0, 5)}`,
    crestIcon: inferCourseCrestIcon(name),
    ...palette,
  };
}

type AcademicProfileWithCourse = {
  academicLevel: string;
  startDate: Date | string;
  currentSemester: number;
  course: {
    name: string;
    slug: string;
    crestIcon: string;
    crestColor: string;
    crestBackground: string;
  };
};

export function serializeAcademicProfile(
  profile: AcademicProfileWithCourse | null | undefined,
) {
  if (!profile) return null;

  return {
    academicLevel: profile.academicLevel,
    levelLabel: ACADEMIC_LEVEL_LABELS[profile.academicLevel],
    courseName: profile.course.name,
    courseSlug: profile.course.slug,
    crestIcon: profile.course.crestIcon,
    crestColor: profile.course.crestColor,
    crestBackground: profile.course.crestBackground,
    startDate:
      profile.startDate instanceof Date
        ? profile.startDate.toISOString()
        : new Date(profile.startDate).toISOString(),
    currentSemester: profile.currentSemester,
  };
}

export const academicProfileInclude = {
  course: {
    select: {
      name: true,
      slug: true,
      crestIcon: true,
      crestColor: true,
      crestBackground: true,
    },
  },
} as const;

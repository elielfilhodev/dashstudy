import {
  courseDefaults,
  inferCourseCrestIcon,
  normalizeCourseName,
  serializeAcademicProfile,
  slugifyCourseName,
} from './academic';

describe('normalizeCourseName', () => {
  it('remove acentos, colapsa espaços e minusculiza', () => {
    expect(normalizeCourseName('  Ciência   da   Computação ')).toBe(
      'ciencia da computacao',
    );
  });

  it('normaliza variações do mesmo curso para a mesma chave', () => {
    expect(normalizeCourseName('ENGENHARIA CIVIL')).toBe(
      normalizeCourseName('engenharia  civil'),
    );
  });
});

describe('slugifyCourseName', () => {
  it('gera um slug seguro para URL', () => {
    expect(slugifyCourseName('Ciência da Computação')).toBe(
      'ciencia-da-computacao',
    );
  });

  it('cai num valor padrão quando o nome não tem caracteres úteis', () => {
    expect(slugifyCourseName('!!!')).toBe('curso');
  });
});

describe('inferCourseCrestIcon', () => {
  it.each([
    ['Ciência da Computação', 'code'],
    ['Direito', 'scale'],
    ['Medicina', 'health'],
    ['Engenharia Civil', 'engineering'],
    ['Administração', 'business'],
    ['Psicologia', 'humanities'],
    ['Matemática', 'science'],
    ['Design Gráfico', 'creative'],
    ['Curso Desconhecido', 'graduation-cap'],
  ])('%s recebe o ícone %s', (course, icon) => {
    expect(inferCourseCrestIcon(course)).toBe(icon);
  });
});

describe('courseDefaults', () => {
  it('gera a mesma identidade de curso independente de caixa e espaços', () => {
    const { name: _a, ...a } = courseDefaults('Engenharia Civil');
    const { name: _b, ...b } = courseDefaults('  engenharia   civil  ');
    expect(a).toEqual(b);
  });

  it('preserva o nome original limpo e deriva a chave normalizada', () => {
    const result = courseDefaults('  Ciência  da  Computação ');
    expect(result.name).toBe('Ciência da Computação');
    expect(result.normalizedName).toBe('ciencia da computacao');
    expect(result.slug).toMatch(/^ciencia-da-computacao-/);
  });
});

describe('serializeAcademicProfile', () => {
  it('devolve null sem perfil', () => {
    expect(serializeAcademicProfile(null)).toBeNull();
    expect(serializeAcademicProfile(undefined)).toBeNull();
  });

  it('traduz o nível e normaliza a data para ISO', () => {
    const result = serializeAcademicProfile({
      academicLevel: 'GRADUACAO',
      startDate: new Date('2024-02-01T00:00:00.000Z'),
      currentSemester: 5,
      course: {
        name: 'Ciência da Computação',
        slug: 'ciencia-da-computacao-abc',
        crestIcon: 'code',
        crestColor: '#0f766e',
        crestBackground: '#ccfbf1',
      },
    });

    expect(result).toMatchObject({
      levelLabel: 'Graduação',
      courseName: 'Ciência da Computação',
      currentSemester: 5,
      startDate: '2024-02-01T00:00:00.000Z',
    });
  });
});

import { dayDiff, levelFromXp, rankFromLevel, utcDayKey } from './gamification';

describe('levelFromXp', () => {
  it('começa no nível 1 sem XP', () => {
    expect(levelFromXp(0)).toEqual({
      level: 1,
      currentXp: 0,
      nextLevelXp: 100,
      totalXp: 0,
    });
  });

  it('mantém o nível 1 logo abaixo do primeiro limiar', () => {
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(99).currentXp).toBe(99);
  });

  it('sobe para o nível 2 exatamente no limiar', () => {
    expect(levelFromXp(100)).toEqual({
      level: 2,
      currentXp: 0,
      nextLevelXp: 125,
      totalXp: 100,
    });
  });

  it('aplica limiares crescentes de 25% por nível', () => {
    // 100 + 125 = 225 acumulados até o nível 3
    expect(levelFromXp(225).level).toBe(3);
    expect(levelFromXp(224).level).toBe(2);
    expect(levelFromXp(225).nextLevelXp).toBe(156);
  });

  it('é monotônico: mais XP nunca reduz o nível', () => {
    let previous = 0;
    for (let xp = 0; xp <= 5000; xp += 37) {
      const { level } = levelFromXp(xp);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });
});

describe('rankFromLevel', () => {
  it.each([
    [1, 'bronze'],
    [9, 'bronze'],
    [10, 'prata'],
    [20, 'ouro'],
    [30, 'platina'],
    [40, 'esmeralda'],
    [50, 'diamante'],
    [60, 'mestre'],
    [75, 'grao-mestre'],
    [90, 'genio'],
    [150, 'genio'],
  ])('nível %i corresponde ao rank %s', (level, expected) => {
    expect(rankFromLevel(level).key).toBe(expected);
  });
});

describe('utcDayKey / dayDiff', () => {
  it('formata a data como YYYY-MM-DD em UTC', () => {
    expect(utcDayKey(new Date('2026-03-05T23:59:59.999Z'))).toBe('2026-03-05');
  });

  it('usa o dia UTC, não o fuso local', () => {
    // 22:00 em UTC-3 ainda é o dia seguinte em UTC.
    expect(utcDayKey(new Date('2026-03-05T01:00:00.000Z'))).toBe('2026-03-05');
  });

  it('conta dias de calendário, não janelas de 24h', () => {
    expect(dayDiff('2026-03-05', '2026-03-06')).toBe(1);
    expect(dayDiff('2026-03-05', '2026-03-05')).toBe(0);
    expect(dayDiff('2026-03-01', '2026-03-31')).toBe(30);
  });

  it('atravessa a virada do mês e do ano', () => {
    expect(dayDiff('2026-12-31', '2027-01-01')).toBe(1);
    expect(dayDiff('2026-02-28', '2026-03-01')).toBe(1);
  });
});

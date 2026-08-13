export type LevelInfo = {
  level: number;
  currentXp: number;
  nextLevelXp: number;
  totalXp: number;
};

export function levelFromXp(xp: number): LevelInfo {
  let level = 1;
  let threshold = 100;
  let accumulated = 0;
  while (xp >= accumulated + threshold) {
    accumulated += threshold;
    level++;
    threshold = Math.round(threshold * 1.25);
  }
  return {
    level,
    currentXp: xp - accumulated,
    nextLevelXp: threshold,
    totalXp: xp,
  };
}

export type RankInfo = {
  key: string;
  label: string;
  className: string;
  avatarBorder: string;
  icon: string;
};

const RANKS: Array<RankInfo & { minLevel: number }> = [
  {
    minLevel: 90,
    key: 'genio',
    label: 'Gênio',
    className:
      'bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 text-white',
    avatarBorder: 'avatar-rank-genio',
    icon: '✨',
  },
  {
    minLevel: 75,
    key: 'grao-mestre',
    label: 'Grão-Mestre',
    className: 'bg-purple-700 text-white',
    avatarBorder: 'avatar-rank-grao-mestre',
    icon: '👑',
  },
  {
    minLevel: 60,
    key: 'mestre',
    label: 'Mestre',
    className: 'bg-red-600 text-white',
    avatarBorder: 'avatar-rank-mestre',
    icon: '🔥',
  },
  {
    minLevel: 50,
    key: 'diamante',
    label: 'Diamante',
    className: 'bg-sky-500 text-white',
    avatarBorder: 'avatar-rank-diamante',
    icon: '💎',
  },
  {
    minLevel: 40,
    key: 'esmeralda',
    label: 'Esmeralda',
    className: 'bg-emerald-500 text-white',
    avatarBorder: 'avatar-rank-esmeralda',
    icon: '💚',
  },
  {
    minLevel: 30,
    key: 'platina',
    label: 'Platina',
    className: 'bg-violet-500 text-white',
    avatarBorder: 'avatar-rank-platina',
    icon: '🔷',
  },
  {
    minLevel: 20,
    key: 'ouro',
    label: 'Ouro',
    className: 'bg-yellow-500 text-black',
    avatarBorder: 'avatar-rank-ouro',
    icon: '🥇',
  },
  {
    minLevel: 10,
    key: 'prata',
    label: 'Prata',
    className: 'bg-zinc-400 text-black',
    avatarBorder: 'avatar-rank-prata',
    icon: '🥈',
  },
  {
    minLevel: 1,
    key: 'bronze',
    label: 'Bronze',
    className: 'bg-orange-700 text-white',
    avatarBorder: 'avatar-rank-bronze',
    icon: '🥉',
  },
];

export function rankFromLevel(level: number): RankInfo {
  const rank =
    RANKS.find((r) => level >= r.minLevel) ?? RANKS[RANKS.length - 1];
  const { minLevel: _minLevel, ...info } = rank;
  return info;
}

export const RANK_THRESHOLDS = RANKS.map(({ key, label, minLevel, icon }) => ({
  key,
  label,
  minLevel,
  icon,
})).reverse();

export const ACHIEVEMENTS: Record<
  string,
  { label: string; description: string }
> = {
  FIRST_TASK: {
    label: 'Primeira Tarefa',
    description: 'Concluiu a primeira tarefa',
  },
  TEN_TASKS: { label: 'Dedicado', description: 'Concluiu 10 tarefas' },
  FIFTY_TASKS: { label: 'Veterano', description: 'Concluiu 50 tarefas' },
  HUNDRED_TASKS: { label: 'Centurião', description: 'Concluiu 100 tarefas' },
  WEEK_STREAK: {
    label: 'Semana de Fogo',
    description: 'Ofensiva de 7 dias seguidos',
  },
  MONTH_STREAK: {
    label: 'Mês Imparável',
    description: 'Ofensiva de 30 dias seguidos',
  },
};

export const XP_BASE = 20;
export const XP_WEEK_BONUS = 100;
export const XP_MONTH_BONUS = 300;

/** Chave de dia em UTC (`YYYY-MM-DD`), formato usado em `Gamification.lastCompletionDate`. */
export function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Diferença em dias de calendário UTC entre duas chaves `YYYY-MM-DD`. */
export function dayDiff(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Ofensiva efetiva para exibição (a "chama"). `streakDays` só é recalculado
 * quando o usuário conclui uma tarefa, então uma ofensiva perdida fica com o
 * valor antigo no banco até a próxima conclusão. Aqui derivamos, a cada
 * leitura, se já se passou mais de 1 dia sem conclusão — se sim, a chama
 * apaga (mostra 0) mesmo sem gravar nada, preservando `bestStreak` como
 * recorde.
 */
export function effectiveStreakDays(
  streakDays: number,
  lastCompletionDate: string | null,
  today = utcDayKey(),
): number {
  if (!lastCompletionDate) return 0;
  return dayDiff(lastCompletionDate, today) > 1 ? 0 : streakDays;
}

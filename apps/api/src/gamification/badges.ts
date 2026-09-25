export interface BadgeDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  isEarned: (context: BadgeContext) => boolean;
}

export interface BadgeContext {
  completedLessonCount: number;
  completedLabCount: number;
  correctQuestionCount: number;
  submittedSimulationCount: number;
  passedSimulationCount: number;
  currentStreak: number;
  level: number;
}

export const BADGE_CATALOG: BadgeDefinition[] = [
  {
    id: 'first_lesson',
    name: 'Primeiros passos',
    description: 'Concluiu sua primeira aula.',
    icon: '📖',
    isEarned: (ctx) => ctx.completedLessonCount >= 1,
  },
  {
    id: 'first_lab',
    name: 'Mão na massa',
    description: 'Concluiu seu primeiro laboratório.',
    icon: '🛠️',
    isEarned: (ctx) => ctx.completedLabCount >= 1,
  },
  {
    id: 'first_question',
    name: 'Primeiro acerto',
    description: 'Acertou sua primeira questão.',
    icon: '🎯',
    isEarned: (ctx) => ctx.correctQuestionCount >= 1,
  },
  {
    id: 'first_simulation',
    name: 'Primeira prova',
    description: 'Enviou seu primeiro simulado.',
    icon: '📝',
    isEarned: (ctx) => ctx.submittedSimulationCount >= 1,
  },
  {
    id: 'simulation_passed',
    name: 'Aprovado!',
    description: 'Foi aprovado em um simulado.',
    icon: '🏅',
    isEarned: (ctx) => ctx.passedSimulationCount >= 1,
  },
  {
    id: 'streak_3',
    name: 'Pegando ritmo',
    description: '3 dias seguidos estudando.',
    icon: '🔥',
    isEarned: (ctx) => ctx.currentStreak >= 3,
  },
  {
    id: 'streak_7',
    name: 'Uma semana em cheio',
    description: '7 dias seguidos estudando.',
    icon: '🔥',
    isEarned: (ctx) => ctx.currentStreak >= 7,
  },
  {
    id: 'streak_30',
    name: 'Hábito formado',
    description: '30 dias seguidos estudando.',
    icon: '🔥',
    isEarned: (ctx) => ctx.currentStreak >= 30,
  },
  {
    id: 'level_5',
    name: 'Nível 5',
    description: 'Alcançou o nível 5.',
    icon: '⭐',
    isEarned: (ctx) => ctx.level >= 5,
  },
  {
    id: 'level_10',
    name: 'Nível 10',
    description: 'Alcançou o nível 10.',
    icon: '🌟',
    isEarned: (ctx) => ctx.level >= 10,
  },
];

/** Returns the catalog entries whose condition is satisfied by `context`. */
export function evaluateBadges(context: BadgeContext): BadgeDefinition[] {
  return BADGE_CATALOG.filter((badge) => badge.isEarned(context));
}

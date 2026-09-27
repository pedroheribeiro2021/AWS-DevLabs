/**
 * Pure analytics functions (no database access) so the diagnosis and the
 * recommendation rules can be unit-tested. Recommendations are deterministic
 * on purpose -- see docs/Planejamento.md, section 15.
 */

export interface TopicInput {
  id: string;
  name: string;
  domainId: string;
  lessonsTotal: number;
  lessonsCompleted: number;
  /** First lesson (in track order) the user hasn't completed, or the first lesson if all are done. */
  nextLessonId: string | null;
  labsTotal: number;
  labsCompleted: number;
  questionsTotal: number;
  flashcardsTotal: number;
  flashcardsMastered: number;
}

export interface DomainInput {
  id: string;
  name: string;
  weightPercent: number;
  topics: TopicInput[];
}

/** One answer to one question, from practice or from a completed simulation. */
export interface AnswerInput {
  questionId: string;
  topicId: string;
  isCorrect: boolean;
  answeredAt: Date;
}

export interface InProgressLab {
  id: string;
  title: string;
}

export interface TopicStats extends TopicInput {
  /** Distinct questions answered at least once. */
  answeredQuestions: number;
  /** Distinct questions whose most recent answer was correct. */
  correctQuestions: number;
  /** correctQuestions / answeredQuestions, 0-100, or null with no answers. */
  accuracyPercent: number | null;
}

export interface DomainStats {
  id: string;
  name: string;
  weightPercent: number;
  answeredQuestions: number;
  correctQuestions: number;
  accuracyPercent: number | null;
  questionsTotal: number;
  lessonsTotal: number;
  lessonsCompleted: number;
  topics: TopicStats[];
}

export type RecommendationKind =
  | 'REVIEW_WEAK_TOPIC'
  | 'FINISH_LAB'
  | 'CONTINUE_LESSONS'
  | 'PRACTICE_TOPIC'
  | 'TAKE_SIMULATION';

export interface Recommendation {
  kind: RecommendationKind;
  title: string;
  reason: string;
  href: string;
}

export interface WeeklyActivity {
  /** Monday of the week, YYYY-MM-DD, in Brasília time. */
  weekStart: string;
  answers: number;
  correct: number;
}

/** A topic needs this many distinct answered questions before it can be called weak. */
export const WEAK_TOPIC_MIN_ANSWERED = 3;
/** Below this accuracy (%) a topic with enough answers is weak. */
export const WEAK_TOPIC_ACCURACY = 70;
/** Each domain needs this many answered questions before a simulation is recommended. */
export const SIMULATION_MIN_ANSWERED_PER_DOMAIN = 5;
export const MAX_RECOMMENDATIONS = 5;

const BRASILIA_OFFSET_MS = -3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function percent(part: number, total: number): number | null {
  return total === 0 ? null : Math.round((part / total) * 100);
}

/** Keeps only the most recent answer per question -- accuracy reflects what the user knows now. */
export function latestAnswerByQuestion(answers: AnswerInput[]): Map<string, AnswerInput> {
  const latest = new Map<string, AnswerInput>();
  for (const answer of answers) {
    const current = latest.get(answer.questionId);
    if (!current || answer.answeredAt > current.answeredAt) {
      latest.set(answer.questionId, answer);
    }
  }
  return latest;
}

export function computeDomainStats(domains: DomainInput[], answers: AnswerInput[]): DomainStats[] {
  const latest = [...latestAnswerByQuestion(answers).values()];

  return domains.map((domain) => {
    const topics: TopicStats[] = domain.topics.map((topic) => {
      const topicAnswers = latest.filter((answer) => answer.topicId === topic.id);
      const correctQuestions = topicAnswers.filter((answer) => answer.isCorrect).length;
      return {
        ...topic,
        answeredQuestions: topicAnswers.length,
        correctQuestions,
        accuracyPercent: percent(correctQuestions, topicAnswers.length),
      };
    });

    const answeredQuestions = topics.reduce((sum, topic) => sum + topic.answeredQuestions, 0);
    const correctQuestions = topics.reduce((sum, topic) => sum + topic.correctQuestions, 0);

    return {
      id: domain.id,
      name: domain.name,
      weightPercent: domain.weightPercent,
      answeredQuestions,
      correctQuestions,
      accuracyPercent: percent(correctQuestions, answeredQuestions),
      questionsTotal: topics.reduce((sum, topic) => sum + topic.questionsTotal, 0),
      lessonsTotal: topics.reduce((sum, topic) => sum + topic.lessonsTotal, 0),
      lessonsCompleted: topics.reduce((sum, topic) => sum + topic.lessonsCompleted, 0),
      topics,
    };
  });
}

/**
 * Topics with enough answers and accuracy below the threshold, worst first;
 * ties go to the heavier domain, since it's worth more on the exam.
 */
export function findWeakTopics(domains: DomainStats[]): (TopicStats & { domainWeight: number })[] {
  return domains
    .flatMap((domain) => domain.topics.map((topic) => ({ ...topic, domainWeight: domain.weightPercent })))
    .filter(
      (topic) =>
        topic.answeredQuestions >= WEAK_TOPIC_MIN_ANSWERED &&
        topic.accuracyPercent !== null &&
        topic.accuracyPercent < WEAK_TOPIC_ACCURACY,
    )
    .sort((a, b) => a.accuracyPercent! - b.accuracyPercent! || b.domainWeight - a.domainWeight);
}

export interface RecommendationContext {
  domains: DomainStats[];
  inProgressLabs: InProgressLab[];
  completedSimulations: number;
  passingScorePercent: number;
}

/**
 * Deterministic "what should I study now?" list, in priority order:
 * weak topics, unfinished labs, the next lessons, topics with little practice,
 * and finally a simulation once every domain has been practiced.
 */
export function buildRecommendations(context: RecommendationContext): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const { domains } = context;
  const orderedTopics = domains.flatMap((domain) => domain.topics);
  // A topic gets at most one recommendation, the highest-priority one.
  const coveredTopicIds = new Set<string>();

  for (const topic of findWeakTopics(domains).slice(0, 2)) {
    coveredTopicIds.add(topic.id);
    recommendations.push({
      kind: 'REVIEW_WEAK_TOPIC',
      title: `Revisar ${topic.name}`,
      reason: `Você acertou ${topic.accuracyPercent}% das ${topic.answeredQuestions} questões respondidas deste tópico. Releia a aula e refaça as questões.`,
      href: topic.nextLessonId ? `/learn/${topic.nextLessonId}` : `/questions?topicId=${topic.id}`,
    });
  }

  const lab = context.inProgressLabs[0];
  if (lab) {
    recommendations.push({
      kind: 'FINISH_LAB',
      title: `Terminar o laboratório "${lab.title}"`,
      reason: 'Você começou este laboratório e ainda não concluiu.',
      href: `/labs/${lab.id}`,
    });
  }

  const nextTopicToStudy = orderedTopics.find(
    (topic) =>
      !coveredTopicIds.has(topic.id) && topic.lessonsTotal > 0 && topic.lessonsCompleted < topic.lessonsTotal,
  );
  if (nextTopicToStudy?.nextLessonId) {
    coveredTopicIds.add(nextTopicToStudy.id);
    recommendations.push({
      kind: 'CONTINUE_LESSONS',
      title: `Estudar ${nextTopicToStudy.name}`,
      reason: `Aulas concluídas neste tópico: ${nextTopicToStudy.lessonsCompleted} de ${nextTopicToStudy.lessonsTotal}.`,
      href: `/learn/${nextTopicToStudy.nextLessonId}`,
    });
  }

  // Topics whose lessons are done but whose question bank is mostly untouched.
  const underPracticed = orderedTopics.filter(
    (topic) =>
      !coveredTopicIds.has(topic.id) &&
      topic.lessonsTotal > 0 &&
      topic.lessonsCompleted === topic.lessonsTotal &&
      topic.questionsTotal > 0 &&
      topic.answeredQuestions < topic.questionsTotal / 2,
  );
  for (const topic of underPracticed.slice(0, 2)) {
    recommendations.push({
      kind: 'PRACTICE_TOPIC',
      title: `Praticar questões de ${topic.name}`,
      reason: `Você concluiu as aulas, mas respondeu só ${topic.answeredQuestions} de ${topic.questionsTotal} questões.`,
      href: `/questions?topicId=${topic.id}`,
    });
  }

  const everyDomainPracticed =
    domains.length > 0 &&
    domains.every((domain) => domain.answeredQuestions >= SIMULATION_MIN_ANSWERED_PER_DOMAIN);
  if (everyDomainPracticed) {
    const answered = domains.reduce((sum, domain) => sum + domain.answeredQuestions, 0);
    const correct = domains.reduce((sum, domain) => sum + domain.correctQuestions, 0);
    const accuracy = percent(correct, answered) ?? 0;
    recommendations.push({
      kind: 'TAKE_SIMULATION',
      title: context.completedSimulations === 0 ? 'Fazer seu primeiro simulado' : 'Fazer um novo simulado',
      reason:
        accuracy >= context.passingScorePercent
          ? `Sua taxa de acerto atual (${accuracy}%) está acima da nota de aprovação (${context.passingScorePercent}%). Teste isso em condições de prova.`
          : `Você já praticou todos os domínios. Um simulado mostra como ${accuracy}% de acerto se sai em condições de prova (aprovação: ${context.passingScorePercent}%).`,
      href: '/simulations',
    });
  }

  return recommendations.slice(0, MAX_RECOMMENDATIONS);
}

function toBrasiliaDate(date: Date): Date {
  return new Date(date.getTime() + BRASILIA_OFFSET_MS);
}

/** Monday 00:00 of the date's week, as a UTC-based date shifted to Brasília time. */
function weekStartOf(date: Date): Date {
  const local = toBrasiliaDate(date);
  const dayStart = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  return new Date(dayStart - daysSinceMonday * DAY_MS);
}

/** Answers (every attempt, not only the latest) per week for the last `weeks` weeks, oldest first. */
export function weeklyActivity(answers: AnswerInput[], now: Date, weeks = 8): WeeklyActivity[] {
  const currentWeek = weekStartOf(now).getTime();
  const buckets: WeeklyActivity[] = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const start = new Date(currentWeek - index * 7 * DAY_MS);
    buckets.push({ weekStart: start.toISOString().slice(0, 10), answers: 0, correct: 0 });
  }

  const firstWeek = currentWeek - (weeks - 1) * 7 * DAY_MS;
  for (const answer of answers) {
    const week = weekStartOf(answer.answeredAt).getTime();
    if (week < firstWeek || week > currentWeek) continue;
    const bucket = buckets[(week - firstWeek) / (7 * DAY_MS)];
    bucket.answers += 1;
    if (answer.isCorrect) bucket.correct += 1;
  }

  return buckets;
}

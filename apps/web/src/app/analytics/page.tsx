import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AccuracyBar } from '@/components/accuracy-bar';
import { AppNav } from '@/components/app-nav';
import { RecommendationsSection } from '@/components/recommendations-section';
import { WeeklyActivityChart } from '@/components/weekly-activity-chart';
import { getAnalytics } from '@/lib/analytics';
import { getCurrentUser } from '@/lib/auth-server';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default async function AnalyticsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const analytics = await getAnalytics();
  const { overall, passingScorePercent } = analytics;

  const tiles = [
    {
      label: 'Taxa de acerto',
      value: overall.accuracyPercent === null ? '—' : `${overall.accuracyPercent}%`,
      detail: `${overall.answeredQuestions} de ${overall.questionsTotal} questões`,
    },
    { label: 'Aulas', value: `${overall.lessonsCompleted}/${overall.lessonsTotal}`, detail: 'concluídas' },
    { label: 'Laboratórios', value: `${overall.labsCompleted}/${overall.labsTotal}`, detail: 'concluídos' },
    {
      label: 'Flashcards',
      value: `${overall.flashcardsMastered}/${overall.flashcardsTotal}`,
      detail: 'dominados',
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:py-16">
      <AppNav title="Desempenho" />

      <section className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">{tile.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{tile.value}</p>
              <p className="text-xs text-slate-500">{tile.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          A taxa de acerto usa a resposta mais recente de cada questão, na prática e nos simulados. A linha cinza
          nas barras marca a nota de aprovação da prova ({passingScorePercent}%).
        </p>
      </section>

      <RecommendationsSection recommendations={analytics.recommendations} />

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">Pontos fracos</h2>
        {analytics.weakTopics.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">
            Nenhum tópico abaixo de 70% de acerto. Um tópico só entra aqui depois de pelo menos 3 questões
            respondidas.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {analytics.weakTopics.map((topic) => (
              <li key={topic.id}>
                <Link
                  href={`/questions?topicId=${topic.id}`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
                >
                  <span className="text-slate-800">{topic.name}</span>
                  <span className="shrink-0 text-xs font-medium text-red-700">
                    {topic.accuracyPercent}% em {topic.answeredQuestions} questões
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">Desempenho por domínio</h2>
        {analytics.domains.map((domain) => (
          <div key={domain.id} className="rounded-lg border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <h3 className="text-base font-semibold text-slate-800">
                {domain.name}{' '}
                <span className="font-normal text-slate-500">({domain.weightPercent}% da prova)</span>
              </h3>
              <span className="shrink-0 text-xs text-slate-500">
                {domain.answeredQuestions}/{domain.questionsTotal} questões
              </span>
            </div>
            <div className="mt-2">
              <AccuracyBar accuracyPercent={domain.accuracyPercent} passingScorePercent={passingScorePercent} />
            </div>
            <ul className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-3">
              {domain.topics.map((topic) => (
                <li key={topic.id} className="flex flex-col gap-1">
                  <div className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
                    <Link
                      href={`/questions?topicId=${topic.id}`}
                      className="text-slate-700 hover:text-slate-900 hover:underline"
                    >
                      {topic.name}
                    </Link>
                    <span className="shrink-0 text-xs text-slate-500">
                      {topic.answeredQuestions}/{topic.questionsTotal} questões · {topic.lessonsCompleted}/
                      {topic.lessonsTotal} aulas
                    </span>
                  </div>
                  <AccuracyBar accuracyPercent={topic.accuracyPercent} passingScorePercent={passingScorePercent} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-semibold">Evolução</h2>
        <WeeklyActivityChart weeks={analytics.history.weekly} />

        <h3 className="mt-6 text-sm font-medium text-slate-700">Simulados concluídos</h3>
        {analytics.history.simulations.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Você ainda não concluiu nenhum simulado.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1">
            {analytics.history.simulations.map((simulation) => (
              <li key={simulation.id}>
                <Link
                  href={`/simulations/${simulation.id}/review`}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
                >
                  <span className="text-slate-700">
                    {formatDate(simulation.completedAt)} · {simulation.questionCount} questões
                  </span>
                  <span
                    className={
                      simulation.passed
                        ? 'shrink-0 text-xs font-medium text-green-700'
                        : 'shrink-0 text-xs font-medium text-red-700'
                    }
                  >
                    {simulation.scorePercent}% · {simulation.passed ? '✓ Aprovado' : '✗ Reprovado'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

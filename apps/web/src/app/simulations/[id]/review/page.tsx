import Link from 'next/link';
import { redirect } from 'next/navigation';
import { XpBanner } from '@/components/xp-banner';
import { getCurrentUser } from '@/lib/auth-server';
import { getSimulationReview } from '@/lib/simulations';

interface ReviewPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ xp?: string; level?: string; streak?: string; badges?: string }>;
}

export default async function SimulationReviewPage({ params, searchParams }: ReviewPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const { id } = await params;
  const { xp, level, streak, badges } = await searchParams;
  const review = await getSimulationReview(id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
      <Link href="/simulations" className="text-sm text-slate-500 hover:underline">
        ← Voltar aos simulados
      </Link>

      <XpBanner xp={xp} level={level} streak={streak} badges={badges} />

      <div
        className={
          review.passed
            ? 'rounded-lg border border-green-300 bg-green-50 p-5 text-center'
            : 'rounded-lg border border-red-300 bg-red-50 p-5 text-center'
        }
      >
        <p className="text-3xl font-bold">{review.scorePercent}%</p>
        <p
          className={
            review.passed ? 'mt-1 font-semibold text-green-700' : 'mt-1 font-semibold text-red-700'
          }
        >
          {review.passed ? 'Aprovado' : 'Reprovado'}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {review.correctCount} de {review.questionCount} questões corretas
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {review.questions.map((simulationQuestion, index) => (
          <div key={simulationQuestion.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm text-slate-500">Questão {index + 1}</p>
            <h2 className="mt-1 font-medium text-slate-900">{simulationQuestion.question.prompt}</h2>
            <p
              className={
                simulationQuestion.isCorrect
                  ? 'mt-2 text-sm font-semibold text-green-600'
                  : 'mt-2 text-sm font-semibold text-red-600'
              }
            >
              {simulationQuestion.isCorrect ? 'Correta' : 'Incorreta'}
            </p>

            <div className="mt-3 flex flex-col gap-2">
              {simulationQuestion.question.options.map((option) => {
                const wasSelected = simulationQuestion.selectedOptionIds.includes(option.id);
                return (
                  <div
                    key={option.id}
                    className={
                      option.isCorrect
                        ? 'rounded-md border border-green-300 bg-green-50 p-3 text-sm'
                        : wasSelected
                          ? 'rounded-md border border-red-300 bg-red-50 p-3 text-sm'
                          : 'rounded-md border border-slate-200 bg-white p-3 text-sm'
                    }
                  >
                    <p className="font-medium text-slate-800">
                      {option.text}
                      {option.isCorrect && ' ✓'}
                      {wasSelected && !option.isCorrect && ' (sua resposta)'}
                    </p>
                    <p className="mt-1 text-slate-600">{option.explanation}</p>
                  </div>
                );
              })}
            </div>

            {simulationQuestion.question.explanation && (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="mb-1 font-semibold">Explicação</p>
                <p>{simulationQuestion.question.explanation}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

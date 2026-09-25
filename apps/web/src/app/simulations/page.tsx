import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppNav } from '@/components/app-nav';
import { getCurrentUser } from '@/lib/auth-server';
import { getTrack } from '@/lib/learning';
import { getSimulations } from '@/lib/simulations';
import { startNewSimulation } from './actions';

const DEFAULT_CERTIFICATION_SLUG = 'aws-certified-developer-associate';

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído',
  ABANDONED: 'Abandonado',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function SimulationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const [track, attempts] = await Promise.all([getTrack(DEFAULT_CERTIFICATION_SLUG), getSimulations()]);
  const examVersion = track.examVersions[0];
  const inProgress = attempts.find((attempt) => attempt.status === 'IN_PROGRESS');
  const startAction = examVersion ? startNewSimulation.bind(null, examVersion.id) : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:py-16">
      <AppNav title="Simulados" />

      {inProgress ? (
        <Link
          href={`/simulations/${inProgress.id}`}
          className="rounded-lg border border-orange-300 bg-orange-50 p-4 text-sm font-medium text-orange-800 hover:border-orange-400"
        >
          Você tem um simulado em andamento — continuar de onde parou →
        </Link>
      ) : startAction ? (
        <form action={startAction}>
          <button
            type="submit"
            className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Novo simulado
          </button>
        </form>
      ) : null}

      <ul className="flex flex-col gap-3">
        {attempts.length === 0 && (
          <p className="text-sm text-slate-500">Você ainda não fez nenhum simulado.</p>
        )}
        {attempts.map((attempt) => (
          <li key={attempt.id}>
            <Link
              href={
                attempt.status === 'IN_PROGRESS'
                  ? `/simulations/${attempt.id}`
                  : `/simulations/${attempt.id}/review`
              }
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
            >
              <div>
                <p className="font-medium text-slate-800">
                  {attempt.questionCount} questões · {attempt.durationMinutes} min
                </p>
                <p className="text-sm text-slate-500">{formatDate(attempt.startedAt)}</p>
              </div>
              <div className="text-right">
                {attempt.status === 'COMPLETED' ? (
                  <p
                    className={
                      attempt.passed
                        ? 'text-sm font-semibold text-green-600'
                        : 'text-sm font-semibold text-red-600'
                    }
                  >
                    {attempt.scorePercent}% · {attempt.passed ? 'Aprovado' : 'Reprovado'}
                  </p>
                ) : (
                  <p className="text-sm font-medium text-slate-500">{STATUS_LABEL[attempt.status]}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

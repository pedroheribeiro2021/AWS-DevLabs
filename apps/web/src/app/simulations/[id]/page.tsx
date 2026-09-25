import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SimulationTimer } from '@/components/simulation-timer';
import { getCurrentUser } from '@/lib/auth-server';
import { getSimulation } from '@/lib/simulations';
import { saveSimulationAnswer } from './actions';

interface SimulationPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}

export default async function SimulationPage({ params, searchParams }: SimulationPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const { id } = await params;
  const { q } = await searchParams;
  const simulation = await getSimulation(id);

  if (simulation.status !== 'IN_PROGRESS') {
    redirect(`/simulations/${id}/review`);
  }

  const totalQuestions = simulation.questions.length;
  const requestedOrder = Number(q) || 1;
  const currentOrder = Math.min(Math.max(requestedOrder, 1), totalQuestions);
  const current = simulation.questions.find((item) => item.order === currentOrder)!;
  const nextOrder = currentOrder < totalQuestions ? currentOrder + 1 : null;
  const prevOrder = currentOrder > 1 ? currentOrder - 1 : null;
  const answeredCount = simulation.questions.filter((item) => item.answered).length;
  const inputType = current.question.multipleCorrect ? 'checkbox' : 'radio';
  const action = saveSimulationAnswer.bind(null, id, current.question.id, nextOrder);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500">
          Questão {currentOrder} de {totalQuestions} · {answeredCount} respondidas
        </p>
        <SimulationTimer remainingSeconds={simulation.remainingSeconds} />
      </div>

      <div className="flex flex-wrap gap-2">
        {simulation.questions.map((item) => {
          const isCurrent = item.order === currentOrder;
          const base = 'flex h-9 w-9 items-center justify-center rounded-md border text-sm font-medium';
          const style = isCurrent
            ? `${base} border-slate-900 bg-slate-900 text-white`
            : item.flagged
              ? `${base} border-amber-400 bg-amber-50 text-amber-700`
              : item.answered
                ? `${base} border-green-300 bg-green-50 text-green-700`
                : `${base} border-slate-200 bg-white text-slate-600`;
          return (
            <Link key={item.id} href={`/simulations/${id}?q=${item.order}`} className={style}>
              {item.order}
            </Link>
          );
        })}
      </div>

      <form action={action} className="flex flex-col gap-4">
        <h1 className="text-lg font-bold text-slate-900">{current.question.prompt}</h1>

        <div className="flex flex-col gap-3">
          {current.question.options.map((option) => (
            <label
              key={option.id}
              className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800 hover:border-slate-300"
            >
              <input
                type={inputType}
                name="selectedOptionIds"
                value={option.id}
                defaultChecked={current.selectedOptionIds.includes(option.id)}
                className="mt-0.5"
              />
              {option.text}
            </label>
          ))}
        </div>

        <label className="flex w-fit items-center gap-2 text-sm text-amber-700">
          <input type="checkbox" name="flagged" defaultChecked={current.flagged} />
          Marcar para revisar
        </label>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            {prevOrder && (
              <Link
                href={`/simulations/${id}?q=${prevOrder}`}
                className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-medium hover:bg-slate-100"
              >
                ← Anterior
              </Link>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href={`/simulations/${id}/submit`}
              className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-medium hover:bg-slate-100"
            >
              Enviar simulado
            </Link>
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              {nextOrder ? 'Salvar e continuar →' : 'Salvar resposta'}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}

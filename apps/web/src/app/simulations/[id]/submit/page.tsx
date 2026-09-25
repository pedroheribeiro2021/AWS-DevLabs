import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-server';
import { getSimulation } from '@/lib/simulations';
import { confirmSubmitSimulation } from './actions';

interface ConfirmSubmitPageProps {
  params: Promise<{ id: string }>;
}

export default async function ConfirmSubmitPage({ params }: ConfirmSubmitPageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  const { id } = await params;
  const simulation = await getSimulation(id);

  if (simulation.status !== 'IN_PROGRESS') {
    redirect(`/simulations/${id}/review`);
  }

  const totalQuestions = simulation.questions.length;
  const answeredCount = simulation.questions.filter((item) => item.answered).length;
  const unansweredCount = totalQuestions - answeredCount;
  const action = confirmSubmitSimulation.bind(null, id);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
      <h1 className="text-xl font-bold">Enviar simulado?</h1>

      <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p>
          Você respondeu <strong>{answeredCount}</strong> de <strong>{totalQuestions}</strong> questões.
        </p>
        {unansweredCount > 0 && (
          <p className="mt-1 text-amber-700">
            {unansweredCount} questão(ões) ainda sem resposta — elas serão contadas como erradas.
          </p>
        )}
        <p className="mt-2 text-slate-500">Depois de enviado, não é possível alterar as respostas.</p>
      </div>

      <div className="flex gap-3">
        <Link
          href={`/simulations/${id}`}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100"
        >
          Cancelar
        </Link>
        <form action={action}>
          <button
            type="submit"
            className="rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
          >
            Confirmar envio
          </button>
        </form>
      </div>
    </main>
  );
}

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { XpBanner } from '@/components/xp-banner';
import { getCurrentUser } from '@/lib/auth-server';
import { getLab } from '@/lib/labs';
import { completeLabAction, startLabAction } from './actions';

interface LabPageProps {
  params: Promise<{ labId: string }>;
  searchParams: Promise<{ xp?: string; level?: string; streak?: string; badges?: string }>;
}

export default async function LabPage({ params, searchParams }: LabPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const { labId } = await params;
  const { xp, level, streak, badges } = await searchParams;
  const lab = await getLab(labId);
  const start = startLabAction.bind(null, labId);
  const complete = completeLabAction.bind(null, labId);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
      <Link href="/labs" className="text-sm text-slate-500 hover:underline">
        ← Voltar aos laboratórios
      </Link>

      <XpBanner xp={xp} level={level} streak={streak} badges={badges} />

      <div>
        <p className="text-sm text-slate-500">
          Nível {lab.level} · {lab.topic.name} · {lab.estimatedMinutes} min
        </p>
        <h1 className="text-2xl font-bold">{lab.title}</h1>
      </div>

      <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-800">
        <div>
          <h2 className="mb-1 font-semibold text-slate-700">Objetivo</h2>
          <p>{lab.objective}</p>
        </div>
        <div>
          <h2 className="mb-1 font-semibold text-slate-700">Pré-requisitos</h2>
          <p>{lab.prerequisites}</p>
        </div>
        <div>
          <h2 className="mb-1 font-semibold text-slate-700">Contexto</h2>
          <p>{lab.context}</p>
        </div>
        <div className="rounded-md bg-orange-50 p-3 text-orange-800">
          <p className="font-semibold">Custos</p>
          <p>{lab.costWarning}</p>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-slate-800">Tarefas</h2>
        {lab.steps.map((step) => (
          <div key={step.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="mb-2 font-medium text-slate-700">
              {step.order}. {step.title}
            </h3>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{step.instructions}</p>
            <p className="mt-3 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
              <span className="font-semibold">Como validar: </span>
              {step.validation}
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-800">
        <h2 className="mb-1 font-semibold text-slate-700">Troubleshooting</h2>
        <p className="whitespace-pre-wrap">{lab.troubleshooting}</p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-800">
        <h2 className="mb-1 font-semibold text-slate-700">Cleanup</h2>
        <p>{lab.cleanup}</p>
      </section>

      {lab.status === 'NOT_STARTED' && (
        <form action={start}>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Iniciar laboratório
          </button>
        </form>
      )}

      {lab.status === 'IN_PROGRESS' && (
        <form action={complete}>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Marcar como concluído
          </button>
        </form>
      )}

      {lab.status === 'COMPLETED' && (
        <p className="text-sm font-medium text-green-600">Laboratório concluído.</p>
      )}
    </main>
  );
}

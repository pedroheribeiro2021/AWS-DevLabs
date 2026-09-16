import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppNav } from '@/components/app-nav';
import { getCurrentUser } from '@/lib/auth-server';
import { getLabs } from '@/lib/labs';

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Não iniciado',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluído',
};

export default async function LabsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const labs = await getLabs();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16">
      <AppNav title="Laboratórios" />

      <ul className="flex flex-col gap-3">
        {labs.map((lab) => (
          <li key={lab.id}>
            <Link
              href={`/labs/${lab.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
            >
              <div>
                <p className="font-medium text-slate-800">{lab.title}</p>
                <p className="text-sm text-slate-500">
                  Nível {lab.level} · {lab.topic.name} · {lab.estimatedMinutes} min
                </p>
              </div>
              <span
                className={
                  lab.status === 'COMPLETED'
                    ? 'text-xs font-medium text-green-600'
                    : lab.status === 'IN_PROGRESS'
                      ? 'text-xs font-medium text-orange-600'
                      : 'text-xs text-slate-400'
                }
              >
                {STATUS_LABEL[lab.status]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

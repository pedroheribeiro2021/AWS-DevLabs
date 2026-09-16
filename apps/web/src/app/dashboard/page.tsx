import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppNav } from '@/components/app-nav';
import { getCurrentUser } from '@/lib/auth-server';
import { getTrack } from '@/lib/learning';

const DEFAULT_CERTIFICATION_SLUG = 'aws-certified-developer-associate';

const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Não iniciada',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
};

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const track = await getTrack(DEFAULT_CERTIFICATION_SLUG);
  const lessons = track.examVersions.flatMap((ev) => ev.domains).flatMap((d) => d.topics).flatMap((t) => t.lessons);
  const completedCount = lessons.filter((lesson) => lesson.status === 'COMPLETED').length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16">
      <AppNav title={`Olá, ${user.name}`} />

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">{track.name}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {completedCount} / {lessons.length} lições concluídas
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-orange-500"
            style={{ width: `${lessons.length ? (completedCount / lessons.length) * 100 : 0}%` }}
          />
        </div>
      </section>

      {track.examVersions.map((examVersion) =>
        examVersion.domains.map((domain) => (
          <section key={domain.id} className="flex flex-col gap-3">
            <h3 className="text-base font-semibold text-slate-800">
              {domain.name} <span className="font-normal text-slate-500">({domain.weightPercent}%)</span>
            </h3>
            {domain.topics.map((topic) => (
              <div key={topic.id} className="rounded-lg border border-slate-200 bg-white p-4">
                <h4 className="mb-2 font-medium text-slate-700">{topic.name}</h4>
                <ul className="flex flex-col gap-1">
                  {topic.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <Link
                        href={`/learn/${lesson.id}`}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
                      >
                        <span>{lesson.title}</span>
                        <span
                          className={
                            lesson.status === 'COMPLETED'
                              ? 'text-xs font-medium text-green-600'
                              : 'text-xs text-slate-400'
                          }
                        >
                          {STATUS_LABEL[lesson.status]}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )),
      )}
    </main>
  );
}

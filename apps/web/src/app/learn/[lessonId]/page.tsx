import Link from 'next/link';
import { redirect } from 'next/navigation';
import { XpBanner } from '@/components/xp-banner';
import { getCurrentUser } from '@/lib/auth-server';
import { getLesson } from '@/lib/learning';
import { markLessonComplete } from './actions';

interface LessonPageProps {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{ xp?: string; level?: string; streak?: string }>;
}

export default async function LessonPage({ params, searchParams }: LessonPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const { lessonId } = await params;
  const { xp, level, streak } = await searchParams;
  const lesson = await getLesson(lessonId);
  const completeAction = markLessonComplete.bind(null, lessonId);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:underline">
        ← Voltar ao painel
      </Link>

      <XpBanner xp={xp} level={level} streak={streak} />

      <div>
        <p className="text-sm text-slate-500">
          {lesson.certification.name} · {lesson.topic.name}
        </p>
        <h1 className="text-2xl font-bold">{lesson.title}</h1>
        <p className="mt-1 text-sm text-slate-500">{lesson.estimatedMinutes} min de leitura</p>
      </div>

      <article className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-800">
        {lesson.content}
      </article>

      {lesson.resources.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Recursos</h2>
          <ul className="flex flex-col gap-1">
            {lesson.resources.map((resource) => (
              <li key={resource.id}>
                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-orange-600 hover:underline"
                >
                  {resource.title}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form action={completeAction}>
        <button
          type="submit"
          disabled={lesson.status === 'COMPLETED'}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {lesson.status === 'COMPLETED' ? 'Concluída' : 'Marcar como concluída'}
        </button>
      </form>
    </main>
  );
}

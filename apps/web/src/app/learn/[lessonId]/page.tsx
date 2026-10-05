import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LessonCheckpoint } from '@/components/lesson-checkpoint';
import { LessonStepsView } from '@/components/lesson-steps-view';
import { MarkdownContent } from '@/components/markdown-content';
import { XpBanner } from '@/components/xp-banner';
import { getCurrentUser } from '@/lib/auth-server';
import { getLesson } from '@/lib/learning';
import { markLessonComplete } from './actions';

interface LessonPageProps {
  params: Promise<{ lessonId: string }>;
  searchParams: Promise<{
    xp?: string;
    level?: string;
    streak?: string;
    badges?: string;
    checkpoint?: string;
    step?: string;
  }>;
}

export default async function LessonPage({ params, searchParams }: LessonPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const { lessonId } = await params;
  const { xp, level, streak, badges, checkpoint, step } = await searchParams;
  const lesson = await getLesson(lessonId);
  const completeAction = markLessonComplete.bind(null, lessonId);
  // Step-by-step mode is opt-in; without ?step the lesson reads as one page, as before.
  const stepIndex = step !== undefined ? Number.parseInt(step, 10) : NaN;
  const stepMode = Number.isInteger(stepIndex);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
      <Link href="/dashboard" className="text-sm text-slate-500 hover:underline">
        ← Voltar ao painel
      </Link>

      <XpBanner xp={xp} level={level} streak={streak} badges={badges} />

      <div>
        <p className="text-sm text-slate-500">
          {lesson.certification.name} · {lesson.topic.name}
        </p>
        <h1 className="text-2xl font-bold">{lesson.title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {lesson.estimatedMinutes} min de leitura
          {' · '}
          <Link
            href={`/learn/${lessonId}/practice`}
            className="font-semibold text-orange-600 hover:underline"
          >
            Praticar com exercícios
          </Link>
          {!stepMode && (
            <>
              {' · '}
              <Link href={`/learn/${lessonId}?step=0`} className="text-orange-600 hover:underline">
                Estudar em etapas
              </Link>
            </>
          )}
        </p>
      </div>

      {stepMode ? (
        <LessonStepsView lessonId={lessonId} lesson={lesson} stepIndex={stepIndex} />
      ) : (
        <>
          <article className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-800">
            <MarkdownContent content={lesson.content} />
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

          <LessonCheckpoint
            lessonId={lessonId}
            topicId={lesson.topic.id}
            pinnedQuestionIds={checkpoint?.split(',').filter(Boolean)}
          />

          <form action={completeAction}>
            <button
              type="submit"
              disabled={lesson.status === 'COMPLETED'}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {lesson.status === 'COMPLETED' ? 'Concluída' : 'Marcar como concluída'}
            </button>
          </form>
        </>
      )}
    </main>
  );
}

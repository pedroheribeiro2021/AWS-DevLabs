import Link from 'next/link';
import { InlineQuestion } from '@/components/inline-question';
import { MarkdownContent } from '@/components/markdown-content';
import { markLessonComplete, submitStepAnswer } from '@/app/learn/[lessonId]/actions';
import type { LessonDetail } from '@/lib/learning';
import { splitLessonIntoSteps } from '@/lib/lesson-steps';
import { getPractice } from '@/lib/practice';
import { getQuestion } from '@/lib/questions';

interface LessonStepsViewProps {
  lessonId: string;
  lesson: LessonDetail;
  stepIndex: number;
}

export async function LessonStepsView({ lessonId, lesson, stepIndex }: LessonStepsViewProps) {
  const steps = splitLessonIntoSteps(lesson.content);
  const index = Math.min(Math.max(stepIndex, 0), steps.length - 1);
  const isLast = index === steps.length - 1;

  // One of this lesson's questions between steps, picked by step position so it
  // stays the same across the answer round trip.
  let question = null;
  if (!isLast) {
    const { questions: lessonQuestions } = await getPractice(lessonId);
    if (lessonQuestions.length > 0) {
      question = await getQuestion(lessonQuestions[index % lessonQuestions.length].id);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Etapa {index + 1} de {steps.length}
          </span>
          <Link href={`/learn/${lessonId}`} className="hover:underline">
            Ver lição inteira
          </Link>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-orange-500 transition-all"
            style={{ width: `${((index + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <article className="rounded-lg border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-800">
        <MarkdownContent content={steps[index]} />
      </article>

      {question && (
        <section id="question" className="flex flex-col gap-2 scroll-mt-6">
          <h2 className="text-sm font-semibold text-slate-700">Pratique antes de seguir</h2>
          <InlineQuestion
            question={question}
            action={submitStepAnswer.bind(null, lessonId, question.id, index)}
          />
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {index > 0 && (
          <Link
            href={`/learn/${lessonId}?step=${index - 1}`}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
          >
            ← Anterior
          </Link>
        )}

        {!isLast ? (
          <Link
            href={`/learn/${lessonId}?step=${index + 1}`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Próxima etapa →
          </Link>
        ) : (
          <>
            <form action={markLessonComplete.bind(null, lessonId)}>
              <button
                type="submit"
                disabled={lesson.status === 'COMPLETED'}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {lesson.status === 'COMPLETED' ? 'Concluída' : 'Marcar como concluída'}
              </button>
            </form>
            <Link
              href={`/learn/${lessonId}#checkpoint`}
              className="text-sm font-medium text-orange-600 hover:underline"
            >
              Fazer o teste rápido
            </Link>
          </>
        )}
      </div>
    </>
  );
}

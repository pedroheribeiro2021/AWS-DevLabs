import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppNav } from '@/components/app-nav';
import { getCurrentUser } from '@/lib/auth-server';
import { getQuestions } from '@/lib/questions';

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: 'Fácil',
  MEDIUM: 'Médio',
  HARD: 'Difícil',
};

const TYPE_LABEL: Record<string, string> = {
  KNOWLEDGE: 'Conhecimento',
  APPLICATION: 'Aplicação',
  SCENARIO: 'Cenário',
  EXAM_LEVEL: 'Nível de prova',
};

export default async function QuestionsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const questions = await getQuestions();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16">
      <AppNav title="Questões" />

      <ul className="flex flex-col gap-3">
        {questions.map((question) => (
          <li key={question.id}>
            <Link
              href={`/questions/${question.id}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
            >
              <div>
                <p className="font-medium text-slate-800">{question.prompt}</p>
                <p className="text-sm text-slate-500">
                  {DIFFICULTY_LABEL[question.difficulty]} · {TYPE_LABEL[question.type]} ·{' '}
                  {question.topic.name}
                </p>
              </div>
              {question.answered && (
                <span
                  className={
                    question.isCorrect
                      ? 'shrink-0 text-xs font-medium text-green-600'
                      : 'shrink-0 text-xs font-medium text-red-600'
                  }
                >
                  {question.isCorrect ? 'Acertou' : 'Errou'}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

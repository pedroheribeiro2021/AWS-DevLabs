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

interface QuestionsPageProps {
  searchParams: Promise<{ topicId?: string; mistakes?: string }>;
}

export default async function QuestionsPage({ searchParams }: QuestionsPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const { topicId, mistakes } = await searchParams;
  const allQuestions = await getQuestions(topicId);
  const topicName = topicId ? allQuestions[0]?.topic.name : undefined;
  // "Wrong" means the latest answer was wrong — the same rule analytics uses (ADR 0007).
  const mistakeQuestions = allQuestions.filter(
    (question) => question.answered && question.isCorrect === false,
  );
  const mistakesMode = mistakes === '1';
  const questions = mistakesMode ? mistakeQuestions : allQuestions;
  const topicQuery = topicId ? `topicId=${encodeURIComponent(topicId)}` : '';

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:py-16">
      <AppNav title="Questões" />

      {mistakesMode ? (
        <p className="-mt-4 text-sm text-slate-600">
          Refazendo seus erros ({mistakeQuestions.length}) ·{' '}
          <Link
            href={`/questions${topicQuery ? `?${topicQuery}` : ''}`}
            className="text-orange-700 hover:underline"
          >
            ver todas
          </Link>
        </p>
      ) : (
        mistakeQuestions.length > 0 && (
          <Link
            href={`/questions?mistakes=1${topicQuery ? `&${topicQuery}` : ''}`}
            className="-mt-4 self-start rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:border-red-300"
          >
            Refazer meus erros ({mistakeQuestions.length})
          </Link>
        )
      )}

      {mistakesMode && mistakeQuestions.length === 0 && (
        <p className="text-sm text-slate-600">Nenhum erro pendente. Bom trabalho!</p>
      )}

      {topicId && (
        <p className="-mt-4 text-sm text-slate-600">
          Filtrando por <span className="font-medium text-slate-800">{topicName ?? 'tópico'}</span> ·{' '}
          <Link href="/questions" className="text-orange-700 hover:underline">
            ver todas
          </Link>
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {questions.map((question) => (
          <li key={question.id}>
            <Link
              href={`/questions/${question.id}${mistakesMode ? '?retry=1' : ''}`}
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

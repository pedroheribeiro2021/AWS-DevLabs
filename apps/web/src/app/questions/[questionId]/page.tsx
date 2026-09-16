import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-server';
import { getQuestion } from '@/lib/questions';
import { submitQuestionAnswer } from './actions';

interface QuestionPageProps {
  params: Promise<{ questionId: string }>;
}

const DIFFICULTY_LABEL: Record<string, string> = {
  EASY: 'Fácil',
  MEDIUM: 'Médio',
  HARD: 'Difícil',
};

export default async function QuestionPage({ params }: QuestionPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const { questionId } = await params;
  const question = await getQuestion(questionId);
  const action = submitQuestionAnswer.bind(null, questionId);
  const inputType = question.multipleCorrect ? 'checkbox' : 'radio';

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-16">
      <Link href="/questions" className="text-sm text-slate-500 hover:underline">
        ← Voltar às questões
      </Link>

      <div>
        <p className="text-sm text-slate-500">
          {DIFFICULTY_LABEL[question.difficulty]} · {question.topic.name}
        </p>
        <h1 className="text-xl font-bold">{question.prompt}</h1>
      </div>

      {!question.answered ? (
        <form action={action} className="flex flex-col gap-3">
          {question.options.map((option) => (
            <label
              key={option.id}
              className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-800 hover:border-slate-300"
            >
              <input
                type={inputType}
                name="selectedOptionIds"
                value={option.id}
                required={!question.multipleCorrect}
                className="mt-0.5"
              />
              {option.text}
            </label>
          ))}
          <button
            type="submit"
            className="self-start rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Responder
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <p
            className={
              question.isCorrect
                ? 'text-sm font-semibold text-green-600'
                : 'text-sm font-semibold text-red-600'
            }
          >
            {question.isCorrect ? 'Você acertou.' : 'Você errou.'}
          </p>

          {question.options.map((option) => {
            const wasSelected = question.selectedOptionIds?.includes(option.id);
            return (
              <div
                key={option.id}
                className={
                  option.isCorrect
                    ? 'rounded-lg border border-green-300 bg-green-50 p-4 text-sm'
                    : wasSelected
                      ? 'rounded-lg border border-red-300 bg-red-50 p-4 text-sm'
                      : 'rounded-lg border border-slate-200 bg-white p-4 text-sm'
                }
              >
                <p className="font-medium text-slate-800">
                  {option.text}
                  {option.isCorrect && ' ✓'}
                  {wasSelected && !option.isCorrect && ' (sua resposta)'}
                </p>
                <p className="mt-1 text-slate-600">{option.explanation}</p>
              </div>
            );
          })}

          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p className="mb-1 font-semibold">Explicação</p>
            <p>{question.explanation}</p>
            {question.officialReferences && (
              <a
                href={question.officialReferences}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-orange-600 hover:underline"
              >
                Referência oficial
              </a>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

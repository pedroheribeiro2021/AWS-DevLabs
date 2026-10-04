import type { QuestionDetail } from '@/lib/questions';

interface InlineQuestionProps {
  question: QuestionDetail;
  // Server action bound to this question; receives the form's selectedOptionIds.
  action: (formData: FormData) => Promise<void>;
  label?: string;
}

// Answer form before the question is answered, feedback with explanations after —
// the same flow as the question page, embedded in a lesson.
export function InlineQuestion({ question, action, label }: InlineQuestionProps) {
  const inputType = question.multipleCorrect ? 'checkbox' : 'radio';

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5">
      <p className="text-sm font-medium text-slate-800">
        {label}
        {question.prompt}
      </p>

      {!question.answered ? (
        <form action={action} className="flex flex-col gap-2">
          {question.options.map((option) => (
            <label
              key={option.id}
              className="flex items-start gap-3 rounded-md border border-slate-200 p-3 text-sm text-slate-800 hover:border-slate-300"
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
        <div className="flex flex-col gap-2">
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
                    ? 'rounded-md border border-green-300 bg-green-50 p-3 text-sm'
                    : wasSelected
                      ? 'rounded-md border border-red-300 bg-red-50 p-3 text-sm'
                      : 'rounded-md border border-slate-200 p-3 text-sm'
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
          <p className="text-sm text-slate-700">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}

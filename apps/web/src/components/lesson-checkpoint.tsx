import { getQuestion, getQuestions, type QuestionSummary } from '@/lib/questions';
import { submitCheckpointAnswer } from '@/app/learn/[lessonId]/actions';

const CHECKPOINT_SIZE = 3;

// Unanswered questions first, then the ones whose latest answer was wrong, then
// the ones already right — so each visit practices something new when it can.
function pickCheckpointQuestions(questions: QuestionSummary[]): string[] {
  const rank = (question: QuestionSummary) =>
    !question.answered ? 0 : question.isCorrect ? 2 : 1;
  return [...questions]
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, CHECKPOINT_SIZE)
    .map((question) => question.id);
}

interface LessonCheckpointProps {
  lessonId: string;
  topicId: string;
  // Ids carried over from the previous answer, so the set doesn't reshuffle
  // as each question moves from "unanswered" to "answered".
  pinnedQuestionIds?: string[];
}

export async function LessonCheckpoint({
  lessonId,
  topicId,
  pinnedQuestionIds,
}: LessonCheckpointProps) {
  const questionIds = pinnedQuestionIds?.length
    ? pinnedQuestionIds.slice(0, CHECKPOINT_SIZE)
    : pickCheckpointQuestions(await getQuestions(topicId));

  if (questionIds.length === 0) {
    return null;
  }

  const questions = await Promise.all(questionIds.map((id) => getQuestion(id)));
  const correctCount = questions.filter((question) => question.isCorrect).length;
  const allAnswered = questions.every((question) => question.answered);

  return (
    <section id="checkpoint" className="flex flex-col gap-4 scroll-mt-6">
      <div>
        <h2 className="text-lg font-semibold">Teste rápido</h2>
        <p className="text-sm text-slate-500">
          {allAnswered
            ? `Você acertou ${correctCount} de ${questions.length}.`
            : `${questions.length} questões do tópico para fixar o que você leu.`}
        </p>
      </div>

      {questions.map((question, index) => {
        const action = submitCheckpointAnswer.bind(null, lessonId, question.id, questionIds);
        const inputType = question.multipleCorrect ? 'checkbox' : 'radio';

        return (
          <div
            key={question.id}
            className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-5"
          >
            <p className="text-sm font-medium text-slate-800">
              {index + 1}. {question.prompt}
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
      })}
    </section>
  );
}

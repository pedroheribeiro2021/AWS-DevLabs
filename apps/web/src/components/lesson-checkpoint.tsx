import { InlineQuestion } from '@/components/inline-question';
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

      {questions.map((question, index) => (
        <InlineQuestion
          key={question.id}
          question={question}
          action={submitCheckpointAnswer.bind(null, lessonId, question.id, questionIds)}
          label={`${index + 1}. `}
        />
      ))}
    </section>
  );
}

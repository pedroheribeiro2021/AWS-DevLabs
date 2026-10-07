'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  checkPracticeAnswer,
  finishPractice,
  recordFlashcardPractice,
} from '@/app/learn/[lessonId]/practice/actions';
import type { GamificationResult } from '@/lib/gamification';
import { JUDGE_WRONG, shuffle, type Exercise } from '@/lib/practice-exercises';

interface PracticeSessionProps {
  lessonId: string;
  lessonTitle: string;
  topicName: string;
  alreadyCompleted: boolean;
  exercises: Exercise[];
}

interface Feedback {
  correct: boolean;
  correctText: string | null;
  explanation: string | null;
  // Option values to paint green (and the selected ones red when wrong).
  correctValues: string[];
  // Solved, but with slips along the way (match pairs): not repeated, no accuracy credit.
  slipped: boolean;
}

type Phase = 'intro' | 'exercise' | 'done';

const KIND_LABEL: Record<Exercise['kind'], string> = {
  definition: 'O que significa?',
  judge: 'Certo ou errado?',
  match: 'Combine os pares',
  question: 'Responda',
};

export function PracticeSession({
  lessonId,
  lessonTitle,
  topicName,
  alreadyCompleted,
  exercises,
}: PracticeSessionProps) {
  // Kept in state (not derived from props) so a server refresh never reshuffles a running session.
  const [queue, setQueue] = useState(exercises);
  const [initialCount] = useState(exercises.length);
  const [phase, setPhase] = useState<Phase>('intro');
  const [position, setPosition] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [solvedKeys, setSolvedKeys] = useState<Set<string>>(new Set());
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [combo, setCombo] = useState(0);
  const [xp, setXp] = useState(0);
  const [finish, setFinish] = useState<GamificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPending, startTransition] = useTransition();
  const reviewedFlashcards = useRef(new Set<string>());

  const exercise = queue[position];
  const isRetry = exercise ? exercise.key.endsWith(':retry') : false;
  const progress = initialCount === 0 ? 0 : solvedKeys.size / initialCount;

  function originalKey(key: string) {
    return key.replace(/(:retry)+$/, '');
  }

  function settle(
    correct: boolean,
    correctText: string | null,
    explanation: string | null,
    correctValues: string[] = [],
    slipped = false,
  ) {
    const key = originalKey(exercise.key);
    if (correct) {
      setSolvedKeys((keys) => new Set(keys).add(key));
      if (!isRetry && !slipped) setFirstTryCorrect((count) => count + 1);
      setCombo((count) => (slipped ? 0 : count + 1));
    } else {
      setCombo(0);
      // Duolingo-style: a missed exercise comes back at the end of the session.
      // Options are reshuffled so the retry can't be answered by position.
      const retry = { ...exercise, key: `${exercise.key}:retry` } as Exercise;
      if (retry.kind === 'definition') {
        retry.options = shuffle(retry.options);
      } else if (retry.kind === 'question') {
        retry.options = shuffle(retry.options);
      }
      setQueue((items) => [...items, retry]);
    }
    setFeedback({ correct, correctText, explanation, correctValues, slipped });
  }

  function check() {
    if (!exercise || feedback || selected.length === 0 || isPending) return;
    setError(null);

    if (exercise.kind === 'definition' || exercise.kind === 'judge') {
      const correct = selected[0] === exercise.answer;
      if (!reviewedFlashcards.current.has(exercise.flashcardId)) {
        reviewedFlashcards.current.add(exercise.flashcardId);
        // Fire-and-forget: the schedule update must not hold up "Continuar".
        recordFlashcardPractice(exercise.flashcardId, correct).catch(() => {});
      }
      if (exercise.kind === 'judge') {
        // After a near miss, always show the real answer — that's the point of the exercise.
        const realAnswer =
          exercise.answer === JUDGE_WRONG ? `Resposta certa: ${exercise.correctText}` : null;
        settle(correct, correct ? null : exercise.answer, realAnswer, [exercise.answer]);
      } else {
        settle(correct, correct ? null : exercise.answer, null, [exercise.answer]);
      }
      return;
    }

    if (exercise.kind === 'question') {
      startTransition(async () => {
        try {
          const result = await checkPracticeAnswer(exercise.questionId, selected);
          setXp((total) => total + result.xpAwarded);
          settle(
            result.isCorrect,
            result.correctOptionTexts.join(' · '),
            result.explanation,
            result.correctOptionIds,
          );
        } catch {
          setError('Não foi possível verificar a resposta. Tente de novo.');
        }
      });
    }
  }

  function next() {
    setFeedback(null);
    setSelected([]);
    if (position + 1 < queue.length) {
      setPosition(position + 1);
      return;
    }
    setElapsedSeconds(Math.round((Date.now() - startedAt) / 1000));
    setPhase('done');
    complete();
  }

  // Separate from next() so a failed save can be retried without redoing the session.
  function complete() {
    setError(null);
    startTransition(async () => {
      try {
        const { gamification } = await finishPractice(lessonId);
        setFinish(gamification);
        setXp((total) => total + (gamification?.xpAwarded ?? 0));
      } catch {
        setError('Não foi possível salvar a conclusão da lição.');
      }
    });
  }

  function start() {
    setStartedAt(Date.now());
    setPhase('exercise');
  }

  // Keyboard: 1-4 pick an option, Enter checks / continues.
  // Re-subscribed after every render so the listener always sees the current state.
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (phase !== 'exercise' || !exercise) return;
      if (exercise.kind === 'match') {
        if (event.key === 'Enter' && feedback) next();
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        if (feedback) next();
        else check();
        return;
      }
      const index = Number(event.key) - 1;
      if (!feedback && Number.isInteger(index) && index >= 0) {
        const values = optionValues(exercise);
        if (index < values.length) toggle(values[index]);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  });

  function toggle(value: string) {
    if (feedback || !exercise) return;
    if (exercise.kind === 'question' && exercise.multipleCorrect) {
      setSelected((current) =>
        current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
      );
    } else {
      setSelected([value]);
    }
  }

  if (phase === 'intro') {
    return (
      <div className="flex flex-col items-center gap-6 rounded-2xl border-2 border-slate-200 bg-white px-6 py-10 text-center">
        <span className="text-5xl text-orange-500">{alreadyCompleted ? '✓' : '★'}</span>
        <div>
          <p className="text-sm text-slate-500">{topicName}</p>
          <h1 className="text-2xl font-bold">{lessonTitle}</h1>
        </div>
        {initialCount > 0 ? (
          <>
            <p className="max-w-md text-sm text-slate-600">
              {initialCount} exercícios curtos: conceitos novos, questões, combinação de pares e
              &quot;certo ou errado&quot;. O que você errar volta no fim, até acertar tudo.
            </p>
            <button
              type="button"
              onClick={start}
              className="w-full max-w-xs rounded-2xl border-b-4 border-orange-700 bg-orange-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-orange-400 active:translate-y-0.5 active:border-b-2"
            >
              {alreadyCompleted ? 'Praticar de novo' : 'Começar'}
            </button>
          </>
        ) : (
          <p className="text-sm text-slate-600">Esta lição ainda não tem exercícios.</p>
        )}
        <Link
          href={`/learn/${lessonId}`}
          className="text-sm font-semibold text-orange-600 hover:underline"
        >
          Ler a lição primeiro
        </Link>
      </div>
    );
  }

  if (phase === 'done') {
    const accuracy = initialCount === 0 ? 0 : Math.round((firstTryCorrect / initialCount) * 100);
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return (
      <div className="flex flex-col items-center gap-6 rounded-2xl border-2 border-slate-200 bg-white px-6 py-10 text-center">
        <span className="text-6xl">🎉</span>
        <h1 className="text-2xl font-bold text-orange-600">Lição concluída!</h1>
        <div className="grid w-full max-w-md grid-cols-3 gap-3">
          <StatTile
            label="XP ganho"
            value={isPending ? '…' : `+${xp}`}
            color="border-amber-400 text-amber-600"
          />
          <StatTile
            label="Precisão"
            value={`${accuracy}%`}
            color="border-emerald-400 text-emerald-600"
          />
          <StatTile
            label="Tempo"
            value={`${minutes}:${String(seconds).padStart(2, '0')}`}
            color="border-sky-400 text-sky-600"
          />
        </div>
        {finish?.leveledUp && (
          <p className="text-sm font-semibold text-orange-700">
            Subiu para o nível {finish.level}! 🎉
          </p>
        )}
        {finish?.streakExtended && (
          <p className="text-sm font-semibold text-orange-700">
            🔥 {finish.currentStreak} dia{finish.currentStreak === 1 ? '' : 's'} seguido
            {finish.currentStreak === 1 ? '' : 's'}
          </p>
        )}
        {finish?.newBadges.map((badge) => (
          <p
            key={badge.id}
            className="rounded-full bg-orange-600 px-3 py-1 text-xs font-semibold text-white"
          >
            Nova conquista: {badge.icon} {badge.name}
          </p>
        ))}
        {error && (
          <p className="text-sm text-red-600">
            {error}{' '}
            <button type="button" onClick={complete} className="font-semibold underline">
              Tentar de novo
            </button>
          </p>
        )}
        <Link
          href="/dashboard"
          className="w-full max-w-xs rounded-2xl border-b-4 border-orange-700 bg-orange-500 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-orange-400"
        >
          Continuar
        </Link>
        <Link
          href={`/learn/${lessonId}`}
          className="text-sm font-semibold text-orange-600 hover:underline"
        >
          Ler a lição
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-48">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          aria-label="Sair da prática"
          className="text-2xl leading-none text-slate-400 hover:text-slate-600"
        >
          ×
        </Link>
        <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-orange-500 transition-all duration-500"
            style={{ width: `${Math.max(progress * 100, 2)}%` }}
          />
        </div>
        {combo >= 2 && (
          <span className="whitespace-nowrap text-sm font-bold text-orange-600">🔥 {combo}</span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {exercise.kind === 'definition' && exercise.isNew && !isRetry && (
          <span className="w-fit rounded-md bg-violet-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-violet-700">
            Conceito novo
          </span>
        )}
        {isRetry && (
          <span className="w-fit rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-red-700">
            Erro anterior
          </span>
        )}
        <h2 className="text-xl font-bold text-slate-800">{KIND_LABEL[exercise.kind]}</h2>
      </div>

      {exercise.kind === 'match' ? (
        <MatchPairs
          key={exercise.key}
          pairs={exercise.pairs}
          onDone={(mistakes) =>
            settle(
              true,
              null,
              mistakes > 0
                ? `${mistakes} combinação(ões) errada(s) no caminho — esses conceitos valem revisão.`
                : null,
              [],
              mistakes > 0,
            )
          }
          disabled={feedback !== null}
        />
      ) : (
        <>
          <p className="rounded-2xl border-2 border-slate-200 bg-white p-4 text-base text-slate-800">
            {exercise.prompt}
          </p>
          {exercise.kind === 'judge' && (
            <blockquote className="rounded-2xl border-2 border-dashed border-sky-300 bg-sky-50 p-4 text-sm text-slate-800">
              {exercise.statement}
            </blockquote>
          )}
          <div className="flex flex-col gap-2">
            {optionValues(exercise).map((value, index) => {
              const label = exercise.kind === 'question' ? exercise.options[index].text : value;
              const isSelected = selected.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  disabled={feedback !== null}
                  onClick={() => toggle(value)}
                  className={`flex items-start gap-3 rounded-2xl border-2 border-b-4 p-3 text-left text-sm transition ${
                    feedback?.correctValues.includes(value)
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-900'
                      : feedback && isSelected
                        ? 'border-red-400 bg-red-50 text-red-900'
                        : isSelected
                          ? 'border-sky-400 bg-sky-50 text-sky-900'
                          : feedback
                            ? 'border-slate-200 bg-white text-slate-400'
                            : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 border-slate-200 text-xs font-bold text-slate-400">
                    {index + 1}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div
        className={`fixed inset-x-0 bottom-0 border-t-2 px-4 py-5 ${
          feedback === null
            ? 'border-slate-200 bg-white'
            : feedback.correct
              ? 'border-emerald-200 bg-emerald-50'
              : 'border-red-200 bg-red-50'
        }`}
      >
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {feedback ? (
            <div className={feedback.correct ? 'text-emerald-700' : 'text-red-700'}>
              <p className="text-lg font-bold">
                {!feedback.correct
                  ? 'Resposta correta:'
                  : feedback.slipped
                    ? 'Pares completos!'
                    : 'Muito bem!'}
              </p>
              {!feedback.correct && feedback.correctText && (
                <p className="text-sm font-medium">{feedback.correctText}</p>
              )}
              {feedback.explanation && (
                <p className="mt-1 max-h-32 overflow-y-auto text-sm text-slate-700">
                  {feedback.explanation}
                </p>
              )}
            </div>
          ) : (
            <span />
          )}
          {exercise.kind !== 'match' || feedback ? (
            <button
              type="button"
              onClick={feedback ? next : check}
              disabled={(!feedback && selected.length === 0) || isPending}
              className={`shrink-0 rounded-2xl border-b-4 px-8 py-3 text-sm font-bold uppercase tracking-wide text-white transition active:translate-y-0.5 active:border-b-2 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-400 ${
                feedback && !feedback.correct
                  ? 'border-red-700 bg-red-500 hover:bg-red-400'
                  : 'border-emerald-700 bg-emerald-500 hover:bg-emerald-400'
              }`}
            >
              {feedback ? 'Continuar' : isPending ? 'Verificando…' : 'Verificar'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// For choice exercises: definition/term options are their own text; questions use option ids.
function optionValues(exercise: Exercise): string[] {
  if (exercise.kind === 'question') return exercise.options.map((option) => option.id);
  if (exercise.kind === 'match') return [];
  return exercise.options;
}

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={`flex flex-col rounded-2xl border-2 ${color}`}>
      <span className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide">{label}</span>
      <span className="rounded-b-xl bg-white px-2 py-2 text-lg font-bold">{value}</span>
    </div>
  );
}

interface MatchPairsProps {
  pairs: { id: string; left: string; right: string }[];
  onDone: (mistakes: number) => void;
  disabled: boolean;
}

function MatchPairs({ pairs, onDone, disabled }: MatchPairsProps) {
  const [lefts] = useState(() => shuffle(pairs));
  const [rights] = useState(() => shuffle(pairs));
  const [pickedLeft, setPickedLeft] = useState<string | null>(null);
  const [pickedRight, setPickedRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<{ left: string; right: string } | null>(null);
  const [mistakes, setMistakes] = useState(0);

  function attempt(left: string | null, right: string | null) {
    if (!left || !right) return;
    if (left === right) {
      const nextMatched = new Set(matched).add(left);
      setMatched(nextMatched);
      if (nextMatched.size === pairs.length) onDone(mistakes);
    } else {
      setMistakes((count) => count + 1);
      setWrong({ left, right });
      setTimeout(() => setWrong(null), 600);
    }
    setPickedLeft(null);
    setPickedRight(null);
  }

  function tileClass(id: string, side: 'left' | 'right', picked: string | null) {
    if (matched.has(id)) return 'border-emerald-200 bg-emerald-50 text-emerald-300';
    if (wrong && wrong[side] === id) return 'border-red-400 bg-red-50 text-red-700';
    if (picked === id) return 'border-sky-400 bg-sky-50 text-sky-900';
    return 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50';
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-2">
        {lefts.map((pair) => (
          <button
            key={pair.id}
            type="button"
            disabled={disabled || matched.has(pair.id)}
            onClick={() => {
              setPickedLeft(pair.id);
              attempt(pair.id, pickedRight);
            }}
            className={`min-h-24 rounded-2xl border-2 border-b-4 p-3 text-left text-xs font-semibold transition sm:text-sm ${tileClass(pair.id, 'left', pickedLeft)}`}
          >
            {pair.left}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {rights.map((pair) => (
          <button
            key={pair.id}
            type="button"
            disabled={disabled || matched.has(pair.id)}
            onClick={() => {
              setPickedRight(pair.id);
              attempt(pickedLeft, pair.id);
            }}
            className={`min-h-24 rounded-2xl border-2 border-b-4 p-3 text-left text-xs transition sm:text-sm ${tileClass(pair.id, 'right', pickedRight)}`}
          >
            {pair.right}
          </button>
        ))}
      </div>
    </div>
  );
}

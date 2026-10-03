import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppNav } from '@/components/app-nav';
import { getCurrentUser } from '@/lib/auth-server';
import { getFlashcards } from '@/lib/flashcards';

const STATE_LABEL: Record<string, string> = {
  NEW: 'Novo',
  LEARNING: 'Aprendendo',
  REVIEW: 'Revisão',
  MASTERED: 'Dominado',
};

const STATE_COLOR: Record<string, string> = {
  NEW: 'text-slate-400',
  LEARNING: 'text-orange-600',
  REVIEW: 'text-blue-600',
  MASTERED: 'text-green-600',
};

const reviewDateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

interface FlashcardsPageProps {
  searchParams: Promise<{ review?: string }>;
}

export default async function FlashcardsPage({ searchParams }: FlashcardsPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const allFlashcards = await getFlashcards();
  const dueFlashcards = allFlashcards.filter((card) => card.due);
  const reviewMode = (await searchParams).review === '1';
  const flashcards = reviewMode ? dueFlashcards : allFlashcards;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:py-16">
      <AppNav title="Flashcards" />

      {reviewMode ? (
        <p className="-mt-4 text-sm text-slate-600">
          Revisão do dia ({dueFlashcards.length}) ·{' '}
          <Link href="/flashcards" className="text-orange-700 hover:underline">
            ver todos
          </Link>
        </p>
      ) : (
        dueFlashcards.length > 0 && (
          <Link
            href={`/flashcards/${dueFlashcards[0].id}?review=1`}
            className="-mt-4 self-start rounded-md border border-orange-200 bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 hover:border-orange-300"
          >
            Começar revisão do dia ({dueFlashcards.length})
          </Link>
        )
      )}

      {reviewMode && dueFlashcards.length === 0 && (
        <p className="text-sm text-slate-600">Revisão do dia concluída. Volte amanhã!</p>
      )}

      <ul className="flex flex-col gap-3">
        {flashcards.map((card) => (
          <li key={card.id}>
            <Link
              href={`/flashcards/${card.id}${reviewMode ? '?review=1' : ''}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
            >
              <div>
                <p className="font-medium text-slate-800">{card.front}</p>
                <p className="text-sm text-slate-500">
                  {card.topic.name}
                  {card.due
                    ? ' · revisar hoje'
                    : card.nextReviewAt &&
                      ` · próxima revisão ${reviewDateFormat.format(new Date(card.nextReviewAt))}`}
                </p>
              </div>
              <span className={`shrink-0 text-xs font-medium ${STATE_COLOR[card.state]}`}>
                {STATE_LABEL[card.state]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

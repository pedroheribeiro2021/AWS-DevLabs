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

export default async function FlashcardsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const flashcards = await getFlashcards();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-16">
      <AppNav title="Flashcards" />

      <ul className="flex flex-col gap-3">
        {flashcards.map((card) => (
          <li key={card.id}>
            <Link
              href={`/flashcards/${card.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
            >
              <div>
                <p className="font-medium text-slate-800">{card.front}</p>
                <p className="text-sm text-slate-500">{card.topic.name}</p>
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

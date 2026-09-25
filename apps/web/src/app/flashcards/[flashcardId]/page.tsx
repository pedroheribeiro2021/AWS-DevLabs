import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth-server';
import { getFlashcard } from '@/lib/flashcards';
import { reviewFlashcardAction } from './actions';

interface FlashcardPageProps {
  params: Promise<{ flashcardId: string }>;
}

export default async function FlashcardPage({ params }: FlashcardPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const { flashcardId } = await params;
  const card = await getFlashcard(flashcardId);
  const markWrong = reviewFlashcardAction.bind(null, flashcardId, false);
  const markRight = reviewFlashcardAction.bind(null, flashcardId, true);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10 sm:py-16">
      <Link href="/flashcards" className="text-sm text-slate-500 hover:underline">
        ← Voltar aos flashcards
      </Link>

      <p className="text-sm text-slate-500">{card.topic.name}</p>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <p className="text-lg font-medium text-slate-800">{card.front}</p>

        <details className="mt-4 group">
          <summary className="cursor-pointer text-sm font-medium text-orange-600">
            Mostrar resposta
          </summary>
          <p className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-700">{card.back}</p>
        </details>
      </div>

      <div className="flex gap-3">
        <form action={markWrong}>
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Não lembrei
          </button>
        </form>
        <form action={markRight}>
          <button
            type="submit"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Lembrei
          </button>
        </form>
      </div>
    </main>
  );
}

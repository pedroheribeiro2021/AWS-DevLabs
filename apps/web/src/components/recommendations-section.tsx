import Link from 'next/link';
import type { Recommendation } from '@/lib/analytics';

const KIND_ICON: Record<Recommendation['kind'], string> = {
  REVIEW_WEAK_TOPIC: '🎯',
  FINISH_LAB: '🛠️',
  CONTINUE_LESSONS: '📖',
  PRACTICE_TOPIC: '✍️',
  TAKE_SIMULATION: '⏱️',
};

interface RecommendationsSectionProps {
  recommendations: Recommendation[];
  limit?: number;
}

export function RecommendationsSection({ recommendations, limit }: RecommendationsSectionProps) {
  const shown = limit ? recommendations.slice(0, limit) : recommendations;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">O que estudar agora</h2>
      {shown.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          Nada pendente por aqui. Continue praticando questões e flashcards para manter o ritmo.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {shown.map((recommendation) => (
            <li key={`${recommendation.kind}-${recommendation.href}`}>
              <Link
                href={recommendation.href}
                className="flex items-start gap-3 rounded-md border border-slate-100 p-3 hover:border-slate-300 hover:bg-slate-50"
              >
                <span className="text-xl leading-none">{KIND_ICON[recommendation.kind]}</span>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{recommendation.title}</p>
                  <p className="text-xs text-slate-500">{recommendation.reason}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

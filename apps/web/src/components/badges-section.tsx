import type { BadgeStatus } from '@/lib/gamification';

interface BadgesSectionProps {
  badges: BadgeStatus[];
}

export function BadgesSection({ badges }: BadgesSectionProps) {
  const earnedCount = badges.filter((badge) => badge.earned).length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-lg font-semibold">
        Conquistas <span className="font-normal text-slate-500">({earnedCount} / {badges.length})</span>
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className={
              badge.earned
                ? 'flex flex-col items-center gap-1 rounded-lg border border-orange-300 bg-orange-50 p-3 text-center'
                : 'flex flex-col items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center opacity-50'
            }
          >
            <span className="text-2xl">{badge.icon}</span>
            <p className="text-xs font-semibold text-slate-800">{badge.name}</p>
            <p className="text-[11px] text-slate-500">{badge.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

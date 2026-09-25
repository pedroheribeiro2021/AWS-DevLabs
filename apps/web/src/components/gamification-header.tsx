import type { GamificationStats } from '@/lib/gamification';

interface GamificationHeaderProps {
  stats: GamificationStats;
}

export function GamificationHeader({ stats }: GamificationHeaderProps) {
  const { level, xpIntoLevel, xpForLevel, currentStreak, longestStreak } = stats;
  const progressPercent = xpForLevel > 0 ? Math.min(100, (xpIntoLevel / xpForLevel) * 100) : 100;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-white">
          {level}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">Nível {level}</p>
          <div className="mt-1 h-2 w-40 overflow-hidden rounded-full bg-slate-100 sm:w-48">
            <div className="h-full bg-orange-500" style={{ width: `${progressPercent}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {xpIntoLevel} / {xpForLevel} XP para o nível {level + 1}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm font-medium text-orange-700">
        <span className="text-xl">🔥</span>
        <div>
          <p>
            {currentStreak} dia{currentStreak === 1 ? '' : 's'} seguido{currentStreak === 1 ? '' : 's'}
          </p>
          {longestStreak > currentStreak && (
            <p className="text-xs font-normal text-slate-500">recorde: {longestStreak} dias</p>
          )}
        </div>
      </div>
    </section>
  );
}

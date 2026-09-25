interface XpBannerProps {
  xp?: string;
  level?: string;
  streak?: string;
  badges?: string;
}

export function XpBanner({ xp, level, streak, badges }: XpBannerProps) {
  const xpAwarded = Number(xp);

  if (!xp || !Number.isFinite(xpAwarded) || xpAwarded <= 0) {
    return null;
  }

  const newBadges = badges ? badges.split('|') : [];

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-orange-300 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800">
      <div className="flex flex-wrap items-center gap-2">
        <span>+{xpAwarded} XP</span>
        {level && (
          <span className="rounded-full bg-orange-600 px-2 py-0.5 text-xs font-semibold text-white">
            Subiu para o nível {level}! 🎉
          </span>
        )}
        {streak && (
          <span>
            🔥 {streak} dia{streak === '1' ? '' : 's'} seguido{streak === '1' ? '' : 's'}
          </span>
        )}
      </div>
      {newBadges.map((badge) => (
        <div
          key={badge}
          className="w-fit rounded-full bg-orange-600 px-2 py-0.5 text-xs font-semibold text-white"
        >
          Nova conquista: {badge}
        </div>
      ))}
    </div>
  );
}

interface AccuracyBarProps {
  accuracyPercent: number | null;
  passingScorePercent: number;
}

/** Horizontal meter with a tick at the passing score; the number is always printed beside it. */
export function AccuracyBar({ accuracyPercent, passingScorePercent }: AccuracyBarProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100">
        {accuracyPercent !== null && (
          <div className="h-full rounded-full bg-orange-600" style={{ width: `${accuracyPercent}%` }} />
        )}
        <div
          aria-hidden
          className="absolute top-0 h-full w-0.5 bg-slate-400"
          style={{ left: `${passingScorePercent}%` }}
        />
      </div>
      <span className="w-12 shrink-0 text-right text-xs font-medium text-slate-700">
        {accuracyPercent === null ? '—' : `${accuracyPercent}%`}
      </span>
    </div>
  );
}

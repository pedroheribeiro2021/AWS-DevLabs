import type { Analytics } from '@/lib/analytics';

interface WeeklyActivityChartProps {
  weeks: Analytics['history']['weekly'];
}

function formatWeek(isoDate: string) {
  const [, month, day] = isoDate.split('-');
  return `${day}/${month}`;
}

/** Single-series bar chart (answers per week); hover or focus a bar for the exact numbers. */
export function WeeklyActivityChart({ weeks }: WeeklyActivityChartProps) {
  const max = Math.max(1, ...weeks.map((week) => week.answers));
  const total = weeks.reduce((sum, week) => sum + week.answers, 0);

  return (
    <figure>
      <figcaption className="text-sm font-medium text-slate-700">
        Questões respondidas por semana{' '}
        <span className="font-normal text-slate-500">
          (últimas {weeks.length} semanas, {total} no total)
        </span>
      </figcaption>
      <ul className="mt-3 flex h-36 items-end gap-0.5 border-b border-slate-200">
        {weeks.map((week) => {
          const accuracy = week.answers ? Math.round((week.correct / week.answers) * 100) : null;
          const label = `Semana de ${formatWeek(week.weekStart)}: ${week.answers} respostas${
            accuracy === null ? '' : `, ${accuracy}% de acerto`
          }`;
          return (
            <li
              key={week.weekStart}
              aria-label={label}
              tabIndex={0}
              className="group relative flex h-full flex-1 items-end justify-center outline-none"
            >
              {week.answers > 0 && (
                <div
                  className="w-full max-w-10 rounded-t bg-orange-600 group-hover:bg-orange-700 group-focus:bg-orange-700"
                  style={{ height: `${(week.answers / max) * 100}%` }}
                />
              )}
              <div className="pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max max-w-44 rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow group-hover:block group-focus:block">
                {label}
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-1 flex gap-0.5 text-[11px] text-slate-500">
        {weeks.map((week) => (
          <span key={week.weekStart} className="flex-1 text-center">
            {formatWeek(week.weekStart)}
          </span>
        ))}
      </div>
    </figure>
  );
}

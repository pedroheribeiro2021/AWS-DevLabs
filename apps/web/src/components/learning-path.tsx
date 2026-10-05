import Link from 'next/link';
import type { TrackDomain, TrackLesson } from '@/lib/learning';

// Horizontal offsets (px) that make the Duolingo-style zigzag. Nodes have a fixed
// size and nothing expands inside the path, so the shape never breaks.
const ZIGZAG = [0, 48, 80, 48, 0, -48, -80, -48];

// One banner color per unit, cycling.
const UNIT_COLORS = ['bg-orange-500', 'bg-sky-500', 'bg-emerald-500', 'bg-violet-500'];

type NodeState = 'done' | 'current' | 'upcoming';

const NODE_CLASS: Record<NodeState, string> = {
  done: 'bg-orange-500 border-orange-700 text-white',
  current: 'bg-orange-500 border-orange-700 text-white ring-8 ring-orange-200',
  upcoming: 'bg-slate-200 border-slate-300 text-slate-400 hover:bg-slate-300',
};

interface PathNodeProps {
  lesson: TrackLesson;
  state: NodeState;
  offset: number;
}

function PathNode({ lesson, state, offset }: PathNodeProps) {
  return (
    <div
      className="relative flex flex-col items-center"
      style={{ transform: `translateX(${offset}px)` }}
    >
      {state === 'current' && (
        <div className="absolute -top-12 z-20 flex flex-col items-center">
          <span className="whitespace-nowrap rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-orange-600 shadow-sm">
            Começar
          </span>
          <span className="-mt-1 h-2.5 w-2.5 rotate-45 border-b-2 border-r-2 border-slate-200 bg-white" />
        </div>
      )}
      <Link
        href={`/learn/${lesson.id}/practice`}
        title={lesson.title}
        aria-label={`${lesson.title} — ${
          state === 'done' ? 'concluída' : state === 'current' ? 'próxima lição' : 'não iniciada'
        }`}
        className={`flex h-[72px] w-[72px] items-center justify-center rounded-full border-b-[6px] text-2xl font-bold transition active:translate-y-1 active:border-b-2 ${NODE_CLASS[state]}`}
      >
        {state === 'done' ? '✓' : '★'}
      </Link>
      {/* Title on the side the zigzag leans away from, so it never covers the path. */}
      <span
        className={`absolute top-1/2 w-32 -translate-y-1/2 text-xs leading-tight sm:w-44 ${
          offset > 0 ? 'right-full mr-4 text-right' : 'left-full ml-4 text-left'
        } ${state === 'upcoming' ? 'text-slate-400' : 'font-semibold text-slate-700'}`}
      >
        {lesson.title}
      </span>
    </div>
  );
}

interface LearningPathProps {
  domains: TrackDomain[];
}

export function LearningPath({ domains }: LearningPathProps) {
  // The "current" node is the first lesson not yet completed, across the whole track.
  const allLessons = domains.flatMap((domain) => domain.topics.flatMap((topic) => topic.lessons));
  const currentLessonId = allLessons.find((lesson) => lesson.status !== 'COMPLETED')?.id;
  // The zigzag runs continuously across units, so offsets come from the global position.
  const offsetByLessonId = new Map(
    allLessons.map((lesson, index) => [lesson.id, ZIGZAG[index % ZIGZAG.length]]),
  );

  return (
    <div className="flex flex-col gap-10">
      {domains.map((domain, unitIndex) => {
        const lessons = domain.topics.flatMap((topic) => topic.lessons);
        const completed = lessons.filter((lesson) => lesson.status === 'COMPLETED').length;
        const unitDone = lessons.length > 0 && completed === lessons.length;

        return (
          <section key={domain.id} className="flex flex-col gap-8">
            <div
              className={`rounded-2xl px-5 py-4 text-white ${UNIT_COLORS[unitIndex % UNIT_COLORS.length]}`}
            >
              <p className="text-xs font-bold uppercase tracking-wide opacity-80">
                Unidade {unitIndex + 1} · {domain.weightPercent}% da prova
              </p>
              <h3 className="text-lg font-bold">{domain.name}</h3>
              <p className="text-sm opacity-90">
                {completed} / {lessons.length} lições concluídas
              </p>
            </div>

            <div className="flex flex-col items-center gap-10 pt-6">
              {lessons.map((lesson) => {
                const state: NodeState =
                  lesson.status === 'COMPLETED'
                    ? 'done'
                    : lesson.id === currentLessonId
                      ? 'current'
                      : 'upcoming';
                return (
                  <PathNode
                    key={lesson.id}
                    lesson={lesson}
                    state={state}
                    offset={offsetByLessonId.get(lesson.id) ?? 0}
                  />
                );
              })}

              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl border-b-[6px] text-3xl ${
                  unitDone
                    ? 'border-amber-600 bg-amber-400'
                    : 'border-slate-300 bg-slate-200 grayscale'
                }`}
                title={unitDone ? 'Unidade concluída' : 'Conclua a unidade para ganhar o troféu'}
              >
                🏆
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

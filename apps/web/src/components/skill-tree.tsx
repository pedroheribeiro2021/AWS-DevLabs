import Link from 'next/link';
import type { TrackTopic } from '@/lib/learning';

const LESSON_STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: 'Não iniciada',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
};

type TopicState = 'empty' | 'not-started' | 'in-progress' | 'done';

function getTopicState(topic: TrackTopic): TopicState {
  const total = topic.lessons.length;
  if (total === 0) return 'empty';
  const completed = topic.lessons.filter((lesson) => lesson.status === 'COMPLETED').length;
  if (completed === 0) return 'not-started';
  if (completed === total) return 'done';
  return 'in-progress';
}

const CIRCLE_CLASS: Record<TopicState, string> = {
  empty: 'border-2 border-dashed border-slate-200 bg-white text-slate-300',
  'not-started': 'border-2 border-slate-300 bg-white text-slate-600',
  'in-progress': 'border-2 border-orange-400 bg-orange-50 text-orange-700',
  done: 'border-2 border-orange-500 bg-orange-500 text-white',
};

interface SkillTreeNodeProps {
  topic: TrackTopic;
  index: number;
}

function SkillTreeNode({ topic, index }: SkillTreeNodeProps) {
  const state = getTopicState(topic);
  const total = topic.lessons.length;
  const completed = topic.lessons.filter((lesson) => lesson.status === 'COMPLETED').length;

  const node = (
    <div className="flex items-center gap-3">
      <div
        className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold ${CIRCLE_CLASS[state]}`}
      >
        {state === 'done' ? '✓' : index + 1}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800">{topic.name}</p>
        <p className="text-xs text-slate-500">
          {total === 0 ? 'Conteúdo em breve' : `${completed} / ${total} lições concluídas`}
        </p>
      </div>
    </div>
  );

  if (total === 0) {
    return <div className="opacity-60">{node}</div>;
  }

  return (
    <details className="group">
      <summary className="cursor-pointer list-none">{node}</summary>
      <ul className="ml-14 mt-2 flex flex-col gap-1 border-l border-slate-100 pl-4">
        {topic.lessons.map((lesson) => (
          <li key={lesson.id}>
            <Link
              href={`/learn/${lesson.id}`}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50"
            >
              <span>{lesson.title}</span>
              <span
                className={
                  lesson.status === 'COMPLETED'
                    ? 'shrink-0 text-xs font-medium text-green-600'
                    : 'shrink-0 text-xs text-slate-400'
                }
              >
                {LESSON_STATUS_LABEL[lesson.status]}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}

interface SkillTreeProps {
  topics: TrackTopic[];
}

export function SkillTree({ topics }: SkillTreeProps) {
  return (
    <div className="relative pl-2">
      <div className="absolute left-[23px] top-2 bottom-2 w-0.5 bg-slate-200" />
      <div className="flex flex-col gap-3">
        {topics.map((topic, index) => (
          <SkillTreeNode key={topic.id} topic={topic} index={index} />
        ))}
      </div>
    </div>
  );
}

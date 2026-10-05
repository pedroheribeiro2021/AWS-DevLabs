import { redirect } from 'next/navigation';
import { PracticeSession } from '@/components/practice-session';
import { getCurrentUser } from '@/lib/auth-server';
import { getPractice } from '@/lib/practice';
import { buildExercises } from '@/lib/practice-exercises';

interface PracticePageProps {
  params: Promise<{ lessonId: string }>;
}

// Duolingo-style practice: short exercises one at a time. An addition to the
// lesson — reading it (whole or in steps) stays at /learn/:id.
export default async function PracticePage({ params }: PracticePageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const { lessonId } = await params;
  const material = await getPractice(lessonId);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:py-12">
      <PracticeSession
        lessonId={lessonId}
        lessonTitle={material.lesson.title}
        topicName={material.topic.name}
        alreadyCompleted={material.lesson.status === 'COMPLETED'}
        exercises={buildExercises(material)}
      />
    </main>
  );
}

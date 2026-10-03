import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AppNav } from '@/components/app-nav';
import { BadgesSection } from '@/components/badges-section';
import { GamificationHeader } from '@/components/gamification-header';
import { RecommendationsSection } from '@/components/recommendations-section';
import { SkillTree } from '@/components/skill-tree';
import { getAnalytics } from '@/lib/analytics';
import { getCurrentUser } from '@/lib/auth-server';
import { getFlashcards } from '@/lib/flashcards';
import { getGamificationStats } from '@/lib/gamification';
import { getTrack } from '@/lib/learning';

const DEFAULT_CERTIFICATION_SLUG = 'aws-certified-developer-associate';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const [track, gamificationStats, analytics, flashcards] = await Promise.all([
    getTrack(DEFAULT_CERTIFICATION_SLUG),
    getGamificationStats(),
    getAnalytics(),
    getFlashcards(),
  ]);
  const dueFlashcards = flashcards.filter((card) => card.due);
  const lessons = track.examVersions.flatMap((ev) => ev.domains).flatMap((d) => d.topics).flatMap((t) => t.lessons);
  const completedCount = lessons.filter((lesson) => lesson.status === 'COMPLETED').length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:py-16">
      <AppNav title={`Olá, ${user.name}`} />

      <GamificationHeader stats={gamificationStats} />

      {dueFlashcards.length > 0 && (
        <Link
          href={`/flashcards/${dueFlashcards[0].id}?review=1`}
          className="flex items-center justify-between rounded-lg border border-orange-200 bg-orange-50 p-4 hover:border-orange-300"
        >
          <span className="text-sm font-semibold text-orange-800">
            Revisão do dia: {dueFlashcards.length} flashcard{dueFlashcards.length > 1 ? 's' : ''}
          </span>
          <span className="text-sm font-medium text-orange-700">Começar →</span>
        </Link>
      )}

      <RecommendationsSection recommendations={analytics.recommendations} limit={3} />

      <BadgesSection badges={gamificationStats.badges} />

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold">{track.name}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {completedCount} / {lessons.length} lições concluídas
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-orange-500"
            style={{ width: `${lessons.length ? (completedCount / lessons.length) * 100 : 0}%` }}
          />
        </div>
      </section>

      {track.examVersions.map((examVersion) =>
        examVersion.domains.map((domain) => (
          <section key={domain.id} className="rounded-lg border border-slate-200 bg-white p-5">
            <h3 className="mb-4 text-base font-semibold text-slate-800">
              {domain.name} <span className="font-normal text-slate-500">({domain.weightPercent}%)</span>
            </h3>
            <SkillTree topics={domain.topics} />
          </section>
        )),
      )}
    </main>
  );
}

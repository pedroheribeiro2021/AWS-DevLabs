export interface DomainQuestionPool {
  domainId: string;
  weightPercent: number;
  questionIds: string[];
}

/**
 * Picks `questionCount` question ids from `pools`, proportionally to each
 * domain's weightPercent. Degrades gracefully when there aren't enough
 * questions: caps the result to whatever is actually available instead of
 * throwing, and redistributes any shortfall (from rounding or a thin domain)
 * to whichever domains still have unused questions.
 */
export function selectSimulationQuestionIds(
  pools: DomainQuestionPool[],
  questionCount: number,
  random: () => number = Math.random,
): string[] {
  const totalAvailable = pools.reduce((sum, pool) => sum + pool.questionIds.length, 0);
  const targetCount = Math.min(Math.max(questionCount, 0), totalAvailable);

  if (targetCount === 0) {
    return [];
  }

  const totalWeight =
    pools.reduce((sum, pool) => sum + pool.weightPercent, 0) || pools.length || 1;

  const takeByDomain = new Map<string, number>();
  let allocated = 0;

  for (const pool of pools) {
    const rawTarget = Math.round((pool.weightPercent / totalWeight) * targetCount);
    const take = Math.min(rawTarget, pool.questionIds.length);
    takeByDomain.set(pool.domainId, take);
    allocated += take;
  }

  let shortfall = targetCount - allocated;
  if (shortfall > 0) {
    const byLeftoverCapacity = pools
      .map((pool) => ({
        pool,
        leftover: pool.questionIds.length - (takeByDomain.get(pool.domainId) ?? 0),
      }))
      .sort((a, b) => b.leftover - a.leftover);

    for (const { pool, leftover } of byLeftoverCapacity) {
      if (shortfall <= 0) break;
      const extra = Math.min(shortfall, leftover);
      if (extra <= 0) continue;
      takeByDomain.set(pool.domainId, (takeByDomain.get(pool.domainId) ?? 0) + extra);
      shortfall -= extra;
    }
  }

  const selected: string[] = [];
  for (const pool of pools) {
    const take = takeByDomain.get(pool.domainId) ?? 0;
    selected.push(...shuffle(pool.questionIds, random).slice(0, take));
  }

  return shuffle(selected, random);
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

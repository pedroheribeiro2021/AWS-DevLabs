// Splits a lesson's markdown into steps at its `## ` headings, so the existing
// lessons get a step-by-step mode without being rewritten. Text before the first
// heading (an intro) stays with the first step instead of becoming a tiny step of
// its own. Headings inside fenced code blocks are not split points.
export function splitLessonIntoSteps(content: string): string[] {
  const steps: string[][] = [[]];
  let inFence = false;

  for (const line of content.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
    }

    const startsSection = !inFence && line.startsWith('## ');
    const current = steps[steps.length - 1];
    const currentHasHeading = current.some((entry) => entry.startsWith('## '));

    if (startsSection && currentHasHeading) {
      steps.push([line]);
    } else {
      current.push(line);
    }
  }

  return steps.map((step) => step.join('\n').trim()).filter((step) => step.length > 0);
}

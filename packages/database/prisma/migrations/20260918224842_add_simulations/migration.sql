-- CreateEnum
CREATE TYPE "SimulationStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "simulation_attempts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examVersionId" TEXT NOT NULL,
    "questionCount" INTEGER NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "status" "SimulationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "correctCount" INTEGER,
    "scorePercent" INTEGER,
    "passed" BOOLEAN,

    CONSTRAINT "simulation_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_questions" (
    "id" TEXT NOT NULL,
    "simulationAttemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "selectedOptionIds" TEXT[],
    "isCorrect" BOOLEAN,
    "flagged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "simulation_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "simulation_questions_simulationAttemptId_questionId_key" ON "simulation_questions"("simulationAttemptId", "questionId");

-- AddForeignKey
ALTER TABLE "simulation_attempts" ADD CONSTRAINT "simulation_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_attempts" ADD CONSTRAINT "simulation_attempts_examVersionId_fkey" FOREIGN KEY ("examVersionId") REFERENCES "exam_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_questions" ADD CONSTRAINT "simulation_questions_simulationAttemptId_fkey" FOREIGN KEY ("simulationAttemptId") REFERENCES "simulation_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_questions" ADD CONSTRAINT "simulation_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

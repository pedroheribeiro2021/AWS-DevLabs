-- CreateEnum
CREATE TYPE "FlashcardState" AS ENUM ('NEW', 'LEARNING', 'REVIEW', 'MASTERED');

-- CreateTable
CREATE TABLE "flashcards" (
    "id" TEXT NOT NULL,
    "conceptId" TEXT NOT NULL,
    "front" TEXT NOT NULL,
    "back" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "flashcards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_flashcard_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "flashcardId" TEXT NOT NULL,
    "state" "FlashcardState" NOT NULL DEFAULT 'NEW',
    "lastReviewedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_flashcard_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_flashcard_progress_userId_flashcardId_key" ON "user_flashcard_progress"("userId", "flashcardId");

-- AddForeignKey
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "concepts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_flashcard_progress" ADD CONSTRAINT "user_flashcard_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_flashcard_progress" ADD CONSTRAINT "user_flashcard_progress_flashcardId_fkey" FOREIGN KEY ("flashcardId") REFERENCES "flashcards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

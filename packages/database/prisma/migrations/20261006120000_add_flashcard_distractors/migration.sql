-- AlterTable
ALTER TABLE "flashcards" ADD COLUMN     "distractors" TEXT[] DEFAULT ARRAY[]::TEXT[];

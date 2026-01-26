-- AlterTable
ALTER TABLE "Timer" ADD COLUMN "defaultStartTime" TEXT;

-- AlterTable
ALTER TABLE "TimerSchedule" ADD COLUMN "startTime" TEXT;

-- CreateTable
CREATE TABLE "TimerSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timerId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "seconds" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimerSchedule_timerId_fkey" FOREIGN KEY ("timerId") REFERENCES "Timer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TimerSchedule_timerId_dayOfWeek_key" ON "TimerSchedule"("timerId", "dayOfWeek");

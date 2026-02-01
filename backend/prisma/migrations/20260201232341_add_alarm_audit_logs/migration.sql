-- CreateTable
CREATE TABLE "AlarmAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "soundType" TEXT,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlarmAuditLog_timerId_fkey" FOREIGN KEY ("timerId") REFERENCES "Timer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

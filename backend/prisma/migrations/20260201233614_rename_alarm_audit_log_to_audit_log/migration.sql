/*
  Warnings:

  - You are about to drop the `AlarmAuditLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AlarmAuditLog";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_timerId_fkey" FOREIGN KEY ("timerId") REFERENCES "Timer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Timer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "defaultDailySeconds" INTEGER NOT NULL,
    "defaultStartTime" TEXT,
    "defaultExpirationTime" TEXT,
    "alarmSound" TEXT NOT NULL DEFAULT 'classic',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Timer_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Timer" ("createdAt", "defaultDailySeconds", "defaultExpirationTime", "defaultStartTime", "id", "name", "personId") SELECT "createdAt", "defaultDailySeconds", "defaultExpirationTime", "defaultStartTime", "id", "name", "personId" FROM "Timer";
DROP TABLE "Timer";
ALTER TABLE "new_Timer" RENAME TO "Timer";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "adminPinHash" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Timer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "defaultDailySeconds" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Timer_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyAllocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timerId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "totalSeconds" INTEGER NOT NULL,
    "usedSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyAllocation_timerId_fkey" FOREIGN KEY ("timerId") REFERENCES "Timer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Checkout" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timerId" TEXT NOT NULL,
    "allocationId" TEXT NOT NULL,
    "allocatedSeconds" INTEGER NOT NULL,
    "usedSeconds" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Checkout_timerId_fkey" FOREIGN KEY ("timerId") REFERENCES "Timer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Checkout_allocationId_fkey" FOREIGN KEY ("allocationId") REFERENCES "DailyAllocation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "checkoutId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeEntry_checkoutId_fkey" FOREIGN KEY ("checkoutId") REFERENCES "Checkout" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyAllocation_timerId_date_key" ON "DailyAllocation"("timerId", "date");

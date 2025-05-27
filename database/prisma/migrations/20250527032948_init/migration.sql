-- CreateTable
CREATE TABLE "Date" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Indicator" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "IndicatorValue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "indicatorId" INTEGER NOT NULL,
    "dateId" INTEGER NOT NULL,
    "value" REAL NOT NULL,
    CONSTRAINT "IndicatorValue_indicatorId_fkey" FOREIGN KEY ("indicatorId") REFERENCES "Indicator" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "IndicatorValue_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "Date" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Date_date_key" ON "Date"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Indicator_name_key" ON "Indicator"("name");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorValue_indicatorId_dateId_key" ON "IndicatorValue"("indicatorId", "dateId");

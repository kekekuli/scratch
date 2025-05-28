import express from "express";
import prisma from './clients'
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const router = express.Router();

router.get("/", async (req, res) => {
    const data = await prisma.indicatorValue.findMany({
        include: {
            indicator: true,
            date: true
        }
    });

    const result = data.map(item => ({
        name: item.indicator.name,
        date: dayjs(item.date.date).tz("Asia/Shanghai").format("YYYY-MM"),
        value: String(item.value)
    }));

    res.json(result);
});

router.post("/addRecord", async (req, res) => {
    const { indicator: indicatorName, date, value } = req.body;

    if (typeof indicatorName !== 'string' || typeof date !== 'string' || typeof value !== 'number') {
        res.status(400).json({ error: "Invalid input data" });
        return;
    }

    try{
        const indicator = await prisma.indicator.upsert({
            where: {name:indicatorName},
            update: {},
            create: { name: indicatorName }
        })

        const parsedDate = dayjs.tz(`${date}/01`, "Asia/Shanghai").toDate();

        if (isNaN(parsedDate.getTime())) {
            res.status(400).json({ error: "Invalid date format" });
            return;
        }

        const dateEntry = await prisma.date.upsert({
            where: { date: parsedDate },
            update: {},
            create: { date: parsedDate }
        });

        const indicatorValue = await prisma.indicatorValue.upsert({
            where: {
                indicatorId_dateId:{
                    indicatorId: indicator.id,
                    dateId: dateEntry.id
               },
            },
            update: { value },
            create: {
                value,
                indicatorId: indicator.id,
                dateId: dateEntry.id
            }
        })

        res.status(201).json(indicatorValue);
    }catch (error) {
        if (error instanceof Error) {
            console.error("Error adding record:", error.message);
            res.status(500).json({ error: error.message });
        }
        else {
            console.error("Unexpected error:", error);
            res.status(500).json({ error: "An unexpected error occurred" });
        }
    }
});

export default router;
import express from "express";
import prisma from './clients'

const router = express.Router();

router.get("/", async (req, res) => {
    const data = await prisma.indicatorValue.findMany({
        include:{
            indicator: true,
            date: true
        }
    })

    res.json(data);
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

        const parsedDate = new Date(`${date}/01`);

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
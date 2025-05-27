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

export default router;
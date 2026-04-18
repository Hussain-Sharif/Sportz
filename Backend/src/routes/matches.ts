import { Router } from "express";
import { createMatchSchema, listMatchesQuerySchema } from "../validations/matches.js";
import { db } from "../db/index.js";
import { matches } from "../db/schema.js";
import { getMatchStatus } from "../utils/matchStatus.js";
import { desc } from "drizzle-orm";

const matchesRouter = Router()

const MAX_LIMIT=100

matchesRouter.get('/',async (req,res)=>{
    
    const parsed = listMatchesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
        return res.status(400).json({error: 'Invalid query.', details: parsed.error.issues });
    }

    const limit = Math.min(parsed.data.limit ?? 50, MAX_LIMIT);
    // console.log(parsed.data.limit,limit)

    try {
        const data = await db
            .select()
            .from(matches)
            .orderBy((desc(matches.createdAt)))
            .limit(limit)
        console.log("may inside")
        res.json({ data });
    } catch (e) {
        res.status(500).json({ error: 'Failed to list matches.' });
    }
})

// routes/matches.js
matchesRouter.post('/', async (req, res) => {
    const parsed = createMatchSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: 'Invalid payload',
            details: parsed.error.issues
        });
    }

    try {
        // Destructure to handle naming differences and overrides
        const { homeTeam, startTime, endTime, homeScore, awayScore, ...rest } = parsed.data;

        const [event] = await db.insert(matches).values({
            ...rest,
            homeTeam: homeTeam, // Mapping Zod 'homeTown' to Drizzle 'homeTeam'
            status: getMatchStatus(startTime, endTime),
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            homeScore: homeScore ?? 0,
            awayScore: awayScore ?? 0,
        }).returning();

        return res.status(201).json({data:event});

    } catch (error) {
        return res.status(500).json({
            error: 'Database error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});


export default matchesRouter
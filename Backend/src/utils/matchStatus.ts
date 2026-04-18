import z from "zod";
import { createMatchSchema, MATCH_STATUS } from "../validations/matches.js";

export function getMatchStatus(startTime:z.infer<typeof createMatchSchema>["startTime"], endTime:z.infer<typeof createMatchSchema>["endTime"], now:Date = new Date()) {
    const start = new Date(startTime);
    const end = new Date(endTime);

    if (now < start) {
        return MATCH_STATUS.enum.scheduled;
    }

    if (now >= end) {
        return MATCH_STATUS.enum.finished;
    }

    return MATCH_STATUS.enum.live;
}

export async function syncMatchStatus(match:z.infer<typeof createMatchSchema>, updateStatus:any) {
    const nextStatus = getMatchStatus(match.startTime, match.endTime);
    if (!nextStatus) {
        return match.status;
    }
    if (match.status !== nextStatus) {
        await updateStatus(nextStatus);
        match.status = nextStatus;
    }
    return match.status;
}
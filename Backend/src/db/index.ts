import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import PG from 'pg'

if (!process.env.DATABASE_URL){
    throw new Error("Database-url is not defined to make a pool connection")
}

export const pool = new PG.Pool({
    connectionString:process.env.DATABASE_URL
})

export const db = drizzle(pool)
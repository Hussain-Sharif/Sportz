import express from 'express';
import matchesRouter  from './routes/matches.js';

const app = express()
const port = 4000

app.use(express.json())



app.use('/matches',matchesRouter)

app.listen(port,()=>{
    console.log(`Server starts: http://localhost:${port}`)
})
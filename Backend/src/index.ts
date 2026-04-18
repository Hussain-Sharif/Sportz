import express from 'express';
import http from 'http'
import matchesRouter  from './routes/matches.js';
import { attchWebSocketServer } from './ws/server.js';
import { securityMiddleware } from './arcjet.js';

const PORT = Number(process.env.PORT || 8000)
const HOST = process.env.HOST || '0.0.0.0'

const app = express()
const server = http.createServer(app)

app.use(express.json())

app.use(securityMiddleware())

app.get('/',(req,res)=>{
    res.send('Hi REST!')
})

app.use('/matches',matchesRouter)


const {broadcastMatchCreated}=attchWebSocketServer(server)
app.locals.broadcastMatchCreated=broadcastMatchCreated



server.listen(PORT,()=>{

    const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}` 

    console.log(`Server starts: ${baseUrl}`)
    console.log(`WebSocket Server is running on: ${baseUrl.replace('http','ws')}/ws`)  // navigating the socket request to the websocket created file path
})
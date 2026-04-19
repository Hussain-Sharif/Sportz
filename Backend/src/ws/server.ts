import { Server } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import z from "zod";
import { createMatchSchema } from "../validations/matches.js";
import { wsArcjet } from "../arcjet.js";
import { Request } from "express";
import { createCommentarySchema } from "../validations/commentary.js";
import { commentary } from "../db/schema.js";

type Payload={
    type:String,
    data:any
}

// extended websocket layer for ping-pong checks
interface ExtWebSocketType extends WebSocket{
    isAlive:boolean,
    subscriptions:Set<number>
}

// utility functions
function sendJson(socket: WebSocket,payload: any){
    if(socket.readyState !== WebSocket.OPEN) return ;

    socket.send(JSON.stringify(payload))
}


function broadcastToAll(wss:WebSocketServer,payload:Payload){
    for(const client of wss.clients){
        if(client.readyState !== WebSocket.OPEN) continue ;

        client.send(JSON.stringify(payload))
    }
}


// Pub-Sub Impl:
const matchSubscribers = new Map()

function subscribe(matchId:number,socket:ExtWebSocketType){
    if ( !matchSubscribers.has(matchId)){
        matchSubscribers.set(matchId,new Set())
    }

    matchSubscribers.get(matchId).add(socket)
}

function unSubscribe(matchId:number,socket:ExtWebSocketType){
    const subscribers:Set<ExtWebSocketType> = matchSubscribers.get(matchId)
    
    if(!subscribers) return;

    subscribers.delete(socket)

    if(subscribers.size === 0 ){
        matchSubscribers.delete(matchId)
    }
}

function cleanUpSubscriptions(socket:ExtWebSocketType){
    for(const matchId of socket.subscriptions){
        unSubscribe(matchId,socket)
    }
}

function broadcastToMatch(matchId:number, payload:Payload){
    const subscribers:Set<ExtWebSocketType> = matchSubscribers.get(matchId)

    if(!subscribers || subscribers.size ===0) return;

    const message = JSON.stringify(payload)
    for(let client of subscribers ){
        if(client.readyState === WebSocket.OPEN){
            client.send(message)
        }
    }

}


function handleMessage(socket:ExtWebSocketType,data:Payload){
    let message

    try {
        message = JSON.parse(data.toString())
    } catch (error) {
        sendJson(socket,{type:'error',message:'Invalid JSON'})
        return;
    }

    if ( message?.type === "subscribe" && Number.isInteger(message.data.matchId)) {
        subscribe(message.data.matchId, socket)
        socket.subscriptions.add(message.data.matchId)
        sendJson(socket,{type:'subscribed',matchId:message.data.matchId})
        return 
    }

    if (message?.type === "unsubscribe" && Number.isInteger(message.data.matchId)){
        unSubscribe(message.data.matchId,socket)
        socket.subscriptions.delete(message.data.matchId)
        sendJson(socket,{type:'unsubscribed',matchId:message.data.matchId})
    }

}

// server init
export function attchWebSocketServer(server:Server) {
    const wss = new WebSocketServer({
        noServer:true,
        path:'/ws', // showing the request -> websocket server file
        maxPayload:1024*1024, // incoming socket msg size limited to 1MB
    })

    server.on("upgrade",async(req:Request,socket,head)=>{
        const { pathname } = new URL(req.url, `http://${req.headers.host}`);

        if (pathname !== '/ws') {
            socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
            socket.destroy();
            return;
        }

        if (wsArcjet) {
            try {
                const decision = await wsArcjet.protect(req);

                if (decision.isDenied()) {
                    if (decision.reason.isRateLimit()) {
                        socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
                    } else {
                        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                    }
                    socket.destroy();
                    return;
                }
            } catch (e) {
                console.error('WS upgrade protection error', e);
                socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
                socket.destroy();
                return;
            }
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    })

    wss.on('connection',async(socket:ExtWebSocketType,req:Request)=>{
        // when we recieve a pong from client -> set `isAlive`->true
        socket.isAlive=true;
        socket.on("pong",function(this:WebSocket){
            const ws=this as ExtWebSocketType
            ws.isAlive=true 
        })

        socket.subscriptions=new Set()

        sendJson(socket,{type:'welcome'})
        
        socket.on('message',(data:Payload) => {
            handleMessage(socket,data)
        })

        socket.on("close",()=>{
            cleanUpSubscriptions(socket)
        })

        socket.on('error',()=>{
            socket.terminate()
            console.error(`Some Went Wrong with ws connection `)
        });
    })

    // setting interval to check for dead-connections
    const intervalID=setInterval(()=>{
        wss.clients.forEach((ws)=>{
            const clientSocketConnection=ws as ExtWebSocketType
            
            if(clientSocketConnection.isAlive === false){
                console.log('Terminating zombie connection');
                return ws.terminate();
            }

            // Mark it as false and send a ping to client. 
            // If the client is alive, the 'pong' event will fire and set it back to true
            clientSocketConnection.isAlive=false
            clientSocketConnection.ping() // triggering the `ping` event & client will 
        })
    },30000)

    // 3. Clean up the interval when the server closes
    wss.on('close', () => {
        clearInterval(intervalID);
    });

    function broadcastMatchCreated(match:z.infer<typeof createMatchSchema>){
        broadcastToAll(wss,{type:'match_created',data:match})
    }

    function broadcastCommentaryCreated(matchId:number,comment:z.infer<typeof createCommentarySchema>){
   
        broadcastToMatch(matchId,{type:'commentary_created',data:comment})
    }

    return {broadcastMatchCreated,broadcastCommentaryCreated}

}
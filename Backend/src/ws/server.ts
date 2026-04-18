import { Server } from "node:http";
import WebSocket, { WebSocketServer } from "ws";
import z from "zod";
import { createMatchSchema } from "../validations/matches.js";

// extended websocket layer for ping-pong checks
interface ExtWebSocketType extends WebSocket{
    isAlive:boolean
}

// utility functions
function sendJson(socket: WebSocket,payload: any){
    if(socket.readyState !== WebSocket.OPEN) return ;

    socket.send(JSON.stringify(payload))
}


function broadcast(wss:WebSocketServer,payload:any){
    for(const client of wss.clients){
        if(client.readyState !== WebSocket.OPEN) continue ;

        client.send(JSON.stringify(payload))
    }
}


// server init
export function attchWebSocketServer(server:Server) {
    const wss = new WebSocketServer({
        server,
        path:'/ws', // showing the request -> websocket server file
        maxPayload:1024*1024, // incoming socket msg size limited to 1MB
    })

    wss.on('connection',(socket:ExtWebSocketType)=>{
        
        // when we recieve a pong from client -> set `isAlive`->true
        socket.isAlive=true;
        socket.on("pong",function(this:WebSocket){
            const ws=this as ExtWebSocketType
            ws.isAlive=true 
        })

        sendJson(socket,{type:'welcome'})
        
        socket.on('error',console.error);
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
        broadcast(wss,{type:'match_created',data:match})
    }

    return {broadcastMatchCreated}

}
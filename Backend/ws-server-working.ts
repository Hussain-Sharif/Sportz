import { WebSocketServer } from "ws";


const wss = new WebSocketServer({port: 8080}); // This creates it's own HTTP Server just for the inital Handshake

// After 101 Switching Protocols, the connection is upgraded to WebSocket and we can use the socket object to send and receive data.

// Remember:
// for `readyState` property of Websocket connection obj:
// 0: CONNECTING
// 1: OPEN // only state where we can send and receive data "safely".
// 2: CLOSING
// 3: CLOSED

// Connection Event
wss.on("connection",(socket,request) => { // this `scoket` represents the WebSocket Connection one per client
    console.log("New Client Connected");
    const ip = request.socket.remoteAddress

    socket.on("message",(rawData) => { // by default `rawData` is of type `Buffer`(binary) but we can also send string data and it will be received as string.
        const msg = rawData.toString(); // if we want to convert Buffer to string
        console.log("Raw Data:")
        console.log({rawData})
        console.log(`Received data from ${ip}, Msg: ${msg}`);

        // if we want to send data to every active client connected Socket Object:
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(`Server Broadcast: ${rawData}`)
            }
        })


        // handling socket error due to any reason like client disconnecting abruptly, network issues etc.
        wss.on("error",(err) => {
            console.error(`Error occurred with client ${ip}:`, err.message);
        })

        // socket cleanup
        socket.on("close",()=>{
            console.log(`Client ${ip} disconnected`);
        })

    })

})
 
console.log("WebSocket Server is running on ws://localhost:8080");
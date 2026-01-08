// server.js

// =============================== IMPORT MODULES
const express = require("express"); 
const http = require("http");
const { Server } = require("socket.io");

// =============================== SETUP SERVER

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("🔥 Server running on", PORT));
let chat = []
let chat_store_limit = 100
let max_message_length = 1000
io.on("connection",(socket)=>{
  socket.on("get-chat",(args)=>{
    socket.emit("successful-get-chat",chat)
  })
  socket.on("send-message",(args)=>{
    const message = args.msg
    const user = args.user
    if(typeof message !== "string")return socket.emit("unsuccessful-send-message", "message not a string")
    if(message.length>max_message_length)return socket.emit("unsuccessful-send-message", "message exceeded max message length")
    chat.push(user + ": " + message)
    io.emit("new-message",user + ": " + message)
    if(chat.length>chat_store_limit){
      while(chat.length>chat_store_limit){
        chat.shift()
      }
    }
  })
  
})

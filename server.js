// server.js

const express = require("express"); 
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("🔥 Server running on", PORT));

let chat = {} // {chatName: {chat:[], typing:{}}}
let chat_store_limit = 100
let max_message_length = 1000

io.on("connection", (socket) => {

  // ================= CREATE CHAT
  socket.on("create-chat", () => {
    let chatName;
    while (!chatName || chat[chatName]) {
      chatName = crypto.randomUUID();
    }
    chat[chatName] = { chat: [], typing: {} };

    socket.join(chatName); // join room immediately
    socket.emit("good-create-chat", { reqFrom: socket.id, chatName });
  });

  // ================= SEND MESSAGE
  socket.on("send-message", ({ chatName, username, message }) => {
    if (!chat[chatName]) return socket.emit("bad-send-message", "chat not found");
    if (typeof username !== "string") return socket.emit("bad-send-message", "invalid username");
    if (typeof message !== "string") return socket.emit("bad-send-message", "invalid message");
    if (message.length > max_message_length) return socket.emit("bad-send-message", "message too big");

    const date = Date.now();
    chat[chatName].chat.push({ username, message, date });

    // trim chat if over limit
    while (chat[chatName].chat.length > chat_store_limit) {
      chat[chatName].chat.shift(); // remove oldest
    }

    // send to everyone in this chat
    io.to(chatName).emit("new-message", { chatName, username, message, date });
  });

  // ================= GET MESSAGES
  socket.on("get-message", ({ chatName }) => {
    if (!chat[chatName]) return socket.emit("bad-get-message", "chat not found");

    socket.join(chatName); // join room if not already
    socket.emit("good-get-message", chat[chatName].chat);
  });

  // ================= SET TYPING
  socket.on("set-typing", ({ chatName, username, bool }) => {
    if (!chat[chatName]) return socket.emit("bad-set-typing", "chat not found");
    if (typeof username !== "string") return socket.emit("bad-set-typing", "invalid username");
    if (typeof bool !== "boolean") return socket.emit("bad-set-typing", "invalid boolean");

    if (!chat[chatName].typing) chat[chatName].typing = {};
    if (chat[chatName].typing[username] === bool) 
      return socket.emit("ignore-msg", { from: "set-typing", msg: "user already typing." });

    chat[chatName].typing[username] = bool;

    // broadcast typing status to this chat only
    io.to(chatName).emit("typing-update", { chatName, username, bool });
  });
// =================== GET ALL CHATS
socket.on("get-chats", () => {
  const chatList = Object.keys(chat); // all chat names
  socket.emit("all-chats", chatList);
});

  // ================= HANDLE DISCONNECT
  socket.on("disconnecting", () => {
    // remove user from typing in all rooms
    for (const room of socket.rooms) {
      if (chat[room] && chat[room].typing) {
        for (const user in chat[room].typing) {
          if (chat[room].typing[user] && socket.id === user) {
            chat[room].typing[user] = false;
          }
        }
        io.to(room).emit("typing-update", { chatName: room, username: socket.id, bool: false });
      }
    }
  });

});


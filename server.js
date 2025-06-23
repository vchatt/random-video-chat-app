const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

let waitingUsers = [];

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('findPartner', ({ userId, gender }) => {
    // Remove socket if already waiting
    waitingUsers = waitingUsers.filter(user => user.socketId !== socket.id);

    let partnerIndex = waitingUsers.findIndex(
      user => user.socketId !== socket.id && (!gender || user.gender === gender)
    );

    if (partnerIndex !== -1) {
      const partner = waitingUsers[partnerIndex];
      waitingUsers.splice(partnerIndex, 1);
      io.to(socket.id).emit('partnerFound', partner.socketId);
      io.to(partner.socketId).emit('partnerFound', socket.id);
    } else {
      waitingUsers.push({ socketId: socket.id, userId, gender });
    }
  });

  socket.on('signal', (data) => {
    io.to(data.to).emit('signal', { from: socket.id, signal: data.signal });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    waitingUsers = waitingUsers.filter(user => user.socketId !== socket.id);
    io.emit('userDisconnected', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
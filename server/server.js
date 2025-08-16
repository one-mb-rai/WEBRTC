const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  cors: {
    origin: '*',
  }
});
const port = process.env.PORT || 3000;

const users = {}; // Stores { userId: { socketId: string, userName: string } }

app.use(express.static('www'));

io.on('connection', (socket) => {
  console.log('a user connected');

  const emitUserList = () => {
    const connectedUsers = Object.keys(users).map(id => ({
      id: id,
      name: users[id].userName
    }));
    console.log('Emitting users-updated:', connectedUsers);
    io.emit('users-updated', connectedUsers);
  };

  socket.on('register', ({ userId, userName }) => {
    console.log('Users before register:', users);
    users[userId] = { socketId: socket.id, userName: userName };
    console.log('registered user:', userId, 'with socket id:', socket.id, 'and name:', userName);
    console.log('Users after register:', users);
    emitUserList();
  });

  socket.on('disconnect', () => {
    console.log('Users before disconnect:', users);
    const disconnectedUserId = Object.keys(users).find(userId => users[userId].socketId === socket.id);
    if (disconnectedUserId) {
      delete users[disconnectedUserId];
      console.log('user disconnected:', disconnectedUserId);
      console.log('Users after disconnect:', users);
      emitUserList();
    }
  });

  socket.on('message', (message) => {
    console.log('message: ', message);
    const remoteSocketId = users[message.remoteUserId]?.socketId;
    if (remoteSocketId) {
      let senderUserId;
      for (let userId in users) {
        if (users[userId].socketId === socket.id) {
          senderUserId = userId;
          break;
        }
      }
      io.to(remoteSocketId).emit('message', { ...message, remoteUserId: senderUserId });
    } else {
      console.log('remote user not found');
    }
  });
});

http.listen(port, () => {
  console.log(`listening on *:${port}`);
});

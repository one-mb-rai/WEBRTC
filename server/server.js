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
    io.emit('users-updated', connectedUsers);
  };

  socket.on('register', ({ userId, userName }) => {
    users[userId] = { socketId: socket.id, userName: userName };
    console.log('registered user:', userId, 'with socket id:', socket.id, 'and name:', userName);
    emitUserList();
  });

  socket.on('disconnect', () => {
    for (let userId in users) {
      if (users[userId].socketId === socket.id) {
        delete users[userId];
        break;
      }
    }
    console.log('user disconnected');
    emitUserList();
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

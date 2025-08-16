const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http, {
  cors: {
    origin: '*',
  }
});
const port = process.env.PORT || 3000;

const users = {};

app.use(express.static('www'));

io.on('connection', (socket) => {
  console.log('a user connected');

  socket.on('register', (userId) => {
    users[userId] = socket.id;
    console.log('registered user:', userId, 'with socket id:', socket.id);
  });

  socket.on('disconnect', () => {
    for (let userId in users) {
      if (users[userId] === socket.id) {
        delete users[userId];
        break;
      }
    }
    console.log('user disconnected');
  });

  socket.on('message', (message) => {
    console.log('message: ', message);
    const remoteSocketId = users[message.remoteUserId];
    if (remoteSocketId) {
      let senderUserId;
      for (let userId in users) {
        if (users[userId] === socket.id) {
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

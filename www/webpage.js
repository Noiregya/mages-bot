const express = require('express');
const sock = require('socket.io')
const INDEX = 'index.html';
//const PORT = 3000;

const server = express()
  .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
  .listen(process.env.PORT, () => console.log(`Listening on ${ process.env.PORT }`));

  /*const io = socketIO(server);

  io.on('connection', (socket) => {
    console.log('Client connected');
    socket.on('disconnect', () => console.log('Client disconnected'));
  });

  setInterval(() => io.emit('time', new Date().toTimeString()), 1000);

  var socket = io();
  var el = document.getElementById('server-time');

  socket.on('time', function(timeString) {
    el.innerHTML = 'Server time: ' + timeString;
  });

  const wss = new SocketServer({ server });

  wss.on('connection', (ws) => {
    console.log('Client connected');
    ws.on('close', () => console.log('Client disconnected'));
  });

  setInterval(() => {
  wss.clients.forEach((client) => {
    client.send(new Date().toTimeString());
  });
}, 1000);

//const SocketServer = require('wss');
/*
var HOST = location.origin.replace(/^http/, 'ws')
var ws = new WebSocket(HOST);
var el = document.getElementById('server-time');

  ws.onmessage = function (event) {
    el.innerHTML = 'Server time: ' + event.data;
  };
*/

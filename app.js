var express = require('express');
// var routes = require('./routes');
var http = require('http');
var path = require('path');
var SHA256 = require("crypto-js/sha256");

var app = express();

app.use(express.static(path.join(__dirname, 'public')));

var httpServer = http.createServer(app).listen(process.env.PORT || 8080, function (req, res) {
    console.log('Socket IO server has been started');
});

// upgrade http server to socket.io server

var io = require('socket.io').listen(httpServer);

var peopleManage = {};
var peopleList = [];
var chatHistory = [];

function formatAMPM(date) {
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    minutes = minutes < 10 ? '0' + minutes : minutes;
    var strTime = ' [' + hours + ':' + minutes + ' ' + ampm + '] ';
    return strTime;
}

io.sockets.on('connection', function (socket) {
    socketAddress = socket.handshake.address.split(':');
    socketIP = socketAddress[socketAddress.length - 1];
    socketAddress = socketIP.split('.');
    socketAddress = socketAddress[0] + '.' + socketAddress[1];
    peopleManage[socketIP] = socketAddress;
    peopleList = Object.keys(peopleManage).map(function(key){
        return peopleManage[key];
    });

    socket.emit('toclient', { type: 'welcome', msg: formatAMPM(new Date()) + socketAddress + ' : ' + 'Welcome !', peopleList: peopleList });
    socket.on('fromclient', function (data) {
        data.msg = formatAMPM(new Date()) + socketAddress + ' : ' + data.msg;
        data.sender = 'other';
        socket.broadcast.emit('toclient', data); // 자신을 제외하고 다른 클라이언트에게 보냄
        data.sender = 'me';
        socket.emit('toclient', data); // 해당 클라이언트에게만 보냄. 다른 클라이언트에 보낼려면?
        console.log('Message from client :' + data.msg);
    })

    socket.on('disconnect', function () {
        socketAddress = socket.handshake.address.split(':');
        socketIP = socketAddress[socketAddress.length - 1];
        console.log('disconnection-' + socketIP);

        delete peopleManage[socketIP];
    })
});

// io.sockets.on('connection', function (socket) {socket.emit('toclient', { type: 'welcome', msg: 'Welcome !', peopleList: peopleList });
//     socket.on('fromclient', function (data) {
//         socket.broadcast.emit('toclient', data); // 자신을 제외하고 다른 클라이언트에게 보냄
//         socket.emit('toclient', data); // 해당 클라이언트에게만 보냄. 다른 클라이언트에 보낼려면?
//         console.log('Message from client :' + data.msg);
//     })

//     socket.on('disconnect', function () {
//         console.log('disconnection-');
//     })
// });
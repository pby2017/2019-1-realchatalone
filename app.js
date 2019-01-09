var dotenv = require('dotenv').config()
var express = require('express');
// var routes = require('./routes');
var http = require('http');
var path = require('path');
var SHA256 = require("crypto-js/sha256");

var nano = require('nano')(process.env.DB_URL);
const socketio_today = nano.use(process.env.DB_NAME);

var app = express();

app.use(express.static(path.join(__dirname, 'public')));

var httpServer = http.createServer(app).listen(process.env.PORT || 8080, function (req, res) {
    console.log('Socket IO server has been started');
});

// upgrade http server to socket.io server

var io = require('socket.io').listen(httpServer);

var onlinePeopleManage = {};
var todayPeopleManage = {};
var onlinePeopleList = [];
var todayPeopleList = [];
// 방문자랑 채팅 기록 1시간마다 저장하자. 그 전에는 DB값 + 현재 chatHistory 반환해주고
var chatHistory = [];
var totalVisited = 0;
var todayVisited = 0;

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

setInterval(function () {
    if (new Date().getHours === 0) {
        socketio_today.get(process.env.DB_DOC_NAME)
            .then((body) => {
                console.log('get today DOC ! \n', body);
                body.totalVisited = totalVisited;
                todayVisited = 0;
                todayPeopleManage = {};
                body.message = body.message.concat(chatHistory);
                chatHistory = [];

                // DB에 저장하는 코드 필요
                // socketio_today.insert({ people: onlinePeopleList }, process.env.DB_DOC_NAME)
                // .then((body) => {
                //     console.log('body ! \n',body);
                // });
            })
            .catch((err) => {
                console.log('get today DOC ERR !', err);
                if (err.error === 'not_found' && (err.reason === 'deleted' || err.reason === 'missing')) {
                    socketio_today.insert({ totalVisited: 0, message: [] }, process.env.DB_DOC_NAME)
                        .then((body) => {
                            console.log('there is not DB_DOC so new create!');
                        })
                        .catch((err) => {
                            console.log('insert today DOC ERR !', err);
                        });
                }
            });
    }
}, 3600000);

io.sockets.on('connection', function (socket) {
    totalVisited++;
    todayVisited++;

    socketAddress = socket.handshake.address.split(':');
    socketIP = socketAddress[socketAddress.length - 1];
    socketAddress = socketIP.split('.');
    socketAddress = socketAddress[0] + '.' + socketAddress[1];
    onlinePeopleManage[socketIP] = socketAddress;
    onlinePeopleList = Object.keys(onlinePeopleManage).map(function (key) {
        return onlinePeopleManage[key];
    });
    if (todayPeopleManage[socketIP] !== null) {
        todayPeopleManage[socketIP] = socketAddress;
    }
    todayPeopleList = Object.keys(todayPeopleManage).map(function (key) {
        return todayPeopleManage[key];
    });

    var welcomeChat = [formatAMPM(new Date()) + socketAddress + ' : ' + 'Welcome !'];

    socket.emit('toclient', {
        type: 'welcome',
        msg: welcomeChat.concat(chatHistory),
        onlinePeopleList: onlinePeopleList,
        todayPeopleList: todayPeopleList,
        totalVisited: totalVisited,
        todayVisited: todayVisited
    });
    socket.on('fromclient', function (data) {
        data.msg = formatAMPM(new Date()) + socketAddress + ' : ' + data.msg;
        data.sender = 'other';
        chatHistory.push(data.msg);
        socket.broadcast.emit('toclient', data); // 자신을 제외하고 다른 클라이언트에게 보냄
        data.sender = 'me';
        socket.emit('toclient', data); // 해당 클라이언트에게만 보냄. 다른 클라이언트에 보낼려면?
        console.log('Message from client :' + data.msg);
    })

    socket.on('disconnect', function () {
        socketAddress = socket.handshake.address.split(':');
        socketIP = socketAddress[socketAddress.length - 1];
        console.log('disconnection-' + socketIP);

        delete onlinePeopleManage[socketIP];
    })
});

// io.sockets.on('connection', function (socket) {socket.emit('toclient', { type: 'welcome', msg: 'Welcome !', onlinePeopleList: onlinePeopleList });
//     socket.on('fromclient', function (data) {
//         socket.broadcast.emit('toclient', data); // 자신을 제외하고 다른 클라이언트에게 보냄
//         socket.emit('toclient', data); // 해당 클라이언트에게만 보냄. 다른 클라이언트에 보낼려면?
//         console.log('Message from client :' + data.msg);
//     })

//     socket.on('disconnect', function () {
//         console.log('disconnection-');
//     })
// });
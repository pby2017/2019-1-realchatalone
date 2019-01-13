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
    console.log('new Date().getHours = ', new Date().getHours());
    if(new Date().getHours() === 23){
        console.log('good');
    }
    console.log(new Date().getHours,new Date().getHours.type);
    if (new Date().getHours() === 0) {
        socketio_today.get(process.env.DB_DOC_NAME, { revs_info: true })
            .then((body) => {
                console.log('get today DOC ! \n', body);

                // DB에 저장하는 코드 필요(이전 데이터랑 비교해서 변경사항이 있으면)
                if((totalVisited) => {
                    if (body.totalVisited !== totalVisited){
                        body.totalVisited = totalVisited;
                        return true;
                    }
                    return false;
                }){
                    socketio_today.insert({_id: process.env.DB_DOC_NAME, _rev: body._rev, totalVisited: totalVisited })
                    .then((body) => {
                        console.log('body ! \n',body);
                    });
                }
                // socketio_today.insert({ people: onlinePeopleList }, process.env.DB_DOC_NAME)
                // .then((body) => {
                //     console.log('body ! \n',body);
                // });

                todayVisited = 0;
                todayPeopleManage = {};
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
    console.log(socket.request.connection.remoteAddress);
    totalVisited++;
    todayVisited++;

    socketAddress = socket.handshake.address.split(':');
    socketIP = socketAddress[socketAddress.length - 1];
    socketAddress = socketIP.split('.');
    socketAddress = socketAddress[0] + '.' + 'x' + '.' + socketAddress[2] + '.' + socketAddress[3];
    onlinePeopleManage[socketIP] = socketAddress;
    onlinePeopleList = Object.keys(onlinePeopleManage).map(function (key) {
        return onlinePeopleManage[key];
    });
    if (todayPeopleManage[socketIP] === undefined) {
        console.log('when new member connect, add to today dictionary');
        todayPeopleManage[socketIP] = socketAddress;
    }
    todayPeopleList = Object.keys(todayPeopleManage).map(function (key) {
        return todayPeopleManage[key];
    });

    console.log('online people list - ', onlinePeopleList);
    console.log('today people list - ', todayPeopleList);

    var welcomeChat = [{
            time: formatAMPM(new Date()),
            addr: socketAddress,
            msg: 'Welcome !',
            id: 0
        }];

    socket.emit('toclient', {
        type: 'welcome',
        msg: chatHistory.concat(welcomeChat),
        onlinePeopleList: onlinePeopleList,
        todayPeopleList: todayPeopleList,
        totalVisited: totalVisited,
        todayVisited: todayVisited
    });
    socket.on('fromclient', function (data) {
        data.msg = {
            time: formatAMPM(new Date()),
            addr: socketAddress,
            msg: data.msg,
            id: (Object.keys(chatHistory).length+1)
        };
        data.sender = 'other';
        chatHistory.push(data.msg);
        socket.broadcast.emit('toclient', data); // 자신을 제외하고 다른 클라이언트에게 보냄
        data.sender = 'me';
        socket.emit('toclient', data); // 해당 클라이언트에게만 보냄. 다른 클라이언트에 보낼려면?
        console.log('Message from client :' + data.msg);
        console.log(chatHistory);
        console.log(data.msg.id);
    })

    socket.on('disconnect', function () {
        socketAddress = socket.handshake.address.split(':');
        socketIP = socketAddress[socketAddress.length - 1];
        console.log('disconnection-' + socketIP);

        delete onlinePeopleManage[socketIP];
    })
});
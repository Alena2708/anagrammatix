// Импорт модуля Express
var express = require('express');

// Импортируйте модуль 'path' (в комплекте с Node.js)
var path = require('path');

//Создать новый экземпляр Express
var app = express();

// Импортируйте файл игры Anagrammatix.
var agx = require('./agxgame');

// Создание простого экспресс-приложения
app.configure(function() {
    // Отключение ведения журнала
    app.use(express.logger('dev'));

    // Подавайте статические html, js, css и файлы изображений из каталога 'public'
    app.use(express.static(path.join(__dirname,'public')));
});

// Создайте http-сервер на основе Node.js на порт 8080
var server = require('http').createServer(app).listen(process.env.PORT || 8080);

// Создайте сервер Socket.IO и присоедините его к серверу http
var io = require('socket.io').listen(server);

// Уменьшите вывод журнала в Socket.IO
io.set('log level',1);

//  Socket.IO. После подключения запустите игровую логику.
io.sockets.on('connection', function (socket) {
    //console.log('client connected');
    agx.initGame(io, socket);
});



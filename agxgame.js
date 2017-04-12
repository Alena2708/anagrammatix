var io;
var gameSocket;

//Эта функция вызывается index.js для инициализации нового экземпляра игры
 
 // @param sio Библиотека Socket.IO
 //@param socket Объект сокета для подключенного клиента
 
exports.initGame = function(sio, socket){
    io = sio;
    gameSocket = socket;
    gameSocket.emit('connected', { message: "You are connected!" });

    //События в хостинге
    gameSocket.on('hostCreateNewGame', hostCreateNewGame);
    gameSocket.on('hostRoomFull', hostPrepareGame);
    gameSocket.on('hostCountdownFinished', hostStartGame);
    gameSocket.on('hostNextRound', hostNextRound);

    // События игрока
    gameSocket.on('playerJoinGame', playerJoinGame);
    gameSocket.on('playerAnswer', playerAnswer);
    gameSocket.on('playerRestart', playerRestart);
}


      //    Функции хоста        
   

 //Была нажата кнопка «START» и произошло событие «hostCreateNewGame»
 
function hostCreateNewGame() {
    // Создаем уникальную комнату Socket.IO
    var thisGameId = ( Math.random() * 100000 ) | 0;

    // Возвращаем ID комнаты (gameId) и идентификатор сокета (mySocketId) клиенту в  браузер
    this.emit('newGameCreated', {gameId: thisGameId, mySocketId: this.id});

    // Присоедияемя  к комнате и ждем игроков
    this.join(thisGameId.toString());
};


 // Два игрока присоединились
  // @param gameId ID игры / номер комнаты
 
function hostPrepareGame(gameId) {
    var sock = this;
    var data = {
        mySocketId : sock.id,
        gameId : gameId
    };
    //console.log("All Players Present. Preparing game...");
    io.sockets.in(data.gameId).emit('beginNewGame', data);
}


 //Обратный отсчет закончился, и игра начинается!
  //@param gameId ID игры / номер комнаты

function hostStartGame(gameId) {
    console.log('Game Started.');
    sendWord(0,gameId);
};


 //Игрок ответил правильно. Переходим к следующему слову
// @param data Отправленные  от клиента содержат текущий раунд и gameId (комната)
 
function hostNextRound(data) {
    if(data.round < wordPool.length ){
        // Отправляем новый набор слов  на хост и игроков
        sendWord(data.round, data.gameId);
    } else {
        // Если текущий раунд превышает количество слов, то событие «gameOver»
        io.sockets.in(data.gameId).emit('gameOver',data);
    }
}


/// Функции игрока

//Игрок нажал кнопку «START GAME».
  // Поробуем  подключиться  к комнате, которая соответствует
 // GameId, введенный игроком.
  // @param data Содержит данные, введенные через вход игрока - playerName и gameId.
function playerJoinGame(data) {
    //console.log('Player ' + data.playerName + 'attempting to join game: ' + data.gameId );

    // Ссылка на сокет игрока Socket.IO
    var sock = this;

    // Ищем идентификатор комнаты в объекте диспетчера Socket.IO
    var room = gameSocket.manager.rooms["/" + data.gameId];

    // Если такая комната существует
    if( room != undefined ){
        // Прикрепляем идентификатор сокета к объекту данных
        data.mySocketId = sock.id;

        // Присоединяемся к комнате
        sock.join(data.gameId);

        //console.log('Player ' + data.playerName + ' joining game: ' + data.gameId );

        // Уведомляем игрока о том, что он присоединился к комнате
        io.sockets.in(data.gameId).emit('playerJoinedRoom', data);

    } else {
        // В противном случае отправляем игроку  сообщение об ошибке 
        this.emit('error',{message: "This room does not exist."} );
    }
}


  ///Игрок выбрал слово в списке слов
  // @param data gameId
 
function playerAnswer(data) {
    // console.log('Player ID: ' + data.playerId + ' answered a question with: ' + data.answer);

    // Ответ игрока прикреплен к объекту данных 
     // Излучаем событие с ответом, чтобы его можно было проверить с помощью 'Host'
    io.sockets.in(data.gameId).emit('hostCheckAnswer', data);
}


  //Игра окончена, и игрок нажал кнопку, чтобы перезапустить игру.
  // @param data
 
function playerRestart(data) {
    // console.log('Player: ' + data.playerName + ' ready for new game.');

    // Исключите данные игрока от клиентов в игровой комнате.
    data.playerId = this.id;
    io.sockets.in(data.gameId).emit('playerJoinedRoom',data);
}

/// Логика игры


 //Получите слово для хоста и список слов для игрока
  // @param wordPoolIndex
 // @param gameId Идентификатор комнаты
 
function sendWord(wordPoolIndex, gameId) {
    var data = getWordData(wordPoolIndex);
    io.sockets.in(data.gameId).emit('newWordData', data);
}

/**
 * Эта функция делает всю работу по получению новых слов 
  *
  * @param i Индекс wordPool.
  * @returns {{round: *, word: *, answer: *, list: Array}}
 */
function getWordData(i){
   // Случайный порядок доступных слов.
     // Первый элемент в рандомизированном массиве будет отображаться на экране хоста
     // Второй элемент будет скрыт в списке ложных целей в качестве правильного ответа
    var words = shuffle(wordPool[i].words);

    // Выполним рандомизацию порядка слов"ловушек"" и выбираем первые 5
    var decoys = shuffle(wordPool[i].decoys).slice(0,5);

    // Выберите случайное место в списке ловушек, чтобы поставить правильный ответ
    var rnd = Math.floor(Math.random() * 5);
    decoys.splice(rnd, 0, words[1]);

    // Скомпануем слова в один объект
    var wordData = {
        round: i,
        word : words[0],   // Отобрааемые слова
        answer : words[1], // Правилный ответ
        list : decoys      //Список слов для игрока ("ловушки"" и ответ)
    };

    return wordData;
}

/*
 * Выполнение Javascript алгоритма тасования Фишера-Йейта
 * http://stackoverflow.com/questions/2450954/how-to-randomize-a-javascript-array
 */
function shuffle(array) {
    var currentIndex = array.length;
    var temporaryValue;
    var randomIndex;

    // Пока остаются элементы для перетасовки
    while (0 !== currentIndex) {

        // Выбираем оставшийся элемент
                randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // И меняем его с  текущим элементом
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

/**
 * Каждый элемент в массиве предоставляет данные для одного раунда в игре.
  *
  * В каждом раунде в качестве слова хоста и правильного ответа выбираются два случайных слова.
  * Пять случайных «ловушек» выбираются для составления списка, отображаемого игроку.
  * Правильный ответ случайным образом вставляется в список выбранных ложных целей.
 *
 * @type {Array}
 */
var wordPool = [
    {
        "words"  : [ "sale","seal","ales","leas" ],
        "decoys" : [ "lead","lamp","seed","eels","lean","cels","lyse","sloe","tels","self" ]
    },

    {
        "words"  : [ "item","time","mite","emit" ],
        "decoys" : [ "neat","team","omit","tame","mate","idem","mile","lime","tire","exit" ]
    },

    {
        "words"  : [ "spat","past","pats","taps" ],
        "decoys" : [ "pots","laps","step","lets","pint","atop","tapa","rapt","swap","yaps" ]
    },

    {
        "words"  : [ "nest","sent","nets","tens" ],
        "decoys" : [ "tend","went","lent","teen","neat","ante","tone","newt","vent","elan" ]
    },

    {
        "words"  : [ "pale","leap","plea","peal" ],
        "decoys" : [ "sale","pail","play","lips","slip","pile","pleb","pled","help","lope" ]
    },

    {
        "words"  : [ "races","cares","scare","acres" ],
        "decoys" : [ "crass","scary","seeds","score","screw","cager","clear","recap","trace","cadre" ]
    },

    {
        "words"  : [ "bowel","elbow","below","beowl" ],
        "decoys" : [ "bowed","bower","robed","probe","roble","bowls","blows","brawl","bylaw","ebola" ]
    },

    {
        "words"  : [ "dates","stead","sated","adset" ],
        "decoys" : [ "seats","diety","seeds","today","sited","dotes","tides","duets","deist","diets" ]
    },

    {
        "words"  : [ "spear","parse","reaps","pares" ],
        "decoys" : [ "ramps","tarps","strep","spore","repos","peris","strap","perms","ropes","super" ]
    },

    {
        "words"  : [ "stone","tones","steno","onset" ],
        "decoys" : [ "snout","tongs","stent","tense","terns","santo","stony","toons","snort","stint" ]
    }
]
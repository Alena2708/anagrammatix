;
jQuery(function($){    
    'use strict';

    /**
      Весь код, относящийся к Socket.IO, собирается в пространстве имен IO.
     
      @type {{init: Function, bindEvents: Function, onConnected: Function, onNewGameCreated: Function, playerJoinedRoom: Function, beginNewGame: Function, onNewWordData: Function, hostCheckAnswer: Function, gameOver: Function, error: Function}}
     */
    var IO = {

        /**
          Вызывается, когда страница отображается. Он соединяет клиент Socket.IO
           На сервер Socket.IO
         */
        init: function() {
            IO.socket = io.connect();
            IO.bindEvents();
        },

        /**
          При подключении Socket.IO будет слушать следующие события:
           На сервере Socket.IO, затем запустите соответствующую функцию.
         */
        bindEvents : function() {
            IO.socket.on('connected', IO.onConnected );
            IO.socket.on('newGameCreated', IO.onNewGameCreated );
            IO.socket.on('playerJoinedRoom', IO.playerJoinedRoom );
            IO.socket.on('beginNewGame', IO.beginNewGame );
            IO.socket.on('newWordData', IO.onNewWordData);
            IO.socket.on('hostCheckAnswer', IO.hostCheckAnswer);
            IO.socket.on('gameOver', IO.gameOver);
            IO.socket.on('error', IO.error );
        },

        /**
        Клиент успешно подключен
         */
        onConnected : function() {
            // Кэшировать копию идентификатора сеанса socket.IO клиента в приложении.
            App.mySocketId = IO.socket.socket.sessionid;
            // console.log(data.message);
        },

        /**
         * Создана новая игра и создан случайный идентификатор игры
         * @param data {{ gameId: int, mySocketId: * }}
         */
        onNewGameCreated : function(data) {
            App.Host.gameInit(data);
        },

        /**
         * Игрок успешно присоединился к игре
         * @param data {{playerName: string, gameId: int, mySocketId: int}}
         */
        playerJoinedRoom : function(data) {
            // Когда игрок присоединяется к комнате, выполните функцию updateWaitingScreen.
             // Существует две версии этой функции: одна для «хоста» и
             // другая для «игрока».
             //
             // Итак, в окне браузера «host» вызывается функция App.Host.updateWiatingScreen.
             // И в браузере игрока вызывается App.Player.updateWaitingScreen.
            App[App.myRole].updateWaitingScreen(data);
        },

        /**
         * Оба игрока присоединились к игре
         * @param data
         */
        beginNewGame : function(data) {
            App[App.myRole].gameCountdown(data);
        },

        /**
         * Новый набор слов для раунда возвращается с сервера
         * @param data
         */
        onNewWordData : function(data) {
            // Обновить текущий раунд
            App.currentRound = data.round;

            // Изменение слов на эране игрока
                        App[App.myRole].newWord(data);
        },

        /**
         * Игрок ответил,проверяем ответ.
         * @param data
         */
        hostCheckAnswer : function(data) {
            if(App.myRole === 'Host') {
                App.Host.checkAnswer(data);
            }
        },

        /**
         * Оповещаем игра окончена.
         * @param data
         */
        gameOver : function(data) {
            App[App.myRole].endGame(data);
        },

        /**
         * Произошла ошибка
         * @param data
         */
        error : function(data) {
            alert(data.message);
        }

    };

    var App = {

        /**
         * Следите за идентификатором gameId, который идентичен ID
          * Комнаты Socket.IO, используемой для игроков и хоста для связи
         *
         */
        gameId: 0,

        /**
         * Это используется для различия между браузерами «Host» и «Player».
         */
        myRole: '',   // 'Player' or 'Host'

        /**
         * Идентификатор объекта сокета Socket.IO  уникален для
          * Каждого игрок и хоста. Он генерируется, когда браузер изначально
          * Подключается к серверу, когда страница загружается в первый раз.
         */
        mySocketId: '',

        /**
         * Определяет текущий раунд. Начинается с 0, поскольку соответствует
          *  массиув текстовых данных, хранящихся на сервере.
         */
        currentRound: 0,

  
//Настройки
        /**
         * Когда страница загружается.
         */
        init: function () {
            App.cacheElements();
            App.showInitScreen();
            App.bindEvents();

            // Инициализировать библиотеку fastclick
            FastClick.attach(document.body);
        },

        /**
         * Создавайте ссылки на экранные элементы, используемые в игре.
         */
        cacheElements: function () {
            App.$doc = $(document);

            // Шаблоны
            App.$gameArea = $('#gameArea');
            App.$templateIntroScreen = $('#intro-screen-template').html();
            App.$templateNewGame = $('#create-game-template').html();
            App.$templateJoinGame = $('#join-game-template').html();
            App.$hostGame = $('#host-game-template').html();
        },

        /**
         *Создайте несколько обработчиков щелчков для различных кнопок, отображаемых на экране
         */
        bindEvents: function () {
            // Хост
            App.$doc.on('click', '#btnCreateGame', App.Host.onCreateClick);

            // Игрок
            App.$doc.on('click', '#btnJoinGame', App.Player.onJoinClick);
            App.$doc.on('click', '#btnStart',App.Player.onPlayerStartClick);
            App.$doc.on('click', '.btnAnswer',App.Player.onPlayerAnswerClick);
            App.$doc.on('click', '#btnPlayerRestart', App.Player.onPlayerRestart);
        },

 //Логика игры

        /**
         * Показать начальный экран заголовка Anagrammatix
          * (С кнопками «Создать» и «Войти»)
         */
        showInitScreen: function() {
            App.$gameArea.html(App.$templateIntroScreen);
            App.doTextFit('.title');
        },


       //Хост
        Host : {

            /**
             *Содержит ссылки на данные игрока
             */
            players : [],

            /**
             *Флаг, указывающий, начинается ли новая игра.
              * Это используется после окончания первой игры, и игроки начинают новую игру
              * Без обновления окон браузера.
             */
            isNewGame : false,

            /**
             *Следим за количеством игроков, присоединившихся к игре.
             */
            numPlayersInRoom: 0,

            /**
             *Ссылка на правильный ответ  текущего раунда.
             */
            currentCorrectAnswer: '',

            /**
             * Обработчик для кнопки «Старт» на экране заголовка.
             */
            onCreateClick: function () {
                // console.log('Clicked "Create A Game"');
                IO.socket.emit('hostCreateNewGame');
            },

            /**
             * Экран Host отображается в первый раз.
             * @param data{{ gameId: int, mySocketId: * }}
             */
            gameInit: function (data) {
                App.gameId = data.gameId;
                App.mySocketId = data.mySocketId;
                App.myRole = 'Host';
                App.Host.numPlayersInRoom = 0;

                App.Host.displayNewGameScreen();
                // console.log("Game started with ID: " + App.gameId + ' by host: ' + App.mySocketId);
            },

            /**
             * Показать экран хоста, содержащий URL игры и уникальный идентификатор игры
             */
            displayNewGameScreen : function() {
                // Заполните игровой экран соответствующим HTML-кодом.
                App.$gameArea.html(App.$templateNewGame);

                // Отображение URL на экране
                $('#gameURL').text(window.location.href);
                App.doTextFit('#gameURL');

                // Показать идентификатор игры / комнаты на экране
                $('#spanNewGameCode').text(App.gameId);
            },

            /**
             * Обновление экрана хоста, когда первый игрок присоединяется
             * @param data{{playerName: string}}
             */
            updateWaitingScreen: function(data) {
                // Если это перезапущенная игра, покажите экран.
                if ( App.Host.isNewGame ) {
                    App.Host.displayNewGameScreen();
                }
                //Обновить экран хоста
                $('#playersWaiting')
                    .append('<p/>')
                    .text('Игрок ' + data.playerName + ' присоеденился к игрe.');

                //Сохраните данные нового игрока на хосте.
                App.Host.players.push(data);

                // Увеличивает количество игроков в комнате
                App.Host.numPlayersInRoom += 1;

                // Если два игрока присоединились, начните игру!
                if (App.Host.numPlayersInRoom === 2) {
                    // console.log('Room is full. Almost ready!');

                    // Пусть сервер знает, что присутствуют два игрока.
                    IO.socket.emit('hostRoomFull',App.gameId);
                }
            },

            /**
             * Показать экран обратного отсчета
             */
            gameCountdown : function() {

                //Подготовьте игровой экран с новым HTML-кодом.
                App.$gameArea.html(App.$hostGame);
                App.doTextFit('#hostWord');

                // Начните отсчет времени на экране
                var $secondsLeft = $('#hostWord');
                App.countDown( $secondsLeft, 5, function(){
                    IO.socket.emit('hostCountdownFinished', App.gameId);
                });

                // Отображение имен игроков на экране
                $('#player1Score')
                    .find('.playerName')
                    .html(App.Host.players[0].playerName);

                $('#player2Score')
                    .find('.playerName')
                    .html(App.Host.players[1].playerName);

                // Установите для раздела «Оценка» на экране значение 0 для каждого игрока.
                $('#player1Score').find('.score').attr('id',App.Host.players[0].mySocketId);
                $('#player2Score').find('.score').attr('id',App.Host.players[1].mySocketId);
            },

            /**
             * Покажите слово для текущего раунда на экране.
             * @param data{{round: *, word: *, answer: *, list: Array}}
             */
            newWord : function(data) {
                // Вставить новое слово 
                $('#hostWord').text(data.word);
                App.doTextFit('#hostWord');

                // Обновить данные для текущего раунда
                App.Host.currentCorrectAnswer = data.answer;
                App.Host.currentRound = data.round;
            },

            /**
             * Проверьте ответ, нажатый игроком.
             * @param data{{round: *, playerId: *, answer: *, gameId: *}}
             */
            checkAnswer : function(data) {
                // Убедитесь, что ответ нажат на текущий раунд.
                 // Это предотвращает «поздний вход» от игрока, у которого на экране нет
                 // еще обновленный до текущего раунда.
                if (data.round === App.currentRound){

                    //Получить счет игрока
                    var $pScore = $('#' + data.playerId);

                    // Счет  игрока, если ответ правильный
                    if( App.Host.currentCorrectAnswer === data.answer ) {
                        // Добавить 5 к счету игрока
                        $pScore.text( +$pScore.text() + 5 );

                        // След. раунд
                        App.currentRound += 1;

                        // Подготовьте данные для отправки на сервер
                        var data = {
                            gameId : App.gameId,
                            round : App.currentRound
                        }

                        // Сообщите серверу о начале следующего раунда.
                        IO.socket.emit('hostNextRound',data);

                    } else {
                        // Был представлен неверный ответ, поэтому уменьшите счет игрока.
                        $pScore.text( +$pScore.text() - 3 );
                    }
                }
            },


            /**
             *Все 10 раундов разыгрались. Закончить игру.
             * @param data
             */
            endGame : function(data) {
                // Получить данные для игрока 1 с экрана хоста
                var $p1 = $('#player1Score');
                var p1Score = +$p1.find('.score').text();
                var p1Name = $p1.find('.playerName').text();

                //Получить данные для игрока 2 с экрана хоста
                var $p2 = $('#player2Score');
                var p2Score = +$p2.find('.score').text();
                var p2Name = $p2.find('.playerName').text();

                // Найдите победителя по результатам
                var winner = (p1Score < p2Score) ? p2Name : p1Name;
                var tie = (p1Score === p2Score);

                //Отображение победителя (или связанного игрового сообщения)
                if(tie){
                    $('#hostWord').text("Ничья!");
                } else {
                    $('#hostWord').text( winner + ' Победил!!' );
                }
                App.doTextFit('#hostWord');

                // Сброс игровых данных
                App.Host.numPlayersInRoom = 0;
                App.Host.isNewGame = true;
            },

            /**
             * Игрок нажимает кнопку «Начать снова» после окончания игры.
             */
            restartGame : function() {
                App.$gameArea.html(App.$templateNewGame);
                $('#spanNewGameCode').text(App.gameId);
            }
        },


     //Код дял игрока

        Player : {

            /**
             * Ссылка на идентификатор сокета хоста
             */
            hostSocketId: '',

            /**
             * Имя игрока введено на экране «Войти».
             */
            myName: '',

            /**
             * Обработчик кликов для кнопки «Создать»
             */
            onJoinClick: function () {
                // console.log('Clicked "Join A Game"');

                // Отобразите HTML-код Join Game на экране проигрывателя.
                App.$gameArea.html(App.$templateJoinGame);
            },

            /**
             * Игрок ввел свое имя и gameId (надеюсь)
              * И нажал «Старт».
             */
            onPlayerStartClick: function() {
                // console.log('Player clicked "Start"');

                // Собирать данные для отправки на сервер
                var data = {
                    gameId : +($('#inputGameId').val()),
                    playerName : $('#inputPlayerName').val() || 'anon'
                };

                // Отправить gameId и playerName на сервер
                IO.socket.emit('playerJoinGame', data);

                // SИ соответствующие свойства для текущего игрока.
                App.myRole = 'Player';
                App.Player.myName = data.playerName;
            },

            /**
             *  Щелкните обработчик, чтобы игрок попал в слово в слове.
             */
            onPlayerAnswerClick: function() {
                // console.log('Clicked Answer Button');
                var $btn = $(this);      // Нажатие на кнопку
                var answer = $btn.val(); //Выбор слова

                // Отправьте информацию о игроке и прослушанное слово на сервер, чтобы
                 // хост может проверить ответ.
                var data = {
                    gameId: App.gameId,
                    playerId: App.mySocketId,
                    answer: answer,
                    round: App.currentRound
                }
                IO.socket.emit('playerAnswer',data);
            },

            /**
             * Обработчик щелчка для кнопки «Начать снова», которая появляется
              * Когда игра окончена.
             */
            onPlayerRestart : function() {
                var data = {
                    gameId : App.gameId,
                    playerName : App.Player.myName
                }
                IO.socket.emit('playerRestart',data);
                App.currentRound = 0;
                $('#gameArea').html("<h3>Ожидание  для запуска новой игры.</h3>");
            },

            /**
             * Отображение экрана ожидания для игрока 1
             * @param data
             */
            updateWaitingScreen : function(data) {
                if(IO.socket.socket.sessionid === data.mySocketId){
                    App.myRole = 'Player';
                    App.gameId = data.gameId;

                    $('#playerWaitingMessage')
                        .append('<p/>')
                        .text('Присоединенная игра ' + data.gameId + '.Пожалуйста, подождите, пока игра начнется.');
                }
            },

            /**
             *Отобразите «Get Ready», пока таймер обратного отсчета тикает 
             * @param hostData
             */
            gameCountdown : function(hostData) {
                App.Player.hostSocketId = hostData.mySocketId;
                $('#gameArea')
                    .html('<div class="gameOver">Начнем!</div>');
            },

            /**
             * Показать список слов для текущего раунда.
             * @param data{{round: *, word: *, answer: *, list: Array}}
             */
            newWord : function(data) {
                // Создать элемент неупорядоченного списка
                var $list = $('<ul/>').attr('id','ulAnswers');

                //Вставить элемент списка для каждого слова в списке слов
                 // получен с сервера.
                $.each(data.list, function(){
                    $list                                //  <ul> </ul>
                        .append( $('<li/>')              //  <ul> <li> </li> </ul>
                            .append( $('<button/>')      //  <ul> <li> <button> </button> </li> </ul>
                                .addClass('btnAnswer')   //  <ul> <li> <button class='btnAnswer'> </button> </li> </ul>
                                .addClass('btn')         //  <ul> <li> <button class='btnAnswer'> </button> </li> </ul>
                                .val(this)               //  <ul> <li> <button class='btnAnswer' value='word'> </button> </li> </ul>
                                .html(this)              //  <ul> <li> <button class='btnAnswer' value='word'>word</button> </li> </ul>
                            )
                        )
                });

                // Вставьте список на экран.
                $('#gameArea').html($list);
            },

            /**
             * Покажите экран «Game Over».
             */
            endGame : function() {
                $('#gameArea')
                    .html('<div class="gameOver">Игра окончена!</div>')
                    .append(
                        // Create a button to start a new game.
                        $('<button>Еще одна игра</button>')
                            .attr('id','btnPlayerRestart')
                            .addClass('btn')
                            .addClass('btnGameOver')
                    );
            }
        },


        

    /**
          * Отображение таймера обратного отсчета на экране хоста
          *
          * @param $ el Элемент контейнера для таймера обратного отсчета
          * @param startTime
          * @param callback Функция, вызываемая при завершении таймера.
         */
        countDown : function( $el, startTime, callback) {

            // Отображение времени начала на экране.
            $el.text(startTime);
            App.doTextFit('#hostWord');

            // console.log('Starting Countdown...');

            // Запуск таймера 1 секунда
            var timer = setInterval(countItDown,1000);

            // Уменьшение отображаемого значения таймера на каждом тике
            function countItDown(){
                startTime -= 1
                $el.text(startTime);
                App.doTextFit('#hostWord');

                if( startTime <= 0 ){
                    // console.log('Countdown Finished.');

                    // Остановите таймер и выполните обратный вызов.
                    clearInterval(timer);
                    callback();
                    return;
                }
            }

        },

        /**
         * Сделать текст внутри данного элемента как можно большим
         * See: https://github.com/STRML/textFit
         *
         * @param elРодительский элемент текста
         */
        doTextFit : function(el) {
            textFit(
                $(el)[0],
                {
                    alignHoriz:true,
                    alignVert:false,
                    widthOnly:true,
                    reProcess:true,
                    maxFontSize:300
                }
            );
        }

    };

    IO.init();
    App.init();

}($));

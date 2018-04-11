// activate vscode code completion, remove eslint error
if (false) {
    var $ = require('jquery');
    var io = require('socket.io')();
    var createjs = require('easeljs');
}

const global = {
    // Keys and other mathematical constants
    KEY_ESC: 27,
    KEY_ENTER: 13,
    KEY_CHAT: 13,
    KEY_FIREFOOD: 119,
    KEY_SPLIT: 32,
    KEY_LEFT: 37,
    KEY_UP: 38,
    KEY_RIGHT: 39,
    KEY_DOWN: 40,
    borderDraw: false,
    spin: -Math.PI,
    enemySpin: -Math.PI,
    mobile: false,
    foodSides: 10,
    virusSides: 20,

    // Canvas
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    gameWidth: 0,
    gameHeight: 0,
    gameStart: false,
    disconnected: false,
    died: false,
    kicked: false,
    continuity: false,
    startPingTime: 0,
    toggleMassState: 0,
    backgroundColor: '#f2fbff',
    lineColor: '#000000',
};

// 开全局便于debug
const socket = io();

let cameraMain = {
    x: 0,
    y: 0,
    screenX: global.screenWidth / 2,
    screenY: global.screenHeight / 2,
};
let me = null;
let users = [];
let target = null;
let targetStar = null;
let targetLine = null;
let offset = { x: 0, y: 0 };
// mouseMode:{0: moving, 1:fireball}
let mouseMode = 0;


let c = null;
let graph = null;
let stage = null;
let fireballButton = null;

let lines = [];
let circle = [];
let userCircle = [];
let nicknameText = [];
let HPs = [];
let touchBoard = null;
let defenceArea = { x: 0, y: 0, height: 0, width: 0 };
let gameAreaShape = null;
let defenceAreaShape = null;

const resize = () => {
    global.screenWidth = window.innerWidth;
    global.screenHeight = window.innerHeight;
    if (stage) {
        stage.canvas.width = global.screenWidth;
        stage.canvas.height = global.screenHeight;
        stage.canvas.x = 0;
        stage.canvas.y = 0;
    }
    cameraMain.screenX = global.screenWidth / 2;
    cameraMain.screenY = global.screenHeight / 2;

    //添加形状实例到舞台显示列表
    //更新阶段将呈现下一帧
    // stage.update();
};

window.addEventListener('resize', resize);

const main = (room) => {
    $('#login-form').submit(() => {
        $('#login-failed').text('');
        $('#login-submit').attr('disabled', true);

        socket.emit('req_login', {
            username: $('#nickname').val(),
            password: null // 暂无注册登入
        });

        return false;
    });

    const toScreenPos = (point) => {
        return {
            x: point.x - cameraMain.x + cameraMain.screenX,
            y: point.y - cameraMain.y + cameraMain.screenY,
        };
    };
    const toGlobalPos = (point) => {
        return {
            x: point.x + cameraMain.x - cameraMain.screenX,
            y: point.y + cameraMain.y - cameraMain.screenY,
        };
    };

    // 画背景网格
    const drawGrid = () => {
        let x = offset.x - me.x;
        let y = offset.y - me.y;
        while (x > 0) x -= global.screenWidth;
        while (y > 0) y -= global.screenHeight;
        lines[0].graphics.c();
        lines[1].graphics.c();
        for (; x < global.screenWidth; x += global.screenWidth / 25) {
            lines[0].graphics.setStrokeStyle(3).beginStroke('#33333333').moveTo(x, 0).lineTo(x, global.gameHeight);
        }
        for (; y < global.screenWidth; y += global.screenWidth / 25) {
            lines[1].graphics.setStrokeStyle(3).beginStroke('#33333333').moveTo(0, y).lineTo(global.screenWidth, y);
        }
    };
    //stage的自动刷新
    const handleTicker = () => {
        if (global.gameStart) {
            // stage.removeAllChildren();

            cameraMain.x = me.x;
            cameraMain.y = me.y;

            gameAreaShape.graphics.c();
            gameAreaShape.graphics.setStrokeStyle(5, 1)
                .beginStroke('#8B3A3ADD')
                .beginFill('#B2222299')
                .drawRect(toScreenPos({ x: 0, y: 0 }).x, toScreenPos({ x: 0, y: 0 }).y, global.gameWidth, global.gameHeight);

            drawGrid();

            targetLine.graphics.c();
            targetLine.graphics.setStrokeDash([20, 10])
                .setStrokeStyle(5, 1)
                .beginStroke('#aaaaaa')
                .moveTo(toScreenPos(target).x, toScreenPos(target).y)
                .lineTo(cameraMain.screenX, cameraMain.screenY);

            targetStar.graphics.c();
            targetStar.graphics.setStrokeStyle(3, 1)
                .beginStroke('22AA22').
                beginFill('#00EE22')
                .drawPolyStar(toScreenPos(target).x, toScreenPos(target).y, 20, 3, 0.7, 90);

            users.forEach((user, index) => {
                user.screenX = toScreenPos(user).x;
                user.screenY = toScreenPos(user).y;
                circle[index].graphics.c();
                circle[index].graphics.setStrokeStyle(4, 1)
                    .beginStroke('black').
                    beginFill(user.color).
                    drawCircle(user.screenX, user.screenY, user.radius);

                nicknameText[index].text = user.nickname;
                nicknameText[index].font = 'bold 25px Arial';
                nicknameText[index].textAlign = 'centor';
                nicknameText[index].x = user.screenX - 20;
                nicknameText[index].y = user.screenY - 10;
                nicknameText[index].textBaseline = 'middle';

                HPs[index].text = 'HP: ' + Math.ceil(user.HP);
                HPs[index].font = '15px Arial';
                HPs[index].textAlign = 'centor';
                HPs[index].x = user.screenX - 20;
                HPs[index].y = user.screenY + 10;
                HPs[index].textBaseline = 'middle';
            });

            defenceAreaShape.graphics.c();
            defenceAreaShape.graphics.setStrokeStyle(5, 1)
                .beginStroke('#00C5CDAA')
                .beginFill('#BBFFFF33')
                .drawRect(toScreenPos(defenceArea).x, toScreenPos(defenceArea).y, defenceArea.width, defenceArea.height);


            touchBoard.graphics.c();
            touchBoard.graphics.beginFill('#11111111')
                .drawRect(0, 0, global.gameWidth, global.gameHeight);

            stage.update();
        }
    };
    createjs.Ticker.setFPS(30);
    createjs.Ticker.addEventListener('tick', handleTicker);

    // events
    const mouseDownEvent = event => {
        target = toGlobalPos({ x: event.stageX, y: event.stageY });
        if (mouseMode === 0) // mouseMode === 'moveing'
            socket.emit('c_moveClick', { target: target });
        else if (mouseMode === 1) // mouseMode === 'fireball'
            socket.emit('c_fireballClick', { target: target });
    };

    socket.on('res_login', (args) => {
        if (args.status === 'succeed') {
            me = args.me;
            // 获取初始的相对位置补偿以确定网格坐标
            offset = { x: me.x, y: me.y };
            target = me.target;

            $('#login-failed').text('');
            $('#login-submit').attr('disabled', true);

            socket.emit('req_join', {
                roomId: null // 由服务器安排
            });

            $('#view-login').slideUp('normal');
        } else if (args.status === 'duplicate') {
            $('#login-failed').text('该昵称已存在');
            $('#login-submit').removeAttr('disabled');
        } else if (args.status === 'toolong') {
            $('#login-failed').text('昵称应少于20个字符');
            $('#login-submit').removeAttr('disabled');
        }
    });

    socket.on('res_join', (args) => {
        if (args.status === 'succeed') {
            me = args.me;
            $('#view-room').slideDown('normal');
        } else if (args.status === 'running') {
            alert('房间游戏中');
        } else if (args.status === 'full') {
            alert('房间已满');
        } else if (args.status === 'nonexistent') {
            alert('房间不存在');
        }
    });

    $('#room-form').submit(() => {
        socket.emit('c_chat', {
            message: $('#room-input').val()
        });
        $('#room-input').val('');
        $('#room-input').focus();
        return false;
    });

    socket.on('s_chat', (args) => {
        room.chat(args.user, args.message);
    });

    $('#room-start').click(() => {
        socket.emit('c_start', {});
    });

    socket.on('s_start', (args) => {
        // alert('游戏开始！');
        $('#view-room').slideUp('normal');
        global.gameWidth = args.gameWidth;
        global.gameHeight = args.gameHeight;

        $('#view-canvas').slideDown('normal');
        stage = new createjs.Stage('cvs');

        //移动端的点击支持
        createjs.Touch.enable(stage);

        stage.addEventListener('mousedown', mouseDownEvent);

        lines.push(new createjs.Shape());
        lines.push(new createjs.Shape());
        gameAreaShape = new createjs.Shape();
        targetLine = new createjs.Shape();
        targetStar = new createjs.Shape();
        for (let i = 0; i < 8; ++i) {
            userCircle.push(new createjs.Container());
            circle.push(new createjs.Shape());
            nicknameText.push(new createjs.Text());
            HPs.push(new createjs.Text());
            userCircle[i].addChild(circle[i], nicknameText[i], HPs[i]);
        }
        defenceAreaShape = new createjs.Shape();
        touchBoard = new createjs.Shape();

        stage.addChild(...lines, gameAreaShape, targetLine,
            targetStar, ...userCircle, defenceAreaShape, touchBoard);

        fireballButton = new createjs.Shape();
        fireballButton.graphics.setStrokeStyle(4, 1)
            .beginStroke('#000000')
            .beginFill('#FF2222')
            .drawCircle(global.screenWidth / 4,
                global.screenHeight / 4,
                Math.min(global.screenWidth / 4, global.screenHeight / 4 - 10));

        window.canvas = stage.canvas;
        c = window.canvas;
        graph = c.getContext('2d');

        resize();
        global.gameStart = true;
    });

    // 服务器帧
    socket.on('frame', (args) => {
        users = args.users;
        defenceArea = args.defenceArea;
        users.forEach(user => {
            if (global.gameStart && user.id === me.id) {
                me = user;
            }
        });
        room.update(users, me);
    });
};

require.config({
    baseUrl: 'js/lib'
})(['domReady', 'polyfill', 'room'],
    (domReady, polyfill, room) => {
        domReady(() => {
            polyfill();
            main(room);
        });
    });



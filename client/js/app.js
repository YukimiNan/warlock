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

let c = null;
let graph = null;
let stage = null;
let offset = { x: 0, y: 0 };

let lines = [];
let circle = null;
let touchBoard = null;

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

    lines = [];
    //添加形状实例到舞台显示列表
    //更新阶段将呈现下一帧
    // stage.update();
}

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

    // 画背景网格
    const drawGrid = () => {
        lines = [];
        let x = offset.x - me.x;
        let y = offset.y - me.y;
        while (x > 0) x -= global.screenWidth;
        while (y > 0) y -= global.screenHeight;
        for (; x < global.screenWidth; x += global.screenWidth / 25 ) {
            lines.push(new createjs.Shape());
            let i = lines.length - 1;
            lines[i].graphics.setStrokeStyle(3).beginStroke('#33333333').moveTo(x, 0).lineTo(x, global.gameHeight);
            stage.addChild(lines[i]);
        }
        for (; y < global.screenWidth; y += global.screenWidth / 25 ) {
            lines.push(new createjs.Shape());
            let i = lines.length - 1;
            lines[i].graphics.setStrokeStyle(3).beginStroke('#33333333').moveTo(0, y).lineTo(global.screenWidth, y);
            stage.addChild(lines[i]);
        }
        let pointAround = [[0, 0], [0, global.gameHeight], [global.gameWidth, 0], [global.gameWidth, global.gameHeight]];
        pointAround.forEach(p => {
            lines.push(new createjs.Shape());

        });

    }
    //stage的自动刷新
    const handleTicker = () => {
        if (global.gameStart) {
            stage.removeAllChildren();

            cameraMain.x = me.x;
            cameraMain.y = me.y;
            drawGrid();

            targetStar = new createjs.Shape();
            targetStar.graphics.setStrokeDash([20, 10]).setStrokeStyle(5, 1).beginStroke('#aaaaaa').moveTo(cameraMain.screenX, cameraMain.screenY).lineTo(target.x - cameraMain.x + cameraMain.screenX, target.y - cameraMain.y + cameraMain.screenY);
            stage.addChild(targetStar);

            targetStar = new createjs.Shape();
            targetStar.graphics.beginStroke("22AA22").beginFill('#00EE22').drawPolyStar(target.x - cameraMain.x + cameraMain.screenX, target.y - cameraMain.y + cameraMain.screenY, 20, 3, 0.7, 90);
            stage.addChild(targetStar);

            users.forEach(user => {
                user.screenX = user.x - cameraMain.x + cameraMain.screenX;
                user.screenY = user.y - cameraMain.y + cameraMain.screenY;
                circle = new createjs.Shape();
                circle.graphics.beginStroke("black").beginFill(user.color).drawCircle(user.screenX, user.screenY, user.radius);

                stage.addChild(circle);
            });
            touchBoard = new createjs.Shape();
            touchBoard.graphics.beginFill('#11111111').drawRect(0, 0, global.gameWidth, global.gameHeight);
            stage.addChild(touchBoard);
            
            stage.update();
        }
    }
    // createjs.Ticker.setFPS(30);
    createjs.Ticker.addEventListener("tick", handleTicker);

    const mouseDownEvent = event => {
        target = { x: event.stageX - cameraMain.screenX + cameraMain.x, y: event.stageY - cameraMain.screenY + cameraMain.y };
        socket.emit('c_moveClick', { target: target });
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
        stage = new createjs.Stage("cvs");

        //移动端的点击支持
        createjs.Touch.enable(stage);

        stage.addEventListener("mousedown", mouseDownEvent);
        window.canvas = stage.canvas;
        c = window.canvas;
        graph = c.getContext('2d');

        resize();
        global.gameStart = true;
    });

    // 服务器帧
    socket.on('frame', (args) => {
        users = args.users;
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



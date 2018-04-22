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

let totalusernum = null;
let aliveusernum = null;
let me = null;
let users = [];
let target = null;
let targetStar = null;
let targetLine = null;
let offset = { x: 0, y: 0 };
// mouseMode:{-1: moving, else:skill(0: fireball, 1: blink)}
let mouseMode = -1;


let c = null;
let graph = null;
let stage = null;
let fireballButton = null;

let lines = [];
let circle = [];
let userCircle = [];
let skillCircle = [];
let nicknameText = [];
let HPs = [];
let skills = [];
let beforeskill = null;
let touchBoard = null;
let defenceArea = { x: 0, y: 0, height: 0, width: 0 };
let gameAreaShape = null;
let defenceAreaShape = null;

let Boards = null;
let userBoard = null;
let userHPs = [];
let usernames_hp = [];
let zi_wanjiabang = null;
let zi_wanjiaming_hp = null;
let zi_shengming = null;

let scoreBoard = null;
let usernames_score = [];
let userscores = [];
let zi_jifenbang = null;
let zi_wanjiaming_score = null;
let zi_jifeng = null;

let zi_shengyuwanjiashu = null;



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
    // cameraMain.screenX = 12000;
    // cameraMain.screenY = 12000;

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
        for (; x < global.screenWidth; x += global.screenWidth / 10) {
            lines[0].graphics.setStrokeStyle(3)
                .beginStroke('#33333333')
                .moveTo(x, 0)
                .lineTo(x, global.gameHeight);
        }
        for (; y < global.screenWidth; y += global.screenWidth / 10) {
            lines[1].graphics.setStrokeStyle(3)
                .beginStroke('#33333333')
                .moveTo(0, y)
                .lineTo(global.screenWidth, y);
        }
    };
    //stage的自动刷新
    const handleTicker = () => {
        if (global.gameStart) {
            // stage.removeAllChildren();
            if (me.isdeath) {
                cameraMain.x = 2500;
                cameraMain.y = 2500;
                // console.log(me.showdeath)
                if (!me.showdeath) {
                    alert('你死了');
                }
            }
            else {
                cameraMain.x = me.x;
                cameraMain.y = me.y;
            }

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
                .beginStroke('22AA22')
                .beginFill('#00EE22')
                .drawPolyStar(toScreenPos(target).x, toScreenPos(target).y, 20, 3, 0.7, 90);

            userBoard.graphics.c();
            //??????????????????????????????
            targetStar.graphics.setStrokeStyle(3, 1)
                .beginStroke('22AA22')
                .beginFill('#BBFFFF33')
                .drawRect(0, 0, 230, 300);

            scoreBoard.graphics.c();
            //??????????????????????????????
            targetStar.graphics.setStrokeStyle(3, 1)
                .beginStroke('22AA22')
                .beginFill('#BBFFFF33')
                .drawRect(230, 0, 230, 300);

            zi_shengyuwanjiashu.text = '剩余玩家数 : ' + aliveusernum;
            zi_shengyuwanjiashu.font = 'bold 50px Arial';
            zi_shengyuwanjiashu.textAlign = 'centor';
            zi_shengyuwanjiashu.x = innerWidth * (5 / 11);
            zi_shengyuwanjiashu.y = 50;
            zi_shengyuwanjiashu.textBaseline = 'middle';


            zi_wanjiabang.text = '玩家榜';
            zi_wanjiabang.font = 'bold 25px Arial';
            zi_wanjiabang.textAlign = 'centor';
            zi_wanjiabang.x = 80;
            zi_wanjiabang.y = 20;
            zi_wanjiabang.textBaseline = 'middle';

            zi_wanjiaming_hp.text = '用户名';
            zi_wanjiaming_hp.font = 'bold 25px Arial';
            zi_wanjiaming_hp.textAlign = 'centor';
            zi_wanjiaming_hp.x = 20;
            zi_wanjiaming_hp.y = 50;
            zi_wanjiaming_hp.textBaseline = 'middle';

            zi_shengming.text = '生命';
            zi_shengming.font = 'bold 25px Arial';
            zi_shengming.textAlign = 'centor';
            zi_shengming.x = 150;
            zi_shengming.y = 50;
            zi_shengming.textBaseline = 'middle';


            zi_jifenbang.text = '积分榜';
            zi_jifenbang.font = 'bold 25px Arial';
            zi_jifenbang.textAlign = 'centor';
            zi_jifenbang.x = 310;
            zi_jifenbang.y = 20;
            zi_jifenbang.textBaseline = 'middle';

            zi_wanjiaming_score.text = '用户名';
            zi_wanjiaming_score.font = 'bold 25px Arial';
            zi_wanjiaming_score.textAlign = 'centor';
            zi_wanjiaming_score.x = 250;
            zi_wanjiaming_score.y = 50;
            zi_wanjiaming_score.textBaseline = 'middle';

            zi_jifeng.text = '积分';
            zi_jifeng.font = 'bold 25px Arial';
            zi_jifeng.textAlign = 'centor';
            zi_jifeng.x = 400;
            zi_jifeng.y = 50;
            zi_jifeng.textBaseline = 'middle';

            users.forEach((user, index) => {
                usernames_hp[index].text = user.nickname;
                usernames_hp[index].font = 'bold 25px Arial';
                usernames_hp[index].textAlign = 'centor';
                usernames_hp[index].x = 20;
                usernames_hp[index].y = 80 + index * 30;
                usernames_hp[index].textBaseline = 'middle';

                usernames_score[index].text = user.nickname;
                usernames_score[index].font = 'bold 25px Arial';
                usernames_score[index].textAlign = 'centor';
                usernames_score[index].x = 250;
                usernames_score[index].y = 80 + index * 30;
                usernames_score[index].textBaseline = 'middle';


                userHPs[index].text = Math.ceil(user.HP);
                userHPs[index].font = 'bold 25px Arial';
                userHPs[index].textAlign = 'centor';
                userHPs[index].x = 150;
                userHPs[index].y = 80 + index * 30;
                userHPs[index].textBaseline = 'middle';

                userscores[index].text = user.score;
                userscores[index].font = 'bold 25px Arial';
                userscores[index].textAlign = 'centor';
                userscores[index].x = 400;
                userscores[index].y = 80 + index * 30;
                userscores[index].textBaseline = 'middle';

                if (user.isdeath) {
                    circle[index].graphics.c();
                    circle[index].graphics.setStrokeStyle(4, 1);
                    nicknameText[index].text = '';
                    HPs[index].text = '';
                }
                else {
                    user.screenX = toScreenPos(user).x;
                    user.screenY = toScreenPos(user).y;
                    // console.log("user"+user.screenX,user.screenY);
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
                }
            });
            // console.log(skills)
            skills.forEach((skill, index) => {
                if (skill.isdisapear) {
                    skillCircle[index].graphics.c();
                    skillCircle[index].graphics.setStrokeStyle(4, 1);
                }
                else {
                    skill.screenX = toScreenPos(skill).x;
                    skill.screenY = toScreenPos(skill).y;
                    let temp = { x: skill.startx, y: skill.starty };
                    skill.screenstartX = toScreenPos(temp).x;
                    skill.screenstartY = toScreenPos(temp).y;
                    // console.log("skill"+skill.screenX,skill.screenY);
                    if (skill.name == 'thunder') {
                        skillCircle[index].graphics.c();
                        skillCircle[index].graphics.setStrokeStyle(20, 1)
                            .beginStroke('blue')
                            .moveTo(skill.screenstartX, skill.screenstartY)
                            .lineTo(skill.screenX, skill.screenY);
                    }
                    else {
                        skillCircle[index].graphics.c();
                        skillCircle[index].graphics.setStrokeStyle(4, 1)
                            .beginStroke('black')
                            .beginFill(skill.color)
                            .drawCircle(skill.screenX, skill.screenY, skill.radius);
                    }
                }
            });
            // stage.addChild(...skills)

            defenceAreaShape.graphics.c();
            defenceAreaShape.graphics.setStrokeStyle(5, 1)
                .beginStroke('#00C5CDAA')
                // .beginFill('#BBFFFF33')
                .beginFill('white')
                .drawRect(toScreenPos(defenceArea).x, toScreenPos(defenceArea).y, defenceArea.width, defenceArea.height);


            touchBoard.graphics.c();
            touchBoard.graphics.beginFill('#11111111')
                .drawRect(0, 0, global.gameWidth, global.gameHeight);

            stage.update();
        }
    };
    // createjs.Ticker.addEventListener('tick', handleTicker);
    setInterval(handleTicker);
    // events
    const mouseDownEvent = event => {
        // console.log(event)
        // console.log(event.nativeEvent.button)
        if (me.isdeath)
            return 'death';
        // cancle skill
        if (event.nativeEvent.button == 2) {
            mouseMode = -1;
            // console.log(event.pointerID)
            // console.log(event)
            // event.cancelBubble = true
            // event.returnValue = false;
        }
        target = toGlobalPos({ x: event.stageX, y: event.stageY });
        if (mouseMode === -1) // mouseMode === 'moveing'
            socket.emit('c_moveClick', { target: target });
        else // mouseMode === 'fireball'
            socket.emit('c_skill', { target: target, skillindex: mouseMode });

        beforeskill.graphics.c();
        beforeskill.graphics.setStrokeStyle(3, 1);
        mouseMode = -1;
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
        // console.log(users.length)
        // useralivenum = totalusernum = users.length()
        $('#view-room').slideUp('normal');
        global.gameWidth = args.gameWidth;
        global.gameHeight = args.gameHeight;

        $('#view-canvas').slideDown('normal');
        stage = new createjs.Stage('cvs');

        //移动端的点击支持
        createjs.Touch.enable(stage);

        // stage.addEventListener('mousedown', mouseDownEvent);
        window.addEventListener('keydown', event => {
            if (me.isdeath)
                return 'death';
            if (event.key == 'q') {
                mouseMode = 0;
                console.log('q');
            }
            else if (event.key == 'w') {
                mouseMode = 1;
                console.log('w');
            }
            else if (event.key == 'e') {
                mouseMode = 2;
                console.log('e');
            }
        });
        stage.addEventListener('stagemousemove', event => {
            if (!me.isdeath && mouseMode != -1) {
                beforeskill.graphics.c();
                beforeskill.graphics.setStrokeStyle(3, 1)
                    // .beginStroke('#00C5CDAA')
                    .beginFill('blue')
                    .drawCircle(event.stageX, event.stageY, 10);
            }
            stage.addEventListener('mousedown', mouseDownEvent);
        });

        lines.push(new createjs.Shape());
        lines.push(new createjs.Shape());
        gameAreaShape = new createjs.Shape();
        targetLine = new createjs.Shape();
        targetStar = new createjs.Shape();
        beforeskill = new createjs.Shape();
        Board = new createjs.Container();
        userBoard = new createjs.Shape();
        scoreBoard = new createjs.Shape();

        zi_shengyuwanjiashu = new createjs.Text();
        zi_wanjiabang = new createjs.Text();
        zi_wanjiaming_hp = new createjs.Text();
        zi_shengming = new createjs.Text();
        zi_jifenbang = new createjs.Text();
        zi_wanjiaming_score = new createjs.Text();
        zi_jifeng = new createjs.Text();
        for (let i = 0; i < totalusernum; ++i) {
            userCircle.push(new createjs.Container());
            circle.push(new createjs.Shape());
            nicknameText.push(new createjs.Text());
            HPs.push(new createjs.Text());
            userCircle[i].addChild(circle[i], nicknameText[i], HPs[i]);
            userHPs[i] = new createjs.Text();
            usernames_hp[i] = new createjs.Text();
            userscores[i] = new createjs.Text();
            usernames_score[i] = new createjs.Text();
        }
        for (let i = 0; i < totalusernum * 3; ++i) {
            skillCircle[i] = new createjs.Shape();
        }
        defenceAreaShape = new createjs.Shape();
        touchBoard = new createjs.Shape();

        fireballButton = new createjs.Shape();
        fireballButton.graphics.setStrokeStyle(4, 1)
            .beginStroke('#000000')
            .beginFill('#FF2222')
            .drawCircle(innerWidth / 10,
                innerHeight * (8 / 9),
                Math.min(global.screenWidth / 4, global.screenHeight / 4 - 10));

        Board.addChild(userBoard, ...userHPs, ...usernames_hp,
            scoreBoard, ...usernames_score, ...userscores, zi_wanjiabang,
            zi_wanjiaming_hp, zi_shengming, zi_jifenbang, zi_wanjiaming_score,
            zi_jifeng);

        stage.addChild(gameAreaShape, defenceAreaShape, ...lines,
            targetLine, targetStar, ...userCircle, touchBoard,
            ...skillCircle, beforeskill, Board, zi_shengyuwanjiashu);


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
        skills = args.skills;
        totalusernum = args.totalusernum;
        aliveusernum = args.aliveusernum;
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



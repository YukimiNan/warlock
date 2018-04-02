const logger = require('tracer').colorConsole();

const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

require('./lib/yukimilib');

const s = require('./settings.json');

const sockets = {}, // 归User类管理归User类管理
    users = {}, // User类外只读不写
    rooms = {}; // Room类外只读不写

class User {
    constructor(socket) {
        // socket不整合入User类内，因为要发送给客户端
        sockets[socket.id] = socket;
        this.id = socket.id;
        this.username = null;
        this.nickname = null;
        // User.roomId不能为引用，否则会和Room.users死循环
        // 操作this.roomId时，应同时操作socket[this.id].join/leave
        this.roomId = null;
        this.warlock = null;
        users[this.id] = this;

        this.radius = s.radius;        
        this.x = Math.random() * (s.gameWidth - this.radius * 2) + this.radius;
        this.y = Math.random() * (s.gameHeight - this.radius * 2) + this.radius;

        this.target = { x: this.x, y: this.y };
        this.speed = s.startSpeed;

        this.screenX = null;
        this.screenY = null;
        this.color = null;
    }

    emitFatal(reason) {
        sockets[this.id].emit('fatal', {
            reason: reason
        });
    }

    // 可能的返回值: succeed, duplicate, toolong
    login(username, password) {
        const isUsernameExist = Object.values(users).some((user) => user.username === username);
        if (isUsernameExist)
            return 'duplicate';

        if (username.length > s.maxUsernameLength)
            return 'toolong';

        this.username = username;
        this.nickname = username;
        return 'succeed';
    }

    // 可能的返回值: succeed
    logout() {
        this.leave();
        delete sockets[this.id];
        delete users[this.id];
        return 'succeed';
    }

    // 可能的返回值: succeed, full, nonexistent
    join(roomId) {
        // 先操作room再操作user
        if (roomId === null) {
            roomId = this.autoRoomId();
        }

        let status = null;
        if (roomId in rooms) {
            status = rooms[roomId].add(this);
        } else {
            status = 'nonexistent';
        }

        if (status === 'succeed') {
            this.roomId = roomId;
            sockets[this.id].join(roomId, (err) => {
                if (err !== null) {
                    logger.error('%s join %s error\n%s', this.id, roomId, err);
                    this.leave();
                    this.emitFatal('server side join room failed');
                }

            });
        }
        return status;
    }

    autoRoomId() {
        const list = Object.values(rooms).filter((room) => room.status === 'waiting');
        list.sort((a, b) => {
            if (a.users.length === b.users.length)
                return a.id - b.id;
            return b.users.length - a.users.length;
        });
        return list.length === 0 ? new Room().id : list[0].id;
    }

    // 可能的返回值: succeed
    leave() {
        // 先操作room再操作user
        if (this.roomId !== null) {
            rooms[this.roomId].remove(this);
        }
        if (this.roomId in sockets[this.id].rooms) {
            sockets[this.id].leave(this.roomId, (err) => {
                if (err !== null) {
                    logger.error('%s leave %s error\n%s', this.id, this.roomId, err);
                    this.emitFatal('server side leave room failed');
                }
            });
        }
        this.roomId = null;
        return 'succeed';
    }

    // 可能的返回值：succeed
    moveToTarget() {
        let dis = Math.sqrt((this.target.x - this.x) * (this.target.x - this.x) +
            (this.target.y - this.y) * (this.target.y - this.y));
        if (dis <= this.speed) {
            this.x = this.target.x;
            this.y = this.target.y;
        }
        else {
            let dir = { x: (this.target.x - this.x) / dis, y: (this.target.y - this.y) / dis };
            this.x += dir.x * this.speed;
            this.y += dir.y * this.speed;
        }
        if (this.x < 0 + this.radius) {
            this.x = 0 + this.radius;
        }
        else if (this.x >= s.gameWidth - this.radius) {
            this.x = s.gameWidth - this.radius;
        }
        if (this.y < 0 + this.radius) {
            this.y = 0 + this.radius;
        }
        else if (this.y >= s.gameHeight - this.radius) {
            this.y = s.gameHeight - this.radius;
        }
        return 'succeed';
    }
}

class Room {
    constructor() {
        this.id = String(new Date().getTime());
        this.status = 'waiting'; // 可能的值: waiting, running
        this.users = [];
        rooms[this.id] = this;
    }

    // 可能的返回值: succeed, running, full
    add(user) {
        if (this.status === 'running')
            return 'running';
        if (this.users.length >= s.maxPlayerPerRoom)
            return 'full';

        this.users.push(user);
        return 'succeed';
    }

    // 可能的返回值: succeed, nonexistent
    remove(user) {
        if (this.users.includes(user) === false)
            return 'nonexistent';

        if (this.users.remove(user) === 0) {
            delete rooms[this.id];
        }
        return 'succeed';
    }
    // 可能的返回值: succeed, unscceed
    Updates() {
        this.users.forEach(user => {
            // user.target = { x: user.x + 1000, y: user.y + 1000 }; //for test
            if (user.moveToTarget() !== 'succeed') {
                return 'unsucceed';
            }
        });
        return 'succeed';
    }
    // 可能的返回值: succeed, insufficient
    start() {
        if (this.users.length < 1)
            return 'insufficient';

        this.status = 'running';
        return 'succeed';
    }
}

app.use(express.static(`${__dirname}/../client`));

http.listen(80, () => {
    logger.info('listening on *:80');
});

io.on('connection', (socket) => {
    logger.info('%s %s connected', socket.id, socket.handshake.address);
    const me = new User(socket);

    const systemChat = (roomId, message) => {
        io.in(roomId).emit('s_chat', {
            user: {
                id: null,
                nickname: '系统'
            },
            message: message
        });
    };

    socket.on('disconnect', () => {
        logger.info('%s disconnected', me.id);
        systemChat(me.roomId, `${me.nickname} 离开了房间`);
        me.logout();
    });

    socket.on('req_login', (args) => {
        const result = {
            status: me.login(args.username, args.password)
        };

        if (result.status === 'succeed') {
            result.me = me;
        } else {
            result.me = null;
        }

        logger.info('%s login %s', me.id, result.status);
        socket.emit('res_login', result);
    });

    socket.on('req_join', (args) => {
        const result = {
            status: me.join(args.roomId)
        };

        if (result.status === 'succeed') {
            result.me = me;
            systemChat(me.roomId, `${me.nickname} 进入了房间`);
        } else {
            result.me = null;
        }

        logger.info('%s join %s %s', me.id, me.roomId, result.status);
        socket.emit('res_join', result);
    });

    socket.on('c_chat', (args) => {
        io.in(me.roomId).emit('s_chat', {
            user: me,
            message: args.message
        });
    });

    socket.on('c_start', (args) => {
        const status = rooms[me.roomId].start();
        if (status === 'succeed') {
            systemChat(me.roomId, `${me.nickname} 开始了游戏，游戏将在 ${s.startCountdown} 秒后开始...`);

            let colors = [...s.colors];
            rooms[me.roomId].users.forEach(user => {
                let randomIndex = Math.floor(Math.random() * colors.length);
                user.color = colors[randomIndex];
                colors.splice(randomIndex);
            })
            for (let i = 1; i < s.startCountdown; ++i) {
                setTimeout(() => {
                    systemChat(me.roomId, `游戏将在 ${s.startCountdown - i} 秒后开始...`);
                }, i * 10);
            }

            setTimeout(() => {
                systemChat(me.roomId, '游戏开始');
                io.in(me.roomId).emit('s_start', s);
            }, s.startCountdown * 10);
        } else if (status === 'insufficient') {
            systemChat(me.id, '人数不足，不能开始游戏');
        }

        logger.info('%s start %s %s', me.id, me.roomId, status);
    });
    socket.on('c_moveClick', (args) => {
        users[me.id].target.x = args.target.x;
        users[me.id].target.y = args.target.y;
        logger.info('%s wants to move to {%d %d}', me.id, users[me.id].target.x, users[me.id].target.y);
    });

});

setInterval(() => {
    Object.values(rooms).forEach((room) => {
        if (room.status === 'running') {
            // 每间room进行状态更新
            room.Updates();
        }
        io.in(room.id).emit('frame', {
            users: room.users
        });
    });
}, 1000 / s.framePerSecond);
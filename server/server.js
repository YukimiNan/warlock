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
        this.skills = []
        //test huoqiu
        // User.roomId不能为引用，否则会和Room.users死循环
        // 操作this.roomId时，应同时操作socket[this.id].join/leave
        this.roomId = null;
        // this.warlock = null;
        users[this.id] = this;

        this.radius = s.radius * s.scalingratio;
        this.x = Math.random() * (s.defenceAreaWidth * s.scalingratio - this.radius * 2) + this.radius + (s.gameWidth - s.defenceAreaWidth) * s.scalingratio/2;
        this.y = Math.random() * (s.defenceAreaHeight * s.scalingratio - this.radius * 2) + this.radius + (s.gameHeight - s.defenceAreaHeight) * s.scalingratio/2;

        this.ismove = false// user move or not
        this.target = { x: this.x, y: this.y };
        this.skilltarget = {x: null, y: null};
        this.iscasting = false;
        this.castingtime = 0;
        this.speed = s.startSpeed;
        this.HP = s.startHP;
        this.isdeath = false//user death or not
        this.showdeath = false
        this.burning = false;
        this.hitspeedx = 0;
        this.hitspeedy = 0;
        this.hitinfluence = 0.5;
        this.score = 0;

        this.screenX = null;
        this.screenY = null;
        this.color = null;
    }

    death(){
        this.x = null
        this.y = null
        this.isdeath = true
        rooms[this.roomId].penglist.remove(this)
        rooms[this.roomId].deathnum += 1
        // users.this
        // socket.emit("s_death",this)
    }

    addskill(){
        this.skills[0] = new Skills({name : "huoqiu", damage : 10, speed : 20 * s.scalingratio, range: 2000*s.scalingratio, colddown: 1000, radius: 20 * s.scalingratio, posinfluence: 150, ischongzhuang: false, color: 'red'},this.id)
        this.skills[1] = new Skills({name : "blink", damage : 5, speed : 60*s.scalingratio, range: 1000*s.scalingratio, colddown: 3000, radius: this.radius, posinfluence: 100, ischongzhuang: true, color: null},this.id)
        this.skills[2] = new Skills({name : "thunder", damage : 5, speed : 60 * s.scalingratio, range: 1000*s.scalingratio, colddown: 1000, radius: 20 * s.scalingratio, posinfluence: 70, ischongzhuang: false, color: 'blue'},this.id)
    }

    emitFatal(reason) {
        sockets[this.id].emit('fatal', {
            reason: reason
        });
    }

    // 可能的返回值: succeed, duplicate, toolong
    login(username, password) {
        const isUsernameExist = Object.keys(users).map(e=>users[e]).some((user) => user.username === username);
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
        const list = Object.keys(rooms).map(e=>rooms[e]).filter((room) => room.status === 'waiting');
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
            if(rooms[this.roomId].status != 'running'){
                rooms[this.roomId].remove(this);
                rooms[this.roomId].users.remove(this)
                this.skills.forEach(skill => {
                    rooms[this.roomId].skillslist.remove(skill)
                })
            }
            this.showdeath = true
            this.death()
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
        if (this.ismove == true) {
            let dis = Math.sqrt((this.target.x - this.x) * (this.target.x - this.x) +
                (this.target.y - this.y) * (this.target.y - this.y));
            if (dis <= this.speed) {
                this.x = this.target.x;
                this.y = this.target.y;
                this.ismove = false
            }
            else {
                let dir = { x: (this.target.x - this.x) / dis, y: (this.target.y - this.y) / dis };
                this.x += dir.x * this.speed;
                this.y += dir.y * this.speed;
            }
        }
        this.x += this.hitspeedx;
        this.y += this.hitspeedy;
        if(Math.abs(this.hitspeedx) >= this.hitinfluence)
            if(this.hitspeedx > 0)
                this.hitspeedx -= this.hitinfluence;
            else
                this.hitspeedx += this.hitinfluence;
        else
            this.hitspeedx = 0
        if(Math.abs(this.hitspeedy) >= this.hitinfluence)
            if(this.hitspeedy > 0)
                this.hitspeedy -= this.hitinfluence;
            else
                this.hitspeedy += this.hitinfluence;
        else
            this.hitspeedy = 0
        
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

class DefenceArea {
    constructor() {
        // this.x = 0;
        // this.y = 0;
        // this.height = s.gameHeight;
        // this.width = s.gameWidth;
        this.height = s.defenceAreaHeight * s.scalingratio;
        this.width = s.defenceAreaWidth * s.scalingratio;
        this.x = (s.gameWidth * s.scalingratio - this.width)/2 
        this.y = (s.gameHeight * s.scalingratio - this.height)/2
        this.minheight = s.minheight * s.scalingratio;
        this.minwidth = s.minwidth * s.scalingratio;
        this.speedReduce = 10;
        this.startSpeed = 1;
        this.hurt = 0.050
    }

    // Event of onetime reduce of the safe area
    AreaReduce() {
        // 使用反比函数控制缩圈速度，延长小场景时间，改善游戏节奏
        if (this.height >= s.radius * s.minheight || this.width >= s.radius * s.minwidth) {
            let speedTmp = this.speedReduce / (this.x - (s.gameWidth - s.defenceAreaWidth) * s.scalingratio /2 + this.speedReduce) * this.startSpeed;
            this.x += speedTmp;
            this.y += speedTmp;
            this.height -= speedTmp * 2;
            this.width -= speedTmp * 2;
        }
        return 'succeed';
    }

    // if the user in this DefenceArea.
    // if not, let him/her burned and HP down!
    // xu yao youhua !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
    BloodReduce(user) {
        if (user.x <= this.x + this.width &&
            user.y <= this.y + this.height &&
            user.x >= this.x &&
            user.y >= this.y) {
            this.burning = false;
        }
        else {
            if (user.HP >= this.hurt)
                user.HP -= this.hurt;
            else{
                user.HP = 0;
                if(!user.isdeath)
                    user.death();
            }
            this.burning = true;
        }
        return 'succeed';
    }
}

var Getdistance = ((obj1, obj2) => {
    return Math.sqrt((obj1.y - obj2.y) * (obj1.y - obj2.y) + 
                    (obj1.x - obj2.x) * (obj1.x - obj2.x));
})

class Room {
    constructor() {
        this.id = String(new Date().getTime());
        this.status = 'waiting'; // 可能的值: waiting, running
        this.users = [];
        //collide
        this.skillslist = [];
        this.penglist = [];
        this.defenceArea = new DefenceArea();
        this.deathnum = 0;
        this.isgameover = false;
        rooms[this.id] = this;
    }

    // 可能的返回值: succeed, running, full
    add(user) {
        if (this.status === 'running')
            return 'running';
        if (this.users.length >= s.maxPlayerPerRoom)
            return 'full';
        this.penglist.push(user);
        this.users.push(user);
        return 'succeed';
    }

    // 可能的返回值: succeed, nonexistent
    remove(user) {
        if (this.users.includes(user) === false)
            return 'nonexistent';

        if (this.users.remove(user) === 0) {
            delete rooms[this.id];
            this.penglist.remove(user)
        }
        return 'succeed';
    }
    // collision or not
    Ispeng(obj1,obj2) {
        if(Getdistance(obj1, obj2) < obj1.radius+obj2.radius){
            return true;
        }
        return false;
    }

    Isuser(obj) {
        if(obj.skills != undefined)
            return true
        return false;
    }

    Isskill(obj) {
        if(obj.attackerid != undefined)
            return true
        return false;
    }

    Peng(obj1, obj2){
        //both object are user
        if (this.Isuser(obj1) && this.Isuser(obj2)) {
            let dis = Getdistance(obj1, obj2)
            //debug
            // console.log(obj1.x) 
            let retdistance = (obj1.radius + obj2.radius - dis) / 2
            let x = (obj1.x - obj2.x) / dis * retdistance
            let y = (obj1.y - obj2.y) / dis * retdistance
            obj2.x += (obj2.x - obj1.x) / dis * retdistance
            obj2.y += (obj2.y - obj1.y) / dis * retdistance
            obj1.x += x
            obj1.y += y
        }
        else if(this.Isuser(obj1) && this.Isskill(obj2)) {
            if(obj2.attackerid !== obj1.id)
                obj2.Hit(obj1)
        }
     }

    // 可能的返回值: succeed, unscceed,unsucceedl
    Updates() {
        this.users.forEach(user => {
            if(user.isdeath && user.showdeath) {
                return "died"
            }
            if(user.isdeath && !user.showdeath) {
                user.showdeath = true
            }
            // user.target = { x: user.x + 1000, y: user.y + 1000 }; //for test
            if (user.moveToTarget() !== 'succeed') {
                return 'unsucceed';
            }
            if (!this.isdeath && this.defenceArea.BloodReduce(user) !== 'succeed')
                return 'unsucceed1';
            // console.log("x,y"+user.screenX,user.screenY)
        });
        this.skillslist.forEach(skill => {
            if (skill.Updates() !== 'succeed'){
                return 'unsucceed';
            }
        })
        //list
        this.penglist.forEach(obj1 => {
            this.penglist.forEach(obj2 => {
                if(obj1 !== obj2) {
                    if(this.Ispeng(obj1, obj2))
                        this.Peng(obj1, obj2);
                }
            })
        })

        if (this.defenceArea.AreaReduce() !== 'succeed')
            return 'unsucceed1';
        return 'succeed';
    }
    // 可能的返回值: succeed, insufficient
    start() {
        if (this.users.length < 1)
            return 'insufficient';
        this.deathnum = 0
        this.status = 'running';
        return 'succeed';
    }
}


class Skills{
    constructor(skill,userid){
        this.name = skill.name
        this.damage = skill.damage
        this.speed = skill.speed
        this.range = skill.range
        this.colddown = skill.colddown
        this.radius = skill.radius
        this.posinfluence = skill.posinfluence
        this.ischongzhuang = skill.ischongzhuang //
        this.attackerid = userid
        this.x = -10000
        this.y = -10000
        this.eps = 0.0000001
        this.start = {x: null, y: null}
        this.color = skill.color

        this.curcold = 0//cur cold time
        this.iscoldover = true //can use or not
        this.screenX = null
        this.screenY = null
        this.screenstartX = null
        this.screenstartY = null
        this.target = {x: -10000, y: -10000}
        this.distance = 0
        this.isdisappear = true
        this.isblink = false
        rooms[users[userid].roomId].skillslist.push(this)
    }
    Attack(user) {
        if(this.iscoldover){
            this.x = user.x
            this.y = user.y
            this.startx = user.x
            this.starty = user.y
            let dis = Getdistance(this,{x : user.skilltarget.x, y : user.skilltarget.y})
            if(this.ischongzhuang) {
                let realdis = Math.min(dis,this.range)
                // user.x = user.x + (user.skilltarget.x - user.x)/dis*realdis
                // user.y = user.y + (user.skilltarget.y - user.y)/dis*realdis
                this.target.x = user.x + (user.skilltarget.x - user.x)/dis*realdis
                this.target.y = user.y + (user.skilltarget.y - user.y)/dis*realdis
                user.target.x = this.target.x
                user.target.y = this.target.y
                users[this.attackerid].ismove = true
                users[this.attackerid].iscasting = true;
                users[this.attackerid].speed = this.speed
            }
            else {
                this.target.x = this.x + (user.skilltarget.x - this.x)/dis*this.range
                this.target.y = this.y + (user.skilltarget.y - this.y)/dis*this.range
                
            }
            if(!this.isblink){
                rooms[user.roomId].penglist.push(this)
                this.isdisappear = false
            }
            this.iscoldover = false
            this.curcold = this.colddown
        }
        else
            return "skill is in cold"
    }
    Hit(user) {
        console.log("Hit");
        if(user.HP > this.damage){
            user.HP -= this.damage
            users[this.attackerid].score += this.damage
        }
        else{
            users[this.attackerid].score += Math.ceil(user.HP)
            // console.log(user.HP)
            user.HP = 0
            if(!user.isdeath)
                user.death()
        }
        let dis = Getdistance(this,user)
        let ydis = user.y - this.y
        let xdis = user.x - this.x
        if(xdis<0)
            user.hitspeedx -= Math.sqrt(-xdis/dis*this.posinfluence*2)
        else
            user.hitspeedx += Math.sqrt(xdis/dis*this.posinfluence*2)
        if(ydis<0)
            user.hitspeedy -= Math.sqrt(-ydis/dis*this.posinfluence*2)
        else
            user.hitspeedy += Math.sqrt(ydis/dis*this.posinfluence*2)
        // console.log(user.hitspeedx,user.hitspeedy)
        //chongzhuang until the target
        // if(!this.ischongzhuang)
        this.Disappear();
    }
    Disappear() {
        console.log("disapear");
        if(this.ischongzhuang){
            users[this.attackerid].speed = s.startSpeed
            users[this.attackerid].iscasting = false;
        }
        this.x = -10000
        this.y = -10000
        this.target.x = -10000
        this.target.y = -10000
        this.screenX = null
        this.screenY = null
        this.isdisappear = true
        // console.log(this.x,this.y)
        rooms[users[this.attackerid].roomId].penglist.remove(this)
    }
    Updates() {
        if(this.curcold <= 1000 / s.framePerSecond){
            this.curcold = 0
            this.iscoldover = true
        }
        else
            this.curcold -= 1000/s.framePerSecond
        //blink complete at once no need to call moveToTarget()
        if(this.blink)
            return "blink"
        if(this.target.x != this.x && this.target.y != this.y)
            this.moveToTarget()
    }
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
        // console.log(this.x,this.target.x,this.y,this.target.y,this.isdisappear)
        if(Math.abs(this.x - this.target.x) <= this.eps && 
            Math.abs(this.y - this.target.y) <= this.eps && 
            this.isdisappear == false)
            this.Disappear()
        return 'succeed'
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
        
        me.addskill()
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
            });
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
        if(users[me.id].iscasting == true)
            return "casting"
        users[me.id].target.x = args.target.x;
        users[me.id].target.y = args.target.y;
        users[me.id].ismove = true;
        logger.info('%s wants to move to {%d %d}', me.id, users[me.id].target.x, users[me.id].target.y);
    });

    socket.on('c_skill', (args) => {
        if(users[me.id].iscasting == true)
            return "casting"
        users[me.id].skilltarget.x = args.target.x;
        users[me.id].skilltarget.y = args.target.y;
        users[me.id].skills[args.skillindex].Attack(users[me.id])
    })

});

setInterval(() => {
    // console.log(users)
    Object.keys(rooms).map(e=>rooms[e]).forEach((room) => {
        if (room.status === 'running') {
            // 每间room进行状态更新
            room.Updates();
        }
        // console.log(room.users.length)
        io.in(room.id).emit('frame', {
            users: room.users,
            skills: room.skillslist,
            totalusernum: room.users.length,
            aliveusernum: room.users.length - room.deathnum,
            defenceArea: room.defenceArea
        });
    });
}, 1000 / s.framePerSecond);
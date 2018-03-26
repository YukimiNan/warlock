// activate vscode code completion, remove eslint error
if (false) {
    var $ = require('jquery');
    var io = require('socket.io')();
}

// 开全局便于debug
const socket = io();
let me = null;
let users = null;

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

    socket.on('res_login', (args) => {
        if (args.status === 'succeed') {
            me = args.me;

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
    });

    // 服务器帧
    socket.on('frame', (args) => {
        users = args.users;
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
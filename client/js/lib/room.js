// activate vscode code completion, remove eslint error
if (false) {
    var $ = require('jquery');
    var define;
}

const liHTML = '<li class="list-group-item"><h4></h4></li>';
const youHTML = '<span class="label label-default" id="room-you">你</span>';

const update = (users, me) => {
    // 调整列表长度
    const ul = $('#room-users');
    const ulLength = ul.children().length;
    if (ulLength < users.length) {
        for (let i = ulLength; i < users.length; ++i) {
            ul.append($(liHTML));
        }
    } else {
        ul.children(`li:gt(${users.length - 1})`).remove();
    }

    // 修改列表内容
    users.forEach((user, i) => {
        const li = ul.children(`li:eq(${i})`);
        if (li.attr('data-userid') !== user.id) {
            li.attr('data-userid', user.id).children(':header').text(user.nickname);
        }
    });

    // 调整“你”标记
    if ($('#room-you').parent().parent().attr('data-userid') !== me.id) {
        $('#room-you').remove();
        $(`#room-users>li[data-userid="${me.id}"]>:header`).prepend(youHTML);
    }
};

const chat = (user, message) => {
    const labelType = user.id === null ? 'warning' : 'success';
    $('#room-msgul').append(`
        <li>
            <h4>
                <span class="label label-${labelType}">${user.nickname}</span>
            </h4>
            <p>${message}</p>
        </li>`
    );
    // 滚动到底
    $('#room-msgdiv').scrollTop($('#room-msgdiv')[0].scrollHeight);
};

define(() => {
    return {
        update: update,
        chat: chat,
    };
});
const express = require('express');
const app = express();
const http = require('http').Server(app);

app.use(express.static(__dirname + '/../client'));

http.listen(80, () => {
    console.log('listening on *:80');
});

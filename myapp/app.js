const express = require('express')
const app = express()
const port = 3000
const messages = require("ups_pb")

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

var message = new messages.UConnect();
message.setWorldid(1);
console.log(message.getWorldid)
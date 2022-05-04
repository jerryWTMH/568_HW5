const protobuf = require('./')
const fs = require('fs')
const path = require('path')

const messages = protobuf(fs.readFileSync(path.join(__dirname, 'ups.proto')))

// pass a proto file as a buffer/string or pass a parsed protobuf-schema object


const buf = {
    worldid: 42,
    trucks: 3,
    isAmazon: 3
}

const buf2 = messages.Test.encode(buf)

console.log('test message', buf)
console.log('encoded test message', buf2)
console.log('encoded test message decoded', messages.Test.decode(buf2))

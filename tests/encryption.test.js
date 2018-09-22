'use strict'

const {encrypt, decrypt} = require('../lib/encryption')
const assert = require('assert')
const fs = require('fs')

describe('encrypt', () => {
  it('should be able to do everything', async () => {
    console.time('a')
    let dataBuffer = Buffer.from('THIS IS MY TEST STRING, BUWHAHA')
    let key = Buffer.from('examplekey')
    let data = encrypt(dataBuffer, key)
    data.masterkey = key
    let decrypted = await decrypt(data)
    console.timeEnd('a')
    assert(dataBuffer.equals(decrypted))
  })



})
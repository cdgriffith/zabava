'use strict'

const {encrypt, decrypt} = require('../lib/encryption')
const assert = require('assert')


describe('encrypt', () => {
  it('should be able to do everything', () => {
    let dataBuffer = Buffer.from('THIS IS MY TEST STRING, BUWHAHA')
    let key = Buffer.from('examplekey')
    let data = encrypt(dataBuffer, key)
    data.masterkey = key
    let decrypted = decrypt(data)
    assert(dataBuffer.equals(decrypted))
  })



})
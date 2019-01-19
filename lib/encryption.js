'use strict'
const util = require('util')
const crypto = require('crypto')
const pbkdf2 = util.promisify(crypto.pbkdf2)
const randomBytes = util.promisify(crypto.randomBytes)

const encrypt = async (data, key) => {
  let iv = await randomBytes(16)
  iv = iv.toString('hex')
  let salt = await randomBytes(32)
  salt = salt.toString('hex')
  let hashKey = await pbkdf2(key, salt, 5100, 32, 'sha512')
  let cipher = crypto.createCipheriv('aes-256-gcm', hashKey, iv)
  let encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  let tag = cipher.getAuthTag().toString('hex')
  return {salt, iv, tag, encrypted}
}

const decrypt = async ({encrypted, salt, iv, tag, key, ...extra}) => {
  let hashKey = await pbkdf2(key, salt, 5100, 32, 'sha512')
  let decipher = crypto.createDecipheriv('aes-256-gcm', hashKey, iv)
  decipher.setAuthTag(Buffer.from(tag, 'hex'))
  return Buffer.concat([decipher.update(encrypted, 'binary'), decipher.final()])
}

module.exports = {
  encrypt,
  decrypt
}


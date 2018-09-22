'use strict'
const util = require('util')
const crypto = require('crypto')
const pbkdf2 = util.promisify(crypto.pbkdf2)
const randomBytes = util.promisify(crypto.randomBytes)

const encrypt = async (data, masterkey) => {
  let iv = await randomBytes(16)
  iv = iv.toString('hex')
  let salt = await randomBytes(32)
  salt = salt.toString('hex')
  let key = await pbkdf2(masterkey, salt, 5100, 32, 'sha512')
  let cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  let encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  let tag = cipher.getAuthTag()
  return {salt, iv, tag, encrypted}
}

const decrypt = async ({encrypted, salt, iv, tag, masterkey, ...extra}) => {
  console.log(salt)
  let key = await pbkdf2(masterkey, salt, 5100, 32, 'sha512')
  let decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted, 'binary'), decipher.final()])
}

module.exports = {
  encrypt,
  decrypt
}


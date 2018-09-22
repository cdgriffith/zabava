'use strict'
const util = require('util')
const crypto = require('crypto')
const pbkdf2 = util.promisify(crypto.pbkdf2)
const randomBytes = util.promisify(crypto.randomBytes)

const encrypt = async (data, masterkey) => {
  const iv = await randomBytes(32)
  const salt = await randomBytes(64)
  const key = await pbkdf2(masterkey, salt, 5100, 32, 'sha512')
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  const tag = cipher.getAuthTag()
  return {salt, iv, tag, encrypted}
}

const decrypt = async ({encrypted, salt, iv, tag, masterkey, ...extra}) => {
  console.log(salt)
  const key = await pbkdf2(masterkey, salt, 5100, 32, 'sha512')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted, 'binary'), decipher.final()])
}

module.exports = {
  encrypt,
  decrypt
}


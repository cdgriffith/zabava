'use strict'
const crypto = require('crypto')

const encrypt = (data, masterkey) => {
  const iv = crypto.randomBytes(32)
  const salt = crypto.randomBytes(64)
  const key = crypto.pbkdf2Sync(masterkey, salt, 5100, 32, 'sha512')
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
  const tag = cipher.getAuthTag()
  return {salt, iv, tag, encrypted}
}

const decrypt = ({encrypted, salt, iv, tag, masterkey}) => {
  const key = crypto.pbkdf2Sync(masterkey, salt, 5100, 32, 'sha512')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted, 'binary'), decipher.final()])
}

module.exports = {
  encrypt,
  decrypt
}


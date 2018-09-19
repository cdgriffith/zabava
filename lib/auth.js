'use strict'
const jwt = require('jsonwebtoken')


const generateToken = function (subject, expires = '1d', roles = ['video:view'] ) {
  return new Promise(function (resolve, reject) {
    try {
      let options = {
        algorithm: 'HS256',
        expiresIn: expires
      }

      let payload = {
        iat: Math.floor(Date.now() / 1000),
        sub: subject,
        // iss: 'https://b00b.me',
        roles: roles
      }

      return resolve(jwt.sign(payload, process.env.JWT_SECRET, options))
    } catch (e) {
      return reject(e)
    }
  })
}

module.exports = {
  generateToken
}


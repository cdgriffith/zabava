'use strict'
const jwt = require('jsonwebtoken')


const generateToken = function (subject, expires = '1d', roles = ['video:view']) {
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

const verifyToken = function (token) {
  return new Promise(function (resolve, reject) {
    try {
      jwt.verify(token, process.env.JWT_SECRET, {algorithms: ['HS256']}, (tokenError, payLoad) => {
        if (tokenError) {
          return reject(tokenError)
        }
        return resolve(payLoad)
      })
    } catch (e) {
      return reject(e)
    }
  })
}

function getToken(req) {
  if (req.cookies.token) {
    return req.cookies.token
  }
  else if (req.headers.authorization && req.headers.authorization.split(' ')[0] === 'Bearer') {
    return req.headers.authorization.split(' ')[1]
  } else if (req.query && req.query.token) {
    return req.query.token
  }
  return null
}

module.exports = {
  generateToken,
  verifyToken,
  getToken
}


'use strict'
require('dotenv').config()
const db = require('./lib/db')
const Asset = require('./lib/models/asset')
const User = require('./lib/models/user')

function doit (prom) {
  prom.then(a => console.log(a)).catch(err => console.error(err))
}

doit(db())

module.exports = {Asset, User, doit}

// let {Asset, User, doit} = require('./load_db')


'use strict'
let mongoose = require('mongoose')
const _db = null


module.exports = function () {
  return new Promise(function (resolve, reject) {
    if (_db) {
      return resolve(_db)
    }
    let sslOptions = {}

    // if (process.env.NODE_ENV === 'production') {
    //   let ca = Buffer.from(process.env.MONGODB_CA, 'base64').toString('utf8')
    //
    //   sslOptions = {
    //     ssl: true,
    //     sslValidate: true,
    //     sslCA: ca,
    //     // ca: ca,
    //     poolSize: 5,
    //     reconnectTries: 1
    //   }
    // }

    mongoose.Promise = Promise
    let dbOptions = {
      promiseLibrary: Promise,
      useNewUrlParser: true,
      useCreateIndex: true,
      ...sslOptions
    }
    mongoose.connect(process.env.MONGO_URI, dbOptions).then((db) => {
      return resolve(db)
    }, err => {
      return reject(err)
    })
  })
}

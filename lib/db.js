'use strict'
let mongoose = require('mongoose')
const _db = null

module.exports = async function () {
    if (_db) {
      return _db
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
    await mongoose.connect(process.env.MONGO_URI, dbOptions)
}

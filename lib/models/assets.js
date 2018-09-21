'use strict'
const mongoose = require('mongoose')
const encrypt = require('mongoose-encryption')
const Schema = mongoose.Schema

let assetSchema = new Schema(
  {
  media_id: {type: String, required: true, unique: true, uniqueCaseInsensitive: true},
  media_name: {type: String, required: true, unique: true, uniqueCaseInsensitive: true},
  media_type: String, // # (video / tv show/ audio?)
  series: String,
  season: Number,
  episode: Number,
  encryption: {key_id: String, key: String}, // #diff for audio?
  genres: [{type: String}],
  year: Number,
  times_watched: Number,
  cover: {cover_id: String, key: String, iv: String, tag:String, salt: String}
  },
  {timestamps:
      {date_added: 'created_at',
       date_modified: 'modified_at'}
  },
  {collection: 'assets'})

assetSchema.index({'media_name': 'text', 'series': 'text', media_id: 1})
assetSchema.plugin(encrypt, { encryptionKey: process.env.MONGO_KEY, signingKey: process.env.MONGO_SIGNATURE, excludeFromEncryption: ['encryption'] })

module.exports = function () {
  let model
  try {
    // Throws an error if "Name" hasn't been registered
    model = mongoose.model('assets')
  } catch (e) {
    model = mongoose.model('assets', assetSchema)
  }
  return model
}

'use strict'
const mongoose = require('mongoose')
const encrypt = require('mongoose-encryption')
const Schema = mongoose.Schema

let assetSchema = new Schema(
    {
      media_id: {type: String, required: true, unique: true, uniqueCaseInsensitive: true},
      media_name: {type: String, required: true, unique: true, uniqueCaseInsensitive: true},
      media_type: {type: String, default: 'movies'}, // # (video / tv show/ audio?)
      series: String,
      season: Number,
      episode: Number,
      auto_play_series: Boolean,
      encryption: {key_id: String, key: String}, // #diff for audio?
      genres: [{type: String}],
      year: Number,
      times_watched: Number,
      size: Number,
      cover: String,
      default_language: {type: String, default: 'eng'},
      subtitles: [{file: String, language: {type: String, default: "eng"}}],
      encrypted_files: [{key: String, iv: String, tag: String, salt: String, file: String}]
    },
    {
      timestamps:
          {
            date_added: 'created_at',
            date_modified: 'modified_at'
          }
    },
    {collection: 'assets'})

assetSchema.index({'media_name': 'text', 'series': 'text', media_id: 1})
assetSchema.plugin(encrypt, {
  encryptionKey: process.env.MONGO_KEY,
  signingKey: process.env.MONGO_SIGNATURE,
  encryptedFields: ['encryption', 'encrypted_files']
})

assetSchema.methods.sanitized = function () {
  return {
    name: this.name,
    media_type: this.media_type,
    series: this.series,
    season: this.season,
    episode: this.episode,
    auto_play_series: this.auto_play_series,
    genres: this.genres,
    year: this.year,
    times_watched: this.times_watched,
    size: this.size,
    cover: this.cover,
    subtitles: this.subtitles
  }
}

module.exports = function () {
  let model
  try {
    // Throws an error if "Name" hasn't been registered
    model = mongoose.model('assets', assetSchema)
  } catch (e) {
    model = mongoose.model('assets', assetSchema)
  }
  return model
}

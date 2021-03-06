'use strict'
const mongoose = require('mongoose')
const encrypt = require('mongoose-encryption')
const Schema = mongoose.Schema

let assetSchema = new Schema(
    {
      media_id: {type: String, required: true, unique: true, uniqueCaseInsensitive: true},
      media_name: {type: String, required: true, unique: true, uniqueCaseInsensitive: true},
      media_type: {type: String, default: 'movie'}, // # (video / tv show/ audio?)
      series: String,
      season: Number,
      episode: Number,
      auto_play_series: Boolean,
      encryption: {key_id: String, key: String}, // #diff for audio?
      genres: [{_id:false, type: String}],
      year: Number,
      times_watched: {type: Number, default: 0},
      size: Number,
      cover: String,
      processing: {type: Boolean, default: true},
      default_language: {type: String, default: 'en'},
      subtitles: [{_id:false, file: String, language: {type: String, default: "en"}, label: String, file_type: String}],
      encrypted_files: [{_id:false, key: String, iv: String, tag: String, salt: String, file: String}],
      description: String,
      rated: String,
      imdb_id: String,
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

module.exports = mongoose.model('assets', assetSchema)
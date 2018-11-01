'use strict'
const mongoose = require('mongoose')
const Schema = mongoose.Schema

let seriesSchema = new Schema(
    {
      name: {
        type: String,
        required: true,
        unique: true,
        uniqueCaseInsensitive: true
      },
      cover: String,
      encrypted_files: [{_id:false, key: String, iv: String, tag: String, salt: String, file: String}],
      description: String,
      genres: [{_id:false, type: String}],
      year: Number,
    },
    {
      timestamps:
          {
            date_added: 'created_at',
            date_modified: 'modified_at'
          }
    },
    {collection: 'series'})

module.exports = mongoose.model('series', seriesSchema)


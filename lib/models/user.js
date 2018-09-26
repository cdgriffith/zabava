'use strict'
const mongoose = require('mongoose')
const Schema = mongoose.Schema

let userSchema = new Schema(
    {
      username: {
        type: String,
        required: true,
        unique: true,
        uniqueCaseInsensitive: true
      },
      password: {type: String, required: true},
      roles: [{type: String}],
      api_keys : [{
        token: String,
        _id:false,
        token_name: String,
        roles: [{type: String}]
      }]
    },
    {
      timestamps:
          {
            date_added: 'created_at',
            date_modified: 'modified_at'
          }
    },
    {collection: 'users'})

userSchema.index({username: 1})

module.exports = mongoose.model('users', userSchema)


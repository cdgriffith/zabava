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
      roles: [mongoose.Schema.Types.Object]
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

module.exports = function () {
  let model
  try {
    // Throws an error if "Name" hasn't been registered
    model = mongoose.model('users')
  } catch (e) {
    model = mongoose.model('users', userSchema)
  }
  return model
}

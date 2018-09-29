'use strict'
const express = require('express')
const router = express.Router()
const {generateToken} = require('../lib/auth')
const {getProvider} = require('../lib/storage')
const Asset = require('../lib/models/asset')
const {decrypt} = require('../lib/encryption')
const {log} = require('winston')

const provider = getProvider()
const storage = new provider()

router.get('/asset/:id', async (req, res) => {
  let record = await Asset.findOne({media_id: req.params.id})
  return res.status(200).json(record.sanitized())
})




module.exports = router
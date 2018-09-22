const express = require('express')
const router = express.Router()
const {generateToken} = require('../lib/auth')
const {getProvider} = require('../lib/storage')
const request = require('request')
const Asset = require('../lib/models/asset')()
const {decrypt} = require('../lib/encryption')
const {log} = require('winston')

const provider = getProvider()
const storage = new provider()
storage.auth().catch(err => {
  log('error', `Could not authenticate to storage provider: ${err}`)
  process.exit(1)
})

router.get('/', async function (req, res) {
  res.cookie('token', await generateToken('test'), {
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    signed: true
  }).render('login')
})


router.get('/asset/mpeg_dash/:id/*', async function (req, res) {
  let contentId = req.params.id
  let filePath = req.params[0]

  request(await storage.streamUrl(`mpeg_dash/${contentId}/${filePath}`, false),
      {headers: {Authorization: storage.authToken}}).pipe(res)
})


router.get('/asset/covers/:id', async function (req, res) {
  let record = await Asset.findOne({media_id: req.params.id})
  let decrypted
  try {
    let data = await storage.downloadFile(`covers/${req.params.id}.jpg`)
    decrypted = await decrypt({encrypted: data, ...record.cover})
  } catch (err){
    log('error', err.message)
    throw err
  }
  res.contentType('image/jpeg')
  res.end(decrypted, 'binary')
  })


router.get('/folder/:folder', async function (req, res) {
  let records = await Asset.find({media_type: req.params.folder.trim()})
  let files = []
  for (let file of records){
    files.push({cover: `/asset/covers/${file.media_id}`, media_id: file.media_id})
  }

  res.render('folder_viewer', {base: req.params.folder, folders: files})
})


router.get('/video/:id', async function (req, res, next) {
  let record = await Asset.findOne({media_id: req.params.id})
  res.render('video_viewer', record)
})


module.exports = router

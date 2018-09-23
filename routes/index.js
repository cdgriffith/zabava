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
storage.ensureAuth().catch(err => {
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


const getEncryptedAsset = async (contentId, filePath) => {
  log('debug', `Request ${contentId} at ${filePath}`)
    let record = await Asset.findOne({media_id: contentId})
    for (let encrypted of record.encrypted_files) {
      if (filePath === encrypted.file) {
        let data = await storage.downloadFile(filePath)
        return await decrypt({encrypted: data, ...encrypted.toObject()})
      }
    }
    return false
}

router.get('/asset/:id/*', async function (req, res) {
  let contentId = req.params.id
  let filePath = req.params[0]
  let stream = req.query.stream || 'true'
  let contentType = req.query.type || 'image/jpeg'
  log('debug', contentType)
  if (stream.toLowerCase() === 'true'){
    request(await storage.streamUrl(`${contentId}/${filePath}`, false),
        {headers: {Authorization: storage.authToken}}).pipe(res)
  } else {
    let data = await getEncryptedAsset(contentId, `${contentId}/${filePath}`)
    if (!data){
      return res.status(404).end()
    }
    log('debug', contentType.startsWith('text') ? 'utf8' : 'binary')
    res.contentType(contentType)
    return res.end(data, contentType.startsWith('text') ? 'utf8' : 'binary')
  }
})

router.get('/cover/:id', async function (req, res){
  let record = await Asset.findOne({media_id: req.params.id})
  let data = await getEncryptedAsset(req.params.id, record.cover)
  if (!data){
    return res.status(404).end()
  }
  res.contentType('image/jpeg')
  return res.end(data, 'binary')

})

router.get('/subtitles/:id', async function (req, res){
  let record = await Asset.findOne({media_id: req.params.id})
  return record.subtitles
})


router.get('/folder/:folder', async function (req, res) {
  let records = await Asset.find({media_type: req.params.folder.trim()})
  let files = []
  for (let file of records){
    files.push({cover: `/cover/${file.media_id}`, media_id: file.media_id, media_name: file.media_name})
  }

  res.render('folder_viewer', {base: req.params.folder, folders: files})
})


router.get('/video/:id', async function (req, res, next) {
  let record = await Asset.findOne({media_id: req.params.id})
  res.render('video_viewer', record)
})


module.exports = router

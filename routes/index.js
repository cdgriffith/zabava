const express = require('express')
const router = express.Router()
const {generateToken} = require('../lib/auth')
const {getProvider} = require('../lib/storage')
const request = require('request')
const Asset = require('../lib/models/asset')
const User = require('../lib/models/user')
const {decrypt} = require('../lib/encryption')
const {log} = require('winston')
const prettySize = require('prettysize')
const {mediaTypes} = require('../lib/media')
const Minizip = require('minizip-asm.js')
const cache = require('apicache').middleware

const provider = getProvider()
const storage = new provider()

router.get('/', async function (req, res) {
  res.render('login')
})

router.post('/',  async (req, res) => {
  let password = req.body.password
  console.log(req.body)
  if (password === 'a12sd34f') {
    res.cookie('token', await generateToken('test'), {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      signed: true
    }).redirect('/folder/movies')
  }
  res.redirect('/')
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

router.get('/asset/:id/*', async (req, res) => {
  let contentId = req.params.id
  let filePath = req.params[0]
  let stream = req.query.stream || 'true'
  let contentType = req.query.type || 'image/jpeg'
  if (stream.toLowerCase() === 'true'){
    request(await storage.streamUrl(`${contentId}/${filePath}`, false),
        {headers: {Authorization: storage.authToken}}).pipe(res)
  } else {
    let data = await getEncryptedAsset(contentId, `${contentId}/${filePath}`)
    if (!data){
      return res.status(404).end()
    }
    res.contentType(contentType)
    return res.end(data, contentType.startsWith('text') ? 'utf8' : 'binary')
  }
})

router.get('/cover/:id', cache('1 day'),  async (req, res) => {
  let record = await Asset.findOne({media_id: req.params.id})
  let data = await getEncryptedAsset(req.params.id, record.cover)
  if (!data){
    return res.status(404).end()
  }
  res.contentType('image/jpeg')
  return res.end(data, 'binary')

})

// router.get('/subtitles/:id', async (req, res) => {
//   let record = await Asset.findOne({media_id: req.params.id})
//   return record.subtitles
// })


// Views

router.get('/folder/:folder', async (req, res) => {
  let mediaType = req.params.folder.trim()
  if (!Object.keys(mediaTypes).includes(mediaType)){
    throw Error('Not a supported media type')
  }
  let media = mediaTypes[mediaType]
  if (media.series){
    let seriesRaw = await Asset.aggregate([{'$match': {media_type: mediaType}}, {'$group': {_id: '$series'}}])
    let items = []
    for (let series of seriesRaw){
      series = series._id
      let record = await Asset.findOne({media_type: mediaType, series: series}).sort({season: -1})
      items.push({cover: `/cover/${record.media_id}`, series: series})
    }
    res.render('folder_viewer', {series: true, folder: mediaType, items: items, mediaTypes: mediaTypes })

  } else {
    let records = await Asset.find({media_type: mediaType})
    let files = []
    for (let file of records){
      files.push({cover: `/cover/${file.media_id}`, media_id: file.media_id, media_name: file.media_name})
    }
    res.render('folder_viewer', {series: false, folder: mediaType, items: files, mediaTypes: mediaTypes})
  }
})

router.get('/folder/:folder/:series', async (req, res) => {
  let mediaType = req.params.folder.trim()
  if (!Object.keys(mediaTypes).includes(mediaType)){
    throw Error('Not a supported media type')
  }
  let media = mediaTypes[mediaType]

  let seasons = await Asset.aggregate([{'$match': {media_type: mediaType, series: req.params.series.trim()}}, {'$group': {_id: '$season'}}])
  let files = []
  for (let season of seasons){
    season = season._id
    let record = await Asset.findOne({media_type: req.params.folder.trim(), series: req.params.series.trim(), season: season}).sort({episode: -1})
    files.push({cover: `/cover/${record.media_id}`, season: season})
  }
  res.render('series_viewer', {series: req.params.series, items: files, mediaTypes: mediaTypes, folder: mediaType})
})

router.get('/folder/:folder/:series/:season', async (req, res) => {
  let mediaType = req.params.folder.trim()
  if (!Object.keys(mediaTypes).includes(mediaType)){
    throw Error('Not a supported media type')
  }
  let series = req.params.series.trim()
  let season = parseInt(req.params.season.trim())
  let episodes = await Asset.find({media_type: mediaType, series: series, season: season})

  let items = []
  for (let episode of episodes){
    items.push({episode: episode.episode, media_id: episode.media_id})
  }
  res.render('season_viewer', {series: series, items: items, season:season, mediaTypes: mediaTypes, folder: mediaType})
})



router.get('/video/:id', async (req, res) => {
  let record = await Asset.findOne({media_id: req.params.id})
  if (record.times_watched){
    record.times_watched += 1
  } else {
    record.times_watched = 1
  }
  let recordObj = record.toObject()
  recordObj.size = prettySize(record.size)
  res.render('video_viewer', {mediaTypes: mediaTypes, ...recordObj})
  await record.save()
})

router.get('/video/:id/edit', async (req, res) => {
  let record = await Asset.findOne({media_id: req.params.id})
  let recordObj = record.toObject()
  recordObj.cover = `/cover/${recordObj.media_id}`
  res.render('video_editor', {mediaTypes: mediaTypes, ...recordObj})
})


router.get('/export', async (req, res) => {
  let data = {'assets': [],
              'users': [],
              'env': process.env}
  for (let asset of await Asset.find({})){
    data.assets.push(asset.toObject())
  }
  for (let user of await User.find({})){
    data.users.push(user.toObject())
  }

  let options = {}
  let password = req.headers.password || req.query.password || null
  if (password){
    options.password = password
  }

  let myData = JSON.stringify(data)
  let mz = new Minizip()
  mz.append("backup.json", myData, options);
  res.contentType('application/zip')
  let exported = Buffer.from(mz.zip())

  let mzv = new Minizip(exported)
  let compressed = mzv.extract('backup.json', options)
  if (compressed.toString() !== myData){
    throw Error('Validation check failed')
  }
  return res.end(exported, 'binary')
})


module.exports = router

const express = require('express')
const router = express.Router()
const {generateToken, verifyToken, getToken} = require('../lib/auth')
const {getProvider} = require('../lib/storage')
const request = require('request')
const Asset = require('../lib/models/asset')
const User = require('../lib/models/user')
const {encrypt, decrypt} = require('../lib/encryption')
const {log} = require('winston')
const prettySize = require('prettysize')
const {mediaTypes} = require('../lib/media')
const Minizip = require('minizip-asm.js')
const cache = require('apicache').middleware
const uuid = require('uuid')
const sharp = require('sharp')
const crypto = require('crypto')
const path = require('path')
const fs = require('fs-extra')

const provider = getProvider()
const storage = new provider()


const generateId = async (media = false) => {
  let newId = uuid.v4().replace(/-/g, '')
  if (media && await Asset.findOne({media_id: newId})){
    return await generateId()
  }
  return newId
}


router.get('/', async function (req, res) {
  try {
    await verifyToken(getToken(req))
    res.redirect(`/folder/${Object.keys(mediaTypes)[0]}`)
  } catch(err){
    console.error(err)
    res.render('login')
  }
})

router.post('/',  async (req, res) => {
  let password = req.body.password
  if (password === 'a12sd34f') {
    res.cookie('token', await generateToken('test'), {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      signed: false
    }).redirect(`/folder/${Object.keys(mediaTypes)[0]}`)
  }
  res.redirect('/')
})

router.get('/logout', async (req, res) => {
  res.clearCookie('token').redirect('/')
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
    request(await storage.streamUrl(`${contentId}/${filePath}`, false), {headers: {Authorization: storage.authToken}}).pipe(res)
  } else {
    let data = await getEncryptedAsset(contentId, `${contentId}/${filePath}`)
    if (!data){
      return res.status(404).end()
    }
    res.contentType(contentType)
    return res.end(data, contentType.startsWith('text') ? 'utf8' : 'binary')
  }
})

router.get('/cover/:id', cache('3 days'),  async (req, res) => {
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
router.get('/search/:folder', async(req, res, next) => {
  let mediaType = req.params.folder.trim()
  if (!Object.keys(mediaTypes).includes(mediaType)){
    return next(Error('Not a supported media type'))
  }
  let media = mediaTypes[mediaType]

  if (media.series){
    let seriesRaw = await Asset.aggregate(
        [
        {'$match': {media_type: mediaType, processing: false}},
      {'$group': {_id: '$series'}}
      ])
    let items = []
    for (let series of seriesRaw){
      series = series._id
      if (series.toLowerCase().search(req.query.q.toLowerCase()) >= 0){
        let record = await Asset.findOne({media_type: mediaType, series: series, processing: false}).sort({season: 1})
        items.push({cover: `/cover/${record.media_id}`, series: series})
      }
    }
    res.render('folder_viewer', {series: true, folder: mediaType, items: items, mediaTypes: mediaTypes })

  } else {
    let records = await Asset.find({media_type: mediaType, processing: false, media_name: {'$regex' : req.query.q.trim(), '$options' : 'i'}}).limit(35)

    let files = []
    for (let file of records){
      files.push({cover: `/cover/${file.media_id}`, media_id: file.media_id, media_name: file.media_name})
    }
    res.render('folder_viewer', {series: false, folder: mediaType, items: files, mediaTypes: mediaTypes})
  }
})


router.get('/folder/:folder', async (req, res, next) => {
  let mediaType = req.params.folder.trim()
  let start = parseInt(req.query.start || 0)
  if (!Object.keys(mediaTypes).includes(mediaType)){
    return next(Error('Not a supported media type'))
  }
  let media = mediaTypes[mediaType]
  if (media.series){
    let seriesRaw = await Asset.aggregate([{'$match': {media_type: mediaType, processing: false}}, {'$group': {_id: '$series'}}, {'$sort': {'season': 1}}])
    let items = []
    for (let series of seriesRaw){
      series = series._id
      let record = await Asset.findOne({media_type: mediaType, series: series, processing: false}).sort({season: 1})
      items.push({cover: `/cover/${record.media_id}`, series: series})
    }
    res.render('folder_viewer', {series: true, folder: mediaType, items: items, mediaTypes: mediaTypes })

  } else {
    let total = await Asset.find({media_type: mediaType, processing: false}).count()
    let records = await Asset.find({media_type: mediaType, processing: false}).sort('media_name').skip(start).limit(35)
    let files = []
    for (let file of records){
      files.push({cover: `/cover/${file.media_id}`, media_id: file.media_id, media_name: file.media_name})
    }
    res.render('folder_viewer', {series: false, folder: mediaType, items: files, mediaTypes: mediaTypes, start: start, total: total})
  }
})

router.get('/folder/:folder/:series', async (req, res, next) => {
  let mediaType = req.params.folder.trim()
  if (!Object.keys(mediaTypes).includes(mediaType)){
    return next(Error('Not a supported media type'))
  }
  let media = mediaTypes[mediaType]

  let seasons = await Asset.aggregate([{'$match': {media_type: mediaType, series: req.params.series.trim(), processing: false}}, {'$group': {_id: '$season'}}, {'$sort': {'season': 1}}])
  let files = []
  for (let season of seasons){
    season = season._id
    let record = await Asset.findOne({media_type: req.params.folder.trim(), series: req.params.series.trim(), season: season, processing: false}).sort({episode: 1})
    files.push({cover: `/cover/${record.media_id}`, season: season})
  }
  files.sort((a, b) => a.season - b.season)
  res.render('series_viewer', {series: req.params.series, items: files, mediaTypes: mediaTypes, folder: mediaType})
})

router.get('/folder/:folder/:series/:season', async (req, res, next) => {
  let mediaType = req.params.folder.trim()
  if (!Object.keys(mediaTypes).includes(mediaType)){
    return next(Error('Not a supported media type'))
  }
  let series = req.params.series.trim()
  let season = parseInt(req.params.season.trim())
  let episodes = await Asset.find({media_type: mediaType, series: series, season: season, processing: false})

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

router.post('/video/:id/edit', async (req, res, next) => {
  let record = await Asset.findOne({media_id: req.params.id})
  record.media_name = req.body.name
  record.media_type = req.body.type
  if (!isNaN(parseInt(req.body.year))){
    record.year = parseInt(req.body.year)
  }

  // TODO error dialogs
  if (!Object.keys(mediaTypes).includes(req.body.type)){
    return next(Error('invalid media type'))
  }
  if (mediaTypes[req.body.type].series){
    try {
      record.season = parseInt(req.body.season)
      record.episode = parseInt(req.body.episode)
    } catch (err){

    }
    record.series = req.body.series
  }
  record.description = req.body.description
  let genres = []
  for (let genre of req.body.genres.split(",")){
    genres.push(genre.trim())
  }
  record.genres = req.body.genres

  if (req.files.cover) {
    // Make sure image is the right size
    let imageBuffer = req.files.cover.data
    let metadata = sharp(imageBuffer).metadata()
    if (metadata.width !== 300) {
      log('info', 'Resizing cover file')
      imageBuffer = await sharp(imageBuffer).resize(300, 450).toBuffer()
    }

    // Encrypt Image
    log('info', 'encrypting image')
    let coverKey = crypto.randomBytes(16).toString('hex')
    let encryptedImage = await encrypt(imageBuffer, coverKey)
    let coverId = await generateId()
    let remoteCoverPath = `${record.media_id}/files/${coverId}`
    await fs.ensureDir(process.env.UPLOAD_DIR)
    let tmpCover = path.join(process.env.UPLOAD_DIR, coverId)
    await fs.writeFile(tmpCover, encryptedImage.encrypted)
    delete encryptedImage.encrypted

    // Upload cover file
    log('info', 'uploading cover file')
    try {
      await storage.uploadFile(tmpCover, remoteCoverPath)
    } finally {
        await fs.remove(tmpCover)
    }
    // TODO delete old cover encryption info
    record.encrypted_files.push({key: coverKey, file: remoteCoverPath, ...encryptedImage})
    record.cover = remoteCoverPath

  }



  await record.save()
  return res.status(200).redirect(`/video/${req.params.id}/edit`)
})

router.post('/series', async (req, res) => {


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
    return next(Error('Validation check failed'))
  }
  return res.end(exported, 'binary')
})

// router.post('/drm', async (req, res) => {
//   console.log(req.body.kids)
//   res.json({
//     "keys":
//         [{
//           "kty":"oct",
//           "k":"tQ0bJVWb6b0KPL6KtZIy_A",
//           "kid":"LwVHf8JLtPrv2GUXFW2v_A"
//         }],
//     'type':"temporary"
//   })
//
// })


module.exports = router

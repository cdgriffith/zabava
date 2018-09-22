const express = require('express')
const router = express.Router()
const {generateToken} = require('../lib/auth')
const {getProvider} = require('../lib/storage')
const request = require('request')
const Asset = require('../lib/models/asset')()

const provider = getProvider()
const storage = new provider()


router.get('/', async function (req, res) {
  res.cookie('token', await generateToken('test'), {maxAge: 24 * 60 * 60 * 1000, httpOnly: true, signed: true}).render('login')
})

router.post('/', async function (req, res) {
  res.redirect('/video')
})

router.get('/asset/:id/*', async function (req, res) {
  let contentId = req.params.id
  let filePath = req.params[0]

  request(await storage.streamUrl(`mpeg_dash/${contentId}/${filePath}`, false), {headers: {Authorization: storage.authToken}}).pipe(res)
})


router.get('/folder/:folder', async function (req, res) {
  let bucketId, files
  try {
    bucketId = await bb._findBucketId('griff-test')
    files = await bb.listFiles(bucketId)
  } catch (err){
    console.log(err)
    throw err
  }
  let folderNames = await getFolders(bb, bucketId, req.params.folder)
  let folders = []

  folderNames.forEach(folder => {
    folders.push({name: folder, cover: bb.downloadFileNameUrl(process.env.STORAGE_BUCKET_NAME, `${req.params.folder}/${folder}/cover.jpg`)})
  })

  res.render('folder_viewer', {base: req.params.folder, folders: folders})
})

router.get('/video', async function (req, res) {
  let bucketId, files
  try {
    bucketId = await bb._findBucketId('griff-test')
    files = await bb.listFiles(bucketId)
  } catch (err){
    console.log(err)
    throw err
  }
  let fileNames = []

  files.forEach(x => {
    fileNames.push({fileName: x.fileName, fileId: x.fileId})
  })

  res.render('index', {files: fileNames})
})

router.get('/video/:id', async function (req, res, next) {
  let record = await Asset.findOne({media_id: req.params.id})
  res.render('video_viewer', {assetId: req.params.id, ...record.encryption})
})


module.exports = router

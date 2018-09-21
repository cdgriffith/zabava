let express = require('express')
let router = express.Router()
let {Backblaze} = require('../lib/providers/backblaze')
let {generateToken} = require('../lib/auth')
let {getFolders, getProvider} = require('../lib/storage')
let request = require('request')

const provider = new getProvider()(process.env.B2_ACCOUNT_ID, process.env.B2_TOKEN_ID, process.env.B2_TOKEN, process.env.B2_BUCKET)


router.get('/', async function (req, res, next) {
  res.cookie('token', await generateToken('test'), {maxAge: 24 * 60 * 60 * 1000, httpOnly: true, signed: true}).render('login')
})

router.post('/', async function (req, res, next) {
  res.redirect('/video')
})

router.get('/asset/:id/*', async function (req, res) {
  let contentId = req.params.id
  let path = req.params[0]

  request(await provider.streamUrl(contentId + "/" + path, false), {'Authorization': provider.authToken}).pipe(res)

})


router.get('/folder/:folder', async function (req, res, next) {
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
    folders.push({name: folder, cover: bb.downloadFileNameUrl(process.env.B2_BUCKET, `${req.params.folder}/${folder}/cover.jpg`)})
  })

  res.render('folder_viewer', {base: req.params.folder, folders: folders})
})

router.get('/video', async function (req, res, next) {
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
  res.render('video_viewer', {assetId: req.params.id})
})


module.exports = router

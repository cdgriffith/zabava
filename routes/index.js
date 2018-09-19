let express = require('express')
let router = express.Router()
let {Backblaze} = require('../lib/backblaze')
let {generateToken} = require('../lib/auth')
let {getFolders} = require('../lib/storage')

const bb = new Backblaze(process.env.B2_ACCOUNT_ID, process.env.B2ID, process.env.B2KEY)


router.get('/', async function (req, res, next) {
  res.cookie('token', await generateToken('test'), {maxAge: 24 * 60 * 60 * 1000, httpOnly: true, signed: true}).render('login')
})

router.post('/', async function (req, res, next) {



  res.redirect('/video')
})


router.get('/folder/:folder', async function (req, res, next) {
  let bucketId, files
  try {
    bucketId = await bb.findBucket('griff-test')
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
    bucketId = await bb.findBucket('griff-test')
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
  await bb.ensureAuth()
  let bucketId = await bb.findBucket(process.env.B2_BUCKET)
  let filename = await bb.findFileName(bucketId, req.params.id)
  if (!filename){
    throw Error('No file found')
  }
  res.render('video_viewer', {src: bb.downloadFileNameUrl(process.env.B2_BUCKET, filename)})
})


module.exports = router

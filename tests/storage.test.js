require('dotenv').config()
const storage = require('../lib/storage')
const Backblaze = require('../lib/providers/backblaze')
const assert = require('assert')
const winston = require('winston')

const console = new winston.transports.Console()

winston.add(console)
winston.level = process.env.LOG_LEVEL || 'debug'


describe('storage', () => {
  it('should be able to abstract', done => {
    class Provider extends storage.Storage{
      async uploadFile(localFile, RemoteFile){
        return true
      }
    }

    let p = new Provider()
    p.uploadFile('a', 'b').then(a => {assert(a); return done() })
  })

  it('should be able to upload a file to backblaze', async () => {
    let b2 = new Backblaze(process.env.STORAGE_ACCOUNT_ID, process.env.STORAGE_TOKEN_ID,
      process.env.STORAGE_TOKEN, process.env.STORAGE_BUCKET_NAME)

    console.log(await b2.uploadFile(__dirname + '/test.txt', 'folder/folder2/test.txt'))

  }).timeout(10000)

})


'use strict'
const util = require('util')
const exec = util.promisify(require('child_process').exec)


exec(`mp4dash ${video}`, (error, stdout, stderr) => {
  if (error) {
    console.error(`exec error: ${error}`)
    return
  }
  console.log(`stdout: ${stdout}`)
  console.log(`stderr: ${stderr}`)
})



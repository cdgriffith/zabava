let gulp = require('gulp')

gulp.task('link-dependencies', function () {
  gulp.src("./node_modules/video.js/dist/video.js")
  .pipe(gulp.dest("./public/javascript/"))

  gulp.src("./node_modules/video.js/dist/video-js.css")
  .pipe(gulp.dest("./public/stylesheets/"));

  gulp.src("./node_modules/bootstrap/dist/js/*")
  .pipe(gulp.dest("./public/javascript/"))

  gulp.src("./node_modules/bootstrap/dist/css/*")
  .pipe(gulp.dest("./public/stylesheets/"))

  gulp.src("./node_modules/jquery/dist/jquery*")
  .pipe(gulp.dest("./public/javascript/"))

  gulp.src("./node_modules/shaka-player/dist/shaka-player.compiled.debug.js")
      .pipe(gulp.dest("./public/javascript/"))
})

gulp.task('default', ['link-dependencies'])

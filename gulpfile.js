let gulp = require('gulp')

gulp.task('link-dependencies', function () {
  gulp.src("./node_modules/bootstrap/dist/js/*")
  .pipe(gulp.dest("./public/javascript/"))

  gulp.src("./node_modules/bootstrap/dist/css/*")
  .pipe(gulp.dest("./public/stylesheets/"))

  gulp.src("./node_modules/jquery/dist/jquery*")
  .pipe(gulp.dest("./public/javascript/"))

  gulp.src("./node_modules/shaka-player/dist/shaka-player.compiled.debug*")
      .pipe(gulp.dest("./public/javascript/"))

  gulp.src("./node_modules/prettysize/index.js")
      .pipe(gulp.dest("./public/javascript/prettysize.js"))

})

gulp.task('default', ['link-dependencies'])

var path = require('path');
var through2 = require('through2');
var PluginError = require('gulp-util').PluginError;
var colors = require('gulp-util').colors;
var log = require('gulp-util').log;
var QN = require('qn');
var Moment = require('moment');
var fs = require('fs');
var Q = require('q');

module.exports = function (qiniu, option) {
  option = option || {};

  var qn = QN.create(qiniu)
    , version = Moment().format('YYMMDDHHmm')
    , filesTotal = 0
    , filesSuccessTotal = 0
    , qs = []

  return through2.obj(function (file, enc, next) {
    var that = this;
    if (file._contents === null) return next();
    filesTotal++;

    var filePath = path.relative(file.base, file.path);
    var fileKey = option.prefix + (option.prefix[option.prefix.length - 1] === '/' ? '' : '/') + (option.versioning ? version + '/' : '') + filePath;

    qs.push(Q.nbind(qn.upload, qn)(file._contents, {key: fileKey})
      .then(function () {
        filesSuccessTotal++;
        log('Uploaded', colors.green(filePath), '→', colors.green(fileKey));
      }, function (err) {
        that.emit('error', new PluginError('gulp-qiniu', err));
      }));

    next();
  }, function () {
    Q.all(qs)
      .then(function (rets) {
        log('Total uploaded:', colors.green(rets.length));
        if (!option.versioning) return;
        log('Version:', colors.green(version));

        if (option.versionFile) {
          fs.writeFileSync(option.versionFile, JSON.stringify({version: version}))
          log('Write version file:', colors.green(option.versionFile));
        }
      }, function (err) {
        log('Failed upload files:', err.message);
      });
  });
};
let mongoose = require('mongoose');
let config = require('./config/app_' + process.env.NODE_ENV);
let Url = require("./models/url");
let indexer = require('./modules/indexer');
let utils = require('./modules/utils');
mongoose.connect(config.database, {useNewUrlParser: true});
let CronJob = require('cron').CronJob;

console.log('Starting indexer service...');
new CronJob('*/5 * * * * *', function() {

  utils.remainingUrls(function(err, count) {
    if(err){
      console.log(err);
    }
    var remainingUrls = config.api_daily_quota - count;

    if(remainingUrls > 0){
      var urls = Url.find({ 'status': 'pending' }).limit(remainingUrls);
      urls.exec(function (err, urls) {
        if (err) return handleError(err);
        urls.forEach(function(url, index, arr){
          console.log('Notifying url: ' + url.location);

          var initializeIndexer = indexer.notify(url.location, url.type);
          initializeIndexer.then(function(urlDetails) {

            if(urlDetails.error){
              url.response_status_code = urlDetails.error.code;
              url.response_status_message = urlDetails.error.message;
              url.notifytime = new Date();
              url.status = 'updated';
              url.updatedat = new Date();
            }else{
              url.response_status_code = '200';
              url.response_status_message = urlDetails.urlNotificationMetadata.latestUpdate.type;
              url.notifytime = urlDetails.urlNotificationMetadata.latestUpdate.notifyTime;
              url.status = 'updated';
              url.updatedat = new Date();
            }

            url.save(function (err) {
              if (err) return handleError(err);
            });

          }, function(err) {
            console.log(err);
          });

        });
      });
    }else{
      console.log('Exeeding daily quota!');
    }

  });

}, null, true, 'Europe/Rome');
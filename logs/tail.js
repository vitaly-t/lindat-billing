var fs = require('fs');
var path = require('path');
var jsonName = './log-files.json';
var info = require(jsonName);
var parser = require('./parser');

/**
 * Return bytesToRead bytes of data from the end of the file and optionally calls the provided callback with the new data
 * as the file is modified and new data is available.
 *
 * @param  {String} filePath Absolute path to a file.
 * @param  {Number} bytesToRead How many bytes from the end of the file to read.
 * @param  {Number} beggining
 * @param  {Boolean} follow If true, the provided callback will be continuously called (until un-subscribed) with the new data
 *                          as the file is modified and new data is available (aka tail -F).
 * @param  {Function} callback Callback which is called with an error as the first argument, data with as the second one
 *                              and the un-subscribe function as the third one.
 */
function tailFile(filePath, bytesToRead, beggining, follow, callback) {
    var stat, watchFileListener;
    var filename = filePath.substr(filePath.lastIndexOf('/')+1);
    //console.log("should read: " + bytesToRead);

    /**
     * Read a file.
     *
     * @param {Number} start Start offset.
     * @param {Number} end End offset.
     */
    function readFile(start, end) {
        var fileStream = fs.createReadStream(filePath, {start: start, end: end});
        console.log("reading from ", start, " to ", end);
        fileStream.on('data', function(data) {
            // tady to neco chce vylepsit nejak
            parser(data, function () {} );
            callback(null, filename, data, unsubscribe);
        });

        fileStream.on('error', function(err) {
            if (follow) {
                unsubscribe();
            }

            callback(err, filename, null, null);
        });
    }

    function unsubscribe() {
        stat.removeListener('change', watchFileListener);

        if (Object.keys(stat._events).length === 0) {
            // No more listeners left, unwatch the file
            fs.unwatchFile(filePath);
            console.log("stopped watching " + filePath);
        }
    }

    watchFileListener = function(curr, prev) {
        var start, end;

        var inodeCurr = curr.ino;
        var inodePrev = prev.ino;

        var sizeCurr = curr.size;
        var sizePrev = prev.size;
        var sizeDiff = sizeCurr - sizePrev;

        var mtimeCurr = curr.mtime.valueOf();
        var mtimePrev = prev.mtime.valueOf();

        //if ((inodeCurr !== inodePrev) || (sizeDiff < 0) || (sizeDiff === 0 && mtimeCurr !== mtimePrev)) {
        if ((sizeDiff < 0) || (sizeDiff === 0 && mtimeCurr !== mtimePrev)) {
            // Log file was rotated or truncated
            start = 0;
            end = (bytesToRead > sizeCurr) ? sizeCurr : bytesToRead;
        }
        else if (sizeDiff === 0) {
            // No change in the file size (probably file ownership or permissions were changed), ignore this event
            return;
        }
        else {
            start = sizePrev;
            end = sizeCurr;
        }

        readFile(start, end);
    };

    if (follow) {
        console.log("watching " + filePath);
        stat = fs.watchFile(filePath, watchFileListener);
    }

    fs.stat(filePath, function(err, stats) {
        var start, end;
        if (err) {
            if (follow) {
                unsubscribe();
            }
            callback(err, filename, null, null);
            return;
        }

        //start = (bytesToRead >= stats.size) ? 0 : (stats.size - bytesToRead);
        start = beggining;
        end = stats.size;

        if (end === 0) {
            // Empty file
            callback(null, filename, '', (follow) ? unsubscribe : null);
            return;
        }
        //console.log("read: " + start + " " + end);
        readFile(start, end);
    });
}

exports.tailFile = tailFile;
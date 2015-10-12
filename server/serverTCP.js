var net = Npm.require('net');
var fs = Npm.require('fs');
var os = Npm.require('os');
var path = Npm.require('path');


var IP_ADDRESS = '10.18.207.99' // indirizzo IP dell'iPad

// numero di segmenti salvati per ogni pressione del BOTTONE
var SAVED_SEGMENTS = 4 // pari!


var SEGMENT_TIME = 2
var HLS_SEGMENT_TIME = 1

// numero di segmenti mantenuti nella finestra temporale (almeno il doppio di SAVED_SEGMENTS)
var SEGMENT_WRAP = 8
var HLS_SEGMENT_WRAP = 3

var VIDEO_SEGMENT_TIME = 10


// configurazione ffmpeg per merge dei segmenti
var FFMPEG_TRANSCODE_LIB = 'libx264'
var FFMPEG_TRANSCODE_CRF = 26
var HLS_FFMPEG_TRANSCODE_CRF = 28
var FFMPEG_TRANSCODE_PRESET = 'medium'
var HLS_FFMPEG_TRANSCODE_PRESET = 'medium'



//var TMP_ROOT = os.tmpdir();
var TMP_ROOT = process.cwd().split('build')[0]
//console.log(TMP_ROOT)
var VIDEOS_PATH = path.join(TMP_ROOT, 'videos');
var FFMPEG_RTSP_PATH = path.join(TMP_ROOT, 'ffmpeg_rtsp');
var FFMPEG_SAVED_PATH = path.join(FFMPEG_RTSP_PATH, 'saved');


var MAIN_SERVER_PORT = 3003;
var HLS_SERVER_PORT = 3004;


/*
 * Utilities per il filesystem
 */

var mkdirSync = function (path) {
	try {
		fs.mkdirSync(path);
	} catch (e) {
		if (e.code != 'EEXIST') throw e;
	}
}

var deleteFolderRecursive = function (dirPath) {
	if (fs.existsSync(dirPath)) {
		fs.readdirSync(dirPath).forEach(function (file, index) {
			var curPath = path.join(dirPath, file);
			if (fs.lstatSync(curPath).isDirectory()) { // recurse
				deleteFolderRecursive(curPath);
			} else { // delete file
				fs.unlinkSync(curPath);
			}
		});
		fs.rmdirSync(dirPath);
	}
}

var copyFile = function (source, target, cb) {
	var cbCalled = false;

	var rd = fs.createReadStream(source);
	rd.on("error", function (err) {
		done(err);
	});
	var wr = fs.createWriteStream(target);
	wr.on("error", function (err) {
		done(err);
	});
	wr.on("close", function (ex) {
		done();
	});
	rd.pipe(wr);

	function done(err) {
		if (!cbCalled) {
			cb(err);
			cbCalled = true;
		}
	}
}

var copyListFile = function (list, sourcePath, targetPath, cb) {
	var ok = true;
	for (i = 0; (i < list.length) && ok; i++) {
		ok = copyFile(path.join(sourcePath, list[i]), path.join(targetPath, list[i]), cb)
	}

	return ok;
}



var _id_mindwave_session = null;

var mindwaveData = [];

var spawn = Npm.require('child_process').spawn
var ffmpeg

mkdirSync(FFMPEG_RTSP_PATH);
mkdirSync(FFMPEG_SAVED_PATH);
mkdirSync(VIDEOS_PATH);

var tcp_connected = false;

var server = net.createServer(Meteor.bindEnvironment(function (socket) {
	console.log('** serverTCP: connected to ' + socket.remoteAddress + ':' + socket.remotePort)

	socket.on('data', Meteor.bindEnvironment(function (data) {
		if (tcp_connected == false) {
			tcp_connected = true;
			console.log('** serverTCP: receiving data from ' + socket.remoteAddress + ':' + socket.remotePort)

			fs.closeSync(fs.openSync(path.join(FFMPEG_RTSP_PATH, 'seglist.m3u8'), 'w'));

			console.log('** serverTCP: saving video files to ' + FFMPEG_RTSP_PATH)

			ffmpeg = spawn('ffmpeg', ('-y -i rtsp://' + IP_ADDRESS + ' -c:v copy -f segment -segment_format mp4 -segment_time ' +
				SEGMENT_TIME + ' -segment_wrap ' + SEGMENT_WRAP + ' -segment_list_type csv -segment_list_size ' + SEGMENT_WRAP +
				' -segment_list seglist.csv fragment-%03d.mp4' + ' -c:v libx264 -preset ' + HLS_FFMPEG_TRANSCODE_PRESET +
				' -crf ' + HLS_FFMPEG_TRANSCODE_CRF + ' -f ssegment -segment_format mpegts -segment_time ' + HLS_SEGMENT_TIME +
				' -segment_wrap ' + HLS_SEGMENT_WRAP + ' -segment_list_type m3u8 -segment_list_size ' + HLS_SEGMENT_WRAP +
				' -segment_list seglist.m3u8 fragment-%03d.ts').split(' '), { cwd: FFMPEG_RTSP_PATH });

			ffmpeg.stdout.on('data', function (data) {
				//console.log('stdout: ' + data);
			});
			ffmpeg.stderr.on('data', function (data) {
				//console.log('stderr: ' + data);
			});
			ffmpeg.on('close', function (code) {
				//console.log('ffmpeg closed with ' + code);   
			});
		}

		if (data.length < 50) {
			if (mindwaveData.length != 0) {
				mindwaveData[mindwaveData.length - 1] = mindwaveData[mindwaveData.length - 1].concat([data])
			} 

			// se arriva blink per primo lo ignora.
			return;
		}

		if (mindwaveData.length < SEGMENT_TIME * SAVED_SEGMENTS) {
			mindwaveData.push([data]);
		} else {
			mindwaveData.shift();
			mindwaveData.push([data]);
		}

		//console.log(JSON.parse(mindwaveData[mindwaveData.length - 1]));
		//console.log(_id_mindwave_session);
		if (_id_mindwave_session != null) {
			//Meteor.bindEnvironment( function (data) {
			//console.log('inserisco in ' + _id_mindwave_session + ' i dati ' + data)
			mindwaveSession.update(
				{ "_id": _id_mindwave_session },
				{ $push: { "sessionData": JSON.parse(data) } },
				function () {
					//console.log('saved session data');
				});
			//}, function () {console.log('ERRROR BINDING SESSION DATA SAVE')} );

		}


	}, function () { console.log('ERRROR BINDING SESSION DATA SAVE') })); // socket.on data

	socket.on('error', function () {
		console.log('** serverTCP: socket error, ' + socket.remoteAddress + ':' + socket.remotePort)
	});

	socket.on('close', function () {
		console.log('** serverTCP: socket close')
	});

	socket.on('end', function () {
		console.log('** serverTCP: socket end')
	});

	socket.on('timeout', function (data) {
		console.log('** serverTCP: socket timeout, ' + socket.remoteAddress + ':' + socket.remotePort)
	});


}, function () {/*console.log('BIND SU CREaTE serverTCP')*/ }));

server.listen(MAIN_SERVER_PORT, function () {
	console.log('** serverTCP: listening on ' + MAIN_SERVER_PORT + '.')
});



/*
 * HLS file server
 */

var http = Npm.require('http'),
	url = Npm.require('url');

http.createServer(function (req, res) {
	//console.log('** HLS file server: ' + req.url + ' requested');
	var mimeTypes = {
	    "html": "text/html",
	    "jpeg": "image/jpeg",
	    "jpg": "image/jpeg",
	    "png": "image/png",
	    "js": "text/javascript",
	    "css": "text/css",
		"m3u8": "application/x-mpegURL",
		"ts": "video/MP2T"
	};

    var uri = url.parse(req.url).pathname;
    var filename = path.join(TMP_ROOT, uri);
    fs.exists(filename, function (exists) {
        if (!exists) {
            console.log('** HLS file server: ' + filename + ' does not exist');
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.write('404 Not Found\n');
            res.end();
            return;
        }
        var mimeType = mimeTypes[path.extname(filename).split(".")[1]];
        res.writeHead(200, { 'Content-Type': mimeType });

        var fileStream = fs.createReadStream(filename);
        fileStream.pipe(res);

    }); //end path.exists
}).listen(HLS_SERVER_PORT, function () {
	console.log('** HLS file server: listening for HLS file requests on ' + HLS_SERVER_PORT + '.')
});






function createJSONVideoPlayer(command, url, time) {
	var object = { "command": command, "url": url, "time": time }
	return JSON.stringify(object);
}


Meteor.methods({
	'schiacciaBottone': function (number, name, streamingVideo, startTime) {
		//number = number + '' + name;
		console.log('** \'' + name + '\' pressed.');

		var segmentlist_file = path.join(FFMPEG_RTSP_PATH, 'seglist.csv');

		patientCode = 0;
		var fileList;
		var ok = undefined;

		// fs.readFile(segmentlist_file, {encoding: 'utf8'}, function (err, data) {
		// 	if (err) {
		// 		ok=false;
		// 		return;
		// 	}

		// 	fileList = data.split('\n');
		// 	if (fileList.length < (SAVED_SEGMENTS/2 + 2)) {
		// 		ok = false;
		// 		return;
		// 	}

		// 	fileList = data.split('\n').slice(-SAVED_SEGMENTS/2-1, -1).map(function(c, i, a) {
		// 		return c.split(',')[0];
		// 	});
		// });

		data = fs.readFileSync(segmentlist_file, { encoding: 'utf8' });
		fileList = data.split('\n');
		if (fileList.length < (SAVED_SEGMENTS / 2 + 2)) {
			ok = false;
			console.log('** Segmenti non sufficienti, esco...')
			return;
		}

		fileList = data.split('\n').slice(-SAVED_SEGMENTS / 2 - 1, -1).map(function (c, i, a) {
			return c.split(',')[0];
		});


		if (ok == false)
			return false;
		// console.log("prima di watch");
		// console.log(fileList);
		var count = SAVED_SEGMENTS / 2;
		var timestamp = new Date();
		var dirName = '' + timestamp.getFullYear() + ('0' + (timestamp.getMonth() + 1)).slice(-2) + ('0' + timestamp.getDate()).slice(-2) + '_' + patientCode + '_' + _id_mindwave_session;

		mkdirSync(path.join(FFMPEG_SAVED_PATH, dirName));

		var JSONMindwaveData = null;
		var videoPath = null;


		var watcher = fs.watch(segmentlist_file, Meteor.bindEnvironment(function (event, filename) {
			if (count < SAVED_SEGMENTS) {
				data = fs.readFileSync(segmentlist_file, { encoding: 'utf8' });

				fileList = fileList.concat(data.split('\n').slice(-2, -1).map(function (c, i, a) {
					return c.split(',')[0];
				}));

			} else {

				watcher.close();
				var copiedMindwaveData = [];
				//var copy = spawn('cp', ['-vf'].concat(fileList.concat([path.join(FFMPEG_SAVED_PATH, number)])), {cwd:FFMPEG_RTSP_PATH});
				var element;
				for (var i = 0; i < mindwaveData.length; i++) {
					element = []
					for (var j = 0; j < mindwaveData[i].length; j++) {
						//console.log(i + "    " + j);
						//console.log(JSON.parse(mindwaveData[i][j].toString('utf8')));
						element.push([mindwaveData[i][j]]);
					}
					copiedMindwaveData.push(element);
				}

				JSONMindwaveData = [];

				for (var i = 0; i < copiedMindwaveData.length; i++)
					for (var j = 0; j < copiedMindwaveData[i].length; j++) {
						/*console.log(i + "    " + j);
						console.log(JSON.parse(copiedMindwaveData[i][j].toString('utf8')))*/
						JSONMindwaveData[i] = JSON.parse(copiedMindwaveData[i][j]);
					}
		  		
				//fa copy su tutta lista ma bisogna sostituire il copy con lo spawn e vedere se mettere come callback quello che c'e' su copy.on('exit')
				//copyListFile(fileList, FFMPEG_RTSP_PATH, path.join(FFMPEG_SAVED_PATH), function(error) {console.log(error)})
				var numberCopied = 0;
				for (var i = 0; i < fileList.length; i++) {
					copyFile(path.join(FFMPEG_RTSP_PATH, fileList[i]), path.join(FFMPEG_SAVED_PATH, dirName, fileList[i]), Meteor.bindEnvironment(function (error) {
						if (error) {
							console.log(error)
						} else {
							numberCopied++;

							if (numberCopied == SAVED_SEGMENTS) {

								var stringFile = '';
								for (var i = 0; i < fileList.length; i++) {

									stringFile += "file '" + fileList[i] + "'\n";
								}
								//al posto del nome evento forse meglio id, se poi sara' configurabizzabile
								var videoName = '' + ('0' + timestamp.getHours()).slice(-2) + ('0' + timestamp.getMinutes()).slice(-2) + ('0' + timestamp.getSeconds()).slice(-2) + '_' + name
								fs.writeFileSync(path.join(path.join(FFMPEG_SAVED_PATH, dirName), 'list.txt'), stringFile);



								var ffmpegMerge = spawn('ffmpeg', ('-y -f concat -i list.txt -c:v ' + FFMPEG_TRANSCODE_LIB +
									' -preset ' + FFMPEG_TRANSCODE_PRESET + ' -crf ' + FFMPEG_TRANSCODE_CRF + ' ' + videoName + '.mp4').split(' '), { cwd: path.join(FFMPEG_SAVED_PATH, dirName) });

								ffmpegMerge.on('exit', Meteor.bindEnvironment(function (code) {

									fs.unlinkSync(path.join(path.join(FFMPEG_SAVED_PATH, dirName), 'list.txt'));

									for (var i = 0; i < fileList.length; i++) {

										fs.unlinkSync(path.join(path.join(FFMPEG_SAVED_PATH, dirName), fileList[i]));
									}

									if (code == 0) {
										watcher.close();
										ok = true;
										videoPath = path.join(path.join(FFMPEG_SAVED_PATH, dirName), videoName + '.mp4');
										console.log('** Saved: ' + videoPath);


										listEvent.insert({
											"mindwaveData": JSONMindwaveData,
											"patientVideoPath": videoPath,
											"streamingVideo": streamingVideo,
											"startTime": startTime,
											"patientCode": patientCode,
											"createdAt": timestamp,
											"eventName": name
										});
									

										//Salvo nella Collection listEvent
					   					
									} else {
										watcher.close();
										ok = false;
										console.log('Error saving ' + path.join(path.join(FFMPEG_SAVED_PATH, dirName), videoName + '.mp4'))
									}
								}, function (e) { console.log("Error Environment 1"); console.log(e) }));




							}
						}
					}, function (e) { console.log("Error Environment 2") }))
				}

				/*copy.on('exit', function (code) {
		   			if (code == 0) {
		   				var stringFile = '';
		   				for (var i=0; i<fileList.length; i++) {
		   					
		   					 stringFile += "file '" + fileList[i] + "'\n";
		   				}

		   							
		   				fs.writeFileSync(path.join(path.join(FFMPEG_SAVED_PATH, number),'list.txt'), stringFile) ;

		   				
		  			
		  				var ffmpegMerge = spawn('ffmpeg', ('-y -f concat -i list.txt -c:v ' + FFMPEG_TRANSCODE_LIB +
		  					' -preset ' + FFMPEG_TRANSCODE_PRESET + ' -crf ' + FFMPEG_TRANSCODE_CRF + ' intero.mp4').split(' '), {cwd:path.join(FFMPEG_SAVED_PATH, number)});

		  				ffmpegMerge.on('exit', function (code) {
		  					
		  					fs.unlinkSync(path.join(path.join(FFMPEG_SAVED_PATH, number),'list.txt'));
		  					
		  					for (var i=0; i<fileList.length; i++) {
		  						
		   						fs.unlinkSync(path.join(path.join(FFMPEG_SAVED_PATH, number), fileList[i]));
		   					}
	
		   					if (code == 0){
		   						watcher.close();
		   						ok=true;
		   						console.log('Salvato ' + path.join(path.join(FFMPEG_SAVED_PATH, number),'intero.mp4'))
		   					} else {
		   						watcher.close();
		  						ok=false;
		  						console.log('Errore nel salvataggiouo ' + path.join(path.join(FFMPEG_SAVED_PATH, number),'intero.mp4'))
		  					}
		  				});

		  				 
		   			}
		 		});*/



			}

			count++;

		}, function (e) { console.log("Error Environment 3") }));



	},

	'command_video': function (command, url, time) {
		if (command == 'start') {
			_id_mindwave_session = mindwaveSession.insert({
				"patientCode": 0,
				"createdAt": new Date(),
				"sessionData": ['']
			})

			//console.log('create session ' + _id_mindwave_session);
		} else if (command == 'false') {
			_id_mindwave_session = null;
		}

		if (clientSocketVideoPlayer) {
            //console.log('scrivo');
            clientSocketVideoPlayer.write(createJSONVideoPlayer(command, url, time));
		}


	},

	/*'videoUpload': function (buffer, name) {
		name = name.replace(" ", "_");
		var fileName = name.split(".")[0];
		var uploadPath = path.join(VIDEOS_PATH, fileName);
		mkdirSync(uploadPath);
		var filePath = path.join(uploadPath, name);
		//var file = fs.openSync(path.join(uploadPath, name), 'a+');
        //fs.writeSync(file, buffer, 0, buffer.length);
        fs.writeFileSync(filePath, buffer, { flags: 'a+', encoding: 'binary' });
        //console.log(buffer)
		//console.log(('-y -i '+name+' -c:v libx264 -f segment -segment_format mpegts -segment_time ' + VIDEO_SEGMENT_TIME +
		//			' -segment_list_type m3u8 -segment_list "'+fileName+'.m3u8" "'+fileName+'-%03d.ts"').split(' '))
        ffmpegSegmenter = spawn('ffmpeg', ('-y -i ' + name + ' -c:v libx264 -f segment -segment_format mpegts -segment_time ' + VIDEO_SEGMENT_TIME +
			' -segment_list_type m3u8 -segment_list ' + fileName + '.m3u8 ' + fileName + '-%03d.ts').split(' '), { cwd: uploadPath });

        ffmpegSegmenter.stdout.on('data', function (data) {
			//console.log('stdout: ' + data);
		});
		ffmpegSegmenter.stderr.on('data', function (data) {
			//console.log('stderr: ' + data);
		  
		});
		ffmpegSegmenter.on('close', function (code) {
			//console.log('ffmpeg closed with ' + code);
			console.log(code)
			if (code != 0) {
		   	
				//throw new Meteor.Error(500, 'Caricamento fallito')
				return "Caricamento non completato"
			}
			return 'Caricamento Completato';



		});


    },

	'transformUploadedVideo': function (a) {
		//console.log("copy " +a)
		var uploadedName = videoUpload.find({}, { sort: { uploadedAt: -1 }, limit: 1 }).fetch()[0].copies.images.key
		var originalNameWithExt = videoUpload.find({}, { sort: { uploadedAt: -1 }, limit: 1 }).fetch()[0].original.name.replace(" ", "_")
		var originalName = originalNameWithExt.split(".")[0];
		var folderName = path.join(VIDEOS_PATH, originalName);

		mkdirSync(folderName)
		copyFile(path.join(TMP_ROOT, 'cfs', 'files', 'images', uploadedName), path.join(folderName, originalNameWithExt), function (error) { console.log(error) })
		//fs.createReadStream(path.join(TMP_ROOT,'cfs','files','images',uploadedName)).pipe(fs.createWriteStream(path.join(folderName, originalNameWithExt)));
		//fs.writeFileSync(path.join(TMP_ROOT,'cfs','files','images',uploadedName), path.join(folderName, originalNameWithExt));
	},*/

	'connect': function () {
		var HOST = IP_ADDRESS;
		var PORT = 6969;

		var client = new net.Socket();
		client.connect(PORT, HOST, function () {

			console.log('** Sending server IP to: ' + HOST + ':' + PORT);
			// Write a message to the socket as soon as the client is connected, the server will receive it as message from the client 
		    
		
		});
		
		// Add a 'data' event handler for the client socket
		// data is what the server sent to this socket
		client.on('data', function (data) {
		    
			//console.log('DATA: ' + data);
			// Close the client socket completely
			client.destroy();

		});
		
		// Add a 'close' event handler for the client socket
		client.on('close', function () {
			console.log('** Done');
		});

		client.on('error', function () {
			console.log('ERRORE');
		});
	}


});

/*videoUpload.on('uploaded', function (fileObj) {
  // do something
  console.log("uploaded "+fileObj._id)
});*/

videoUpload.on('stored', Meteor.bindEnvironment(function (fileObj) {
	// do something
	//bindEnvironment penso serva a temporizzare adeguatamente tutto (suggerito da meteor stesso)
	console.log("stored " + fileObj._id)
	//var uploadedName = Images.find({},{sort : {uploadedAt : -1}, limit:1}).fetch()[0].copies.images.key
	var uploadedName = videoUpload.find({ _id: fileObj._id }).fetch()[0].copies.videoupload.key
	var originalNameWithExt = videoUpload.find({ _id: fileObj._id }).fetch()[0].original.name.replace(" ", "_")
	var originalName = originalNameWithExt.split(".")[0];
	var folderName = path.join(VIDEOS_PATH, originalName);
	
	//creo cartella sotto .meteor/videos e copio file
	mkdirSync(folderName)
	copyFile(path.join(TMP_ROOT, 'cfs', 'files', 'videoupload', uploadedName), path.join(folderName, originalNameWithExt), Meteor.bindEnvironment(function (error) {
		if (error) {
			console.log("Errore")
			videoList.remove({ _id: fileObj._id })
			videoUpload.remove({})
		} else {
			console.log("Tutto OK")
			videoUpload.remove({})
	
			//segmento il video
			console.log("inizio segment")
			ffmpegSegmenter = spawn('ffmpeg', ('-y -i ' + originalNameWithExt + ' -c:v libx264 -crf 23 -preset ultrafast -c:a aac -strict experimental -f stream_segment -segment_format mpegts -segment_time ' + VIDEO_SEGMENT_TIME +
				' -segment_list_type m3u8 -segment_list ' + originalName + '.m3u8 ' + originalName + '-%03d.ts').split(' '), { cwd: folderName });

			ffmpegSegmenter.stdout.on('data', function (data) {
				//console.log('stdout: ' + data);
			});
			ffmpegSegmenter.stderr.on('data', function (data) {
				//console.log('stderr: ' + data);
			  
			});
			ffmpegSegmenter.on('close', Meteor.bindEnvironment(function (code) {
				//console.log('ffmpeg closed with ' + code);
				console.log(code)
				if (code == 0) {
					var m3u8FileName =
						fs.unlinkSync(path.join(folderName, originalNameWithExt));
					console.log('Conversion successfull')
					videoList.update({ _id: fileObj._id }, { $set: { "segmented": "yes", "path": folderName, "name": originalName + ".m3u8" } })
				} else {
					videoList.remove({ _id: fileObj._id })
					deleteFolderRecursive(folderName)
					console.log("Error");
				}
			}), function () { });
		}

	}), function () { })

	//cancello riferimento e file
	
	
	
}), function () { console.log("no bind") });

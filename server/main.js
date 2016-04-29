var net = Npm.require('net')
var fs = Npm.require('fs')
var os = Npm.require('os')
var path = Npm.require('path')
var spawn = Npm.require('child_process').spawn


//
// Configurazione
//

//
// Lo stream RTSP trasmesso dalla videocamera dell'iPad viene segmentato
// durante la ricezione ed in seguito 'riassemblato'.
//
// numero di segmenti salvati in corrispondenza di un evento
var SAVED_SEGMENTS = 4 // pari
// durata di ogni segmento (in secondi)
var SEGMENT_TIME = 2
// numero di segmenti mantenuti nella finestra temporale (almeno il doppio di SAVED_SEGMENTS)
var SEGMENT_WRAP = 8

//
// I video caricati vengono convertiti e segmentati per poi essere visualizzati
// in streaming (su iPad e client) utilizzando il protocollo HLS.
//
// durata di ogni segmento dei video salvati sul server
var UPLOADED_VIDEO_SEGMENT_TIME = 10

//
// FFmpeg
//
var FFMPEG_EVENT_TRANSCODE_LIB = 'libx264'
var FFMPEG_EVENT_TRANSCODE_CRF = 26
var FFMPEG_EVENT_TRANSCODE_PRESET = 'medium'
var FFMPEG_UPLOADED_TRANSCODE_LIB = 'libx264'
var FFMPEG_UPLOADED_TRANSCODE_CRF = 23
var FFMPEG_UPLOADED_TRANSCODE_PRESET = 'ultrafast'

//
// Porte
//
var MAIN_SERVER_PORT = 3003
var HLS_SERVER_PORT = 3004
var VIDEOPLAYER_SERVER_PORT = 3005

//
// Directory
//
var APP_ROOT = process.cwd().split('build')[0]
console.log('> Directory video: ' + APP_ROOT)
var UPLOADED_VIDEOS_DIR = "videos"
var EVENT_VIDEOS_DIR = 'event_videos'
var UPLOADED_VIDEOS_PATH = path.join(APP_ROOT, UPLOADED_VIDEOS_DIR)
var RTSP_PATH = path.join(APP_ROOT, 'ffmpeg_rtsp')
var EVENT_VIDEOS_PATH = path.join(APP_ROOT, EVENT_VIDEOS_DIR)

//


//
// Utilities per il filesystem
//

var mkdirSync = function (path) {
	try {
		fs.mkdirSync(path)
	} catch (e) {
		if (e.code != 'EEXIST') throw e
	}
}

var deleteFolderRecursive = function (dirPath) {
	if (fs.existsSync(dirPath)) {
		fs.readdirSync(dirPath).forEach(function (file, index) {
			var curPath = path.join(dirPath, file)
			if (fs.lstatSync(curPath).isDirectory()) { // recurse
				deleteFolderRecursive(curPath)
			} else { // delete file
				fs.unlinkSync(curPath)
			}
		})
		fs.rmdirSync(dirPath)
	}
}

var copyFile = function (source, target, cb) {
	var cbCalled = false

	var rd = fs.createReadStream(source)
	rd.on("error", function (err) {
		done(err)
	})
	var wr = fs.createWriteStream(target)
	wr.on("error", function (err) {
		done(err)
	})
	wr.on("close", function (ex) {
		done()
	})
	rd.pipe(wr)

	function done(err) {
		if (!cbCalled) {
			cb(err)
			cbCalled = true
		}
	}
}

var copyListFile = function (list, sourcePath, targetPath, cb) {
	var ok = true
	for (i = 0; (i < list.length) && ok; i++) {
		ok = copyFile(path.join(sourcePath, list[i]), path.join(targetPath, list[i]), cb)
	}

	return ok
}


// crea le cartelle per i video (caricati e degli eventi)
mkdirSync(EVENT_VIDEOS_PATH)
mkdirSync(UPLOADED_VIDEOS_PATH)


//
// HLS file server
//

var http = Npm.require('http'),
	url = Npm.require('url')

var fileServer = http.createServer(function (req, res) {
	//console.log('** HLS file server: ' + req.url + ' requested')
	var mimeTypes = {
	    "html": "text/html",
	    "jpeg": "image/jpeg",
	    "jpg": "image/jpeg",
	    "png": "image/png",
	    "js": "text/javascript",
	    "css": "text/css",
		"m3u8": "application/x-mpegURL",
		"ts": "video/MP2T",
		"mp4": "video/mp4",
		"xml": "application/xml"
	}

    var uri = url.parse(req.url).pathname
    var filename = path.join(APP_ROOT, uri)
    fs.exists(filename, function (exists) {
        if (!exists) {
            console.log('> File server HLS: il file \'' + filename + '\' non esiste')
            res.writeHead(200, { 'Content-Type': 'text/plain' })
            res.write('404 Not Found\n')
            res.end()
            return
        }

        var mimeType = mimeTypes[path.extname(filename).split(".")[1]]

        fs.readFile(filename, function (err, data) {
    		if (err) {
        		throw err;
    		}
    		var filecontents = data;
			var total = filecontents.length
    		if (req.headers.range) {
    		    //console.log('** HLS file server: serve ' + filename + 'to ' + req.connection.remoteAddress)
		        var range = req.headers.range
		        var positions = range.replace(/bytes=/, "").split("-");
		        var start = parseInt(positions[0], 10);
		        var end = positions[1] ? parseInt(positions[1], 10) : total - 1;
		        var chunksize = (end-start)+1;

		        res.writeHead(206, { "Content-Range": "bytes " + start + "-" + end + "/" + total, 
		                             "Accept-Ranges": "bytes",
		                             "Content-Length": chunksize,
		                              "Content-Type":mimeType});
		        res.end(filecontents.slice(start, end+1), "binary");
    		} else {
    			res.writeHead(200, { 'Content-Type': mimeType })
    			res.end(filecontents, "binary");
    		}
		})
    })
}).listen(HLS_SERVER_PORT, function () {
	console.log('> File server HLS: in ascolto sulla porta ' + HLS_SERVER_PORT)
})

//

var mindwaveData = []

var tcp_connected = false

var session_server = null
var videoPlayerTCPServer = null
var session_sockets = []
var ffmpeg = null
var watcher = null
var session_on = false
var _id_session
var videoPlayerClientSocket = null

// Pronto per la registrazione di eventi
var ready = false


function videoPlayerCommandToJSON(command, url, time, id) {
	var object = { "command": command, "url": url, "time": time, 'id': id }
	return JSON.stringify(object)
}


Meteor.methods({
	// metodo chiamato in corrispondenza di un evento
	'eventOccurred': function (id, sessionId, patientId, eventName, videoId, startTime) {
		var segmentlist_file = path.join(RTSP_PATH, 'seglist.csv')
		var fileList

		data = fs.readFileSync(segmentlist_file, { encoding: 'utf8' })

		fileList = data.split('\n').slice(-SAVED_SEGMENTS / 2 - 1, -1).map(function (c, i, a) {
			return c.split(',')[0]
		})

		/*for (var i = 0; i < fileList.length; i++) {
			console.log(fileList[i])
		}*/

		var count = SAVED_SEGMENTS / 2
		var timestamp = new Date()
		var dirName = '' + timestamp.getFullYear() + ('0' + (timestamp.getMonth() + 1)).slice(-2) + 
			('0' + timestamp.getDate()).slice(-2) + '_' + patientId + '_' + _id_session

		mkdirSync(path.join(EVENT_VIDEOS_PATH, dirName))

		var JSONMindwaveData = null
		var videoPath = null
		var added = false

		// controlla se il server ha salvato il numero di segmenti voluto dallo stream dell'iPad
		watcher = fs.watch(segmentlist_file, Meteor.bindEnvironment(function (event, filename) {
			if (count < SAVED_SEGMENTS) {
				data = fs.readFileSync(segmentlist_file, { encoding: 'utf8' })

				var f = data.split('\n').slice(-2, -1).map(function (c, i, a) {
					return c.split(',')[0]
				})

				if(f[0] == fileList[fileList.length -1]){
					added = false
				} else {
					added = true
					fileList = fileList.concat(f)
				}
			} else {
				watcher.close()
				watcher = null
				var copiedMindwaveData = []

				var element
				for (var i = 0; i < mindwaveData.length; i++) {
					element = []
					for (var j = 0; j < mindwaveData[i].length; j++) {

						element.push([mindwaveData[i][j]])
					}
					copiedMindwaveData.push(element)
				}

				JSONMindwaveData = []

				for (var i = 0; i < copiedMindwaveData.length; i++)
					for (var j = 0; j < copiedMindwaveData[i].length; j++) {
						JSONMindwaveData[i] = JSON.parse(copiedMindwaveData[i][j])
					}
		  		
				var numberCopied = 0
				for (var i = 0; i < fileList.length; i++) {
					copyFile(path.join(RTSP_PATH, fileList[i]), path.join(EVENT_VIDEOS_PATH, dirName, fileList[i]), Meteor.bindEnvironment(function (error) {
						if (error) {
							events.remove({_id: id})
							console.log(error)
						} else {
							numberCopied++

							if (numberCopied == SAVED_SEGMENTS) {
								// crea una lista dei file da concatenare con FFmpeg
								var stringFile = ''
								for (var i = 0; i < fileList.length; i++) {
									stringFile += "file '" + fileList[i] + "'\n"
								}
								// indicazione del nome del video registrato e associato all'evento
								var videoName = '' + ('0' + timestamp.getHours()).slice(-2) + ('0' + timestamp.getMinutes()).slice(-2) + ('0' + timestamp.getSeconds()).slice(-2) + '_' + eventName
								fs.writeFileSync(path.join(path.join(EVENT_VIDEOS_PATH, dirName), 'list.txt'), stringFile)

								// avvia ('spawna') un processo FFmpeg per concatenare e convertire i segmenti ricevuti
								var ffmpegMerge = spawn('ffmpeg', ('-y -f concat -i list.txt -c:v ' + FFMPEG_EVENT_TRANSCODE_LIB +
									' -preset ' + FFMPEG_EVENT_TRANSCODE_PRESET + ' -crf ' + FFMPEG_EVENT_TRANSCODE_CRF + ' ' + videoName + '.mp4').split(' '), { cwd: path.join(EVENT_VIDEOS_PATH, dirName) })

								ffmpegMerge.on('exit', Meteor.bindEnvironment(function (code) {
									// rimuove i file non più utili
									fs.unlinkSync(path.join(path.join(EVENT_VIDEOS_PATH, dirName), 'list.txt'))
									for (var i = 0; i < fileList.length; i++) {
										fs.unlinkSync(path.join(path.join(EVENT_VIDEOS_PATH, dirName), fileList[i]))
									}
									
									/*for (var i = 0; i < fileList.length; i++) {
										console.log(fileList[i])
									}*/

									var videoPath = path.join(path.join(EVENT_VIDEOS_PATH, dirName), videoName + '.mp4')

									// se l'esecuzione di FFmpeg è stata completata con successo
									if (code == 0) {
										console.log('> Video \'' + videoPath + '\' salvato correttamente')
										// aggiorna il database degli eventi
										events.update({_id: id}, {
											$set: {
												"mindwaveData": JSONMindwaveData,
												"serverPath": videoPath,
												"playedVideoId": videoId,
												"startTime": startTime,
												"sessionId": sessionId,
												"patientId": patientId,
												"createdAt": timestamp,
												"eventName": eventName,
												"relativeVideoPath": "/"+EVENT_VIDEOS_DIR+"/"+dirName+"/"+videoName +".mp4"
											}
										})					   					
									} else {
										events.remove({_id: id})
										console.log('> Errore durante il salvataggio di \'' + videoPath +'\', l\'evento corrispondente non è stato registrato')
									}
								}, function (e) { console.log(e) }))
							}
						}
					}, function (e) { console.log(e) })) // fine copyFile
				}
			}

			if(added) {
				count++
			}
		}, function (e) { console.log(e) }))
	},
	// gestione dei comandi del player video utilizzato durante la seduta
	'playbackCommand': function (command, url, time, id) {
		if (videoPlayerClientSocket) {
			if (id != null) {
				j = videoPlayerCommandToJSON(command, url, time, id)
				//console.log(JSON.parse(j))
            	videoPlayerClientSocket.write(j)
            } else {
            	j = videoPlayerCommandToJSON(command, url, time, 0)
				//console.log(JSON.parse(j))
            	videoPlayerClientSocket.write(j)
            }
		}
	},

	'clearConnection': function() {
		currentConnection.remove({})
	},
	// avvia la seduta
	'startSession': function(sessionId) {
		_id_session = sessionId
		session_on = true
	},
	// conclude la seduta
	'stopSession': function() {
		var sock
		//console.log("stopSession")
		for (sock in session_sockets)
			if (session_sockets[sock] != null)
				session_sockets[sock].destroy()

		if (session_server !== null)
			session_server.close(function(error) {
				if (error)
					console.log("> Errore durante la chiusura della seduta")
			})

		if (videoPlayerTCPServer !== null)
			videoPlayerTCPServer.close(function(error) {
				if (error)
					console.log("> Errore durante la chiusura della connessione al player video")
			})

		session_sockets = []

		// se ffmpeg è in esecuzione per errore, è il caso di terminarlo
		if (ffmpeg !== null)
			ffmpeg.kill('SIGINT')

		if(watcher !== null)
			watcher.close()

		session_on = false
		tcp_connected = false
		ready = false
	},
	// connessione all'iPad
	'connect': function (ipAddress, connId) {
		var RTSP_HOST = ipAddress
		var PORT = 6969

		// pulisce la cartella dei video RTSP
		deleteFolderRecursive(RTSP_PATH);
		mkdirSync(RTSP_PATH)

		// si connette (da client) all'iPad per comunicare il proprio indirizzo IP
		var client = new net.Socket()
		client.connect(PORT, RTSP_HOST, Meteor.bindEnvironment(function () {
			currentConnection.update({_id: connId}, {$set: {iPad: 'wait'}})
			console.log('> Invio dell\'IP del server all\'iPad ' + RTSP_HOST + ':' + PORT)
		}), function() {})
		
		client.on('data', function (data) {		    
			// Close the client socket completely
			client.destroy()
		})
		
		client.on('close', Meteor.bindEnvironment(function (had_error) {
			if (had_error){
				console.log('> Errore nella chiusura della connessione')
				return
			}

			console.log('> Connessione all\'iPad effettutata con successo')

			currentConnection.update({_id: connId}, {$set: {iPad: 'ok', mindwave: 'wait'}})

			session_server = net.createServer(Meteor.bindEnvironment(function (socket) {
				console.log('> Connesso a ' + socket.remoteAddress + ':' + socket.remotePort)

				session_sockets.push(socket)

				socket.on('data', Meteor.bindEnvironment(function (data) {
					if (tcp_connected == false) {
						tcp_connected = true
						console.log('> Ricezione dei dati da ' + socket.remoteAddress + ':' + socket.remotePort)

						fs.closeSync(fs.openSync(path.join(RTSP_PATH, 'seglist.m3u8'), 'w'))

						console.log('> Salvataggio dello stream video dall\'iPad a \'' + RTSP_PATH + '\'')

						ffmpeg = spawn('ffmpeg', ('-y -i rtsp://' + RTSP_HOST  +  ' -c:v copy -f segment -segment_format mp4 -segment_time ' +
							SEGMENT_TIME + ' -segment_wrap ' + SEGMENT_WRAP + ' -segment_list_type csv -segment_list_size ' + SEGMENT_WRAP +
							' -segment_list seglist.csv fragment-%03d.mp4').split(' '), { cwd: RTSP_PATH })

						currentConnection.update({_id: connId}, {$set: {ffmpeg: 'ok', eventReady: false}})

						ffmpeg.stdout.on('data', function (data) {
							//console.log('stdout: ' + data)
						})
						ffmpeg.stderr.on('data', function (data) {
							//console.log('stderr: ' + data)
						})
						ffmpeg.on('close', Meteor.bindEnvironment(function (code) {
							if(code == 0)
								console.log("> FFmpeg su RTSP dall'iPad terminato correttamente")
							else
								console.log("> FFmpeg su RTSP dall'iPad terminato con codice " + code)
							currentConnection.update({_id: connId}, {$set: {ffmpeg: 'close'}})
						}), function(){})

						ffmpeg.on('error', Meteor.bindEnvironment(function(err, stdout, stderr) {
							currentConnection.update({_id: connId}, {$set: {ffmpeg: 'error'}})
							console.log("> Errore di FFmpeg durante la ricezione dello stream RTSP dall'iPad")
							//console.log("err:\n" + err)
						  	//console.log("ffmpeg stdout:\n" + stdout)
						  	//console.log("ffmpeg stderr:\n" + stderr)
						}), function() {})
					}
					
					if(!ready){
						var segmentlist_file = path.join(RTSP_PATH, 'seglist.csv')
						var fileList

						if (fs.existsSync(segmentlist_file)) {
							d = fs.readFileSync(segmentlist_file, { encoding: 'utf8' })
							fileList = d.split('\n')
							if (fileList.length >= (SAVED_SEGMENTS / 2 + 2)) {
								// una volta ricevuto un numero sufficiente di segmenti, si può attivare la funzionalità
								// di registrazione degli eventi
								currentConnection.update({_id: connId}, {$set: {eventReady: true}})
								ready = true	
							}
						}
					}		
	
					
					if (!("hb" in JSON.parse(data))) {
						currentConnection.update({_id: connId}, {$set: {mindwave: 'ok'}})

						if (data.length < 50) {
							if (mindwaveData.length != 0) {
								mindwaveData[mindwaveData.length - 1] = mindwaveData[mindwaveData.length - 1].concat([data])
							} 
	
							// se arriva blink per primo lo ignora.
							return
						}
	
						if (mindwaveData.length < SEGMENT_TIME * SAVED_SEGMENTS) {
							mindwaveData.push([data])
						} else {
							mindwaveData.shift()
							mindwaveData.push([data])
						}
					
						if (_id_session != null) {
							sessions.update(
								{ "_id": _id_session },
								{ $push: { "sessionData": JSON.parse(data) } },
							)
						}
					} else {
						currentConnection.update({_id: connId}, {$set: {mindwave: 'error'}})
					}
				}, function (err) {  console.log(err) })); // socket.on data

				socket.on('error', function () {
					console.log('> Errore di connessione a ' + socket.remoteAddress + ':' + socket.remotePort)
				})

				socket.on('close', function () {
					//console.log('** serverTCP: socket close')
					socket = null
				})

				socket.on('end', Meteor.bindEnvironment(function () {
					//console.log('** serverTCP: socket end')
					currentConnection.update({_id: connId}, {$set: {iPad: 'close', mindwave: 'close'}})
					Meteor.call('stopSession')
				}, function(error, data) {if (error) console.log(error)}))

				socket.setTimeout(5000);

				socket.on('timeout', Meteor.bindEnvironment(function (data) {
					//console.log('** serverTCP: socket timeout, ' + socket.remoteAddress + ':' + socket.remotePort)
					currentConnection.update({_id: connId}, {$set: {iPad: 'error', mindwave: 'error'}})
					Meteor.call('stopSession')
				}, function(error, data) {if (error ) console.log(error)}))

			}, function () {}))

			session_server.on('close', function(){
				//console.log('** serverTCP: session_server closed')
				session_server = null
			})

			session_server.listen(MAIN_SERVER_PORT, function () {
				console.log('> In ascolto sulla porta ' + MAIN_SERVER_PORT + ' per dati Mindwave e stream video')
			})

			videoPlayerTCPServer = net.createServer(Meteor.bindEnvironment(function(socketCommand) {
				console.log('> Comandi playback video inviati a ' + socketCommand.remoteAddress + ':' + socketCommand.remotePort)
				videoPlayerClientSocket = socketCommand
				session_sockets.push(socketCommand)

				socketCommand.on('data', Meteor.bindEnvironment(function(data){
					//console.log(JSON.parse(data))
					dataReceived = JSON.parse(data)

					if ("id" in dataReceived) {
						if (dataReceived.ready == "true") {
							playerCommand.update({_id: dataReceived.id}, {$set: {ready: true}})
						}
					}
				}), function() {})

				socketCommand.on('error', function(){
					//console.log('** videoplayerTCP: videoPlayerClientSocket error, ' + socketCommand.remoteAddress + ':' + socketCommand.remotePort)
					videoPlayerClientSocket = null
				})

				socketCommand.on('close', function(){
					//console.log('** videoplayerTCP: videoPlayerClientSocket close')
					videoPlayerClientSocket = null
				})

				socketCommand.on('end', function(){
					//console.log('** videoplayerTCP: socket end')
				})

				socketCommand.on('timeout', function(data){
					//console.log('** videoplayerTCP: socketCommand timeout, ' + socketCommand.remoteAddress + ':' + socketCommand.remotePort)
				})

					
			}), function() {})

			videoPlayerTCPServer.on('close', function(){
				videoPlayerTCPServer = null
			})

			videoPlayerTCPServer.listen(VIDEOPLAYER_SERVER_PORT, function() {
				console.log('> In attesa di connessione sulla porta ' + VIDEOPLAYER_SERVER_PORT) 
			})



		}, function () { }))

		client.on('error', Meteor.bindEnvironment(function () {
			console.log('> Connessione all\'iPad fallita')
			currentConnection.update({_id: connId}, {$set: {iPad: 'error'}})
			return
		}), function() {})
	},

	'removeUser': function(id) {
		var adminId = Meteor.users.findOne({username : "admin"}, {fields: {_id: 1}})
		if(Meteor.userId() == adminId._id && id != adminId._id){

			// TODO: rimuovere le altre dipendenze dell'utente (playlist)
			Meteor.users.remove({_id : id})
		}
			
	},

	'addUser': function(name) {
		var adminId = Meteor.users.findOne({username : "admin"}, {fields: {_id: 1}})
		if(Meteor.userId() == adminId._id){
			Accounts.createUser({
				username: name,
				password: name
			})
		}
	},

	'isAdmin': function() {
		a = this.userId() == Meteor.users.findOne({username: "admin"})._id;
		return a;
	},

	'clearCurrentPlaylist': function() {
		currentPlaylist.remove({})
	},

	'saveCurrentPlaylist': function(playlistId) {
		currentPlaylistData = currentPlaylist.find().fetch()
		playlist.update({_id: playlistId}, {$set: {videos: currentPlaylistData}})
	},

	'changeVideoNameUpdatePlaylist': function (videoId, newName) {
		playlist.find({"videos._id":videoId}).forEach(function(p) {
			playlist.update({_id: p._id, "videos._id": videoId}, {$set: {"videos.$.name": newName}})
		})
	},

	'deleteVideo': function(videoId) {
		playlist.update({}, {$pull: {videos: {_id: videoId}}}, {multi:true}, function() {
			currentPlaylist.remove({_id: videoId})

			deleteFolderRecursive(video.findOne({_id: videoId}).serverPath)

			events.find({playedVideoId: videoId, serverPath: {$ne: ''}}).forEach(function(e) {
				Meteor.call('deleteEvent', e._id)
				events.update({id: e._id}, {$set: {playedVideoId: ''}})
			})

			video.remove({_id: videoId})
		})
	},

	'deleteEvent': function(eventId) {
		//console.log('delete eve '+ eventId)
		var sPath = events.findOne({_id: eventId}).serverPath
		fs.unlinkSync(events.findOne({_id: eventId}).serverPath)
		var folderPath = sPath.substring(0, sPath.lastIndexOf("/")+1)

		if(fs.readdirSync(folderPath).length == 0) {
			fs.rmdirSync(folderPath)
		}
		events.update({_id: eventId}, {$set: {serverPath:'', clientPath:''}})
	},

	'deleteSession': function(_sessionId) {
		//console.log("delete " + _sessionId)
		var eventList = events.find({sessionId: _sessionId, serverPath: {$ne: ''}})

		if(eventList.count() > 0) {
			eventList.forEach(function(e){
				Meteor.call('deleteEvent', e._id)
			})

			sessions.update({_id: _sessionId}, {$set: {status: "deleted"}})
		} else {
			sessions.remove({_id: _sessionId})
		}
	},

	'deletePatient': function(_patientId) {
		sessions.find({patientId: _patientId}).forEach(function(s) {
			Meteor.call('deleteSession', s._id)
		})

		patients.remove({_id: _patientId})
	},

})


// Gestione upload dei file video
videoUpload.on('stored', Meteor.bindEnvironment(function (fileObj) {
	var originalNameWithExt = videoUpload.find({ _id: fileObj._id }).fetch()[0].original.name.replace(" ", "_")
	var originalName = originalNameWithExt.split(".")[0]
	var n = videoUpload.find({ _id: fileObj._id }).fetch()[0].original.name.split(".")[0]
	var folderName = path.join(UPLOADED_VIDEOS_PATH, fileObj._id)
	var uploadedName = videoUpload.find({ _id: fileObj._id }).fetch()[0].copies.videoupload.key
	var ownerId = videoUpload.findOne({_id: fileObj._id}).metadata.ownerId
	// crea la cartella e copia i file
	mkdirSync(folderName)
	copyFile(path.join(APP_ROOT, 'cfs', 'files', 'videoupload', uploadedName), path.join(folderName, originalNameWithExt), Meteor.bindEnvironment(function (error) {
		if (error) {
			console.log("> Errore durante la copia del video \'" + uploadedName + "\'")
			video.remove({ _id: fileObj._id })
			videoUpload.update({ _id: fileObj._id}, {$set: {errorEncoding: true}})
		} else {
			videoUpload.update({ _id: fileObj._id}, {$set: {duration: 1, current: 0, errorEncoding: false, thumbnail: false}})
	
			// segmenta e converte il video
			console.log("> Copia del video \'" + uploadedName + "\' effettuata, segmento e converto...")

			var pattDuration = new RegExp("Duration: [0-9]{2}:[0-9]{2}:[0-9]{2}")
			var pattTime = new RegExp("time=[0-9]{2}:[0-9]{2}:[0-9]{2}")

			var _durationTime = 0
			var _currentTime = 0
			var arrDuration = null

			ffmpegSegmenter = spawn('ffmpeg', ('-y -i ' + originalNameWithExt + ' -c:v ' + FFMPEG_UPLOADED_TRANSCODE_LIB + ' -crf ' + FFMPEG_UPLOADED_TRANSCODE_CRF + 
				' -preset ' + FFMPEG_UPLOADED_TRANSCODE_PRESET + ' -c:a aac -bsf:v h264_mp4toannexb -strict experimental -f stream_segment -segment_format mpegts -segment_time ' + UPLOADED_VIDEO_SEGMENT_TIME +
				' -segment_list_type m3u8 -segment_list ' + fileObj._id + '.m3u8 ' + fileObj._id + '-%03d.ts').split(' '), { cwd: folderName })

			ffmpegSegmenter.stdout.on('data', function (data) {
				//console.log('stdout: ' + data)
			})
			ffmpegSegmenter.stderr.on('data', Meteor.bindEnvironment(function (data) {
				//console.log('stderr: ' + data)
				if (pattDuration.test(data)) {
					//duration = pattDuration.exec(data)
					arrDuration = pattDuration.exec(data)[0].split(":")
					_durationTime = 3600 * parseInt(arrDuration[1]) + 60 * parseInt(arrDuration[2]) + parseInt(arrDuration[3])
					videoUpload.update({ _id: fileObj._id}, {$set: {duration: _durationTime}})
				}

				if (pattTime.test(data)) {
					var arrTime = pattTime.exec(data)[0].split("=")[1].split(":")
					_currentTime = 3600 * parseInt(arrTime[0]) + 60 * parseInt(arrTime[1]) + parseInt(arrTime[2])
				}

				videoUpload.update({ _id: fileObj._id}, {$set: {currentTime: _currentTime}})
			  
			}), function() {})

			ffmpegSegmenter.on('close', Meteor.bindEnvironment(function (code) {
				if (code == 0) {
					var m3u8FileName = fs.unlinkSync(path.join(folderName, originalNameWithExt))
					console.log('> Conversione e segmentazione effettuate con successo')
					
					ffmpegThumbnail = spawn('ffmpeg', ('-i ' + fileObj._id + '.m3u8 -ss ' + _durationTime/4 + ' -vframes 1 thumb.png').split(' '), {cwd: folderName})
					ffmpegThumbnail.on('close', Meteor.bindEnvironment(function (code) {
						video.update({ _id: fileObj._id }, {
							$set: {
								"segmented": true,
								"serverPath": folderName,
								"name": n,
								"duration": arrDuration[1]+':'+arrDuration[2]+':'+arrDuration[3],
								"ownerId": ownerId,
								"relativeVideoPath": "/"+UPLOADED_VIDEOS_DIR+"/"+fileObj._id+"/"+fileObj._id +".m3u8",
								"relativeThumbPath": "/"+UPLOADED_VIDEOS_DIR+"/"+fileObj._id+"/thumb.png"
							}
						})

						videoUpload.update({ _id: fileObj._id}, {$set: {thumbnail: true}})
					}), function() {})
				
				} else {
					console.log('> Conversione/segmentazione fallita')
					video.remove({ _id: fileObj._id })
					deleteFolderRecursive(folderName)
					videoUpload.update({ _id: fileObj._id}, {$set: {errorEncoding: true}})
				}
			}), function () { })
		}

	}), function () { })

}), function () { })

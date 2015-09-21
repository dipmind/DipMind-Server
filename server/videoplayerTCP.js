var net = Npm.require('net');

clientSocketVideoPlayer = null;

//Serve a inviare i comandi play stop seek ad ipad
videoPlayerTCPServer = net.createServer(function(socket) {
	console.log('** videoplayerTCP: connected to ' + socket.remoteAddress + ':' + socket.remotePort)

	clientSocketVideoPlayer = socket;
	socket.on('error', function(){
		console.log('** videoplayerTCP: socket error, ' + socket.remoteAddress + ':' + socket.remotePort)
		clientSocketVideoPlayer = null;
	});

	socket.on('close', function(){
		console.log('** videoplayerTCP: socket close')
		clientSocketVideoPlayer = null;
	});

	socket.on('end', function(){
		console.log('** videoplayerTCP: socket end')
	});

	socket.on('timeout', function(data){
		console.log('** videoplayerTCP: socket timeout, ' + socket.remoteAddress + ':' + socket.remotePort)
	});

		
});

videoPlayerTCPServer.listen(3005, function() {
	console.log('** videoplayerTCP: waiting for connection on 3005.') 
});
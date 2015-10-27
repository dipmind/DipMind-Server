if (Meteor.isClient) {
	// counter starts at 0
	Session.setDefault('counter', 0);

	Template.eventBtn.helpers({
		counter: function () {
			return Session.get('counter');
		}
	});

	Template.sendIP.events({
		'click #Connect': function () {
			Meteor.call('connect');
		}
	});

	Template.eventBtn.events({
		'click #count': function () {
			// increment the counter when button is clicked
			Session.set('counter', Session.get('counter') + 1);

			Meteor.call('schiacciaBottone', [Session.get('counter')], event.target.name, $('#playlist')[0].src, $('#playlist')[0].player.getCurrentTime(), function(error, result) {
				
			});
		}
	})

	Template.hello.events({	
		'click #startButton': function () {
			Meteor.call('start_session')
			Meteor.call('command_video', 'start', "", "" )
		},
		'click #stopButton': function () {
			Meteor.call('stop_session')
			Meteor.call('command_video', 'stop', "", "" )
		},
		'change #fileUpload': function(event,template) { 
			FS.Utility.eachFile(event, function(file) {
				videoUpload.insert(file, function (err, fileObj) {
					//console.log('file uploaded to server...prepare to convert it');
					// Inserted new doc with ID fileObj._id, and kicked off the data upload using HTTP
					videoList.insert({_id: fileObj._id, "originalName": fileObj.name(), "segmented": "no"}, function(error, idVideo) {
						if (error) {
							//Facciamo che non succedera' mai
						} else {
							var handle = videoList.find({_id: idVideo}).observeChanges({
								changed: function(id, fields) {
									if (fields.segmented == "yes" && id == idVideo) {
										console.log("File converted successfully")
										handle.stop()
									}
								},
								removed: function(id) {
									if (id == idVideo) {
										console.log("Error in conversion file")
										handle.stop()
									}
								}
							})
						}
						
					});


					//Meteor.call('transformUploadedVideo', fileObj._id);
					//console.log(fileObj.name())
				});
			});
		}
	})

	////////////
	//!!!!!!!!IPAD LEGGE SOLO M3U8 CON CODEC VIDEO H264 E AUDIO AAC ----> OK SU WINDOWS SU MAC USARE -bsf:v h264_mp4toannexb!!!!!!! 
	Template.video1.events({
		'click button': function () {
			var url = 'http://10.20.10.69:3000/videos/quantum.m3u8'
			$('#playlist')[0].player.setSrc(url)
			$('#playlist')[0].player.load()
			$('#playlist')[0].player.play()
			 Meteor.call('command_video', 'play', $('#playlist')[0].src, $('#playlist')[0].player.getCurrentTime() )
		}
	})

	Template.video2.events({
		'click button': function () {
			
			var url = 'http://10.20.10.69:3004/ffmpeg_rtsp/seglist.m3u8'
			//var url = 'http://10.20.10.69:3000/videos/estonia.m3u8'
			$('#streaming')[0].player.setSrc(url)
			$('#streaming')[0].player.load()
			$('#streaming')[0].player.play()
			//Meteor.call('command_video', 'play', $('#streaming')[0].src, $('#streaming')[0].player.getCurrentTime() )
			
		}
	});

	////////////

	Meteor.startup(function () {
		// code to run on server at startup

		$('#playlist').mediaelementplayer({success: function(me, originalNode) {
				
				me.addEventListener('play', function(){
					console.log('#playlist-->play');
					console.log(me.duration)
					Meteor.call('command_video','play', me.src, $('#playlist')[0].player.getCurrentTime() )
				})
				me.addEventListener('pause', function(){
					console.log('#playlist-->pause');
					Meteor.call('command_video','pause', me.src, $('#playlist')[0].player.getCurrentTime())
				})
				me.addEventListener('seeked', function(){
					console.log('#playlist-->seeked to ' + $('#playlist')[0].player.getCurrentTime());
					Meteor.call('command_video','seeked', me.src, $('#playlist')[0].player.getCurrentTime())
				})
				me.addEventListener('ended', function(){
					console.log('#playlist-->ended');
					Meteor.call('command_video','ended', me.src, $('#playlist')[0].player.getCurrentTime())
				})
		}});


		$('#streaming').mediaelementplayer({success: function(me, originalNode) {
				me.addEventListener('play', function(){
					console.log('#streaming-->play');
					console.log(me.duration)
					$('#streaming')[0].player.setCurrentTime(duration/2)
				})
				me.addEventListener('pause', function(){
					console.log('#streaming-->pause');
				})
				me.addEventListener('seeked', function(){
					console.log('#streaming-->seeked to ' + $('#streaming')[0].player.getCurrentTime());
				})
				me.addEventListener('ended', function(){
					console.log('#streaming-->ended');
				})
		}});
	});


}

if (Meteor.isServer) {
	Meteor.startup(function () {
		// code to run on server at startup

		
	});
}

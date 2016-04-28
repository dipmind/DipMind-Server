/* ----- session ------*/

var _sessionStatus = "wait"
var _dep = new Tracker.Dependency

var _sessionLedColor = "red"
var	_iPadLedColor = "red"
var	_mindwaveLedColor = "red"

var _connectionOK = true

var handleConnObserver = null
var idConnObserver = null

var HLS_SERVER_PORT = 3004
var serverLocation = "http://" + this.location.hostname +":" + HLS_SERVER_PORT
var hostnameAddr = this.location.origin

var urlBase = "sessionSetup/"

Wizard.useRouter('iron:router')

var msgSessionWait = $("<span id='msgSessionWait'>Seduta in attesa di avvio</span>")
var msgSessionRunning = $("<span id='msgSessionRunning'>Seduta in corso</span>")
var msgSessionStop = $("<span id='msgSessionStop'>Seduta terminata. Torna alla <a href='/home' id='redirectLink'>Home</a></span>")

var msgMindwaveWait = $("<span id='msgMindwaveWait'>Connessione con Mindwave non riuscita. Controllare la cuffia.</span>")

var msgFFmpegErr = $("<span id='msgFFmpegErr'>Problemi nella registrazione video. Rivedi le <a href='/impostaSeduta' id='redirectLink'>impostazioni della seduta</a></span>")
var msgIPadMindErr = $("<span id='msgIPadErr'>Connessione con iPad e Mindwave persa. Rivedi le <a href='/impostaSeduta' id='redirectLink'>impostazioni della seduta</a></span>")

var msgEventRegistered = $("<br><span id='msgEventRegistered'>\nEvento registrato</span>")
var msgEventErr = $("<br><span id='msgEventErr'>\nErrore nella registrazione dell'evento</span>")

var maxOrder


Template.wizard.onCreated(function(){
	Meteor.call('clearCurrentPlaylist')
	this.data.steps.forEach(function (currentStep){
		currentStep.wizard.clearData()
	})
})

Template.sessionSetup.helpers({
	sessionSteps : function() {
		return [{
			id: 'ip',
			title: 'Connessione iPad',
			template: 'setupIP',
		}, 
		{
			id: 'paziente',
			title: 'Scelta paziente',
			template: 'setupPatient',
			
		},
		{
			id: 'playlist',
			title: 'Scelta playlist',
			template: 'setupPlaylist',      
		},
		{
			id: 'resoconto',
			title: 'Resoconto',
			template: 'checkout',       
		}]
	}
})

Template.sessionSetup.events({
	'click #homeBtn': function(event) {
		event.preventDefault()
		var x = function () {
			Meteor.call("stopSession", function() {
	  			Meteor.call('clearConnection', function() {
	  				$("#root").addClass("animated slideOutRight").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
						Router.go($(event.target).closest("a").attr('href'))
					})
	  			})
	  		})
		}

		Blaze.renderWithData(Template.confirmDelete, 
			{
				idDelete: "exitFromSetup", 
				titleDelete: "Conferma Uscita Configurazione", 
				msgDelete: "Sei sicuro di voler uscire dalla configurazione? (Tutti i dati immessi verranno persi)", 
				functionDelete: x
			},
			$("body")[0]
		)
	}
	,

	/*
	 * Aiuto
	 */
	'click #navbar-help': function(event, template) {
		$('#navbar-help .overlay').each(function() {
			$(this).toggleClass('hidden')
		})

		$('#wizard div.ui.steps').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'bottom',
			container: 'body',
			content: $('#popoverWizard').html()
		}).popover('toggle')

	}

		
})


Template.steps_semanticUI.helpers({
	stepClass: function(id) {
		var activeStep = this.wizard.activeStep();
		var step  = this.wizard.getStep(id);
		if (activeStep && activeStep.id === id) {
			return 'active';
		}
		if (step.data()) {
			return 'completed'
		}
		return 'disabled';
	},
	icon: function() {
		return true;
	},
	iconType: function() {
		if(this.id === 'ip')
			return "phone"
		else if(this.id === 'playlist')
			return "film"
		else if(this.id === 'paziente')
			return "user"
		else 
			return "check"
	}
})

Template.steps_semanticUI.events({
	'click #titleWizardip': function() {
		Meteor.call('stopSession')
	}
})

Template.setupIP.onRendered(function() {
	var step = this.data.step

	var startupIP = function() {
		updateReferer("ip")

		$('#formSetupIP').
			on('init.field.bv', function(e, data) {
				if (step.data() !== null) {
					$(e.target).val(step.data())
				}
			}).bootstrapValidator({
				excluded: ':disabled',
				feedbackIcons: {
					valid: 'glyphicon glyphicon-ok',
					invalid: 'glyphicon glyphicon-remove',
					validating: 'glyphicon glyphicon-refresh'
				},
				fields: {
					IPAddressName: {
						validators: {
							notEmpty: {
								message: "È necessario inserire l'indirizzo IP"
							},
							ip: {
								message: "Inserire l'indirizzo nella forma xxx.xxx.xxx.xxx"
							},
							blank: {}
						}
					}
				}
			}).on('success.form.bv', function(e) {
				e.preventDefault();
			})

		if(step.data()) {
			$('#formSetupIP').data('bootstrapValidator').validate()
		}
	}

	if(Session.get('referer') == "home"){
		startupIP()
		$('#wizardRoot').removeClass('hidden').addClass('animated slideInRight').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
			$('#wizardRoot').removeClass('slideInRight')
		})
	} else {
		startupIP()
		$('#wizardRoot').removeClass('hidden').addClass('animated slideInLeft').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
			$('#wizardRoot').removeClass('slideInLeft')
		})

	}
})

Template.setupIP.helpers({
	screenSrc: function () {
		return serverLocation + "/screenshotIpad.png"
	}
})

Template.setupIP.events({
	'click .wizard-next-button, submit #formSetupIP': function(event, template) {
		event.preventDefault()

		$('#formSetupIP').data('bootstrapValidator').validate()
		if ($('#formSetupIP').data('bootstrapValidator').isValid()) {

			this.wizard.setData("ip", $('#formSetupIP').data('bootstrapValidator').getFieldElements('IPAddressName').val().trim())

			$("#waitConnGlyph").removeClass("hidden")

			currentConnection.insert({startedAt: new Date(), eventReady: false}, function(error, connId) {
				if(error) {

				} else {
					idConnObserver = connId

					var conn = currentConnection.find({_id: connId}).observeChanges({
						changed: function(id, fields) {
							if ("iPad" in fields){
								if (fields.iPad === "ok"){
									$('#wizardRoot').addClass('animated slideOutLeft').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
										$('#wizardRoot').addClass('hidden').removeClass('slideOutLeft')
										$("#waitConnGlyph").addClass("hidden")

										Router.go('sessionSetup', {step: "paziente"})
										conn.stop()
									})
								} else if (fields.iPad === "error"){
									$('#formSetupIP').bootstrapValidator('resetForm', true)
									$('#formSetupIP').data('bootstrapValidator').updateMessage("IPAddressName", 'blank', "Connessione non riuscita.")
									$('#formSetupIP').data('bootstrapValidator').updateStatus("IPAddressName", 'INVALID', 'blank')
									$("#waitConnGlyph").addClass("hidden")
								}
							}
						}
					})

					Meteor.call('connect', $('#formSetupIP').data('bootstrapValidator').getFieldElements('IPAddressName').val().trim(), connId)
				}
			})
		}
	}
})

Template.setupPatient.onRendered(function() {
	var step = this.data.step

	var startupPatient = function() {
		updateReferer("paziente")

		$('#formSetupPatient')
		.on('init.field.bv', function(e, data) {
			$icon = $("#setupPatientList i")
		   
			$icon.addClass("feedbackIcon").appendTo($('.panel-title'));

		}).bootstrapValidator({
			excluded: ':disabled',
			feedbackIcons: {
				valid: 'glyphicon glyphicon-ok',
				invalid: 'glyphicon glyphicon-remove',
				validating: 'glyphicon glyphicon-refresh'
			},
			fields: {
				"optionsPatient": {
					validators: {
						choice: {
							message: "Scegliere un paziente",
							min: 1,
							max: 1
						}
					}
				}
			}
		})
		.on('success.form.bv', function(e) {
			e.preventDefault();
		})

		if(step.data()) {
			$('#formSetupPatient').data('bootstrapValidator').validate()
		}
	}


	if(Session.get('referer') == urlBase+"ip"){
		startupPatient()
		$('#wizardRoot').removeClass('hidden').addClass('animated slideInRight').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
			$('#wizardRoot').removeClass('slideInRight')
		})
	} else {
		startupPatient()
		$('#wizardRoot').removeClass('hidden').addClass('animated slideInLeft').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
			$('#wizardRoot').removeClass('slideInLeft')

		})
	}
})

Template.setupPatient.helpers({
	setupPatientListData: function() {
		return patients.find({})
	},
	checkedBefore: function (patient) {
		return this.step.data() === patient.hash.obj._id
	}
})

Template.setupPatient.events({
	'click .wizard-back-button': function(event, template) {
		var w = this.wizard
		$('#wizardRoot').addClass('animated slideOutRight').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
			$('#wizardRoot').addClass('hidden').removeClass('slideOutRight')
			Router.go('sessionSetup', {step: 'ip'})
		})	
	}, 
	'click .wizard-next-button': function(event, template) {
		event.preventDefault()

		$('#formSetupPatient').data('bootstrapValidator').validate()

		if ($('#formSetupPatient').data('bootstrapValidator').isValid()) {
			var w = this.wizard
			this.wizard.setData("paziente", $('input:checked').val().trim())

			$('#wizardRoot').addClass('animated slideOutLeft').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
				$('#wizardRoot').addClass('hidden').removeClass('slideOutLeft')

				Router.go('sessionSetup', {step: 'playlist'})
			})
		}
	}
})

Template.setupPlaylist.onRendered(function() {
	var step = this.data.step
	
	var startupPlaylist = function () {
		updateReferer("playlist")
		 $('#formSetupPlaylist')
		  .on('init.field.bv', function(e, data) {
				
				$icon = $("#setupPlaylistList i")
				$icon.addClass("feedbackIcon").appendTo($('.panel-title'));
		   }).bootstrapValidator({
				excluded: ':disabled',
				feedbackIcons: {
					valid: 'glyphicon glyphicon-ok',
					invalid: 'glyphicon glyphicon-remove',
					validating: 'glyphicon glyphicon-refresh'
				},
				fields: {
					"optionsPlaylist": {
						validators: {
							choice: {
								message: "Scegliere una playlist",
								min: 1,
								max: 1
							}
						}
					}
				}
			})
			.on('success.form.bv', function(e) {
				e.preventDefault();
			})

		if(step.data()) {
			$('#formSetupPlaylist').data('bootstrapValidator').validate()
		}
	}
	
	if(Session.get('referer') == urlBase+"paziente"){
		startupPlaylist()

		$('#wizardRoot').removeClass('hidden').addClass('animated slideInRight').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
			$('#wizardRoot').removeClass('slideInRight')

		})
	} else {
		startupPlaylist()

		$('#wizardRoot').removeClass('hidden').addClass('animated slideInLeft').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
			$('#wizardRoot').removeClass('slideInLeft')
		})
	}
})

Template.setupPlaylist.helpers({
	setupPlaylistListData: function() {
		return playlist.find({videos: {$not: {$size: 0}}})
	},
	checkedBefore: function (playlist) {
		return this.step.data() === playlist.hash.obj._id
	},
	ownerName: function (playlist) {
		return Meteor.users.findOne({_id: playlist.hash.obj.ownerId}).username
	}
})

Template.setupPlaylist.events({
	'click .wizard-back-button': function(event, template) {
		$('#wizardRoot').addClass('animated slideOutRight').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
			$('#wizardRoot').addClass('hidden').removeClass('slideOutRight')
			Router.go('sessionSetup', {step: 'paziente'})
		})
	}, 
	'click .wizard-next-button': function() {
		$('#formSetupPlaylist').data('bootstrapValidator').validate()

		if ($('#formSetupPlaylist').data('bootstrapValidator').isValid()) {
			this.wizard.setData("playlist", $('input:checked').val().trim())
			$('#wizardRoot').addClass('animated slideOutLeft').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
				$('#wizardRoot').addClass('hidden').removeClass('slideOutLeft')
				Router.go('sessionSetup', {step: 'resoconto'})
			})
		}
	}
})

Template.checkout.onRendered(function() {
	$('#wizardRoot').removeClass('hidden').addClass('animated slideInRight').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
		$('#wizardRoot').removeClass('slideInRight')
		updateReferer("checkout")
	})
})

Template.checkout.helpers({
	addressIP: function() {
		return this.wizard.steps[0].data()
	},
	patientName: function () {
		var p = patients.findOne({_id: this.wizard.steps[1].data()})

		return p.name + " " + p.surname
	},
	playlistChosen: function() {
		return playlist.findOne({_id: this.wizard.steps[2].data()})
	},
	ownerName: function () {
		return Meteor.users.findOne({_id: this.ownerId}).username
	}
})

Template.checkout.events({
	'click .wizard-back-button': function(event, template) {
		var w = this.wizard
		$('#wizardRoot').addClass('animated slideOutRight').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
			$('#wizardRoot').addClass('hidden').removeClass('slideOutRight')
			Router.go('sessionSetup', {step: 'playlist'})
		})
	}, 
	'click .wizard-next-button': function(event) {
		var w = this.wizard

		var statusConn = currentConnection.findOne({_id: idConnObserver})

		if(statusConn.iPad === "ok" && statusConn.ffmpeg === "ok") {
			$('#root').addClass('animated slideOutLeft').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
				$('#root').removeClass('slideOutLeft')
				sessions.insert({patientId: w.steps[1].data(), playlistId: w.steps[2].data(), sessionData: [], ownerId: Meteor.userId()}, function (err, sessionId) {
					if(!err) {
						Router.go('session', {session: sessionId})
					}
				})
			})
		} else {
			$("#checkoutError").removeClass("hidden")
			$(event.target).addClass("disabled")
		}
	}
})

function stopSession (sessionData) {
	$(".consoleControl").addClass('disabled')
	$("#msgSessionRunning").remove()
	$("#msgConsole").append(msgSessionStop)

	handleConn.stop()

	$("#playlistPlayer")[0].player.pause()
	$(".mejs-container .mejs-controls").addClass("hidePlayerControls")
	$(".mejs-overlay-button").addClass("hidePlayerControls")
	$("#playlistPlayer")[0].player.options.clickToPlayPause = false
	
	Meteor.call('playbackCommand', 'stop', "", "" , null)
	Meteor.call('stopSession')
	_sessionStatus = "stop"
	_dep.changed()

	sessions.update({_id: sessionData._id}, {$set: {finishedAt: new Date()}})
}

Template.session.onRendered(function () {
	_sessionStatus = "wait"
	_dep.changed()
	tData = this.data

	var initialVideo
	var videoList = playlist.findOne({_id: tData.playlistId}, {fields: {videos: 1}, sort:{"videos.$.order": 1}}).videos
	var minOrderPos = 0
	maxOrder = 0

	for (var i=1; i<videoList.length; i++){
		if(videoList[i].order < videoList[minOrderPos].order)
			minOrderPos = i

		if(videoList[i].order > maxOrder)
			maxOrder = videoList[i].order
	}

	videoList.forEach(function (v, index){
		if(index == minOrderPos){
			initialVideo = v
			v.playNow = true
		} else {
			v.playNow = false
		}

		currentPlaylist.insert(v)
	})

	var v = currentPlaylist.findOne({playNow: true})

	$('#playlistPlayer').mediaelementplayer({
		features: ['playpause','progress','current','duration'],
		clickToPlayPause: false,
		myDynamicUrl: serverLocation + v.relativeVideoPath,
		type: "application/x-mpegURL",
		relativeVideoPath: v.relativeVideoPath,
		poster: serverLocation + v.relativeThumbPath,
		//enablePluginDebug: true,
		success: function(me, originalNode) {

			$('<div class="mejs-overlay mejs-layer"><div class="mejs-overlay-loading" id="loadingIcon"><span></span></div></div>').appendTo($(".mejs-layers"))
			$('#loadingIcon').hide()

			var playButtons = [$(".mejs-button.mejs-playpause-button"), $(".mejs-overlay.mejs-layer.mejs-overlay-play")/*, $('#playlistPlayer')*/]

			playButtons.forEach(function (button){
				button.off('click').on('click', function() {
					console.log('trigger')
					if($('#playlistPlayer')[0].player.media.paused) {

						playerCommand.insert({ready: false}, function(err, commandId) {
							var handle = playerCommand.find({_id: commandId}).observeChanges({
								changed: function(id, fields) {
									if(fields.ready === true) {

										$('#loadingIcon').hide()
										$(".mejs-container .mejs-controls").removeClass("hidePlayerControls")
										$(".mejs-overlay-button").removeClass("hidePlayerControls")
										$(".consoleBtn").removeClass("disabled")
										$("#playlistPlayer")[0].player.options.clickToPlayPause = true
										/* play */
										
										if($('#playlistPlayer')[0].player.media.pluginType == "native") {
											$('#playlistPlayer')[0].player.play()
										} else {
											$('#playlistPlayer')[0].player.media.pluginApi.playMedia()
										}
										
										handle.stop()
										playerCommand.remove({_id: commandId})
									}
								}
							})

							$('#loadingIcon').show()
							$(".mejs-container .mejs-controls").addClass("hidePlayerControls")
							$(".mejs-overlay-button").addClass("hidePlayerControls")
							$(".consoleBtn").addClass("disabled")
							$("#playlistPlayer")[0].player.options.clickToPlayPause = false
							Meteor.call('playbackCommand','play', $('#playlistPlayer')[0].player.options.relativeVideoPath, $('#playlistPlayer')[0].player.getCurrentTime(), commandId)
						})
					} else {
						Meteor.call('playbackCommand','pause', $('#playlistPlayer')[0].player.options.relativeVideoPath, $('#playlistPlayer')[0].player.getCurrentTime(), null)
						$('#playlistPlayer')[0].player.pause()
					}
				})
			})

			$(".mejs-time-rail").off('mousedown touchstart').on('mousedown', function(e){
				var total = $('.mejs-time-total')
		        var offset = total.offset(),
				width = total.outerWidth(true),
				percentage = 0,
				newTime = 0,
				pos = 0,
                x,
                wasPaused = $('#playlistPlayer')[0].player.media.paused;
                
				if (e.originalEvent.changedTouches) {
					x = e.originalEvent.changedTouches[0].pageX;
				}else{
					x = e.pageX;
				}

				if ($('#playlistPlayer')[0].player.media.duration) {
					if (x < offset.left) {
						x = offset.left;
					} else if (x > width + offset.left) {
						x = width + offset.left;
					}
					
					pos = x - offset.left;
					percentage = (pos / width);
					newTime = (percentage <= 0.02) ? 0 : percentage * $('#playlistPlayer')[0].player.media.duration;

					playerCommand.insert({ready: false}, function(err, newId) {
						$('#playlistPlayer')[0].player.pause()
						var seekHandle = playerCommand.find({_id: newId}).observeChanges({
							changed: function(id, fields) {
								if(fields.ready === true) {
									/* play */
									
									$('#playlistPlayer')[0].player.media.setCurrentTime(newTime)
									$('#loadingIcon').hide()
									$(".mejs-container .mejs-controls").removeClass("hidePlayerControls")
									$(".mejs-overlay-button").removeClass("hidePlayerControls")
									$(".consoleBtn").removeClass("disabled")
									$("#playlistPlayer")[0].player.options.clickToPlayPause = true

									if(!wasPaused) {
										if($('#playlistPlayer')[0].player.media.pluginType == "native") {
											$('#playlistPlayer')[0].player.play()
										} else {
											$('#playlistPlayer')[0].player.media.pluginApi.playMedia()
										}
									}
									seekHandle.stop()
									playerCommand.remove({_id: newId})
								}
							}
						})

						$('#loadingIcon').show()
						$(".mejs-container .mejs-controls").addClass("hidePlayerControls")
						$(".mejs-overlay-button").addClass("hidePlayerControls")
						$(".consoleBtn").addClass("disabled")
						$("#playlistPlayer")[0].player.options.clickToPlayPause = false
						Meteor.call('playbackCommand','seeked', $('#playlistPlayer')[0].player.options.relativeVideoPath, newTime, newId)
					})
				}	
			})
				
			me.addEventListener('play', function(){
				console.log('play');
				$(".glyphPlayed:not(.hidden)").removeClass("glyphicon-pause").addClass("glyphicon-play")
			})
			me.addEventListener('pause', function(){
				console.log('pause');
				$(".glyphPlayed:not(.hidden)").removeClass("glyphicon-play").addClass("glyphicon-pause")
			})
			me.addEventListener('seeked', function(){
				console.log('seek to ' + $('#playlistPlayer')[0].player.getCurrentTime());
			})
			me.addEventListener('ended', function(){
				console.log('end playing');
				var currentVideo = currentPlaylist.findOne({relativeVideoPath: $('#playlistPlayer')[0].player.options.relativeVideoPath})
				var nextVideo = undefined
				var i = 1
				while (!nextVideo && currentVideo.order+i <= maxOrder) {
					nextVideo = currentPlaylist.findOne({order: currentVideo.order+i})
					i++
				}
				
				currentPlaylist.update({_id: currentVideo._id}, {$set: {playNow: false}}, function() {
					if (nextVideo !== undefined) {
						currentPlaylist.update({_id: nextVideo._id}, {$set: {playNow: true}}, function() {
							$('#playlistPlayer')[0].player.pause()
							$('#playlistPlayer')[0].player.setSrc(serverLocation + nextVideo.relativeVideoPath)
							$('#playlistPlayer')[0].player.options.relativeVideoPath = nextVideo.relativeVideoPath
							$(".mejs-button.mejs-playpause-button").trigger('click')
						})
					} else {
						stopSession(tData)
					}
				})
			})
	}})

	var statusConn = currentConnection.findOne({_id: idConnObserver})

	if (statusConn.iPad !== "ok") {
		$(".consoleControl").addClass('disabled')
		$("#msgConsole").append(msgIPadMindErr)

		_sessionStatus = "error"
		_dep.changed()

	} else if (statusConn.mindwave !== "ok") {
		$(".consoleControl:not(.videoListItem)").addClass('disabled')
		$("#msgConsole").append(msgMindwaveWait)

	} else if (statusConn.ffmpeg !== "ok") {
		$(".consoleControl").addClass('disabled')
		$("#msgConsole").append(msgFFmpegErr)

		_sessionStatus = "error"
		_dep.changed()

	} else if(statusConn.iPad === "ok" && statusConn.mindwave === "ok" && statusConn.ffmpeg === "ok"){
		$("#msgConsole").append(msgSessionWait)
	}

	if (statusConn.iPad === "ok" && statusConn.ffmpeg === "ok") {
		handleConn = currentConnection.find({_id: idConnObserver}).observe({

			changed: function(newDoc, oldDoc) {
				if(newDoc.iPad === "ok"){
					$("#msgIPadErr").remove()
				} else {
					$(".consoleControl").addClass('disabled')
					$("#msgConsole").append(msgIPadMindErr)
	
					$("#msgSessionWait").remove()
					$("#msgSessionRunning").remove()

					sessions.update({_id: tData._id}, {$set: {finishedAt: new Date()}})
					_sessionStatus = "error"
					_dep.changed()
					
					if ($("#playlistPlayer")[0].player !== undefined) {
						$("#playlistPlayer")[0].player.pause()
						$(".mejs-container .mejs-controls").addClass("hidePlayerControls")
						$(".mejs-overlay-button").addClass("hidePlayerControls")
						$("#playlistPlayer")[0].player.options.clickToPlayPause = false
					}
					handleConn.stop()
					return
				}
	
				if(newDoc.mindwave === "ok"){
					$("#msgMindwaveWait").remove()
				} else {
					$(".consoleControl:not(.videoListItem)").addClass('disabled')

					if(_sessionStatus === "wait"){
						$("#msgSessionWait").remove()
						$("#msgConsole").append(msgMindwaveWait)
					}

					return
				}
	
				if(newDoc.ffmpeg === "ok"){
					$("#msgFFmpegErr").remove()
				} else {
					$(".consoleControl").addClass('disabled')
					$("#msgConsole").append(msgFFmpegErr)
	
					$("#msgSessionWait").remove()
					$("#msgSessionRunning").remove()

					sessions.update({_id: tData._id}, {$set: {finishedAt: new Date()}})
					
					_sessionStatus = "error"
					_dep.changed()

					if ($("#playlistPlayer")[0].player !== undefined){
						$("#playlistPlayer")[0].player.pause()
						$(".mejs-container .mejs-controls").addClass("hidePlayerControls")
						$(".mejs-overlay-button").addClass("hidePlayerControls")
						$("#playlistPlayer")[0].player.options.clickToPlayPause = false
					}
					
					handleConn.stop()
					return
				}
	
				if (newDoc.iPad === "ok" && newDoc.mindwave === "ok" && newDoc.mindwave === "ok" && _sessionStatus === "wait"){
					$("#msgConsole").empty()
					$("#msgConsole").append(msgSessionWait)
				}
			}
		})
	}
	
	
	$(".mejs-container .mejs-controls").addClass("hidePlayerControls")
	$(".mejs-overlay-button").addClass("hidePlayerControls")
	$('#playlistPlayer')[0].player.load()
	
	$('#root').addClass('animated slideInRight').one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
		$('#root').removeClass('slideInRight')
		
		updateReferer()
	})
})

Template.session.helpers({
	playlistData: function() {
		return currentPlaylist.find({}, {sort: {order: 1}})
	},
	playlistTitle: function() {
		return "Video di " + playlist.findOne({_id: this.playlistId}).name
	},

	videoOpts: {
		sort: true,
		onUpdate: function(e) {
			if(_sessionStatus === "wait") {
				if(e.newIndex == 0){
					var videoSrc
					var currentVideo = currentPlaylist.findOne({relativeVideoPath: $('#playlistPlayer')[0].player.options.relativeVideoPath})

					currentPlaylist.update({_id: currentVideo._id}, {$set: {playNow: false}}, function() {
						currentPlaylist.update({_id: e.data._id}, {$set: {playNow: true}}, function() {
							$('#playlistPlayer')[0].player.setSrc(serverLocation + e.data.relativeVideoPath)
							$('#playlistPlayer')[0].player.setPoster(serverLocation + e.data.relativeThumbPath)
							$('#playlistPlayer')[0].player.options.relativeVideoPath = e.data.relativeVideoPath
							$('#playlistPlayer')[0].player.load() 
						})
					})

				} else if(e.oldIndex == 0){
					var videoSrc
					var currentVideo = currentPlaylist.findOne({relativeVideoPath: $('#playlistPlayer')[0].player.options.relativeVideoPath})

					var nextVideo = undefined
					var v = undefined
					var i = 1
					while (currentVideo.order-i > 0) {
						
						v = currentPlaylist.findOne({order: currentVideo.order-i})
						if(v) {
							nextVideo = v
						}
						i++
					}
					currentPlaylist.update({_id: currentVideo._id}, {$set: {playNow: false}}, function() {
						currentPlaylist.update({_id: nextVideo._id}, {$set: {playNow: true}}, function() {
							$('#playlistPlayer')[0].player.setSrc(serverLocation + nextVideo.relativeVideoPath)
							$('#playlistPlayer')[0].player.setPoster(serverLocation + nextVideo.relativeThumbPath)
							$('#playlistPlayer')[0].player.options.relativeVideoPath = nextVideo.relativeVideoPath
							$('#playlistPlayer')[0].player.load() 
						})
					})

				}
			}
		}
	},
	active: function() {
		return activeEvents.find()
	},
	patientName: function() {
		p = patients.findOne({_id: this.patientId})
		return p.name + " " + p.surname
	},
	sessionLedColor: function() {
		_dep.depend()
		var status = currentConnection.findOne({_id: idConnObserver})
		if (status !== undefined) {
			if (status.iPad === "ok" && status.mindwave === "ok" && status.ffmpeg === "ok" && _sessionStatus === "run"){
				return "green"
			} else {
				return "red"
			}
		} else {
			return "red"
		}

	},
	iPadLedColor: function() {
		var status = currentConnection.findOne({_id: idConnObserver})

		if (status !== undefined) {
			if (status.iPad === "ok"){
				return "green"
			} else {
				return "red"
			}
		} else {
			return "red"
		}
	},
	mindwaveLedColor: function() {
		var status = currentConnection.findOne({_id: idConnObserver})

		if (status !== undefined) {
			if (status.mindwave === "ok"){
				return "green"
			} else {
				return "red"
			}
		} else {
			return "red"
		}
	},
	statusStart: function () {
		_dep.depend()
		var status = currentConnection.findOne({_id: idConnObserver})

		if (status !== undefined) {
			if (status.iPad === "ok" && status.mindwave === "ok" && status.ffmpeg === "ok" && _sessionStatus === "wait"){
				return ""
			} else {
				return "disabled"
			}
		} else {
			return "disabled"
		}
	},
	glyphHidden: function() {
		_dep.depend()

		if(_sessionStatus === "run") {
			return ""
		} else {
			return "hidden"
		}
	},
	disableBtn: function() {
		_dep.depend()
		var status = currentConnection.findOne({_id: idConnObserver})

		if (status !== undefined) {
			if (status.eventReady && _sessionStatus === "run"){
				return ""
			} else {
				return "disabled"
			}
		} else {
			return "disabled"
		}
	},
	thumbnailPath: function () {
		return serverLocation + this.relativeThumbPath
	}
})

Template.session.events({
	'click #startBtn': function(event, template) {
		if(!$(event.target).closest("button").hasClass('disabled')) {

			_sessionStatus = "run"
			_dep.changed()

			$(".disabled:not(.consoleBtn)").removeClass('disabled')
			$("#msgSessionWait").remove()
			$("#msgConsole").append(msgSessionRunning)

			Meteor.call('startSession', template.data._id, function() {
				Meteor.call('playbackCommand', 'start', "", "", null, function() {
					sessions.update({_id: template.data._id}, {$set: {startedAt: new Date()}})
					$(".mejs-container .mejs-controls").removeClass("hidePlayerControls")
					$(".mejs-overlay-button").removeClass("hidePlayerControls")
					$("#playlistPlayer")[0].player.options.clickToPlayPause = true

					//$('#playlistPlayer')[0].player.load()
					//$('#playlistPlayer')[0].player.play()
					$(".mejs-button.mejs-playpause-button").trigger('click')
				})
			}) 
		}
		
	},
	'click #stopBtn': function(e, template) {
		if(!$(e.target).closest("button").hasClass('disabled')) {
			stopSession(template.data)
		}
	},
	'click .videoListItem': function(e) {
		if(!$(e.target).hasClass('disabled')) {

			if(_sessionStatus === "run") {
				var videoSrc

				var currentVideo = currentPlaylist.findOne({relativeVideoPath: $('#playlistPlayer')[0].player.options.relativeVideoPath})
				var nextVideo = this

				if ($('#playlistPlayer')[0].player.options.relativeVideoPath !== nextVideo.relativeVideoPath) {

					currentPlaylist.update({_id: currentVideo._id}, {$set: {playNow: false}}, function() {
						currentPlaylist.update({_id: nextVideo._id}, {$set: {playNow: true}}, function() {
							$('#playlistPlayer')[0].player.pause()
							$('#playlistPlayer')[0].player.setSrc(serverLocation + nextVideo.relativeVideoPath)
							$('#playlistPlayer')[0].player.options.relativeVideoPath = nextVideo.relativeVideoPath
							/*$('#playlistPlayer')[0].player.load()
							$('#playlistPlayer')[0].player.play()*/

							$(".mejs-button.mejs-playpause-button").trigger('click')
						})
					})
				}
			}
		}
	},
	'click .consoleBtn': function(event, template) {

		if(!$(event.target).hasClass('disabled')) {

			$(".consoleBtn").addClass("disabled")
			$(event.target).children("span").removeClass("hidden")
			
			events.insert({}, function(err, objId){

				var handleEvent = events.find({_id: objId}).observeChanges({
					changed: function(id) {
						$(".consoleBtn").removeClass("disabled")
						$(event.target).children("span").addClass("hidden")

						$("#msgConsole").append(msgEventRegistered)

						setTimeout(function (){
							$('#msgEventRegistered').remove()
						}, 2000)

						handleEvent.stop()
					},
					removed: function(id) {
						$(".consoleBtn").removeClass("disabled")
						$(event.target).children("span").addClass("hidden")

						$("#msgConsole").append(msgEventErr)

						setTimeout(function (){
							$('#msgEventErr').remove()
						}, 2000)

						handleEvent.stop()	
					}
				})

				Meteor.call('eventOccurred', objId, template.data._id, template.data.patientId, $(event.target).text(), currentPlaylist.findOne({playNow: true})._id, $('#playlistPlayer')[0].player.getCurrentTime())
			})
		}
	},
	'click #homeBtn, click #backBtn, click #redirectLink': function(event, template) {
		event.preventDefault()
		if(_sessionStatus === "run" || _sessionStatus === "wait") {

			var x = function () {
				if(idConnObserver !== null && handleConn)
					handleConn.stop()
				Meteor.call("stopSession", function() {
		  			Meteor.call('clearConnection', function() {
		  				if(_sessionStatus == "run"){
		  					sessions.update({_id: template.data._id}, {$set: {status: "stop"}})
		  				} else {
		  					sessions.remove({_id: template.data._id})
		  				}
		  				$("#root").addClass("animated slideOutRight").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
							Router.go($(event.target).closest("a").attr('href'))
						})
		  			})
		  		})
			}

			Blaze.renderWithData(Template.confirmDelete, 
				{
					idDelete: "exitFromSessionHome", 
					titleDelete: "Conferma Uscita Sessione", 
					msgDelete: "Sei sicuro di voler uscire dalla seduta?", 
					functionDelete: x
				},
				$("body")[0]
			)
		} else {
			if(_sessionStatus == "stop"){
				sessions.update({_id: template.data._id}, {$set: {status: "stop"}})
			} else {
				if (template.data.sessionData.length == 0) {
					sessions.remove({_id: template.data._id})
				} else {
					sessions.update({_id: template.data._id}, {$set: {status: "error"}})
				}
				
			}
			$("#root").addClass("animated slideOutRight").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
				Router.go($(event.target).closest("a").attr('href'))
			})
		}
	},
	/* Aiuto */
	'click #navbar-help': function(event, template) {
		$('#navbar-help .overlay').each(function() {
			$(this).toggleClass('hidden')
		})

		$('#videoPlaylistList .panel-body').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'right',
			container: 'body',
			content: $('#popoverPlaylist').html()
		}).popover('toggle')

		$('#playerContainer').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'top',
			container: 'body',
			content: $('#popoverVideo').html()
		}).popover('toggle')
		
		
		$('#startStop .btn-group-vertical').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'top',
			container: 'body',
			content: $('#popoverStartStop').html()
		}).popover('toggle')

		$('#status').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'left',
			container: 'body',
			content: $('#popoverStatus').html()
		}).popover('toggle')

		$('#eventsPanel .panel-body ').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'bottom',
			container: 'body',
			content: $('#popoverEvents').html()
		}).popover('toggle')

	},
	'click .disabled': function(){
		$("#status").addClass("animated pulse").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
			$("#status").removeClass("animated pulse")
		})		
	}
})


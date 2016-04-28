var HLS_SERVER_PORT = 3004
var serverLocation = "http://" + this.location.hostname +":" + HLS_SERVER_PORT

var dateToStr = function(d) {
	return d.getDate() + "/" + (d.getMonth() + 1) + "/" + d.getFullYear()
}

var dateToTime = function(d) {
	return d.toTimeString().split(' ')[0]
}

var duration = function(start, finish) {
	var diff = finish - start
	var hours = Math.floor(diff / (1000 * 3600))
	diff = diff - hours * 1000 * 3600
	var minutes = Math.floor(diff / (1000 * 60))
	diff = diff - minutes * 1000 * 60
	var seconds = Math.floor(diff / 1000)
	return hours+":"+ ((minutes > 9)? minutes : ("0" + minutes)) + ":" + ((seconds > 9)? seconds : ("0" + seconds))
}

Template.patients.onRendered( function() {
	if(Session.get('referer') == "home"){
		$('#root').addClass('animated slideInRight')
	} else if(Session.get('referer') == "patientDetails"){
		$('#root').addClass('animated slideInLeft')
	} 

	updateReferer()
})

Template.patients.helpers({
	patientData: function() {
		return patients.find({}, {sort: {surname:1, name:1}})
	},
	fullName: function() {
		return this.name + " " + this.surname
	},
	dateString: function() {
		return dateToStr(this.birthdate)
	},
	sortableOpts: {
		sort: false
	},
	destAddr: function() {
		return Router.current().url + '/' + this._id
	}
});

Template.patients.events({
	'click #patientList .addBtn': function(event, template) {
		$('#patientListModalAdd').modal('show')

		$('#patientListModalAdd').on('shown.bs.modal', function () {
  			$('#patientListModalAdd input:first').focus()
		})
	},
	'click .patientListItem .glyphicon-trash': function(event, template) {
		event.preventDefault()
		event.stopPropagation()

		var deletedId = this._id
		var x = function () {
			Meteor.call('deletePatient', deletedId)
		}
		Blaze.renderWithData(Template.confirmDelete, {idDelete: "deletePatientModal", titleDelete: "Conferma eliminazione paziente", msgDelete: "Sei sicuro di voler cancellare il paziente " + this.name + " "+ this.surname +"?", functionDelete: x}, $("body")[0])

	},
	'click .patientListItem .glyphicon-pencil': function(event, template) {
		event.preventDefault()
		event.stopPropagation()
		$('#patientListModalMod').attr('data-patientid', this._id)
		$('#patientListModalMod').modal('show')

		$('#patientListModalMod').on('shown.bs.modal', function () {
			var form = $('#patientListModalMod form')
			var user = patients.findOne({_id: $('#patientListModalMod').attr('data-patientid')})

			form.find("input[name='patientName']").attr('placeholder', user.name).val(user.name)
			form.find("input[name='patientSurname']").attr('placeholder', user.surname).val(user.surname)

			form.find("input[name='patientBirthdate']").attr('placeholder', dateToStr(user.birthdate)).val(dateToStr(user.birthdate))


  			$('#patientListModalMod input:first').focus()
		})
	},
	'click .patientListItem': function(event, template) {
		event.preventDefault()
		event.stopPropagation()
		$("#root").addClass("animated slideOutLeft").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
			Router.go($(event.target).closest("a").attr('href'))
		})
	},
	/* Aiuto */
	'click #navbar-help': function(event, template) {
		$('#navbar-help .overlay').each(function() {
			$(this).toggleClass('hidden')
		})

		$('#patientList .addBtn').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'right',
			container: 'body',
			content: $('#popoverPlusButton').html()
		}).popover('toggle')

		$('#patientList .panel').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'left',
			container: 'body',
			content: $('#popoverList').html()
		}).popover('toggle')

		/* Legenda */
		$('#patientList .panel-body').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'bottom',
			container: 'body',
			content: $('#popoverListLegend').html()
		}).popover('toggle')

		$('#patientList .panel-body .glyphicon-trash, #patientList .panel-body .glyphicon-pencil').toggleClass("force-show")
	}
})

Template.addPatient.onRendered(function() {
	$('#patientListModalAdd form').bootstrapValidator({
			excluded: ':disabled', /* serve per resettare lo stato dei campi del form quando lo si svuota */
			feedbackIcons: {
				valid: 'glyphicon glyphicon-ok',
				invalid: 'glyphicon glyphicon-remove',
				validating: 'glyphicon glyphicon-refresh'
			},
			fields: {
				patientName: {
					validators: {
						notEmpty: {
							message: 'È necessario inserire il nome del paziente'
						},						
						regexp: {
							regexp: /^[a-zA-Z ']+$/,
							message: 'Sono permessi solo lettere, spazi e \''
						}
					}
				},
				patientSurname: {
					validators: {
						notEmpty: {
							message: 'È necessario inserire il cognome del paziente'
						},
						regexp: {
							regexp: /^[a-zA-Z ']+$/,
							message: 'Sono permessi solo lettere, spazi e \''
						}
					}
				},
				patientBirthdate: {
					message: "Inserire una data di nascita valida",
					validators:{
						notEmpty: {
							message: 'È necessario inserire la data di nascita del paziente'
						},
						date: {
							format: "DD/MM/YYYY"/*,
							max: new Date()*/
						}
					}
				},

			}
		}).on('success.form.bv', function(e) {
			e.preventDefault();
			var $form     = $(e.target),
				validator = $form.data('bootstrapValidator');

			var datestring = validator.getFieldElements('patientBirthdate').val().split('/')
			var birthday = datestring[0]
			var birthmonth = datestring[1] - 1
			var birthyear = datestring[2]

			patients.insert({
				name: validator.getFieldElements('patientName').val().trim(),
				surname: validator.getFieldElements('patientSurname').val().trim(),
				birthdate: new Date(birthyear, birthmonth, birthday)
			})
			$('#patientListModalAdd').modal('hide')

		})

	$('#patientListModalAdd').on('hidden.bs.modal', function() {
		$('#patientListModalAdd form').bootstrapValidator('resetForm', true)
	})
})


Template.modPatient.onRendered(function() {
	$('#patientListModalMod form').bootstrapValidator({
		excluded: ':disabled', /* serve per resettare lo stato dei campi del form quando lo si svuota */
		feedbackIcons: {
			valid: 'glyphicon glyphicon-ok',
			invalid: 'glyphicon glyphicon-remove',
			validating: 'glyphicon glyphicon-refresh'
		},
		fields: {
			patientName: {
				validators: {
					notEmpty: {
						message: 'È necessario inserire il nome del paziente'
					},
					regexp: {
						regexp: /^[a-zA-Z ']+$/,
						message: 'Sono permessi solo lettere, spazi e \''
					},
				}
			},
			patientSurname: {
				validators: {
					notEmpty: {
						message: 'È necessario inserire il cognome del paziente'
					},
					regexp: {
						regexp: /^[a-zA-Z ']+$/,
						message: 'Sono permessi solo lettere, spazi e \''
					},
				}
			},
			patientBirthdate: {
				message: "Inserire una data di nascita valida",
				validators:{
					notEmpty: {
						message: 'È necessario inserire la data di nascita del paziente'
					},
					date: {
						format: "DD/MM/YYYY"
					}
				}
			}
		}
	}).on('success.form.bv', function(e) {
		e.preventDefault();
		var $form     = $(e.target),
			validator = $form.data('bootstrapValidator');

		var datestring = validator.getFieldElements('patientBirthdate').val().split('/')
		var birthday = datestring[0]
		var birthmonth = datestring[1] - 1
		var birthyear = datestring[2]

		patients.update({_id : $('#patientListModalMod').attr('data-patientid')}, {
			name: validator.getFieldElements('patientName').val().trim(),
			surname: validator.getFieldElements('patientSurname').val().trim(),
			birthdate: new Date(birthyear, birthmonth, birthday)
		})

		$('#patientListModalMod').modal('hide')
	})

	$('#patientListModalMod').on('hidden.bs.modal', function() {
		$('#patientListModalMod form').bootstrapValidator('resetForm', true)
	})
})


//
// patientDetails
//

Template.patientDetails.onRendered( function() {
	if(Session.get('referer') == "patients"){
		$('#root').addClass('animated slideInRight');
	} else if(Session.get('referer') == "patientSessions"){
		$('#root').addClass('animated slideInLeft');
	} 

	updateReferer()
})

Template.patientDetails.helpers({
	patientDateString: function() {
		return dateToStr(this.birthdate)
	},
	sessions: function() {
		return sessions.find({patientId:this._id, status: {$ne: "deleted"}}, {sort: {startedAt: -1}})
	},
	sortableOpts: {
		sort: false
	},
	sessionDateString: function() {
		return dateToStr(this.startedAt) 
	},
	sessionHourString: function() {
		return dateToTime(this.startedAt)
	},
	sessionDuration: function() {
		return duration(this.startedAt, this.finishedAt)
	},
	destAddr: function() {
		return Router.current().url + '/' + this._id
	},
	listTitle: function() {
		return "Sedute di " + this.name + " " + this.surname
	},
	eventNumber: function() {
		return events.find({sessionId: this._id, serverPath: {$ne: ''}}).count()
	},
	isOne: function(num) {
		return num === 1 
	},
	isZero: function(num) {
		return num === 0
	},
	playlistName: function() {
		return playlist.findOne({_id: this.playlistId}).name
	},
	playlistOwnerName: function() {
		return Meteor.users.findOne({_id: playlist.findOne({_id: this.playlistId}).ownerId}).username
	},	
	ownerName: function() {
		return Meteor.users.findOne({_id: this.ownerId}).username
	},
	status: function() {
		if (this.status === "stop") {
			return "Terminata correttamente"
		} else {
			return "Terminata per errore"
		}
	},
	downloadPath: function(){
		return '/downloadSession/' + this._id
	}
})

Template.patientDetails.events({
	'click .patientSessionListItem': function(event, template) {
		event.preventDefault()
		event.stopPropagation()
		if (events.find({sessionId: this._id, serverPath: {$ne: ''}}).count() > 0) {
			$("#root").addClass("animated slideOutLeft").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
				Router.go($(event.target).closest("a").attr('href'))
			})
		}
	},
	'click .patientSessionListItem .glyphicon-trash': function(event){
		event.preventDefault()
		event.stopPropagation()
		var deletedId = this._id
		var x = function () {
			Meteor.call('deleteSession', deletedId)
		}

		Blaze.renderWithData(Template.confirmDelete, {
			idDelete: "deleteSessionModal", 
			titleDelete: "Conferma eliminazione seduta", 
			msgDelete: "Sei sicuro di voler cancellare la seduta tenuta il " + dateToStr(this.startedAt) + " alle "+ dateToTime(this.startedAt) + "? (verranno cancellati anche tutti gli eventi e le registrazioni collegate)",
			functionDelete: x
		}, $("body")[0])
	},
	'click .patientSessionListItem .glyphicon-save': function(event, template) {
		event.stopPropagation()
	},
	/* Aiuto */
	'click #navbar-help': function(event, template) {
		$('#navbar-help .overlay').each(function() {
			$(this).toggleClass('hidden')
		})

		$('#patientSessionList .panel').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'left',
			container: 'body',
			content: $('#popoverList').html()
		}).popover('toggle')

		$('#patientSessionList .panel-body').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'bottom',
			container: 'body',
			content: $('#popoverListLegend').html()
		}).popover('toggle')

		$('#patientSessionList .panel-body .glyphicon-trash, #patientSessionList .panel-body .glyphicon-save').toggleClass("force-show")
	}
})


//
// patientSessions
//

Template.patientSessions.onRendered( function() {
	if(Session.get('referer') == "patientDetails"){
		$('#root').addClass('animated slideInRight');
	} 

	updateReferer()
})

Template.patientSessions.helpers({
	patientName: function() {
		var p = patients.findOne({_id: this.patientId})
		return p.name + ' ' + p.surname
	},
	patientId: function() {
		return this.patientId
	},
	events: function() {
		return events.find({sessionId: this._id, serverPath: {$ne: ''}}, {sort: {createdAt: 1}})
	},
	eventHourString: function() {
		return dateToTime(this.createdAt)
	},
	dateString: function() {
		return dateToStr(this.startedAt)
	},
	dateHourString: function() {
		return dateToTime(this.startedAt)
	},
	downloadPath: function(){
		return '/downloadEvent/' + this._id
	},
	session: function() {
		return sessions.findOne({_id: this._id})
	},
	ownerName: function() {
		return Meteor.users.findOne({_id: this.ownerId}).username
	},
	playlistName: function() {
		return playlist.findOne({_id: this.playlistId}).name
	},
	playlistOwnerName: function() {
		return Meteor.users.findOne({_id: playlist.findOne({_id: this.playlistId}).ownerId}).username
	},
	sessionDuration: function() {
		return duration(this.startedAt, this.finishedAt)
	},
	eventNumber: function() {
		return events.find({sessionId: this._id, serverPath: {$ne: ''}}).count()
	},
	status: function() {
		if (this.status === "stop") {
			return "Terminata correttamente"
		} else {
			return "Terminata con errore"
		}
	},
})

Template.patientSessions.events({
	'click #backBtn': function(event){
		event.preventDefault()
		event.stopPropagation()
	  	
	  	$("#root").addClass("animated slideOutRight").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
			Router.go($(event.target).closest("a").attr('href'))
		})
	},

	'click .sessionEventListItem': function(event, template) {
		var eventInstance = this

		var playlistVideo = video.findOne({_id: eventInstance.playedVideoId})
		var startTimePlayer = (eventInstance.startTime - 4 > 0)? eventInstance.startTime - 4 : 0

		//console.log(eventInstance.relativeVideoPath)
		//console.log(playlistVideo.relativeVideoPath)

		if ($('#streamingPlayer')[0].player === undefined || 
				$('#streamingPlayer')[0].player.options.myDynamicUrl !== serverLocation + eventInstance.relativeVideoPath) {

			if($('#eventVideoContainer').hasClass('hidden')){
				$('#streamingPlayer').mediaelementplayer({
					features: ['playpause','current','duration'],
					clickToPlayPause: true,
					preload: "auto",
					type: "video/mp4",
					myDynamicUrl: serverLocation + eventInstance.relativeVideoPath,
					success: function(me, originalNode) {	
						me.addEventListener('play', function(){
							if($("#playlistPlayer")[0].player.media.paused)
								$('#playlistPlayer')[0].player.play()
						})
						me.addEventListener('pause', function(){
							if(!$("#playlistPlayer")[0].player.media.paused)
								$('#playlistPlayer')[0].player.pause()
						})

						me.addEventListener('ended', function(){
							$('#playlistPlayer')[0].player.pause()
							$('#playlistPlayer')[0].player.setCurrentTime(startTimePlayer)
						})
				}})

				$('#playlistPlayer').mediaelementplayer({
					//enablePluginDebug: true,
					features: ['playpause','current','duration'],
					clickToPlayPause: true,
					preload: "auto",
					type: "application/x-mpegURL",
					myDynamicUrl: serverLocation +  playlistVideo.relativeVideoPath,
					enableAutosize: true,
					success: function(me, originalNode) {
						$('#streamingPlayer')[0].player.load()
						me.addEventListener('play', function(){
							if ($("#streamingPlayer")[0].player.media.paused)
								$('#streamingPlayer')[0].player.play()
						})
						me.addEventListener('pause', function(){
							if (!$("#streamingPlayer")[0].player.media.paused)
								$('#streamingPlayer')[0].player.pause()
						})

				        me.addEventListener('loadedmetadata', function() {
							$('#playlistPlayer')[0].player.setCurrentTime(startTimePlayer)
						})				
				}})

				$("#eventVideoContainer").removeClass("hidden").addClass("animated slideInUp").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
					$("#eventVideoContainer").removeClass("slideInUp")
				})
			} else {
				$("#eventVideoContainer").addClass("animated slideOutDown").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
					$("#eventVideoContainer").removeClass("slideOutDown").addClass('hidden')

					$('#streamingPlayer')[0].player.remove()
					$('#playlistPlayer')[0].player.remove()

					$('#streamingPlayer').mediaelementplayer({
						features: ['playpause','current','duration'],
						clickToPlayPause: true,
						type: "video/mp4",
						myDynamicUrl: serverLocation + eventInstance.relativeVideoPath,
						success: function(me, originalNode) {
							if($('#streamingPlayer')[0].player.media.pluginType === "native")
								$('#streamingPlayer')[0].player.setSrc(serverLocation + eventInstance.relativeVideoPath)
								
							me.addEventListener('play', function(){
								$('#playlistPlayer')[0].player.play()
							})
							me.addEventListener('pause', function(){
								$('#playlistPlayer')[0].player.pause()
							})

							me.addEventListener('ended', function(){
								$('#playlistPlayer')[0].player.pause()
								$('#playlistPlayer')[0].player.setCurrentTime(startTimePlayer)
							})

						}
					})

					$('#playlistPlayer').mediaelementplayer({
						clickToPlayPause: true,
						type: "application/x-mpegURL",
						features: ['playpause','current','duration'],
						myDynamicUrl: serverLocation + playlistVideo.relativeVideoPath,
						success: function(me, originalNode) {
							me.load()

							if($('#playlistPlayer')[0].player.media.pluginType === "native")
								$('#playlistPlayer')[0].player.setSrc(serverLocation + playlistVideo.relativeVideoPath)

							me.addEventListener('play', function(){
								$('#streamingPlayer')[0].player.play()
							})
							me.addEventListener('pause', function(){
								$('#streamingPlayer')[0].player.pause()
							})

							$('#playlistPlayer')[0].player.src = serverLocation + playlistVideo.relativeVideoPath

							me.addEventListener('loadedmetadata', function() {
								$('#playlistPlayer')[0].player.setCurrentTime(startTimePlayer)
							})
						}
					})

					$('#playlistPlayer')[0].player.load()

					$("#eventVideoContainer").removeClass('hidden').addClass("animated slideInUp").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
						$("#eventVideoContainer").removeClass("slideInUp")
					})

				})
			}
		}
	},
	'click .sessionEventListItem .glyphicon-trash': function(event) {
		event.preventDefault()
		event.stopPropagation()
		var eventData = this
		var x = function () {
			Meteor.call('deleteEvent', eventData._id)
		}

		Blaze.renderWithData(Template.confirmDelete, {
			idDelete: "deleteEventModal", 
			titleDelete: "Conferma eliminazione evento", 
			msgDelete: "Sei sicuro di voler cancellare l'evento " + eventData.eventName + " avvenuto alle "+ dateToTime(eventData.createdAt)+"?", 
			functionDelete: x}, $("body")[0])
	}, 
	'click .sessionEventListItem .glyphicon-save': function(event, template) {
		event.stopPropagation()
	},
	/* Aiuto */
	'click #navbar-help': function(event, template) {
		$('#navbar-help .overlay').each(function() {
			$(this).toggleClass('hidden')
		})

		$('#sessionInfoContainer .panel').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'top',
			container: 'body',
			content: $('#popoverInfo').html()
		}).popover('toggle')

		$('#sessionEventList .panel').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'top',
			container: 'body',
			content: $('#popoverList').html()
		}).popover('toggle')

		/* Legenda */
		$('#sessionEventList .panel-body').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'bottom',
			container: 'body',
			content: $('#popoverListLegend').html()
		}).popover('toggle')

		$('#sessionEventList .panel-body .glyphicon-trash, #sessionEventList .panel-body .glyphicon-save').toggleClass("force-show")
	}
})
/* ----- video ------*/
renderedView = undefined

// Tracker.dependancy da http://stackoverflow.com/questions/22182497/meteor-dynamically-change-template-helper-data
var _dep = new Tracker.Dependency

var depName = null
var depId = null
_dep.changed()
var videoUploadObj = null

var initialization = true
var insertHook, removeHook, updateHook

var HLS_SERVER_PORT = 3004
var serverLocation = "http://" + this.location.hostname +":" + HLS_SERVER_PORT

Template.videoPage.onCreated(function () {
	this._templateShown = new ReactiveVar("videoForm")
})

Template.videoPage.onRendered( function() {
	if(Session.get('referer') == "home"){
		$('#root').addClass('animated slideInRight');
	}

	updateReferer()

	Meteor.call('clearCurrentPlaylist')

	depName = null
	depId = null
	_dep.changed()
})

Template.videoPage.helpers({
	videoData: function () {
		return video.find({segmented: true})
	},

	videoOpts: {
		sort: false,
		group: {
			name: "videos",
			pull: 'clone',
			put: false
		},
		//draggable: ".list-group-item",

	},

	playlistData: function() {
		return playlist.find({ownerId: Meteor.userId()})
	},

	playlistOpts: {
		sort: false
	},

	isOwner: function() {
		return Meteor.userId() === this.ownerId
	},

	thumbnailPath: function () {
		return serverLocation + this.relativeThumbPath
	}
})

Template.videoPage.events({
	'click  .videoListItem .glyphicon-trash': function(event, template) {
		var deletedId = this._id
		var x = function () {
			Meteor.call('deleteVideo', deletedId)
		}
		Blaze.renderWithData(Template.confirmDelete, {idDelete: "deleteVideoModal", titleDelete: "Conferma eliminazione video", msgDelete: "Sei sicuro di voler cancellare il video " + this.name + "? (Il video verrà cancellato anche da tutte le playlist in cui è presente)", functionDelete: x}, $("body")[0])
	},

	'click .videoPlaylistListItem .glyphicon-trash': function(event, template) {
		var deletedId = this._id
		var x = function () {
			currentPlaylist.remove({_id: deletedId})
		}
		Blaze.renderWithData(Template.confirmDelete, {idDelete: "deleteVideoPlaylistModal", titleDelete: "Conferma eliminazione video", msgDelete: "Sei sicuro di voler cancellare il video " + this.name + " dalla playlist " + depName + "?", functionDelete: x}, $("body")[0])

	},

	'click  .playlistListItem .glyphicon-trash': function(event, template) {
		var playlistId = this._id

		var x = function () {
			if ( playlistId == depId ) {				
				insertHook.remove()
				removeHook.remove()

				depId = null
				depName = null
				_dep.changed()

				Meteor.call('clearCurrentPlaylist', function () {
					playlist.remove({_id: playlistId})
				})

			} else {
				playlist.remove({_id: playlistId})
			}
		}

		Blaze.renderWithData(Template.confirmDelete, {idDelete: "deletePlaylistModal", titleDelete: "Conferma eliminazione playlist", msgDelete: "Sei sicuro di voler cancellare la playlist " + this.name + "?", functionDelete: x}, $("body")[0])

		event.stopPropagation()

	},

	'click  .videoListItem .glyphicon-pencil': function(event, template) {
		$('#modifyVideoListModal input').val(this.name).attr("data-id", this._id)
		$('#modifyVideoListModal').modal('show')
		$('#modifyVideoListModal').on('shown.bs.modal', function () {
			$('#modifyVideoListModal input').focus()
		})
	},

	'click  .playlistListItem .glyphicon-pencil': function(event, template) {
		$('#modifyPlaylistListModal input').val(this.name).attr("data-id", this._id)
		$('#modifyPlaylistListModal').modal('show')
		$('#modifyPlaylistListModal').on('shown.bs.modal', function () {
			$('#modifyPlaylistListModal input').focus()
		})

		event.stopPropagation()
	},

	'click #videoList .addBtn': function(event, template) {
		$('#addVideoListModal').modal('show')
		$('#addVideoListModal').on('shown.bs.modal', function () {
			$('#addVideoListModal input:first').focus()
		})
	},
	'click #playlistList .addBtn': function(event, template) {
		$('#addPlaylistListModal').modal('show')
		$('#addPlaylistListModal').on('shown.bs.modal', function () {
			$('#addPlaylistListModal input:first').focus()
		})
	},

	'click a.playlistListItem': function(event, template) {
		/* -- cliccata un'icona -- */
		if($(event.target).hasClass("glyphicon")) {
			/* -- cliccato delete --*/
			return
		}

		var _playlistId = this._id
		var _playlistName = "Video di " + this.name
		// Controlla se ha già creato il template

		// controlla se playlist richiesta non è già visualizzata
		if (depId !== _playlistId) {
			if(insertHook !== undefined)
				insertHook.remove()

			if(removeHook !== undefined)
				removeHook.remove()
			
			initialization = true

			insertHook = currentPlaylist.after.insert(function () {
				if(!initialization) {
					Meteor.call('saveCurrentPlaylist', depId)
				}
			})

			removeHook = currentPlaylist.after.remove(function (){
				if(!initialization) {
					Meteor.call('saveCurrentPlaylist', depId)
				}
			})
			
			Meteor.call('clearCurrentPlaylist', function() {
				playlist.findOne({_id: _playlistId}, {fields: {videos: 1}}).videos.forEach(function(videoElement) {
					currentPlaylist.insert(videoElement)
				})
				
				depName = _playlistName
				depId = _playlistId
				_dep.changed()

				initialization = false

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
			placement: 'top',
			container: 'body',
			content: $('#popoverPlaylistVideoList').html()
		}).popover('toggle')

		$('#videoPlaylistList .panel').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'bottom',
			container: 'body',
			content: $('#popoverPlaylistVideoListLegend').html()
		}).popover('toggle')
		
		$('#videoList .addBtn').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'top',
			container: 'body',
			content: $('#popoverVideoListPlus').html()
		}).popover('toggle')

		$('#playlistList .addBtn').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'bottom',
			container: 'body',
			content: $('#popoverPlaylistListPlus').html()
		}).popover('toggle')

		$('#playlistList .panel').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'top',
			container: 'body',
			content: $('#popoverPlaylistList').html()
		}).popover('toggle')

		$('#playlistList .panel-body').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'bottom',
			container: 'body',
			content: $('#popoverPlaylistListLegend').html()
		}).popover('toggle')

		$('#videoList .panel-body').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'top',
			container: 'body',
			content: $('#popoverListLegend').html()
		}).popover('toggle')

		$('#playlistList .panel-body .glyphicon-trash, #playlistList .panel-body .glyphicon-pencil').toggleClass("force-show")
		$('#videoList .panel-body .glyphicon-trash, #videoList .panel-body .glyphicon-pencil').toggleClass("force-show")
		$('#videoPlaylistList .panel-body .glyphicon-trash').toggleClass("force-show")
	}	
})

/* ----- videoForm ------*/

Template.videoForm.onRendered(function() {
	if (this.data.add) {

	  $('#addVideoListModal form').bootstrapValidator({
			excluded: ':disabled', /* serve per resettare lo stato dei campi del form quando lo si svuota */
			feedbackIcons: {
				valid: 'glyphicon glyphicon-ok',
				invalid: 'glyphicon glyphicon-remove',
				validating: 'glyphicon glyphicon-refresh'
			},
			fields: {
				addVideoName: {
					message: 'Video non valido',
					validators: {
						notEmpty: {
							message: 'È necessario inserire il nome del video'
						},
						stringLength: {
							min: 3,
							max: 30,
							message: 'Il nome deve avere una lunghezza compresa tra 3 e 30 caratteri'
						},
						regexp: {
							regexp: /^[a-zA-Z0-9_ ]+$/,
							message: 'Sono permessi solo lettere, numeri, spazi e _'
						},
						callback: {
							message: 'È già presente un video con questo nome',
							callback: function(value, validator) {
								return video.findOne({name: value}) === undefined
						   }
						}
					}
				}, 
				inputVideo : {
					message: 'Video non valido',
					validators: {
						notEmpty: {
							message: 'È necessario selezionare un file video'
						},

						file : {
							extension: '3gpp,3gp,mp4,mpeg, mpg,mov,webm,flv,m4v,wmv,avi',
							type: "video/3gpp,video/mp4,video/mpeg,video/quicktime,video/webm,video/x-flv,video/x-m4v,video/x-ms-wmv,video/x-msvideo",
							message: 'Il file selezionato non è un video. Selezionare un file del tipo 3gpp, 3gp,mp4,mpeg, mpg,mov,webm,flv,m4v,wmv o avi',
							minFiles: 1,
							maxFiles: 1
						},
					}
				}
			}
		})
		.on('success.form.bv', function(e) {
			e.preventDefault()
			var $form     = $(e.target),
				validator = $form.data('bootstrapValidator');
			
			file = validator.getFieldElements('inputVideo')[0].files[0]
			var extension = file.name.split(".").slice(-1)[0]
			var uploadFile = new FS.File(file)
			uploadFile.name(validator.getFieldElements('addVideoName').val() + "." + extension)
			uploadFile.metadata = {ownerId: Meteor.userId()}


			videoUploadObj = videoUpload.insert(uploadFile, function (err, fileObj) {
				if (err) {
					videoUpload.update({_id: fileObj._id}, {$set: {errorUpload: true}})
					return
				} else {
					videoUpload.update({_id: fileObj._id}, {$set: {errorUpload: false}})
				}

				video.insert({_id: fileObj._id, "originalName": fileObj.name(), "segmented": false}, function(error, idVideo) {
					if (error) {
					} else {
						var handle = video.find({_id: idVideo}).observeChanges({
							changed: function(id, fields) {
								if (fields.segmented == true && id == idVideo) {
									console.log("> Conversione terminata con successo")
									handle.stop()
								}
							},
							removed: function(id) {
								if (id == idVideo) {
									console.log("> Errore durante la conversione")
									handle.stop()
								}
							}
						})
					}
				})	
			})
			

			$('#addVideoListModal').modal('hide')
			$('#loadingVideoModal').modal('show')
		})

		$('#addVideoListModal').on('hidden.bs.modal', function() {
			$('#addVideoListModal form').bootstrapValidator('resetForm', true)
		})

	} else {

		$('#modifyVideoListModal form').bootstrapValidator({
			excluded: ':disabled', /* serve per resettare lo stato dei campi del form quando lo si svuota */
			feedbackIcons: {
				valid: 'glyphicon glyphicon-ok',
				invalid: 'glyphicon glyphicon-remove',
				validating: 'glyphicon glyphicon-refresh'
			},
			fields: {
				modifyVideoName: {
					message: 'Video non valido',
					validators: {
						notEmpty: {
							message: 'È necessario inserire il nome del video'
						},
						stringLength: {
							min: 3,
							max: 30,
							message: 'Il nome deve avere una lunghezza compresa tra 3 e 30 caratteri'
						},
						regexp: {
							regexp: /^[a-zA-Z0-9_\.]+$/,
							message: 'Sono permessi solo lettere, numeri, . e _'
						},
						callback: {
							message: 'È già presente un video con questo nome o inserito il nome precedente',
							callback: function(value, validator) {
								return video.findOne({name: value}) === undefined
						   }
						}, 
					}
				}
			}
		})
		.on('success.form.bv', function(e) {
			e.preventDefault();
			var $form     = $(e.target),
				validator = $form.data('bootstrapValidator');
			
			Meteor.call('changeVideoNameUpdatePlaylist', validator.getFieldElements('modifyVideoName').attr('data-id'), validator.getFieldElements('modifyVideoName').val(), function(){
				video.update({_id: validator.getFieldElements('modifyVideoName').attr('data-id')}, {$set: {name: validator.getFieldElements('modifyVideoName').val()}})
				currentPlaylist.update({_id: validator.getFieldElements('modifyVideoName').attr('data-id')}, {$set: {name: validator.getFieldElements('modifyVideoName').val()}})
			})
			
			$('#modifyVideoListModal').modal('hide')
		})

		$('#modifyVideoListModal').on('hidden.bs.modal', function() {
			$('#modifyVideoListModal form').bootstrapValidator('resetForm', true)
		})
	}
})

Template.videoForm.helpers({
	idVideo: function(){
		_dep.depend()
		return depIdVideo
	}
})

var initialize=true

Template.loadingVideo.helpers({
	video: function() {
		var v = videoUpload.find().fetch()[0]
		if(v === undefined && initialize)
			initialize=false
		else {
				return v
		}
	},
	progressLoad: function() {
		if ("uploadedAt" in this) {
			return 100
		} else if(this === undefined) {
			return 0
		} else {
			return Math.ceil((this.chunkCount/this.chunkSum)*100) 
		}
		
	},
	progressEncode : function() {
		return Math.ceil((this.currentTime/this.duration)*100)
	},
	processConcluded: function() {
		if ("uploadedAt" in this) {
			if ("duration" in this && "currentTime" in this) {
				if(this.duration==this.currentTime) {
					if(this.thumbnail)
						return ""
				}
			}
			
			return "disabled"

		} else if (this.errorUpload === true || this.errorEncoding===true) {
			return ""
		} else {
			return "disabled"
		}
	},
	uploadColor: function() {
		if("chunckCount" in this && "chunckSum" in this) {
			return "info"
		} else if ("uploadedAt" in this) {
			return "success"
		} else if (this === undefined) {
			return "danger"
		}
	},
	encodingColor: function() {
		if ("uploadedAt" in this) {
			if(this.errorEncoding){
				return "danger"
			} else if(this.duration != this.currentTime) {
				return "info"
			} else {
				return "success"
			}
		} else {
			return "danger"
		}
	}
})

Template.loadingVideo.events({
	'click #finishLoadBtn': function () {
		videoUpload.remove({_id: videoUploadObj._id})
	}
})


/* ----- playlistForm ------*/

Template.playlistForm.onRendered(function() {
	if (this.data.add) {

	  $('#addPlaylistListModal form').bootstrapValidator({
			excluded: ':disabled', /* serve per resettare lo stato dei campi del form quando lo si svuota */
			feedbackIcons: {
				valid: 'glyphicon glyphicon-ok',
				invalid: 'glyphicon glyphicon-remove',
				validating: 'glyphicon glyphicon-refresh'
			},
			fields: {
				addPlaylistName: {
					message: 'PLaylist non valido',
					validators: {
						notEmpty: {
							message: 'È necessario inserire il nome della playlist'
						},
						stringLength: {
							min: 3,
							max: 30,
							message: 'Il nome deve avere una lunghezza compresa tra 3 e 30 caratteri'
						},
						regexp: {
							regexp: /^[a-zA-Z0-9_\. ]+$/,
							message: 'Sono permessi solo lettere, numeri, punti, spazi e _'
						},
						callback: {
							message: 'È già presente una playlist con questo nome',
							callback: function(value, validator) {
				
								return playlist.findOne({name: value, ownerId: Meteor.userId()}) === undefined
						   }
						}
					}
				}
			}
		})
		.on('success.form.bv', function(e) {
			e.preventDefault();

			var $form     = $(e.target),
				validator = $form.data('bootstrapValidator');
			
			playlist.insert({name: validator.getFieldElements('addPlaylistName').val(), ownerId: Meteor.userId(), videos : []})
			$('#addPlaylistListModal').modal('hide')
		})

		$('#addPlaylistListModal').on('hidden.bs.modal', function() {
			$('#addPlaylistListModal form').bootstrapValidator('resetForm', true)
		})

	} else {
		$('#modifyPlaylistListModal form').bootstrapValidator({
			excluded: ':disabled', /* serve per resettare lo stato dei campi del form quando lo si svuota */
			feedbackIcons: {
				valid: 'glyphicon glyphicon-ok',
				invalid: 'glyphicon glyphicon-remove',
				validating: 'glyphicon glyphicon-refresh'
			},
			fields: {
				modifyPlaylistName: {
					message: 'PLaylist non valido',
					validators: {
						notEmpty: {
							message: 'È necessario inserire il nome della playlist'
						},
						stringLength: {
							min: 3,
							max: 30,
							message: 'Il nome deve avere una lunghezza compresa tra 3 e 30 caratteri'
						},
						regexp: {
							regexp: /^[a-zA-Z0-9_\.]+$/,
							message: 'Sono permessi solo lettere, numeri, . e _'
						},
						callback: {
							message: 'È già presente una playlist con questo nome o inserito lo stesso nome',
							callback: function(value, validator) {
				
								return playlist.findOne({name: value}) === undefined
						   }
						}
					}
				}
			}
		})
		.on('success.form.bv', function(e) {
			e.preventDefault();
			var $form     = $(e.target),
				validator = $form.data('bootstrapValidator');
			if (depName === playlist.findOne({_id: validator.getFieldElements('modifyPlaylistName').attr('data-id')}).name)
			{
				depName = validator.getFieldElements('modifyPlaylistName').val()
				_dep.changed()
			}

			playlist.update({_id: validator.getFieldElements('modifyPlaylistName').attr('data-id')}, {$set: {name: validator.getFieldElements('modifyPlaylistName').val()}})
			$('#modifyPlaylistListModal').modal('hide')

		})

		$('#modifyPlaylistListModal').on('hidden.bs.modal', function() {
			$('#modifyPlaylistListModal form').bootstrapValidator('resetForm', true)
		})

	}
})


/* ----- playlistView ------*/

Template.playlistView.helpers({
	videoPlaylistOpts: {
		
		sort: true,

		group:  {
			name: "videos",
			pull: false,
			put: true					
		},

		onUpdate: function(event){
			Meteor.call('saveCurrentPlaylist', depId)
		},

		onAdd: function(event) {
			if (event.clone !== null) {

				if (currentPlaylist.findOne({_id: event.data._id}) !== undefined){
					var msgError = $("<span></span>").addClass("text-danger").text("Il video \""+event.data.name+"\" è gia presente nella playlist").addClass("animated fadeIn")

					$(event.target).closest(".panel-default").children(".panel-heading").children(".panel-title").append(msgError)

					setTimeout(function (){
						msgError.addClass("animated fadeOut").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
							msgError.remove()
						})
					}, 1000)

					return
				} else if (depId === null){
					/* copia i data dell'evento per non modificare quelli originali */
					var tmp = $.extend({}, event.data)
					tmp._id = null
					event.data = tmp
					
					var msgError = $("<span></span>").addClass("text-danger").text("Selezionare una playlist").addClass("animated fadeIn")

					$(event.target).closest(".panel-default").children(".panel-heading").children(".panel-title").append(msgError)

					setTimeout(function (){
						msgError.addClass("animated fadeOut").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
							msgError.remove()
						})
					}, 1000)
				}
			}
		}
	},

	videoPlaylistData: function() {
		return currentPlaylist.find({}, {sort: {order: 1}})
	},

	title: function (){
		_dep.depend()
		return depName
	},

	thumbnailPath: function () {
		return serverLocation + this.relativeThumbPath
	}
})



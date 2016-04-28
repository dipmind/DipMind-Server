/* ----- settings ------*/

Template.settings.onRendered( function() {
	if(Session.get('referer') == "home"){
		$('#root').addClass('animated slideInRight');
	} else if(Session.get('referer') == "userManagement" || Session.get('referer') == "eventManagement") {
		$('#root').addClass('animated slideInLeft');
	}

	updateReferer()
})

Template.settings.events ({
	/* Aiuto */
	'click #navbar-help': function(event, template) {
		$('#navbar-help .overlay').each(function() {
			$(this).toggleClass('hidden')
		})

		$('#root > .container').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'bottom',
			container: 'body',
			content: $('#popoverChoice').html()
		}).popover('toggle')
	}
})


/* ----- userManagement ------*/

Template.userManagement.onRendered( function() {
	if(Session.get('referer') == "settings"){
		$('#root').addClass('animated slideInRight');
	}

	updateReferer()
})

Template.userManagement.helpers({
	userData: function () {
		return Meteor.users.find({username: {$ne: "admin"}}, {sort: {username: 1}})
	},
	sortableOpts: {
		sort: false
	}
})

Template.userManagement.events({
	'click #userList .addBtn': function(event, template) {
		$('#userListModal').modal('show')
		$('#userListModal').on('shown.bs.modal', function () {
  			$('#userListModal input:first').focus()
		})
	},
	'click .userListItem .glyphicon-trash': function(event, template) {
		var deletedId = this._id
		var x = function () {
			Meteor.call('removeUser', deletedId)
		}
		Blaze.renderWithData(Template.confirmDelete, {idDelete: "deleteUserModal", titleDelete: "Conferma eliminazione utente", msgDelete: "Sei sicuro di voler cancellare l'utente " + this.username + "?", functionDelete: x}, $("body")[0])
	},
	/* Aiuto */
	'click #navbar-help': function(event, template) {
		$('#navbar-help .overlay').each(function() {
			$(this).toggleClass('hidden')
		})

		$('#userList .addBtn').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'right',
			container: 'body',
			content: $('#popoverPlusButton').html()
		}).popover('toggle')

		/* Legenda */
		$('#userList .panel-body').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'left',
			container: 'body',
			content: $('#popoverListLegend').html()
		}).popover('toggle')

		$('#userList .panel-body .glyphicon-trash, #userList .panel-body .glyphicon-pencil').toggleClass("force-show")
	}
})

/* ----- userForm ------*/

Template.userForm.onRendered(function() {
	$('#userListModal form').bootstrapValidator({
		excluded: ':disabled', /* serve per resettare lo stato dei campi del form quando lo si svuota */
		feedbackIcons: {
			valid: 'glyphicon glyphicon-ok',
			invalid: 'glyphicon glyphicon-remove',
			validating: 'glyphicon glyphicon-refresh'
		},
		fields: {
			username: {
				message: 'Username non valido',
				validators: {
					notEmpty: {
						message: 'È necessario inserire uno username'
					},
					stringLength: {
						min: 3,
						max: 30,
						message: 'Lo username deve avere una lunghezza compresa tra 3 e 30 caratteri'
					},
					regexp: {
						regexp: /^[a-zA-Z0-9_\.]+$/,
						message: 'Sono permessi solo lettere, numeri, . e _'
					},
					callback: {
						message: 'Lo username indicato è già presente',
						callback: function(value, validator) {
							var pattern = "^"+value.trim()+"$"
							return Meteor.users.findOne({username: {$regex: pattern, $options: "i"}}) === undefined
					   }
					}
				}
			}
		}
	}).on('success.form.bv', function(e) {
		e.preventDefault();
		var $form     = $(e.target),
			validator = $form.data('bootstrapValidator');

		Meteor.call('addUser', validator.getFieldElements('username').val().trim())
		$('#userListModal').modal('hide')

	})

	$('#userListModal').on('hidden.bs.modal', function() {
		$('#userListModal form').bootstrapValidator('resetForm', true)
	})
})


/* ----- eventManagement -----*/

Template.eventManagement.onRendered( function() {
	if(Session.get('referer') == "settings"){
		$('#root').addClass('animated slideInRight')
	}

	updateReferer()
})

Template.eventManagement.helpers({
	availableEvents: function () {
		return availableEvents.find({}, {sort: {name: 1}})

	},
	activeEvents: function () {
		return activeEvents.find({}, {sort: {name: 1}})
	},
	availableOpts: {
		group: {
			name: "eventi",
			pull: true,
			put: true
		},
		sort: false,
		
	},
	activeOpts: {
		group: {
			name: "eventi",
			put: true,
			pull: true
		},
		sort: false,
	}
})

Template.eventManagement.events({
	'click #availableEventList .addBtn': function(event, template) {
		$('#addEventListModal').modal('show')
		$('#addEventListModal').on('shown.bs.modal', function () {
  			$('#addEventListModal input:first').focus()
		})
	},
	'click .availableEventListItem .glyphicon-trash': function(event, template) {
		var deletedId = this._id
		var x = function () {
			availableEvents.remove({_id: deletedId})
		}
		Blaze.renderWithData(Template.confirmDelete, {idDelete: "deleteAvailableModal", titleDelete: "Conferma eliminazione evento", msgDelete: "Sei sicuro di voler cancellare l'evento " + this.name + "?", functionDelete: x}, $("body")[0])
	},
	'click .activeEventListItem .glyphicon-trash': function(event, template) {
		var deletedId = this._id
		var x = function () {
			activeEvents.remove({_id: deletedId})
		}
		Blaze.renderWithData(Template.confirmDelete, {idDelete: "deleteActiveModal", titleDelete: "Conferma eliminazione evento", msgDelete: "Sei sicuro di voler cancellare l'evento " + this.name + "?", functionDelete: x}, $("body")[0])
	},
	'click .availableEventListItem .glyphicon-pencil, click .activeEventListItem .glyphicon-pencil': function(event, template) {
		$('#modifyEventListModal input').val(this.name).attr("data-id", this._id)
		$('#modifyEventListModal').modal('show')
		$('#modifyEventListModal').on('shown.bs.modal', function () {
  			$('#modifyEventListModal input:first').focus()
		})
	},
	/* Aiuto */
	'click #navbar-help': function(event, template) {
		$('#navbar-help .overlay').each(function() {
			$(this).toggleClass('hidden')
		})

		$('#availableEventList .addBtn').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'top',
			container: 'body',
			content: $('#popoverPlusButton').html()
		}).popover('toggle')

		/* Legenda */
		$('#availableEventList .panel-body').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'left',
			container: 'body',
			content: $('#popoverListLegend').html()
		}).popover('toggle')

		$('#activeEventList .panel-body').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'right',
			container: 'body',
			content: $('#popoverListLegend').html()
		}).popover('toggle')

		$('#root > .container').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'bottom',
			container: 'body',
			content: $('#popoverChoice').html()
		}).popover('toggle')

		$('#activeEventList .panel-body .glyphicon-trash, #activeEventList .panel-body .glyphicon-pencil').toggleClass("force-show")
		$('#availableEventList .panel-body .glyphicon-trash, #availableEventList .panel-body .glyphicon-pencil').toggleClass("force-show")
	}
})


Template.eventForm.onRendered(function() {
	if(this.data.add) {
	  $('#addEventListModal form').bootstrapValidator({
			excluded: ':disabled', /* serve per resettare lo stato dei campi del form quando lo si svuota */
			feedbackIcons: {
				valid: 'glyphicon glyphicon-ok',
				invalid: 'glyphicon glyphicon-remove',
				validating: 'glyphicon glyphicon-refresh'
			},
			fields: {
				addEventName: {
					message: 'Evento non valido',
					validators: {
						notEmpty: {
							message: 'È necessario inserire un nome per un evento'
						},
						stringLength: {
							min: 3,
							max: 30,
							message: 'Il nome dell\' evento deve avere una lunghezza compresa tra 3 e 30 caratteri'
						},
						regexp: {
							regexp: /^[a-zA-Z0-9_\.]+$/,
							message: 'Sono permessi solo lettere, numeri, . e _'
						},
						callback: {
							message: 'Il nome indicato è già presente',
							callback: function(value, validator) {
								var pattern = "^"+value.trim()+"$"
								return availableEvents.findOne({name: {$regex: pattern, $options: "i"}}) === undefined && activeEvents.findOne({name: {$regex: pattern, $options: "i"}}) === undefined 
						   }
						}
					}
				}
			}
		}).on('success.form.bv', function(e) {
			e.preventDefault();
			var $form     = $(e.target),
				validator = $form.data('bootstrapValidator');

			availableEvents.insert({name: validator.getFieldElements('addEventName').val().trim()});

			$('#addEventListModal').modal('hide')
		})

		$('#addEventListModal').on('hidden.bs.modal', function() {
			$('#addEventListModal form').bootstrapValidator('resetForm', true)
		})
	} else {
		$('#modifyEventListModal form').bootstrapValidator({
			excluded: ':disabled', /* serve per resettare lo stato dei campi del form quando lo si svuota */
			feedbackIcons: {
				valid: 'glyphicon glyphicon-ok',
				invalid: 'glyphicon glyphicon-remove',
				validating: 'glyphicon glyphicon-refresh'
			},
			fields: {
				modifyEventName: {
					message: 'Evento non valido',
					validators: {
						notEmpty: {
							message: 'È necessario inserire un nome per un evento'
						},
						stringLength: {
							min: 3,
							max: 30,
							message: 'Il nome dell\' evento deve avere una lunghezza compresa tra 3 e 30 caratteri'
						},
						regexp: {
							regexp: /^[a-zA-Z0-9_\.]+$/,
							message: 'Sono permessi solo lettere, numeri, . e _'
						},
						callback: {
							message: 'Il nome indicato è già presente o è quello che si vuole modificare',
							callback: function(value, validator) {
								var pattern = "^"+value.trim()+"$"
								return availableEvents.findOne({name: {$regex: pattern, $options: "i"}}) === undefined && activeEvents.findOne({name: {$regex: pattern, $options: "i"}}) === undefined 
						   }
						}
					}
				}
			}
		}).on('success.form.bv', function(e) {
			e.preventDefault();
			var $form     = $(e.target),
				validator = $form.data('bootstrapValidator');

			availableEvents.update({_id: validator.getFieldElements('modifyEventName').attr("data-id")}, {$set:{name: validator.getFieldElements('modifyEventName').val().trim()}});
			activeEvents.update({_id: validator.getFieldElements('modifyEventName').attr("data-id")}, {$set:{name: validator.getFieldElements('modifyEventName').val().trim()}});

			$('#modifyEventListModal').modal('hide')
		})

		$('#modifyEventListModal').on('hidden.bs.modal', function() {
			$('#modifyEventListModal form').bootstrapValidator('resetForm', true)
		})
	}
})

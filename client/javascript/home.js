/* ----- homeSection ------*/

Template.homeSection.events({
	'click a': function(event) {
		event.preventDefault()
		if(this.destination == "sessionSetup"){
			if(activeEvents.find({}).count() == 0) {
				$(event.target).closest("a").attr("data-content", "Non ci sono eventi attivi per la seduta. Contattare l'amministratore.").popover("toggle")
				return
			} else if (patients.find({}).count() == 0) {
				$(event.target).closest("a").attr("data-content", "Non sono ancora stati inseriti pazienti nel sistema. Inserirne qualcuno tramite la sezione Pazienti.").popover("toggle")
				return
			} else {
				var n = playlist.find({}).count()
				if (n == 0) {
				$(event.target).closest("a").attr("data-content", "Non è ancora stata creata alcuna playlist. Inserirne qualcuna tramite la sezione Playlist.").popover("toggle")
				return
				} else if (playlist.find({videos: {$size: 0}}).count() == n) {
					$(event.target).closest("a").attr("data-content", "Tutte le playlist create non hanno video disponibili. Inserirne qualcuno tramite la sezione Playlist.").popover("toggle")
					return
				}
			}
		}
		$("#root").addClass("animated slideOutLeft").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
			Router.go($(event.target).closest("a").attr('href'))
		})
	}
})


/* ----- homeQuickstart ------*/

Template.homeQuickstart.helpers({
	'showAdminMenu': function() {
		var adminId = Meteor.users.findOne({username : "admin"}, {fields: {_id: 1}})
		return Meteor.userId() === adminId._id
	}
})

Template.homeQuickstart.events({
	/* Aiuto */
	'click #navbar-help': function(event, template) {
		$('#navbar-help .overlay').each(function() {
			$(this).toggleClass('hidden')
		})

		$('#homeBtn').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'bottom',
			container: 'body',
			content: $('#popoverHomeButton').html()
		}).popover('toggle')

		$('#navbar-help').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'right',
			container: 'body',
			content: $('#popoverHelpButton').html()
		}).popover('toggle')

		$('#login-dropdown-list').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'bottom',
			container: 'body',
			content: $('#popoverLoginButton').html()
		}).popover('toggle')

		$('#root').popover({
			html: true,
			animation:false,
			trigger: 'manual',
			placement: 'bottom',
			container: 'body',
			content: $('#popoverChoice').html()
		}).popover('toggle')
	}
})

Template.homeQuickstart.onRendered( function() {
	if (Session.get('referer') != "login") {
		$("#root").addClass("animated slideInLeft")
	}
	
	updateReferer()
})

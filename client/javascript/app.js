/* Logica generale app, eventi ed helper di template */
/* navigationBar, backButton, sortable, list */

/* Parametri iniziali e funzioni generali */
Session.setDefault('referer', 'login')

updateReferer = function(step) {
	if(step === null || step === undefined){
		Session.set('referer', Router.current().route.getName())
	} else {
		Session.set('referer', Router.current().route.getName() + "/" + step)
	}
}

/* ----- navigationBar ------*/

Template.navigationBar.events({
	'click #homeBtn': function(event) {
	  	event.preventDefault()
	  	if(Router.current().route.getName() === 'home')
	  		return

	  	if(Router.current().route.getName() === "sessionSetup" || Router.current().route.getName() === "session")
			return
	  	
	  	$("#root").addClass("animated slideOutRight").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
			Router.go($(event.target).closest("a").attr('href'))
		})
	}
})

/* ----- backButton ------*/

Template.backButton.events({
	'click #backBtn': function(event){
		event.preventDefault()

		if(Router.current().route.getName() === "session")
			return	  		
	  	
	  	$("#root").addClass("animated slideOutRight").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
			Router.go($(event.target).closest("a").attr('href'))
		})
	}
})


/* ----- sortable ------*/

/* Eventi legati al block(#) Sortable e a ciò che contiene */ 
Template.sortable.events({})


Template.confirmDelete.onRendered(function () {
	var template = this
	var nameModal = "#"+template.data.idDelete

	$(nameModal).on('hidden.bs.modal', function() {
		Blaze.remove(template.view)
	})
	$(nameModal).modal("show")
})

Template.confirmDelete.events({
	'click button[type="submit"]' : function (event, template) {
		var nameModal = "#"+this.idDelete
		$(nameModal).on('hidden.bs.modal', function() {
			Blaze.remove(template.view)
		})

		this.functionDelete.call()
		$(nameModal).modal("hide")
	},
	'click button[type="button"]': function (event, template) {
		var nameModal = "#"+this.idDelete
	}
})


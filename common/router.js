//
// Iron Router
//


Router.configure({
	loadingTemplate: 'loading'
})


//
// configurazione delle routes
//

Router.route('/', {
	template: "login",
	name: "login",
	where: "client"
})

Router.route('/home', {
	template: "homeQuickstart",
	name: "home",
	where: "client",
	onBeforeAction: function (){
		if(!Meteor.userId()){
			Router.go("/")
		} else {
			this.next()
		}
	}
})

Router.route('/impostaSeduta/:step?', {
	template: "sessionSetup",
	name: "sessionSetup",
	where: "client",
	onBeforeAction: function (){
		if(!Meteor.userId()){
			Router.go("/")
		} else {
			if (!this.params.step) {
		      	this.redirect('sessionSetup', {
		       		step: 'ip'
		     	});
		    } else {
		    	this.next();
		    }
		}
	}
})

Router.route('/seduta/:session', {
	template: "session",
	name: "session",
	where: "client",
	onBeforeAction: function (){
		if(!Meteor.userId()){
			Router.go("/")
		} else {
			if (!this.params.session || this.data() === undefined) {
		    	Router.go("/home")
		    } else {
		     	this.next();
		    }
		}
	},
	waitOn: function() {
		return Meteor.subscribe('sessionData', this.params.session)
	},
	data: function(){
		return sessions.findOne({_id: this.params.session})		
	}
})

Router.route('/video', {
	template: "videoPage",
	name: "videoPage",
	where: "client",
	onBeforeAction: function (){
		if(!Meteor.userId()){
			Router.go("/")
		} else {
			this.next()
		}
	}
})

Router.route('/pazienti', {
	template: "patients",
	name: "patients",
	where: "client",
	onBeforeAction: function (){
		if(!Meteor.userId()){
			Router.go("/")
		} else {
			this.next()
		}
	}
})

Router.route('/pazienti/:id', {
	template: "patientDetails",
	name: "patientDetails",
	where: "client",
	onBeforeAction: function (){
		if(!Meteor.userId()){
			Router.go("/")
		} else {
			this.next()
		}
	},
	waitOn : function () {
        return Meteor.subscribe('patientData', this.params.id);
    },
	data: function() {
        return patients.findOne({ _id: this.params.id })
	}
})

Router.route('/pazienti/:id/:sessionId', {
	template: "patientSessions",
	name: "patientSessions",
	where: "client",
	onBeforeAction: function (){
		if(!Meteor.userId()){
			Router.go("/")
		} else {
			this.next()
		}
	},
	waitOn : function () {
        return Meteor.subscribe('sessionData', this.params.sessionId);
    },
	data: function() {
        return sessions.findOne({ _id: this.params.sessionId })
	}
})

Router.route('/impostazioni', {
	template: "settings",
	name: "settings",
	where: "client",
	subscriptions: function() {
		return Meteor.subscribe("adminId")
	},
	data: function () {
		return Meteor.users.findOne({username: "admin"})
	},
	onBeforeAction: function (){
		if(!Meteor.userId()){
			Router.go("/")
		} else {
			if(this.ready()) {
				if(this.data()._id != Meteor.userId()){
					Router.go("/home")
				} else {
					this.next()
				}
			}
		}
	}
})

Router.route('/impostazioni/gestioneUtenti', {
	template: "userManagement",
	name: "userManagement",
	where: "client",
	subscriptions: function() {
		return Meteor.subscribe("adminId")
	},
	data: function () {
		return Meteor.users.findOne({username: "admin"})
	},
	onBeforeAction: function (){
		if(!Meteor.userId()){
			Router.go("/")
		} else {
			if(this.ready()) {
				if(this.data()._id != Meteor.userId()){
					Router.go("/home")
				} else {
					this.next()
				}
			}
		}
	}
})

Router.route('/impostazioni/gestioneEventi', {
	template: "eventManagement",
	name: "eventManagement",
	where: "client",
	subscriptions: function() {
		return Meteor.subscribe("adminId")
	},
	data: function () {
		return Meteor.users.findOne({username: "admin"})
	},
	onBeforeAction: function (){
		if(!Meteor.userId()){
			Router.go("/")
		} else {
			if(this.ready()) {
				if(this.data()._id != Meteor.userId()){
					Router.go("/home")
				} else {
					this.next()
				}
			}
		}
	}
})


var SEP = '_'
var SEP_DATE = '-'

var dateToStr = function(d) {
	return d.getFullYear() + SEP_DATE + (d.getMonth() + 1) + SEP_DATE + d.getDate()
}

var dateToTime = function(d) {
	return d.toTimeString().split(' ')[0].replace(/:/g, '')
}


Router.route('downloadEvent', function() {
	var ev = events.findOne({_id: this.params.id})
	var patient = patients.findOne({_id: ev.patientId})
	var text = JSON.stringify(ev.mindwaveData)
	var filename = patient.name  + SEP + patient.surname + SEP + dateToStr(ev.createdAt) + 'T' + dateToTime(ev.createdAt) + SEP + ev.eventName + '.json'

	var headers = {
		'Content-Type': 'application/json',
		'Content-Disposition': "attachment; filename=" + filename
	}

	this.response.writeHead(200, headers)
	return this.response.end(text)

}, {where: 'server', path: '/downloadEvent/:id'})

Router.route('downloadSession', function() {
	var session = sessions.findOne({_id: this.params.id})

	var patient = patients.findOne({_id: session.patientId})

	var text = JSON.stringify(session.sessionData)
	var filename = patient.name  + SEP + patient.surname + SEP + dateToStr(session.startedAt) + 'T' + dateToTime(session.startedAt) + '.json'

	var headers = {
		'Content-Type': 'application/json',
		'Content-Disposition': "attachment; filename=" + filename
	}

	this.response.writeHead(200, headers)
	return this.response.end(text)
}, {where: 'server', path: '/downloadSession/:id'})


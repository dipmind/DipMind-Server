
// Se non è presente un utente 'admin', viene aggiunto al database degli utenti allo startup del server
Meteor.startup(function () {
	if(Meteor.users.findOne({username: "admin"}) === undefined) {
		console.log("> Creo l'utente default 'admin' (password: 'admin')")
		Accounts.createUser({username: 'admin', password: 'admin'})
	}
})


Meteor.publish("adminId", function(){
	return Meteor.users.find({username: "admin"})
})

Meteor.publish("patientData", function(id) {
	return patients.find({_id: id})
})

Meteor.publish("sessionData", function(id) {
	return sessions.find({_id: id})
})

Meteor.publish("activeEventsData", function() {
	return activeEvents.find()
})
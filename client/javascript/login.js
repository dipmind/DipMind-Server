/* Parametri e aggiunte per accounts-UI (logout interno ad app) */
accountsUIBootstrap3.setLanguage('it');

accountsUIBootstrap3.logoutCallback = function(error) {
	if(error)
		console.log("> Errore durante il logout: " + error)
	Session.set('referer', 'login')

	Router.go('/')
}


/* ----- login ------*/

Template.login.onRendered(function () {
	$("form input:first").focus()
})

Template.login.events({
	'submit form': function(event) {
			if($("button").hasClass("disabled")){
				event.preventDefault();
			} else {
				event.preventDefault();
				var usernameVar = event.target.username.value;
				var passwordVar = event.target.password.value;
				Meteor.loginWithPassword(usernameVar, passwordVar, function(error) {
					if(error) {
							$("#login").addClass("animated shake").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
									$(".has-error").removeClass("hidden")
									$("input").val("")
									$("button").addClass("disabled")
									$("#login").removeClass("animated shake")
									$("form input:first").focus()
							})
					} else {
							$("#login").addClass("animated bounceOutUp").one('webkitAnimationEnd mozAnimationEnd MSAnimationEnd oanimationend animationend', function() {
									Router.go("/home")
							})
					}
				})
			}
	},
	'keyup input': function (event){
		inputArr = $("input")

		for (var i=0; i<inputArr.length; i++) {

			if (inputArr[i].value.length == 0){
				if(!$("button").hasClass("disabled")){
					$("button").addClass("disabled")
				}

				return
			}
		} 

		$("button").removeClass("disabled")
	},
	'click #add': function (){
		Accounts.createUser({
			username: "user",
			password: "password"
		})
	}
})


//
// Definizione delle collection MongoDB utilizzate dall'applicazione
//

// pazienti
patients = new Mongo.Collection("patients")

// sedute
sessions = new Mongo.Collection("sessions")

// eventi
events = new Mongo.Collection("events")
availableEvents = new Mongo.Collection("availableEvents")
activeEvents = new Mongo.Collection("activeEvents")

// video/playlist
video = new Mongo.Collection("video")
videoUpload = new FS.Collection("videoupload", {
	stores: [new FS.Store.FileSystem("videoupload")]
})
playlist = new Mongo.Collection("playlist")
currentPlaylist = new Mongo.Collection("currentPlaylist")

// tiene traccia dello stato della connessione corrente tra server e iPad/Mindwave
currentConnection = new Mongo.Collection("currentConnection")

// comandi del player video usato durante la seduta
playerCommand = new Mongo.Collection("playerCommand")

videoUpload = new FS.Collection("videoupload", {
  stores: [new FS.Store.FileSystem("videoupload")]
});

videoList = new Meteor.Collection('videoList');

listEvent = new Meteor.Collection('listEvent');

mindwaveSession = new Meteor.Collection('mindwaveSession');
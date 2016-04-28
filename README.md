# DipMind Server

**DipMind Server** has four main purposes:
* it collects MindWave data coming from the [DipMind iOS App](https://github.com/dipmind/DipMind-App) and stores it in a MongoDB database
* it streams user-selected videoclips to a mobile device running the [App](https://github.com/dipmind/DipMind-App)
* it serves the user interface (a web application) used to control video playback on the device and to identify significant **events** related to the behaviour of who is wearing the bluetooth EEG headset
* it receives, converts ([FFmpeg](https://ffmpeg.org)) and stores the video segments related to events captured by the device camera 


## Server structure

The server is based on the [Meteor framework](https://www.meteor.com), leveraging the capabilities of the underlying Node.js implementation when needed (JavaScript files in 'server' folder).


## Video streaming

Videoclips stored on the server are streamed to the iOS mobile device using the [HLS (*Http Live Streaming*)](https://developer.apple.com/streaming) protocol.

The iOS device camera capture is sent on the network by the means of the [RTSP (*Real Time Streaming Protocol*)](https://en.wikipedia.org/wiki/Real_Time_Streaming_Protocol).


## Web application

The web application allows to control the connection between server and mobile device and to manage patients and playlists, in addition to showing the clip being played on the mobile device. 

When an **event** occurs, the user points it out by pressing the relevant button on the interface.
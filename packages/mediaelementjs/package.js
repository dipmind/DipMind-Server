Package.describe({
  name: 'my:mediaelementjs',
  version: '0.0.1',
  // Brief, one-line summary of the package.
  summary: '',
  // URL to the Git repository containing the source code for this package.
  git: '',
  // By default, Meteor will default to using README.md for documentation.
  // To avoid submitting documentation, set this field to null.
  documentation: 'README.md'
});

Package.onUse(function(api) {
  api.versionsFrom('1.1.0.2');
  api.use('jquery');
  api.addFiles('lib/mediaelement-and-player.js', 'client');
  api.addFiles('lib/mediaelementplayer.css', 'client');
  api.addFiles('lib/mejs-skins.css', 'client');
  api.addAssets('lib/skipback.png', 'client');
  api.addAssets('lib/silverlightmediaelement.xap', 'client');
  api.addAssets('lib/loading.gif', 'client');
  api.addAssets('lib/flashmediaelement.swf', 'client');
  api.addAssets('lib/flashmediaelement-cdn.swf', 'client');
  api.addAssets('lib/controls.svg', 'client');
  api.addAssets('lib/controls.png', 'client');
  api.addAssets('lib/controls.fw.png', 'client');
  api.addAssets('lib/controls-wmp.png', 'client');
  api.addAssets('lib/controls-wmp-bg.png', 'client');
  api.addAssets('lib/controls-ted.png', 'client');
  api.addAssets('lib/bigplay.svg', 'client');
  api.addAssets('lib/bigplay.png', 'client');
  api.addAssets('lib/bigplay.fw.png', 'client');
  api.addAssets('lib/background.png', 'client');
});

/*Package.onTest(function(api) {
  api.use('tinytest');
  api.use('my:mediaelementjs');
  api.addFiles('mediaelementjs-tests.js');
});*/

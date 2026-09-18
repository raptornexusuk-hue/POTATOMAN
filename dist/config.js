// Potatoman host configuration. Loaded before the game, and safe to edit after uploading.
//
// Plain web hosting (IONOS webspace, any static file host) runs the whole game: every world, every
// mode, solo against bots and local split-screen. What it cannot run is the small Node service that
// online rooms and the shared leaderboard need.
//
// To switch those on, run that service somewhere that does run Node (see UPLOAD-GUIDE.md, Option B),
// add this site's address to POTATOMAN_ALLOWED_ORIGINS there, then uncomment the line below and put
// its address in. Leave it commented out to keep scores on each device.
//
// window.POTATOMAN_API='https://rooms.example.com';

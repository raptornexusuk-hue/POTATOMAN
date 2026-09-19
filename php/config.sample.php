<?php
// Potatoman on IONOS Web Hosting. Copy this file to config.php and fill in the four values from
// your IONOS control panel; config.php is the only file you have to edit, and it is the only one
// that holds a password, so it never belongs in a public repository.
//
// IONOS: Hosting > Databases > create a MySQL database. The panel shows the host name, the database
// name and the user. Paste them here.
return [
 // The database. IONOS host names look like db1234567890.hosting-data.io -- not "localhost".
 'db_host' => 'db0000000000.hosting-data.io',
 'db_name' => 'dbs0000000',
 'db_user' => 'dbu0000000',
 'db_pass' => '',

 // The address confirmation emails come from. It has to be a mailbox on your own domain, or the
 // mail will be refused or filed as spam.
 'mail_from' => 'potatoman@example.com',
 'mail_name' => 'Potatoman',

 // Leave empty when the game and this folder are on the same domain, which is the normal case.
 // Only fill this in if the game is served from somewhere else and has to reach across to here:
 // list those addresses, e.g. ['https://potatoman.example.com'].
 'allowed_origins' => [],

 // The address the confirmation link points at -- your game's home page. Leave empty to use
 // whatever address this script was reached on, which is right unless the two differ.
 'site_origin' => '',
];

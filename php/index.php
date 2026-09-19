<?php
// Potatoman's API, for hosting that runs PHP and MySQL rather than Node -- which is what an IONOS
// web hosting package is. Every request the game makes to /api/... arrives here.
//
// Upload the contents of this folder to an "api" folder in your web space, copy config.sample.php
// to config.php and fill it in. Nothing else to install: the tables are created on first use.
declare(strict_types=1);
header('content-type: application/json');
header('cache-control: no-store');

require __DIR__ . '/db.php';
require __DIR__ . '/profiles.php';
require __DIR__ . '/rooms.php';

// Errors are for the operator's log, never for the visitor: an error page carrying a database host
// name or a stack trace is a gift to whoever finds it.
ini_set('display_errors', '0');

final class PotatomanError extends RuntimeException {}
function potatoman_fail(string $message, int $status = 400) { throw new PotatomanError($message, $status); }
function potatoman_now(): int { return (int)round(microtime(true) * 1000); }
function potatoman_uuid(): string {
 $b = random_bytes(16);
 $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
 $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
 return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}
function potatoman_send($value, int $status = 200): void {
 http_response_code($status);
 echo json_encode($value);
 exit;
}

$config = is_file(__DIR__ . '/config.php') ? require __DIR__ . '/config.php' : null;
if (!is_array($config)) potatoman_send(['error' => 'This server has no config.php yet. Copy config.sample.php to config.php and fill in your database details.'], 503);

// The game and this folder normally sit on the same domain, so nothing cross-origin is allowed by
// default. A game served from somewhere else has to be listed in config.php before it may ask.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https' ? 'https' : 'http';
$self = $scheme . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost');
$foreign = $origin !== '' && $origin !== $self;
$permitted = !$foreign || in_array($origin, $config['allowed_origins'] ?? [], true);
header('vary: origin');
if ($foreign && $permitted) {
 header('access-control-allow-origin: ' . $origin);
 header('access-control-allow-headers: content-type');
 header('access-control-allow-methods: POST,OPTIONS');
 header('access-control-max-age: 86400');
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code($permitted ? 204 : 403); exit; }
if (!$permitted) potatoman_send(['error' => 'Origin not allowed.'], 403);
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') potatoman_send(['error' => 'Use POST.'], 405);

$raw = file_get_contents('php://input');
if (strlen($raw) > 110000) potatoman_send(['error' => 'Request too large.'], 413);
$body = json_decode($raw, true);
if (!is_array($body)) potatoman_send(['error' => 'Invalid request.'], 400);

// The path the game asked for, however this folder ended up being addressed: /api/scores/save both
// when Apache rewrites to index.php and when the request lands on index.php/scores/save directly.
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$path = preg_replace('#/index\.php#', '', $path);
if (($cut = strpos($path, '/api/')) !== false) $path = substr($path, $cut);
else $path = '/api' . ($path === '' ? '/' : $path);
$path = rtrim($path, '/');

try {
 $db = potatoman_db($config);
 $siteOrigin = rtrim((string)($config['site_origin'] ?? ''), '/') ?: $self;
 $result = potatoman_profile_api($path, $body, $db, $config, $siteOrigin);
 if ($result === null) $result = potatoman_rooms_api($path, $body, $db);
 $status = 200;
 if (is_array($result) && isset($result['__status'])) { $status = (int)$result['__status']; unset($result['__status']); }
 potatoman_send($result, $status);
} catch (PotatomanError $e) {
 potatoman_send(['error' => $e->getMessage()], $e->getCode() ?: 400);
} catch (Throwable $e) {
 error_log('Potatoman API error: ' . $e->getMessage());
 potatoman_send(['error' => 'The scoreboard is temporarily unavailable. Try again.'], 503);
}

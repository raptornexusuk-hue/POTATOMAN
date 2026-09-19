<?php
// Players, runs and the leaderboard. This is a port of server/profiles.js, kept deliberately close
// to it line for line: the bounds checks here are the only thing between the board and somebody
// posting themselves a perfect circuit, so they are worth being able to compare side by side.

// Level index -> maze grid size, for the ranked escape boards. Neither service can import the
// game's level table, so both carry a copy and tests/php-api.test.mjs checks this one against it.
const MAZE_LEVELS = [1 => 15, 4 => 19, 7 => 21, 12 => 23, 15 => 25, 20 => 27];
// Everything bounded about a circuit follows from how many levels there are: the highest level a
// run may start on, how many rounds it may report, and the most points it can come away with --
// three for winning each main round, one for each hunt between them.
const LEVEL_COUNT = 22;
const MAX_TOTAL = LEVEL_COUNT * 3 + (LEVEL_COUNT - 1);
const RESEND_GAP = 120000;
// A board anybody can type a name into is a board nobody believes. Ranking is for players who have
// proved they can read an address they gave us, which costs an honest player one click and costs
// somebody minting a hundred aliases a hundred real mailboxes.
const EMAIL_PATTERN = '/^[^\s@,;:<>"\'\\\\]{1,64}@[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i';

function potatoman_is_maze($level): bool { return is_int($level) && array_key_exists($level, MAZE_LEVELS); }
function potatoman_number($value, $min, $max): bool { return is_int($value) && $value >= $min && $value <= $max; }

function potatoman_clean_email($value): string {
 $text = is_string($value) ? trim($value) : '';
 if ($text === '') return '';
 if (strlen($text) > 254 || !preg_match(EMAIL_PATTERN, $text)) potatoman_fail('Enter an email address we can actually write to.');
 return $text;
}

// What the game is allowed to see about a player. The token never appears here; it is handed back
// separately and only to the browser that just proved it owns the profile.
function potatoman_public_player(array $profile): array {
 return ['id' => $profile['id'], 'name' => $profile['name'], 'motto' => $profile['motto'],
  'email' => $profile['email'] ?? '', 'verified' => (bool)$profile['verified']];
}

// Delivery goes through the host's own mail, which is the one thing shared hosting is certain to
// have. If it refuses the message the player is told, rather than being left waiting for a link
// that was never sent.
function potatoman_send_verification(array $config, string $to, string $name, string $link): bool {
 $subject = 'Confirm your Potatoman scoreboard name';
 $body = "Hello $name,\n\nConfirm this address to have your scores ranked on the Potatoman leaderboard:\n$link\n\n"
  . "If you did not ask for this, ignore it and nothing happens. The link stops working once it is used.\n";
 $from = $config['mail_from'] ?? '';
 if ($from === '') potatoman_fail('This server has no address to send confirmations from.', 501);
 $headers = 'From: ' . sprintf('%s <%s>', $config['mail_name'] ?? 'Potatoman', $from) . "\r\n"
  . 'Reply-To: ' . $from . "\r\n" . "Content-Type: text/plain; charset=utf-8\r\n" . 'X-Mailer: Potatoman';
 $sent = @mail($to, $subject, $body, $headers, '-f' . $from);
 if (!$sent) potatoman_fail('Could not send the confirmation email. Try again shortly.', 502);
 return true;
}

function potatoman_profile_api(string $path, array $body, PDO $db, array $config, string $origin) {
 if (strpos($path, '/api/player/') !== 0 && strpos($path, '/api/scores/') !== 0) return null;
 $row = function (string $sql, array $args = []) use ($db) { $s = $db->prepare($sql); $s->execute($args); $r = $s->fetch(); return $r === false ? null : $r; };
 $rows = function (string $sql, array $args = []) use ($db) { $s = $db->prepare($sql); $s->execute($args); return $s->fetchAll(); };
 $run = function (string $sql, array $args = []) use ($db) { $s = $db->prepare($sql); $s->execute($args); return $s; };

 if ($path === '/api/scores/leaderboard') {
  $level = array_key_exists('level', $body) ? $body['level'] : null;
  $filter = in_array($body['mode'] ?? null, ['solo', 'local', 'online'], true) ? $body['mode'] : null;
  if ($level !== null && !potatoman_is_maze($level)) potatoman_fail('Choose a maze leaderboard.');
  if ($level === null) {
   $results = $rows("SELECT p.id,p.name,p.motto,MAX(CASE WHEN r.revision>0 THEN r.points ELSE r.score*100 END) AS score,COUNT(r.id) AS circuits
     FROM runs r JOIN profiles p ON p.id=r.profile
     WHERE p.verified=1 AND (r.rounds>0 OR r.played_ms>0) AND (? IS NULL OR r.mode=?)
     GROUP BY p.id,p.name,p.motto ORDER BY score DESC,p.name ASC LIMIT 50", [$filter, $filter]);
  } else {
   $results = $rows("SELECT p.id,p.name,p.motto,MIN(t.milliseconds) AS milliseconds
     FROM race_times t JOIN runs r ON r.id=t.run JOIN profiles p ON p.id=r.profile
     WHERE p.verified=1 AND t.level=? AND (r.finished IS NOT NULL OR r.revision>0) AND (? IS NULL OR r.mode=?)
     GROUP BY p.id,p.name,p.motto ORDER BY milliseconds ASC,p.name ASC LIMIT 50", [$level, $filter, $filter]);
  }
  foreach ($results as &$r) { if (isset($r['score'])) $r['score'] = (int)$r['score']; if (isset($r['circuits'])) $r['circuits'] = (int)$r['circuits']; if (isset($r['milliseconds'])) $r['milliseconds'] = (int)$r['milliseconds']; }
  return ['rows' => $results];
 }

 $profile = isset($body['playerToken']) ? $row('SELECT * FROM profiles WHERE token=?', [(string)$body['playerToken']]) : null;

 if ($path === '/api/player/verify') {
  $token = is_string($body['verifyToken'] ?? null) ? $body['verifyToken'] : '';
  $claimed = $token !== '' ? $row('SELECT * FROM profiles WHERE verify_token=?', [$token]) : null;
  if (!$claimed) potatoman_fail('That confirmation link has already been used, or it has expired.', 410);
  $run('UPDATE profiles SET verified=1,verify_token=NULL WHERE id=?', [$claimed['id']]);
  $claimed['verified'] = 1;
  return ['player' => potatoman_public_player($claimed), 'playerToken' => $claimed['token']];
 }

 if ($path === '/api/player/save') {
  $name = is_string($body['name'] ?? null) ? mb_substr(trim(preg_replace('/[^\p{L}\p{M}0-9 \'’_-]/u', '', $body['name'])), 0, 24) : '';
  $motto = is_string($body['motto'] ?? null) ? mb_substr(trim($body['motto']), 0, 60) : '';
  if (mb_strlen($name) < 2) potatoman_fail('Enter your name with at least two characters.');
  if (!empty($body['playerToken']) && !$profile) potatoman_fail('This player profile is unavailable.', 403);
  $email = potatoman_clean_email($body['email'] ?? null);
  $key = strtolower($email);
  if ($email !== '') {
   $taken = $row('SELECT id FROM profiles WHERE email_key=?', [$key]);
   if ($taken && $taken['id'] !== ($profile['id'] ?? null)) potatoman_fail('That address already has a player on this scoreboard.', 409);
  }
  $at = potatoman_now();
  if ($profile) $run('UPDATE profiles SET name=?,motto=? WHERE id=?', [$name, $motto, $profile['id']]);
  else {
   $profile = ['id' => potatoman_uuid(), 'token' => potatoman_uuid() . potatoman_uuid(), 'verified' => 0, 'email_key' => null];
   $run('INSERT INTO profiles(id,token,name,motto,created) VALUES(?,?,?,?,?)', [$profile['id'], $profile['token'], $name, $motto, $at]);
  }
  // Changing the address un-verifies the player: the point of the confirmation is that this
  // particular address was read, and a new one has not been.
  $sent = false;
  if ($email !== '' && $key !== (string)($profile['email_key'] ?? '')) {
   $verifyToken = potatoman_uuid() . potatoman_uuid();
   $sent = potatoman_send_verification($config, $email, $name, $origin . '/?confirm=' . rawurlencode($verifyToken));
   $run('UPDATE profiles SET email=?,email_key=?,verified=0,verify_token=?,verify_sent=? WHERE id=?', [$email, $key, $verifyToken, $at, $profile['id']]);
  }
  $saved = $row('SELECT * FROM profiles WHERE id=?', [$profile['id']]);
  return ['player' => potatoman_public_player($saved), 'playerToken' => $saved['token'], 'sent' => $sent];
 }

 if ($path === '/api/player/resend') {
  if (!$profile) potatoman_fail('Set up your player profile first.', 401);
  if (empty($profile['email'])) potatoman_fail('Add an email address first.');
  if ($profile['verified']) potatoman_fail('That address is already confirmed.');
  if (potatoman_now() - (int)$profile['verify_sent'] < RESEND_GAP) potatoman_fail('A confirmation was sent a moment ago. Check the address, including its spam folder.', 429);
  $verifyToken = $profile['verify_token'] ?: potatoman_uuid() . potatoman_uuid();
  $sent = potatoman_send_verification($config, $profile['email'], $profile['name'], $origin . '/?confirm=' . rawurlencode($verifyToken));
  $run('UPDATE profiles SET verify_token=?,verify_sent=? WHERE id=?', [$verifyToken, potatoman_now(), $profile['id']]);
  return ['sent' => $sent];
 }

 if ($path === '/api/player/forget') {
  // A player who gave us an address can take it and everything attached to it away again. Runs and
  // race times hang off the profile with ON DELETE CASCADE, so one row is the whole of it.
  if (!$profile) potatoman_fail('Set up your player profile first.', 401);
  $run('DELETE FROM profiles WHERE id=?', [$profile['id']]);
  return ['forgotten' => true];
 }

 if (!$profile) potatoman_fail('Set up your player profile to save scores.', 401);

 if ($path === '/api/player/get') {
  $stats = $row("SELECT COALESCE(SUM(rounds),0) AS rounds,COALESCE(SUM(wins),0) AS wins,COALESCE(SUM(knockouts),0) AS knockouts,
    MAX(CASE WHEN complete=1 THEN score END) AS bestCircuit,MAX(CASE WHEN revision>0 THEN points ELSE score*100 END) AS bestScore
    FROM runs WHERE profile=? AND (rounds>0 OR played_ms>0)", [$profile['id']]);
  foreach (['rounds', 'wins', 'knockouts', 'bestCircuit', 'bestScore'] as $k) $stats[$k] = $stats[$k] === null ? null : (int)$stats[$k];
  return ['player' => potatoman_public_player($profile), 'stats' => $stats];
 }

 if ($path === '/api/scores/start') {
  if (!potatoman_number($body['level'] ?? null, 0, LEVEL_COUNT - 1) || !potatoman_number($body['duration'] ?? null, 60, 600)
   || $body['duration'] % 30 !== 0 || !in_array($body['mode'] ?? null, ['solo', 'local', 'online'], true)) potatoman_fail('Invalid circuit settings.');
  $id = $body['run'] ?? potatoman_uuid();
  if (!is_string($id) || !preg_match('/^[a-f0-9-]{36}$/i', $id)) potatoman_fail('Invalid score session.');
  $run('INSERT IGNORE INTO runs(id,profile,started,start_level,round_seconds,mode) VALUES(?,?,?,?,?,?)',
   [$id, $profile['id'], potatoman_now(), $body['level'], $body['duration'], $body['mode']]);
  $existing = $row('SELECT * FROM runs WHERE id=?', [$id]);
  if ($existing['profile'] !== $profile['id'] || (int)$existing['start_level'] !== $body['level']
   || (int)$existing['round_seconds'] !== $body['duration'] || $existing['mode'] !== $body['mode']) potatoman_fail('This score session belongs to different settings.', 409);
  return ['run' => $id];
 }

 if ($path === '/api/scores/save') {
  $existing = $row('SELECT * FROM runs WHERE id=? AND profile=?', [(string)($body['run'] ?? ''), $profile['id']]);
  if (!$existing) potatoman_fail('This score session is unavailable.', 404);
  if (!potatoman_number($body['revision'] ?? null, 1, 1000000) || !potatoman_number($body['points'] ?? null, 0, 1000000)
   || !potatoman_number($body['playedMs'] ?? null, 0, 7200000) || !potatoman_number($body['score'] ?? null, 0, MAX_TOTAL)
   || !potatoman_number($body['rounds'] ?? null, 0, LEVEL_COUNT - (int)$existing['start_level'])
   || !potatoman_number($body['wins'] ?? null, 0, $body['rounds']) || !potatoman_number($body['knockouts'] ?? null, 0, 2000)) potatoman_fail('Invalid score progress.');
  if ($body['revision'] <= (int)$existing['revision']) return ['saved' => true, 'revision' => (int)$existing['revision'], 'complete' => (bool)$existing['complete']];
  if ($body['points'] < (int)$existing['points'] || $body['playedMs'] < (int)$existing['played_ms'] || $body['rounds'] < (int)$existing['rounds']
   || $body['wins'] < (int)$existing['wins'] || $body['knockouts'] < (int)$existing['knockouts']) potatoman_fail('Score progress cannot go backwards.');
  $times = is_array($body['times'] ?? null) ? $body['times'] : [];
  potatoman_check_times($times, $existing, $body['rounds'], false);
  $complete = (int)$existing['start_level'] === 0 && $body['rounds'] === LEVEL_COUNT;
  $db->beginTransaction();
  try {
   foreach ($times as $t) $run('INSERT INTO race_times(run,level,milliseconds) SELECT id,?,? FROM runs WHERE id=? AND revision<?
     ON DUPLICATE KEY UPDATE milliseconds=LEAST(milliseconds,VALUES(milliseconds))', [$t['level'], $t['milliseconds'], $existing['id'], $body['revision']]);
   $run('UPDATE runs SET finished=?,score=?,points=?,played_ms=?,rounds=?,wins=?,knockouts=?,complete=?,revision=? WHERE id=? AND revision<?',
    [!empty($body['final']) ? potatoman_now() : null, $body['score'], $body['points'], $body['playedMs'], $body['rounds'], $body['wins'], $body['knockouts'], $complete ? 1 : 0, $body['revision'], $existing['id'], $body['revision']]);
   $db->commit();
  } catch (Throwable $e) { $db->rollBack(); throw $e; }
  return ['saved' => true, 'revision' => $body['revision'], 'complete' => $complete];
 }

 if ($path === '/api/scores/finish') {
  $existing = $row('SELECT * FROM runs WHERE id=? AND profile=?', [(string)($body['run'] ?? ''), $profile['id']]);
  if (!$existing) potatoman_fail('This score session is unavailable.', 404);
  if ($existing['finished'] !== null) return ['saved' => true, 'complete' => (int)$existing['complete'] === 1];
  if (!potatoman_number($body['score'] ?? null, 0, MAX_TOTAL) || !potatoman_number($body['rounds'] ?? null, 0, LEVEL_COUNT - (int)$existing['start_level'])
   || !potatoman_number($body['wins'] ?? null, 0, $body['rounds']) || !potatoman_number($body['knockouts'] ?? null, 0, 2000)) potatoman_fail('Invalid score summary.');
  $complete = (int)$existing['start_level'] === 0 && $body['rounds'] === LEVEL_COUNT;
  $durations = $body['durations'] ?? null;
  if (!is_array($durations) || count($durations) !== $body['rounds']) potatoman_fail('Invalid completed-round durations.');
  foreach ($durations as $d) if (!potatoman_number($d, 60, 600) || $d % 30 !== 0) potatoman_fail('Invalid completed-round durations.');
  if (count($durations) && $durations[0] !== (int)$existing['round_seconds']) potatoman_fail('Invalid completed-round durations.');
  $elapsed = potatoman_now() - (int)$existing['started'];
  if ($elapsed < max(0, array_sum($durations) * 1000 - 10000)) potatoman_fail('The score arrived before the rounds could finish.');
  $times = is_array($body['times'] ?? null) ? $body['times'] : [];
  potatoman_check_times($times, $existing, $body['rounds'], true);
  $db->beginTransaction();
  try {
   foreach ($times as $t) $run('INSERT IGNORE INTO race_times(run,level,milliseconds) SELECT id,?,? FROM runs WHERE id=? AND finished IS NULL',
    [$t['level'], $t['milliseconds'], $existing['id']]);
   $run('UPDATE runs SET finished=?,score=?,rounds=?,wins=?,knockouts=?,complete=? WHERE id=? AND finished IS NULL',
    [potatoman_now(), $body['score'], $body['rounds'], $body['wins'], $body['knockouts'], $complete ? 1 : 0, $existing['id']]);
   $db->commit();
  } catch (Throwable $e) { $db->rollBack(); throw $e; }
  return ['saved' => true, 'complete' => $complete];
 }

 return ['error' => 'Not found.', '__status' => 404];
}

// A maze time has to belong to a maze the run actually reached, and cannot be quicker than the
// straight-line dash across that grid -- which nobody can beat, because a maze has walls in it.
function potatoman_check_times(array $times, array $existing, int $rounds, bool $final): void {
 $levels = [];
 foreach ($times as $t) $levels[] = is_array($t) ? ($t['level'] ?? null) : null;
 if (count($times) > count(MAZE_LEVELS) || count(array_unique($levels, SORT_REGULAR)) !== count($times)) potatoman_fail('Invalid maze time.');
 $start = (int)$existing['start_level'];
 foreach ($times as $t) {
  $level = is_array($t) ? ($t['level'] ?? null) : null;
  if (!potatoman_is_maze($level)) potatoman_fail('Invalid maze time.');
  $beyond = $final ? $level >= $start + $rounds : $level > $start + $rounds;
  if ($level < $start || $beyond) potatoman_fail('Invalid maze time.');
  $quickest = $final ? (int)floor((MAZE_LEVELS[$level] - 3) * 3.2 * M_SQRT2 / 17 * 1000) : 1000;
  if (!potatoman_number($t['milliseconds'] ?? null, $quickest, 600000)) potatoman_fail('Invalid maze time.');
 }
}

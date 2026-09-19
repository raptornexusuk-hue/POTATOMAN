<?php
// Online rooms: a three-player lobby, the WebRTC offers and answers the players swap to connect
// directly to each other, and a fallback path that relays the host's snapshot and the guests' input
// when a direct connection cannot be made. A port of the room half of server/index.js.

function potatoman_clean_name($value): string {
 $name = is_string($value) ? trim(preg_replace('/[^\p{L}\p{M}0-9 \'’_-]/u', '', $value)) : '';
 $name = mb_substr($name, 0, 24);
 return $name === '' ? 'SPUD' : $name;
}

// Every field the game may send for a player's input, clamped to what the game itself can produce.
// Anything outside these bounds is somebody talking to the API rather than playing.
function potatoman_clean_input($v): ?array {
 if (!is_array($v)) return null;
 $n = function (string $k, float $min, float $max) use ($v) {
  $x = $v[$k] ?? null;
  return is_int($x) || is_float($x) ? max($min, min($max, (float)$x)) : 0.0;
 };
 $zoom = $n('zoom', 3, 9);
 return ['epoch' => is_string($v['epoch'] ?? null) ? substr($v['epoch'], 0, 64) : '',
  'seq' => $n('seq', 0, 1e12), 'x' => $n('x', -1, 1), 'z' => $n('z', -1, 1),
  'yaw' => $n('yaw', -100000, 100000), 'pitch' => $n('pitch', -.85, .70),
  'fire' => ($v['fire'] ?? null) === true, 'crouch' => ($v['crouch'] ?? null) === true,
  'crouchSerial' => $n('crouchSerial', 0, 1e12), 'zoom' => $zoom ?: 5.6,
  'dodge' => $n('dodge', 0, 1e12), 'catch' => $n('catch', 0, 1e12), 'jump' => $n('jump', 0, 1e12)];
}

function potatoman_rooms_api(string $path, array $body, PDO $db) {
 $row = function (string $sql, array $args = []) use ($db) { $s = $db->prepare($sql); $s->execute($args); $r = $s->fetch(); return $r === false ? null : $r; };
 $rows = function (string $sql, array $args = []) use ($db) { $s = $db->prepare($sql); $s->execute($args); return $s->fetchAll(); };
 $run = function (string $sql, array $args = []) use ($db) { $s = $db->prepare($sql); $s->execute($args); return $s; };
 $at = potatoman_now();

 if ($path === '/api/rooms/create') {
  $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  $code = '';
  for ($i = 0; $i < 10; $i++) $code .= $alphabet[random_int(0, 31)];
  $secret = potatoman_uuid() . potatoman_uuid();
  $db->beginTransaction();
  try {
   $run('DELETE FROM rooms WHERE updated < ?', [$at - 7200000]);
   $run('INSERT INTO rooms(code,created,updated) VALUES(?,?,?)', [$code, $at, $at]);
   $run('INSERT INTO members(room,slot,token,name,seen,generation) VALUES(?,0,?,?,?,?)', [$code, $secret, potatoman_clean_name($body['name'] ?? null), $at, potatoman_uuid()]);
   $db->commit();
  } catch (Throwable $e) { $db->rollBack(); throw $e; }
  return ['code' => $code, 'slot' => 0, 'token' => $secret];
 }

 $code = strtoupper((string)($body['code'] ?? ''));
 if (!preg_match('/^[A-Z2-9]{10}$/', $code)) potatoman_fail('Enter the 10-character room code.');
 $room = $row('SELECT * FROM rooms WHERE code=?', [$code]);
 if (!$room || (int)$room['updated'] < $at - 90000) potatoman_fail('This room has closed or expired. Create a new room.', 404);

 if ($path === '/api/rooms/join') {
  if ($room['status'] !== 'lobby') potatoman_fail('This match has started. Join a new room.', 409);
  // Two players may knock at the same instant, so the free slot is chosen with the room row held:
  // the Node service leans on one clever INSERT for this, which MySQL will not take.
  $secret = potatoman_uuid() . potatoman_uuid();
  $slot = null;
  $db->beginTransaction();
  try {
   $locked = $row('SELECT status FROM rooms WHERE code=? FOR UPDATE', [$code]);
   if ($locked && $locked['status'] === 'lobby') {
    $taken = array_column($rows('SELECT slot FROM members WHERE room=?', [$code]), 'slot');
    foreach ([1, 2] as $candidate) if (!in_array((string)$candidate, array_map('strval', $taken), true)) { $slot = $candidate; break; }
    if ($slot !== null) $run('INSERT INTO members(room,slot,token,name,seen,generation) VALUES(?,?,?,?,?,?)', [$code, $slot, $secret, potatoman_clean_name($body['name'] ?? null), $at, potatoman_uuid()]);
   }
   $db->commit();
  } catch (Throwable $e) { $db->rollBack(); throw $e; }
  if ($slot === null) potatoman_fail('This room is full or the match just started.', 409);
  return ['code' => $code, 'slot' => $slot, 'token' => $secret];
 }

 $member = $row('SELECT * FROM members WHERE room=? AND token=?', [$code, (string)($body['token'] ?? '')]);
 if (!$member) potatoman_fail('Your room connection has expired. Rejoin the room.', 403);
 $slot = (int)$member['slot'];

 if ($path === '/api/rooms/leave') {
  if ($slot === 0) $run('DELETE FROM rooms WHERE code=?', [$code]);
  else {
   $run('DELETE FROM signals WHERE room=? AND (sender=? OR recipient=?)', [$code, $slot, $slot]);
   $run('DELETE FROM members WHERE room=? AND slot=?', [$code, $slot]);
  }
  return ['ok' => true];
 }

 if ($path !== '/api/rooms/exchange') return ['error' => 'Not found.', '__status' => 404];

 $db->beginTransaction();
 try {
  if ($slot === 0) {
   if (($body['start'] ?? null) === true && $room['status'] === 'lobby') {
    $count = $row('SELECT COUNT(*) AS n FROM members WHERE room=? AND seen>=?', [$code, $at - 30000]);
    if ((int)$count['n'] !== 3) { $db->rollBack(); potatoman_fail('Three players are required to start. Online matches have no bots.', 409); }
   }
   $starting = ($body['start'] ?? null) === true;
   $run('UPDATE rooms SET updated=?, status=CASE WHEN ?=1 THEN ? ELSE status END WHERE code=?', [$at, $starting ? 1 : 0, 'playing', $code]);
   $run('DELETE FROM members WHERE room=? AND slot<>0 AND seen<?', [$code, $at - 30000]);
   $snapshot = $body['snapshot'] ?? null;
   if (is_array($snapshot) && is_int($snapshot['seq'] ?? null) && $snapshot['seq'] > (int)$room['seq']) {
    $encoded = json_encode($snapshot);
    if (strlen($encoded) > 90000) { $db->rollBack(); potatoman_fail('Match update too large.'); }
    $run('UPDATE rooms SET snapshot=?,seq=? WHERE code=? AND seq<?', [$encoded, $snapshot['seq'], $code, $snapshot['seq']]);
   }
  }
  $input = potatoman_clean_input($body['input'] ?? null);
  if ($input && $input['seq'] > (float)$member['input_seq'])
   $run('UPDATE members SET seen=?,input=?,input_seq=? WHERE room=? AND slot=? AND input_seq<?', [$at, json_encode($input), $input['seq'], $code, $slot, $input['seq']]);
  else $run('UPDATE members SET seen=? WHERE room=? AND slot=?', [$at, $code, $slot]);

  if (is_array($body['signals'] ?? null)) foreach (array_slice($body['signals'], 0, 3) as $signal) {
   $to = is_array($signal) ? ($signal['to'] ?? null) : null;
   if (!is_int($to) || $to < 0 || $to > 2 || ($slot !== 0 && $to !== 0) || $to === $slot) { $db->rollBack(); potatoman_fail('Invalid signal recipient.'); }
   $description = $signal['description'] ?? null;
   if (!is_array($description) || !in_array($description['type'] ?? null, ['offer', 'answer'], true)
    || !is_string($description['sdp'] ?? null) || strlen($description['sdp']) > 20000) { $db->rollBack(); potatoman_fail('Invalid connection signal.'); }
   $run('INSERT INTO signals(room,sender,recipient,description) VALUES(?,?,?,?) ON DUPLICATE KEY UPDATE description=VALUES(description)', [$code, $slot, $to, json_encode($description)]);
  }
  $db->commit();
 } catch (Throwable $e) { if ($db->inTransaction()) $db->rollBack(); throw $e; }

 $current = $row('SELECT status,snapshot,updated FROM rooms WHERE code=?', [$code]);
 if (!$current) potatoman_fail('The host closed this room.', 410);
 $roster = $rows('SELECT slot,name,seen,input,input_seq,generation FROM members WHERE room=? ORDER BY slot', [$code]);
 $signals = $rows('SELECT sender,description FROM signals WHERE room=? AND recipient=?', [$code, $slot]);
 return [
  'status' => $current['status'],
  'hostSeen' => (int)$current['updated'],
  'roster' => array_map(function ($m) use ($slot) {
   $entry = ['slot' => (int)$m['slot'], 'name' => $m['name'], 'seen' => (int)$m['seen'], 'generation' => $m['generation']];
   if ($slot === 0) $entry['input'] = $m['input'] ? json_decode($m['input'], true) : null;
   return $entry;
  }, $roster),
  'signals' => array_map(fn($s) => ['from' => (int)$s['sender'], 'description' => json_decode($s['description'], true)], $signals),
  'snapshot' => $slot !== 0 && $current['snapshot'] ? json_decode($current['snapshot'], true) : null,
 ];
}

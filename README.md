## Update 0.17.0

Arms now use the body's textured potato skin, so limbs, torso and legs match instead of the
arms reading as pale plastic. Shoulders, elbow poles and the resting pose are placed on the
aim-aligned left/right axis, so both arms hang at the sides of the quarter-turned torso rather
than off its front. Scatter and RPG are held one-handed: a potato torso is wider than the arms
are long, so the old support grip stretched a straight upper arm through the chest. The sleeve
tapers from a fuller deltoid to a slimmer wrist. Eyes blink with real skin eyelids instead of
squashing the eyeball, sit under soft brow ridges, and track the direction of travel.

Klompens are about 10% smaller and carry far more carving: a painted tulip spray with stem and
leaves, heel chevrons, beaded side borders, a scalloped collar and toe volutes.

Two new worlds join the circuit. Chalk Quarry has stepped terraces, a gantry over the cut face,
spoil heaps and cut stone blocks for hard cover. Cider Orchard has fruit rows, pressing sheds,
barrel stacks and mown lanes. Four new levels bring the circuit to fourteen: Quarry Quarrel,
Cider Run, Stone Cold Smash and Orchard Ambush. The circuit order, snapshot bounds, maze
leaderboards and HUD counts are all derived from the level list rather than fixed at ten.

Bots no longer file down one identical groove: the route finder takes a per-bot expansion order,
so rivals take genuinely different equally-short lanes, and each bot holds its own lateral lane
alongside the shared path. Respawning resets the look angle, so dying while aiming down no
longer drops you back in staring at the ground.

Refresh all clients before testing; the snapshot protocol remains 10.

## Update 0.16.0

Shoulder sockets now overlap the actual potato skin, and the upper/lower arm links are about 5% shorter. The existing shoulder–elbow–wrist rig retains its fixed bone lengths and stable bend plane. Both arms respond to travel, including the carried potato, with opposite arm/leg phasing and a restrained torso roll and twist. The throwing hand blends out of its walking motion before wind-up and back after recovery.

Throw effort briefly narrows the eyes, moves the brows and cheeks, and opens the mouth around release. Smooth face geometry replaces the tiny low-detail sphere fallback. The spud gun has a contoured steel receiver, walnut grip, brass pressure chamber bands, feed pipe, trigger guard and pressure gauge; fixed details are combined by material to limit draw calls. Its muzzle and hand sockets remain aligned with gameplay.

The POTATOMAN / TOTALLY MASH title is larger above the left-side menu, and the loading screen uses a large matching wordmark. Camera controls, gun cadence, death-to-throwing progression and protocol 10 are preserved. Refresh all clients before testing. See TESTING.md for measured rig checks and the test browser's WebGL limitation.

Animation principles were checked against the [Blender Rigify manual](https://docs.blender.org/manual/en/2.81/addons/rigging/rigify.html) and the primary study [Dynamic arm swinging in human walking](https://pmc.ncbi.nlm.nih.gov/articles/PMC2817299/). This remains a custom potato rig; no stock model or motion-capture clips were imported.

## Update 0.15.4

Bots choose reachable firing positions 4–10 metres from targets, change flank after a short hold, and step sideways around crowded waypoints. A stationary-position check prevents target changes from indefinitely extending a hold. Capture bots spread around the objective. Throwing and base-gun bots both contest the shared weapon box. Reaction times, aim error, fire cadence and trial navigation retain their existing difficulty settings.

Background streets now span each map, with inward-facing side buildings, estate lodges, farm barns and full-length field rows. Harbour roof spacing accounts for the actual roof footprint. Trees follow map-sized avenues and stand on the canal bank; the estate sign is attached to its facade. The new scenery remains outside the playable boundary and uses the existing static instancing and foliage distance limits.

Independent agents reviewed full-round CPU gameplay and actual scene geometry. The test browser can exercise the menus but has WebGL disabled, so this update has no GPU gameplay or hardware FPS certification. See TESTING.md for results. Refresh all clients before testing; snapshot protocol stays at 10.

## Update 0.15.3

The throwing palm now faces forward, with fingers cupping the rear of the potato. A deeper hand socket places the potato against the palm, and a small wrist cock replaces the previous backward wrist rotation. The side-of-head potato path, exact release, fixed arm lengths, shoulder camera, skin colours, gun grips and death-to-throwing rule remain unchanged.

## Update 0.15.2

The throw uses a side-of-head hand path and guided elbow bend, moving forward into release and recovering around the body with constant arm lengths. This replaces the old corrective elbow tuck that pulled the upper arm inward. The hand follows torso lean while retaining its exact potato socket and projectile release.

Players alternate golden russet and lighter baked-potato skins. Arms and rounded hands now use warm skin colours with subtle surface relief. Yellow carved clogs and the shoulder camera are preserved.

Every death now resets the player to throwing with zero weapon progress, including death with the earned spud gun and falling into water. Three new landed hits earn the gun again. Special guns still drop their remaining ammunition; hits from an already-dead thrower cannot restore weapon progression. Ammo exhaustion while alive still falls back to the base spud gun.

Refresh all clients before testing. The authoritative snapshot format remains protocol 10. See TESTING.md for verification and limitations.

## Update 0.15.1

Corrected glove handedness and the resting elbow direction. Free arms use a rearward elbow bend, including both arms when running unarmed; active throwing and gun paths retain their tuned grip and release positions. The forward/back arm swing now opposes the same-side foot rather than lagging it by a quarter cycle. Free hands sit slightly farther out and back, exposing the left forearm and glove from the rear shoulder camera.

Potato skin uses a deeper golden-brown tint, a rougher surface and less reflected environment light. The existing detailed potato texture remains on the body, face, legs and held potato; the reference-style gloves and arms remain ivory white.

This is a character presentation fix. The left-side menu, maps, controls, fixed shoulder camera, projectiles and protocol 10 remain intact. See TESTING.md for verification and device limitations.

## Update 0.15.0

The play menu is a compact left-hand column, exposing the crowned key artwork. All four world choices remain below it; desktop layouts shorten the header when screen height is limited.

Running now follows actual movement, including backwards, strafing, diagonals and the quarter-turned torso. Raised feet swing in the direction of travel; planted feet return against it. Cadence, restrained lift and the smaller yellow carved clogs are preserved.

The toy-arm reference replaces skin-coloured muscles and nails with slim ivory-white molded arms, continuous rounded elbows, wrist cuffs and three rounded glove fingers with a thumb. The potato is held beside the head before throwing, followed by overhead wind-up, release and follow-through. The release socket, projectile timing, fixed shoulder camera and weapon grips are retained. Animated limb buffers are allocated once and updated in place. A tighter glove grip and shorter gun handle clear the transient crouch/dash clipping found during independent review, and unarmed course runners keep a free arm swing.

This is a visual/gait update on network protocol 10. Refresh each client before testing. Automated checks and browser/real-device limitations are documented in TESTING.md.

## Update 0.14.0

This update addresses arm/body penetration and interrupted throwing. The torso leans around its centre, with the shoulders following the same body transform. Throw targets stay outside the potato, and the overhead arc shares velocities through its release and follow-through. The yellow carved clogs have a further 22.5% reduction across their footprint and lower bulk; the ankles still meet their openings.

Light guns use a side grip; scatter/RPG use a two-handed forward grip so the stock stays outside the torso. The shoulder offset is now 0.98m, with the same fixed camera distance, sight direction and cover compression.

The 120ms throw wind-up is unchanged. A rapid-fire pickup shortens recovery to fit the faster cooldown, instead of restarting halfway through the previous throw. Catching during wind-up lets the pending potato release and the arm recover before the next throw. Guests advance visible throw/catch animation between host snapshots without creating shots or changing authoritative cooldowns.

Online sessions use protocol 10: reload each device and create a fresh three-human room. The fixed shoulder camera, input controls, maps, progression, single shared weapon box, music and Rishi/Moira-only speech remain covered by the existing regression suite. See TESTING.md for mesh, simulation and browser verification limits.

## Update 0.13.0

Aiming now uses a fixed shoulder pivot and camera distance. Looking up no longer drives the camera into the ground and triggers automatic zoom. Only nearby solid cover compresses the camera; the opaque own model is hidden during very close cover to prevent seeing its interior. Nearby opponents no longer trigger disappearance. The body turns across the sight line to expose the weapon side.

Guns pivot around a stable grip beside the shoulder. The visible muzzle and projectile direction share the same ballistic solution, with a separate obstruction check preventing barrels from shooting through nearby cover. Camera distance and launch speed are included in snapshots so remote weapon poses use the shooter's settings. Three-player online sessions use protocol 9: reload every device and create a fresh room.

Hands have four jointed fingers, thumbs, palms, knuckles and nails, with shaped upper arms, forearms, elbow joints and grips. Hand throws use a 120ms overhead wind-up and release at the hand socket, followed by a recovery; death and weapon changes cancel unreleased throws. Guns fire immediately. The base gun fires every 0.34s at 32m/s, versus hand throws every 0.62s at 23m/s. Wooden clogs are 20% smaller across their footprint, with tulip inlays, engraved borders, rims and a wood sole. The gun has wood side panels, fasteners, a trigger guard and a hollow muzzle.

Speech uses only installed Rishi and Moira voices, including manually selected voices. No other voice or arbitrary recorded-voice pack can play. If neither voice exists on the device, speech remains silent. Recorded music, positional effects and captions continue normally. The main artwork now has a gold crown, while preserving the existing character, red cape and village scene.

See TESTING.md for automated checks, visual geometry inspection and device-testing limits.

## Update 0.12.0

Four authored worlds now organize the circuit: Gouda Old Town (market streets and shopfronts), Royal Butter Gardens (formal planting, fountain and estate), Moonlight Quays (warehouses, boats, cranes and protected bridges), and Golden Harvest Farm (red barns, fields, windmill and hay). Street furniture follows kerbs and building fronts; destruction targets form loading rows beside the barns. Bonus hunts use these world layouts too. The menu separates worlds from game modes. Every mixed circuit includes all ten rounds and four worlds, alternates combat/trials, and avoids the previous opening world using a saved preference. Standard-layout practice remains available.

The shoulder camera retains its sight direction through zoom and cover changes. Own-body transparency has been removed: the entire local model is hidden only in a compressed or obstructed view and at point-blank rivals, then restored for other players and split-screen. Normal view retains the opaque character. Feet are broader and turned outward to expose the pointed yellow toes; leg proportions remain compatible with crouch gates. Hand throws animate the arm and release the held potato; gun models appear after progression. Capes belong only to Potatoman, and three consecutive outright main-round wins earn a crown. A tie or loss resets that streak.

Each main round starts with hand-thrown potatoes. Three landed hits on players or marked destruction targets earn the base spud gun. A death while using the base gun retains it. Collecting the single special box raises the loadout tier; dying after that, including after spending its ammo, returns the player to throwing. Remaining special ammunition drops for another player. Weapon and crown state travel in online snapshots.

Online is exactly three human players, with no bots. The server rejects early starts and a fourth player. Missing input stops that human; it never enables AI. If someone leaves, the session saves and returns to the lobby flow for a new three-person room. Reload every client and create a fresh room: snapshot protocol is 8.

Only the last-place player gets named potato commentary, once after each main round; a fully tied round stays silent. Family/alien/scaffolder phrases have been removed from the shipped dialogue. Local damage triggers spaced pain reactions. Moira is preferred for commentary and Rishi for pain when those named system voices are present; an explicit voice selection overrides the preference. No licensed Rishi/Moira recording pack is bundled. Recorded music and positional foley remain, with a separate cloth/whoosh hand-throw cue and a download-safe fallback. Settings are grouped into gameplay, audio and control sections.

The browser menu and settings can be reviewed here; the current cloud browser still reports its GPU disabled. Real GPU appearance, 60 FPS, physical controller feel and perceived voices require device testing. Automated results are recorded in TESTING.md.

## Earlier updates (historical)

## Update 0.11.0

The potato face has smaller, softer eyes, relaxed arched brows and a closed smile instead of the dark mouth and protruding teeth. Gentle catch/runner expressions and a brief damage wince keep it responsive.

Frame-loop changes reuse limb/gun math objects, collision lists and temporary fade state; skip unchanged HUD writes; and spread cape normal updates across players. The 3D collision slab test no longer creates arrays per query. High/Performance resolution changes require sustained samples and a cooldown; each adjustment resizes only once. Cinematic retains fixed resolution. These reduce CPU work and resize churn without changing movement speed or aiming.

All three canal bridges now use physical handrail colliders matching the visible bars. Walking, crouching and dashing cannot push a grounded player off either side; crossings remain open. A deliberate jump above a rail can still clear it. Snapshot protocol is 7: reload every client and create a fresh room.

## Update 0.10.0

Standing characters are 0.20m shorter with proportionally shorter legs; crouch dimensions remain consistent with the assault-course roofs. The gait is 2.8 radians/metre (about 2.67 cycles/second at normal running speed), with restrained foot lift and matching alternating footsteps. The shoulder camera moves farther right (0.85m) and closer (default 4.6m); muzzle/reticle convergence is retained. Untouched old zoom settings migrate, deliberate custom zoom stays, and Reset View now persists the restored distance.

The oscillator soundtrack is replaced by two licensed recordings: Kevin MacLeod's Funk Game Loop for main arenas and Go Cart – Loop Mix for the hunt. Twenty-one compact recorded samples supply wood/grass footsteps, cloth movement, punch/wood/metal impacts, swooshes, splashes, slime and water ambience. Every game cue has its own recorded mix, routed through the existing HRTF/distance/cover/reverb chain. Fountain ambience follows its location. Music pauses/resumes at its saved position, retries failed loading from Preview Music, and stops while hidden. Music + effects add approximately 2.19MB of downloads. In-game Settings contains attribution and links to full credits. Taunts still use the existing browser voice fallback; this update does not install a recorded voice pack.

Trees now have trunks, roots, branching limbs and instanced alpha-tested oak-leaf clusters with subtle wind, shadows and distance-based detail. The new original 1254-square leaf texture also dresses hedge edges. The garden fountain now has eight curved water streams, a central jet, 96 animated droplets and ripple rings inside a raised rim. Basin/canal surfaces have moving waves, glancing reflections, highlights and edge foam. Reflections are an analytic sky approximation, not ray tracing. These changes preserve collision routes and night lighting.

Snapshot protocol is now 6: reload all clients before starting a new room. Automated geometry/audio/network checks and browser recorded-music playback are covered in TESTING.md. GPU appearance, perceived sound quality and sustained 60 FPS still need real-device testing.

## Update 0.9.0

The visible barrel and projectiles now share one muzzle and launch direction, including crouching, weapon scaling and recoil. Camera yaw/pitch are angular, retain their direction when zooming or squeezing past a wall, and ignore cover behind the muzzle when choosing a target. Nearby solid cover still blocks outgoing shots; large spuds have matching muzzle clearance. The local-avatar fade and night environments are retained.

Fresh controls use Space to jump, Left Shift to dodge and left mouse click to fire (F remains available). The previous default C/Space pair migrates; customized bindings remain. Mouse firing can be remapped or disabled in Settings. Keyboard/controller/touch pitch ranges now agree. Bot targeting accounts for the shoulder camera and the height of crates.

Klompens are bright golden yellow with tapered, raised pointed toes, darker wooden soles and engraved decoration. Normal walking is about 1.8 cycles/second with gentler foot lift, arm swing and body bob. The title now uses an original transparent 2079 × 756 gold 3D POTATOMAN / TOTALLY MASH wordmark.

Music has a stronger mix, retries suspended/interrupted browser audio after user gestures, and starts before asynchronous game loading. Settings → Preview Music plays a 12-second sample with volume/status feedback. Existing off/zero preferences are preserved unless Preview Music is explicitly pressed. Taunt frequency remains unchanged. All online players must reload before creating a new room (snapshot protocol 5).

## Update 0.8.0

The camera now sits over the shoulder. A camera ray chooses the visible target and shots converge from the weapon muzzle, including close enemies and crouched targets. The local avatar fades when too close or blocking a nearby rival. Mouse capture recovery remains unchanged. Touch can aim vertically.

Characters have longer articulated legs, separate broad wooden klompens and a crouching pose. Hold Left Ctrl (P2: Numpad 1), the right-stick press on a fresh controller setup, or DUCK on touch. Custom bindings are retained; old setups select an unused button. Three assault checkpoints now require crouching under a low roof, with headroom checks and smaller hitboxes.

Each shooting round has one public special-weapon box at the central square. Everyone starts together after the 2.5-second briefing; opening routes have equal length. The weapon drops with its remaining ammunition on death and becomes spent when exhausted. No replacement box spawns. The bonus hunt has one shared finite Masher, excluding Potatoman. Death still restores the base spud gun.

Audio now uses separate layered effects for every boost, each weapon, wooden footsteps, pickups, landings, catches and explosions. HRTF positioning follows the active camera, with distance falloff, cover low-pass filtering, a short environmental reverb and a 28-event limit. Host events reach guests once and expired/muted events are discarded. Split-screen uses player 1's camera for the shared speaker/headphone listener. Browser voice taunts remain occasional; the recorded-clip loader is ready, but no generated voice pack is installed (see dist/assets/voices/README.md).

The playable ground uses matched 2048px diffuse/normal/roughness cobblestone maps, with 1024px oak maps on klompens and timber. Material maps are CC0 from Poly Haven; credits accompany the assets. Scene batching and adaptive resolution remain enabled. Real GPU/controller playtesting and perceived audio quality still need a device check; automated tests do not establish 60 FPS.

## Update 0.7.0

Every session now saves progress, including partial first rounds. High Scores ranks the best arcade-point session; circuit placement points remain separate in match results. Names are required before solo/practice and online room entry. Old profiles and scores remain available through an additive migration.

The earlier periodic-pad system is superseded by the single shared box and death transfers in 0.8.0. Chipper Auto, Triple Mash and the three-shot Spud RPG remain available. Main circuits alternate combat and movement rounds with varied opening maps. Town, canal and garden layouts now have playable streets/courtyards/bridges.

Voice snippets are occasional: 22–34 seconds between lines, no immediate repeats, and sound effects unaffected. Current voices still come from browser speech synthesis. Install AI Voice Generator in ChatGPT to produce recorded clips; it is not a folder or software package to install on the game host. No recorded voice pack has been generated or bundled yet.

Rendering uses spatial batches and cheaper distant foliage while preserving near detail and a sharper adaptive-resolution floor. Real hardware validation is still needed; see TESTING.md.

# POTATOMAN — by The Klompens · testing build 0.17.0

**Clogs on, Game on. Totally Mash.** A third-person browser game with fourteen levels, potato combat, timed maze races, bonus hunts, local split-screen and friend rooms for exactly three devices.

## Play and controls

Mouse movement pans/aims immediately without holding buttons. A gameplay key requests pointer lock for unlimited turning; clicking the arena also requests it. Browsers which refuse pointer lock retain hover panning and continuous turning near the canvas edges; move the cursor back inward to stop. Pointer capture uses document-level mouse movement and recovers from denied or delayed requests. Escape releases the cursor; browsers may consume that first press, so press Escape again or use the pause button to pause. Left click fires by default; Settings can change or disable mouse firing. Hover panning still works without holding a button.

| Action | Player 1 | Player 2 | Standard / PS5 controller |
| --- | --- | --- | --- |
| Move | WASD | Arrows | Left stick |
| Pan / aim | Mouse, or T/G/Q/H | I/K/J/L | Right stick |
| Throw / fire | Left click / F | Right Ctrl | R2 |
| Catch | E | Right Shift | L2 |
| Jump | Space | Numpad 0 | Cross |
| Crouch / duck | Left Ctrl | Numpad 1 | Right stick press |
| Dodge | Left Shift | Enter | Circle |
| Reset camera | R | N | Triangle |
| Pause / menu | Escape | Escape | Options |

Keyboard and controller buttons are remappable. Connect a DualSense by USB-C data cable or pair it in the device's Bluetooth settings with Create + PS, then press Cross in the game. Add Controller shows device recognition, player assignment and live stick/button feedback. The browser cannot initiate Bluetooth pairing through the Gamepad API.

Main rounds default to two minutes; Settings accepts 1–10 minutes in half-minute steps. A 2.5-second introduction precedes the active clock. Forty-second bonus hunts follow the first nine levels. Solo and local pause freezes the simulation. The online host pauses the shared match; a guest's menu pauses only that guest's controls.

## This playable update

Mixed circuit play rotates all four worlds, avoids the previous opening world, alternates combat and movement modes, and keeps the finale last. Maze layouts change with the circuit seed. A duration-aware route budget adds loops to overly long maze paths. Level Select uses standard layouts for practice and comparable maze records.

The Butter Run replaces the loading-bay destruction round with a 15-checkpoint assault trial: jump onto ascending wooden platforms, clear hurdles and complete the course in order. Fastest complete attempt wins. Space / Numpad 0 / controller Cross jump; existing custom controls migrate without resetting. Jumping has vertical velocity, support/landing collision, airborne character/camera/labels and height-aware projectile hits.

Six shared pickups per main round provide Butter Boots (40% faster running, 12 seconds), Hot Spud (potato cooldown 0.55 → 0.29 seconds, 12 seconds), and Spring Clogs (higher jumps, 14 seconds). Race/trial pickups use running and jumping. Pickups respawn after 18 seconds, never stack duration, and reset on respawn. The host synchronizes them and jumping; short jump taps survive the gap between network sends.

Settings adds 50–100 degree vertical FOV and 3–9 metre camera distance. High/Performance modes adapt rendering resolution to sustained frame rate; Cinematic remains fixed. Fine decoration uses lower-resolution geometry, shadows refresh once across split views, and switching quality resizes existing shadow targets. Camera obstruction now includes narrowed bins. Delayed pointer capture remains accepted while play is active; stale errors cannot disable an acquired capture.

Visual changes include a new 1254-square russet skin texture, fuller organic body/arms, skin-coloured brow ridges, jump poses, contact shadows, environment reflections and surface relief on stone/brick/foliage. These are improved procedural game assets, not a claim of AAA or photorealistic production fidelity.

Named potato commentary plays once after a main round, about last place only. Only Rishi and Moira system voices are permitted; missing voices leave speech silent. Queued utterances are guarded, with recovery from stuck completion callbacks. Recorded music and positional foley continue independently.

Player names and live health bars appear above all four characters, including bots and online players. Labels face each camera, retain a readable screen size in split-screen, hide behind solid cover and during respawn, and use 140 maximum HP for Potatoman or 100 otherwise. Canvas textures update only when the displayed state changes and are released between levels.

Foreground stalls no longer trigger an automatic pause; simulation catch-up is capped at eight fixed steps. Each new arena renders once before its clock starts. Missing or stalled texture downloads fall back to procedural materials after at most eight seconds. Failed startup offers Retry Level and Back to Menu; online retries wait for a rebuilt arena before resuming and retain the latest host snapshot.

Music & potato taunts in Settings has separate music and voice switches and volume sliders, a Rishi/Moira-only voice selector and separate commentary/reaction test buttons. The recorded soundtrack uses a funk arena loop and a separate action loop for hunts. Music pauses with play, retains its playback position and ducks under speech. Preview Music checks download/decoding/playback and volume; full credits are linked in Settings. Voice lines use browser speech synthesis, not recorded actors; available voices and autoplay behaviour vary by device. Captions remain available. The first upgrade to settings version 3 enables the new music/voice defaults; subsequent mute choices persist.

AI difficulty defaults to **Chill**, with Easy, Normal and Hard options. Difficulty changes apply to bots immediately; online rooms contain no bots. Chill gives bots slower movement, 850 ms target updates, wider aim error, at least 1.8 seconds between potato throws and no catches. The bonus runner retains a speed advantage. Human movement and weapon cooldowns only change through the advertised pickups. These are initial tuning values for playtesting. Solo community scores are not separated by AI difficulty.

The title, Totally Mash subtitle, byline and menu links use a clearer responsive layout over the original artwork. The artwork itself remains unchanged.

## Levels and rules

Fourteen levels combine six distinct worlds with combat, capture, destruction, an assault course and increasingly long mazes. Maze shortest routes are 52, 68, 88 and 112 grid steps. All racers share a start and finish; fastest completed escape across repeated attempts wins. Compass cues and visited-cell trail marks aid navigation. Crate hits have damage feedback, capture zones show contest/relocation status, and knockouts add objective points only in battle modes.

Main round winners receive three circuit points. Ties share victory. The rotating bonus runner moves faster, visits two checkpoints and escapes while hunters collect Masher guns. Runner escape awards one point and gives hunters 10% slower potato projectiles for the next main round's first 15 seconds. Hunter victory awards each hunter one point. Penalties never stack and have no effect in combat-free races.

## Online rooms

Create Room returns an invite link and ten-character code. Two guests join the host; all three humans must be present to start. A fourth player is rejected and bots never fill online slots. Joining an already-started room is blocked. The host simulates the match at 120 Hz, publishes snapshots at up to 20 Hz and consumes bounded guest input. Guests predict local movement with bounded correction and interpolate remote players. Press counters protect short catch/dodge/jump taps, including taps between network sends.

WebRTC data channels are preferred, using Google's public STUN service for discovery. If direct connectivity fails or stalls, the same-origin HTTP/database relay remains available. Relay latency and capacity depend on hosting and network conditions. The host must remain connected; this build has no host migration, dedicated simulation server, matchmaking or ranked anti-cheat. Test actual cross-device latency before a public launch. The HTTP room protocol is tested against a real SQLite database. Browser menus were exercised, but the cloud browser reports GL_RENDERER=Disabled, blocking actual 3D gameplay, GPU visual checks and frame-rate measurements. Physical controller and real cross-device matches remain unverified.

## Player profiles and scores

Player Details saves a name, optional motto and durable statistics. An opaque profile access token is remembered by the browser; player records and scores live in the server database. There is no account sign-in or cross-device profile recovery in this alpha. Local split-screen records the primary device player's profile; online players each use their own device profile.

High Scores lists the best arcade-point session, including unfinished first rounds, plus separate fastest-escape tables for each standard-layout maze. Remix circuits contribute points and statistics, but random-maze times are excluded from the fixed-layout boards. Boards can filter solo, local and online play. Partial sessions save arcade points, player statistics and completed standard-layout maze times. Submissions are authenticated to the profile and deduplicated by run ID, with basic bounds and elapsed-time checks. These are community game scores submitted by browser clients, not independently verified ranked results.

## Deployment

See [UPLOAD-GUIDE.md](UPLOAD-GUIDE.md) for the difference between a static upload and the complete multiplayer deployment.

**Uploading only static HTML/assets does not enable rooms, profiles or leaderboards.** Deploy the included server as well. All paths are same-origin.

### Sites / Cloudflare Worker

The existing registered Site uses a D1 binding named `DB`, static assets in `dist/client`, and a Worker entrypoint in `dist/server/index.js`. `npm run build` produces these outputs and includes generated Drizzle migrations. Sites applies the migrations and binds its asset service. Source game files remain tracked in `dist/`; generated `dist/client`, `dist/server` and `dist/.openai` are ignored. A private Sites preview requires Site access for every player; making a room does not grant Site access.

### Other Node-capable web hosting

Use Node 22.13 or newer. Upload the tracked project, retaining `dist`, `server`, `drizzle` and `package.json`, then run `npm start`. No third-party runtime package is needed. Set `PORT` as required by the host. Set `POTATOMAN_PUBLIC_ORIGIN` to the external HTTPS origin when using a reverse proxy, and set `POTATOMAN_DATA_DIR` to a persistent writable directory. The Node adapter applies the same migrations to SQLite and serves the game and APIs together. Back up that directory; ephemeral hosting disks do not preserve player details or scores.

Do not deploy database files, tokens, runtime secrets or source control metadata as public assets. Use one persistent Node instance for this adapter; horizontal scaling needs a shared database/room service. WebRTC is an optimisation; the HTTP relay works without it.

## Graphics and validation

Original 1672 × 941 key/concept art, 1254 × 1254 material maps, organic potato geometry, carved clogs, articulated limbs, facial blinking, movement-driven stride, deforming capes, instanced scenery, water and atmospheric effects. Three.js 0.180.0 is vendored with its MIT license. Quality settings scale resolution and shadows. AAA production assets, GPU/device performance, controller feel and cross-browser networking still need real playtesting.

`npm test` verifies simulation timing/collision, controls, mouse capture denial and recovery, foreground stall handling, solo/online startup retries, audio scheduling and speech muting, Chill bot pacing, texture fallbacks, ten real Three.js scene graphs with a renderer substitute, gameplay and round changes, three-player API capacity and ownership, real HTTP transport against SQLite, network lifecycle races, profile ownership, durable score qualification and ranking. It does not render GPU pixels or measure hardware FPS.

Official references: [Sony DualSense pairing](https://www.playstation.com/en-us/support/hardware/pair-dualsense-controller-bluetooth/), [W3C Gamepad](https://www.w3.org/TR/gamepad/), [MDN Pointer Lock](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API), [MDN WebRTC data channels](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Using_data_channels).

## Tonight’s testing

See [TESTING.md](TESTING.md) for verified checks, remaining release gates and a short real-device testing sequence. Development preview uses `npm run dev`; it has the same room/profile API and an isolated `data/preview.sqlite` database. Production remains the existing Worker or portable Node server.

# POTATOMAN 0.16.0 — testing notes

This is a testing candidate, not a completed production-release certification.

## 0.16.0 verification

The complete automated regression suite passes, including gameplay, bot activity, maze/assault completion, world footprints, bridge protection, input/pan recovery, profiles/scores, weapon progression and host/guest synchronization.

The actual-mesh rig regression now samples 380 collision/topology poses, including 192 moving combinations of travel direction, stride extreme, crouch, dash and held/unarmed state. Shoulder attachment checks require a socket vertex at least 35 mm inside the actual body mesh. Independent sampling measured 67 mm minimum socket overlap and at most 19 mm distal limb penetration, within the existing 20 mm tolerance. Fixed upper/forearm lengths are 0.53/0.55 m. Full normal/boosted throw cycles preserve exact hand/potato contact and release, continuous recovery and 4,752 clear sight rays.

Movement regressions check arm/leg counter-swing in four travel directions, carried-potato movement, torso motion returning to rest, throw expression activation/recovery and a maximum of ten meshes in the detailed spud gun. The render-aim regression checks 54 exact barrel/trajectory combinations and 600 actual mesh/camera poses. Independent CPU projections cover front and shoulder views, idle, walking, strafing, crouching, throw phases and gun poses. These inspect geometry and motion, not GPU textures or lighting.

At the available 1363 × 936 supervised browser viewport, the menu title is 480 × 174.5 pixels with 49 pixels before the play controls; both solo and online buttons remain visible. The larger menu/loading assets load successfully. Arena startup reports GL_VENDOR/GL_RENDERER=Disabled and Error creating WebGL context; Back to Menu works. No rendered GPU playthrough, physical-controller test or hardware frame-rate measurement is claimed. A WebGL-capable device is required for that final acceptance pass.

## 0.15.4 verification

Independent bot review reproduced stationary spells of 76 seconds in battle and 86 seconds in Smash, and overlapping capture bots. The first fix passed 60 complete main/bonus rounds plus 15 moving-target rounds: all 45 maze/assault bot runs finished and all 30 bonus boxes were collected on Chill. The firing-position adjustment was exercised in another 40 complete combat rounds across Chill/Easy/Normal/Hard, stationary and moving human targets, plus eight bonus rounds. All poses remained finite, every combat bot travelled at least 161 metres and fired at least 33 shots, and no navigation deadlocks occurred. On Chill, battle/Smash stationary spells were at most six seconds. The longest collision delay across difficulties was 0.27 seconds. Two harder bonus runs ended with the runner eliminated before the box could be reached.

An independent geometry review checked all ten maps in normal and bonus configurations: actual building bounds do not overlap each other or intrude into the arena, canal buildings and tree trunks remain out of the water, and post-batch transforms remain finite. Environmental mesh-object maximum rose from 413 to 518 as backgrounds became more complete; existing instancing, culling and tree distance limits are retained. This is a scene-complexity measurement, not an FPS benchmark.

The complete existing regression suite passed, including maze/assault completion, bridge rails, deaths returning to throwing, weapon drops, host/guest synchronization, panning recovery, character grips and crosshair clearance. Focused bot activity and scenery footprint regressions accompany the fixes. Running the new checks after the full gameplay sequence exposed a navigation/separation equilibrium beside an occupied waypoint; moving bots now yield sideways without cancelling their forward path. The final sequence checks activity after prior matches and exact overlaps across all four difficulties. An additional independent eight-round Smash sweep varied difficulty and projectile history against the final steering fix: stationary spells were at most five seconds and movement blockage at most 0.008 seconds. The overlap regression permits moving crossings but rejects close pairs that remain motionless for a second.

The supervised browser preview reports GL_VENDOR/GL_RENDERER=Disabled and Error creating WebGL context at arena startup. Menus and startup-error recovery can be tested there; rendered gameplay, visual polish on Ultra, controller hardware and 60 fps must still be checked on a WebGL-capable device. No GPU playthrough is claimed.

## 0.15.3 verification

Targeted character-rig and render-aim suites pass: 188 real-mesh collision/topology poses, full normal/boosted limb-length sweeps, 4,752 full-cycle throw sight rays and 600 additional weapon/camera poses. A new regression checks every hand/finger vertex stays behind the held potato through wind-up and release, including turned aim, crouching and dashing. An independent 20-pose grip inspection measured at least 18 mm behind the potato centre and 0–2 mm nearest palm contact gaps.

CPU projections from front and shoulder cameras were reviewed. They inspect actual geometry without GPU textures/lighting. No browser or hardware gameplay run is claimed for this grip-only update; the previously reported test-browser WebGL limitation remains. Gameplay, networking and controls code were not changed.

## 0.15.2 verification

The complete regression suite passes. Expanded character checks cover 188 actual mesh collision/topology poses, constant bone lengths through normal/boosted crouch/dash cycles, and 4,752 full-cycle sight rays. The elbow is constrained on its fixed-length IK circle instead of shortened after solving. Exact projectile release, smooth recovery and the unchanged camera controls remain verified.

Actual Three.js mesh projections were reviewed from the front three-quarter and normal shoulder camera through ready, wind-up, release and follow-through. These confirm a separate side-of-head wind-up silhouette and warm limb colours; they omit textures and GPU lighting.

Gameplay regressions cover earned-gun death, special-gun drops with remaining ammunition, new hits re-earning the gun, post-death projectile hits, water deaths and host-to-guest respawn state. All deaths return to throwing with zero progress. The character test now resets shot duration between poses, avoiding a previous test-state leak from the boosted throw check.

The managed preview's menus and player entry were exercised. Arena startup reports GL_RENDERER=Disabled / Error creating WebGL context, so there is no claim of a GPU gameplay playthrough, Ultra visual-quality measurement, physical controller test or hardware FPS result. Camera/pan behavior remains covered by simulation and real-mesh geometry tests. Refresh every client before testing; protocol stays at 10.

## 0.15.1 verification

The complete automated suite exits successfully with 105 reported checks. Existing release timing, 68 mesh/body clearance poses, 600 crosshair-clearance poses, 54 muzzle/trajectory combinations, gait, networking, controls and scoring checks remain green.

A read-only reviewer identified the free elbow pole pointing forward and the thumb geometry being mirrored. Free arms now bend behind the shoulder-to-wrist chord, and only active weapon poses use the tuned throwing/gun pole. New regressions check the corrected elbow bend across the swing, glove handedness, and actual torso-ray clearance to the left forearm and palm in normal standing/crouched shoulder views.

The free wrist moves from body-local X=±0.76, Z=0.16 to X=±0.90, Z=−0.04. Independent CPU sampling at a 1440 × 900, 65° normal shoulder camera found that the resting left glove changed from 4.7% exposed to 100%, and the forearm from 40.6% to 100%. At the strongest forward swing, the glove remains 62.7% exposed and the forearm 76.1%; the rear swing is fully exposed. These are torso-only ray samples, not GPU pixels. The active gun/throw hand, camera, launch sockets and boom distance are unchanged.

CPU mesh projections were inspected from the front, rear and normal shoulder camera. Skin now has a golden-brown base tint, roughness 0.88 and lower environment reflection while keeping the existing detailed albedo/bump map. This also makes the procedural-texture fallback brown. White molded arms/gloves and yellow clogs retain their own materials.

The browser GPU remains unavailable. This update does not claim a rendered GPU playthrough or hardware FPS result. Refresh each client before testing; snapshot protocol stays at 10.

## 0.15.0 verification

The complete automated suite exits successfully: 103 reported checks. It retains the full circuit, scores, multiplayer, input/pan, weapon progression, sound and world/bridge regressions.

An independent gait reviewer reproduced forward feet swinging backwards in the actual Three.js transforms. A new regression checks 120 combinations of movement direction, yaw, foot and swing/stance phase, including backpedaling and strafing. Lifted feet now travel along actual movement and planted feet return against it. Idle does not advance stride; teleports reset it. This is directional animation, not fully planted foot IK; some foot sliding at high speed remains a device-playtest concern.

The white toy-style arm meshes have a continuous circular elbow fillet, three rounded glove fingers, an opposed thumb and wrist cuffs. Geometry buffers are created once and disposed with their character. Regression checks cover outward-facing triangles, matching positions/normals across the elbow seam, a head-high ready potato, 68 torso/arm/hand/spud/gun poses, fine-step throw and pitch continuity, exact release and boosted recovery. The 600 full-mesh sight cases and 54 barrel/trajectory cases remain green. Maze/assault runners now use a free arm swing instead of holding an invisible potato beside the head. Front, shoulder and raised-throw CPU mesh projections were inspected; these do not reproduce GPU materials or final lighting.

An independent arm reviewer sampled 5,172 poses for surface orientation, seams, stable buffers and bounds, and checked ownership/disposal of the new geometry. Extra dense clearance sampling found a 30.03mm fingertip penetration during a reachable crouch/dash/downward-aim combination. Tightening the gun grip corrected it; the same 356-pose review then measured a maximum 14.97mm surface overlap, below the existing 20mm tolerance. The regression suite now includes those blended crouch cases for all light guns. Those extra cases also exposed the lower gun handle clipping during the same motion; a shorter, shallower handle clears the body while retaining its top attachment, hand target and exact muzzle.

At a 1363 × 936 browser viewport, the menu controls occupy x=55–475 and all four world cards end at y=882 with no horizontal overflow. The crowned character is exposed on the right. The moved Worlds & Modes button still opens all ten levels. The menu uses shorter branding at limited desktop heights, a bounded left column and vertical scrolling where needed.

A same-process isolated benchmark measured about 0.058ms median for four current character updates versus 0.047ms for 0.14.0. This measures only CPU rig updates, excludes GPU uploads/rendering and browser frame pacing, and is not a hardware FPS claim.

The test browser's GPU remains disabled, so no rendered arena playthrough, sustained 60 FPS result, or physical-controller test is claimed. Refresh each device before public testing; the visual/gait update retains protocol 10.

## 0.14.0 verification

The full automated suite passes: 100 reported checks. This includes the existing complete two-minute circuits, input/pan recovery, profiles/partial scores, three-human multiplayer, progression, audio and map/bridge tests.

New regressions cover real mesh penetration, attached shoulders, bounded arm reach, continuous elbow motion, hand/spud socket contact, exact release, crouch press/release, boosted recovery and its release velocity. The geometry test inspects 56 actual torso/limb/hand/spud/gun poses, excluding only the 0.17m upper-arm joining region and allowing at most 0.02m of surface overlap. The camera test retains 600 actual-mesh sight cases and 54 exact barrel/trajectory cases, plus point-blank targets and cover. Clogs are another 22.5% smaller across the footprint with correctly seated ankles.

An independent reviewer checked 900 sight poses, 30 complete gun-mesh poses, a 920-pose reach sweep and 3,684 throw wrist frames. No sight obstruction or gun/body penetration was found. Maximum overlap beyond the shoulder join was 0.015795m, maximum normalized upper reach 0.70899m and maximum throw wrist bend 83.87 degrees. Elbow motion stayed continuous under fine time and pitch sampling. These are CPU triangle/matrix checks, not rendered GPU screenshots.

Independent gameplay probes confirmed boost expiry/collection during a throw, catch during boosted wind-up, death/respawn, equip changes, host pause, stale guest state and protocol 10 serialization. Guests now advance only visual throw/catch timers between snapshots; cooldowns, pending launches and shot creation remain authoritative. Boosted held fire retains six releases over two seconds and the 120ms wind-up; recovery finishes before the next throw.

CPU projection of the actual meshes was reviewed from the front, shoulder and overhead-throw views. An isolated four-character update benchmark measured about 0.027ms median versus 0.023ms on the prior rig in the same Node process; this excludes the world, GPU work and browser frame pacing and is not a 60 FPS claim.

The browser reviewer verified menu/settings, the WebGL error screen, Retry, Back to Menu and world filtering. Actual arena play was blocked by GL_VENDOR=Disabled / GL_RENDERER=Disabled in the managed browser. GPU appearance, physical-controller feel and sustained frame rate still require device testing. No agent claimed an in-game GPU playthrough.

This remains the public testing link. Reload all clients and create a fresh three-human room (protocol 10). The fixed camera boom is unchanged; its lateral shoulder offset is 0.98m to leave room for the corrected arm silhouettes.

## 0.13.0 verification

- Full automated suite: 91 reported checks passed. Includes full two-minute race/assault simulations, partial scores, profiles, HTTP/SQLite multiplayer, input capture/resume, audio and existing map/bridge checks.
- 600 actual Three.js mesh poses across throw/spud/scatter/RPG, standing/crouched, pitch extremes, three zoom distances and five throw phases keep the central sight ray clear. Open-space camera boom length stays fixed and above the ground. Transformed-runner clearance is also checked.
- 54 barrel/trajectory combinations retain exact visual muzzle/launch correspondence. Close targets at 1/2/4/11m and cover remain covered. Guns pivot around a stable shoulder grip; hand release reaches its exact overhead socket.
- Simulation: overhead release occurs after 120ms; death/equip cancels pending throws; gunfire is immediate and does not penetrate cover. Two seconds of held fire yielded six base-gun shots versus three released hand throws. Cadence settings are 0.34s versus 0.62s.
- Rishi/Moira-only speech selection rejects an unapproved saved voice and remains silent when neither approved voice is available. Existing music/foley and speech spacing checks pass.
- CPU projection of the real character meshes was inspected for shoulder stance, weapon grip and overhead pose. This checks geometry/proportions, not final GPU materials or lighting. Crowned master art was inspected and verified in the browser menu and artwork dialog at 1672 × 941. The voice test reported that Rishi/Moira were unavailable and correctly left speech silent.

This is a public testing build. Reload all clients and create a fresh three-human room (protocol 9). Check aiming and camera clearance on your devices, including tight cover, a nearby opponent, pitch extremes, crouching and each weapon. Actual GPU gameplay, sustained 60 FPS, physical controllers, live cross-device latency and perceived Rishi/Moira sound quality require device testing. The cloud browser reports its graphics renderer disabled; arena startup cannot be visually play-tested in that environment.

## 0.12.0 verification

The complete npm test suite exits successfully: 88 reported checks. New coverage includes 400 circuit openings that avoid the saved previous world, four world families across all ten rounds, authored combat routes and prop colliders, fourteen nonoverlapping farm loading targets, three-hit weapon progression, base-gun retention, special-weapon death drops and return to throwing. Online tests cover three-player capacity, early-start rejection, missing-input behavior without AI, and progression/crown state serialization.

Real Three.js geometry/matrix checks inspect what each viewport would render: ordinary opaque shoulder view, the compressed-camera clear view, point-blank rival visibility, restoration between split-screen viewports, hand-throw arm movement, pointed outward yellow clogs, Potatoman-only capes and the three-win crown. Existing 54 barrel/aim combinations, crouch/assault simulations, bridge protection, mouse capture recovery, collision differential checks, audio scheduling and partial-score persistence remain green. Ten scene graphs build with at most 693 mesh objects after batching; that is a scene count, not a hardware FPS result.

The managed browser preview confirmed the menu, farm world/mode filtering, required named-player flow, accordion settings, recorded soundtrack playback, and a one-human lobby with two open places and disabled Start. A gameplay startup attempt again reported GL_VENDOR=Disabled and GL_RENDERER=Disabled. GPU images, hardware FPS, in-match mouse feel, cross-device/controller play and perceived sound quality remain unverified on this browser.

Potato commentary now names only last place once after the main round; all-tied rounds are silent. Pain reactions are spaced at least 4.5 seconds apart and do not overlap speech. Tests confirm Moira/Rishi preference when available, explicit voice overrides and English fallback. No recorded Rishi/Moira pack is bundled; system voice availability differs by device.

For this update, reload every device and create a fresh three-human room (snapshot protocol 8). Start several circuits to check distinct opening worlds. Tour all four worlds and their bonus hunts. Check tight-cover and point-blank camera transitions, hand throws through the third hit, death after special-weapon collection/ammo exhaustion, crown after three main-round wins, bridge safety, and last-place commentary on actual devices.

## 0.11.0 verification

The full automated suite passed after integrating the friendly face, frame-loop changes and physical canal handrails. Existing real Three.js geometry, 54 barrel/aim combinations, input recovery, full assault-course simulations, HTTP multiplayer and partial-score persistence checks remain green.

The collision optimization matches the previous solver on 20,000 seeded cases, including parallel segments, raised boxes and padding. Targeted simulation verifies all three bridges from both sides while walking, crouching and dashing, open end-to-end crossings and preserved navigation. Rails use the same dimensions for graphics and collision. Their top bars stop grounded bodies; deliberate jumps can clear them and shots below/above remain unobstructed.

Adaptive-resolution checks verify that alternating low/high samples do not repeatedly resize, sustained slow samples lower resolution, recovery is gradual, and Cinematic remains fixed. Cape normals retain their 24Hz update rate with staggered player phases. Geometry quality, movement speed, gait and aiming remain unchanged by the performance work.

An independent read-only reviewer measured the slab change in real Three.js CPU loops using a renderer substitute: median CPU frame work fell from 0.349 to 0.283ms in Market, 0.394 to 0.292ms in Garden and 0.380 to 0.328ms in Fort. This isolates the slab change against 0.10.0; it excludes GPU rendering and is not an FPS measurement. The cloud browser's previously disabled GPU still prevents an in-game visual or hardware frame-rate claim.

For this public testing build, reload every client, create a fresh online room (snapshot protocol 7), and check frame pacing, the new facial expressions and bridge safety on actual devices.

## 0.10.0 verification

The complete automated suite passed after the integrated changes.

Targeted tests cover shortened standing geometry with preserved crouch headroom, barrel/sight alignment across 54 combinations, close torso targeting, new default zoom migration and retained custom settings. The prior sub-two-cycle gait assertion is replaced by a 2.5–2.9 cycles/second running range.

Scene checks verify actual alpha-tested textured leaf-card trees, shadow flags, fountain geometry surviving batching, animated droplet positions/water clocks, and exact flow resource disposal on level changes. Water shading uses an analytic sky reflection; there is no actual scene ray tracing. Independent read-only reviews checked transforms, uniforms, animation ownership and disposal. GPU shader compilation/appearance remain unverified in the cloud browser with its disabled GPU.

All 23 audio MP3s decoded in asset preparation; the selected download payload is 2,189,821 bytes. Browser Settings → Preview Music reached “recorded soundtrack” playback after actual file download/decoding. Automated tests check one looping music source, pause offsets, deferred download/resume races, cache reuse, every cue selecting recorded foley layers, and persistent/removed HRTF fountain loops. Perceived audio quality and actual speakers/headphones still require device listening. Credits are included in Settings and assets/audio/AUDIO-CREDITS.txt.

Check the closer shoulder view at default 4.6m, in tight cover, while crouching and with every gun. Recheck crouch gates after the shorter model. Walk around the garden fountain and listen on headphones, then pause, switch tabs and change levels. Confirm there is no continuing water loop after leaving the garden. Online clients must all reload for snapshot protocol 6.

## 0.9.0 verification (historical)

The full automated suite passed, including gameplay, scene geometry, audio, controls, HTTP multiplayer, profiles and scores.

Targeted real Three.js matrix/geometry tests verify that the actual barrel endpoint equals the projectile origin and the barrel axis follows launch velocity in 54 stance/pitch/yaw/weapon combinations including recoil. Centered rays intersect the actual torso mesh at 1, 2, 4 and 11 metres standing/crouched. Tests also reproduce rear-wall backfiring and large-spud side-wall clipping, verify that camera compression/zoom cannot rotate the sightline, and bound gait cadence/foot lift. These inspect scene data, not rendered GPU pixels.

Music tests cover an unresolved browser resume followed by a new user gesture, suspended/interrupted states, late promises, pause state, louder bus gain and unchanged taunt spacing. The browser UI showed the new title, migrated Space/Shift controls, left-click fire and a running Music Preview after clicking the button. Perceived volume and physical speaker output still need a device check. Independent read-only reviewers found the blocked-resume, crate-height and muzzle-clearance cases; all are addressed.

Reload every client before creating a new online room: snapshot protocol is now 5. Check aiming beside cover, at point-blank enemies, while crouching, and across zoom/FOV settings on actual hardware. The cloud browser previously reported its GPU disabled, so there is no claim of GPU gameplay, hardware FPS, physical controller feel or headphone listening verification here.

## 0.8.0 verification (historical)

The full automated suite passed, then focused controls/shared-weapon/gameplay checks passed after the final integration edits. Coverage includes close-range camera rays at 1/2/4/11 m, standing/crouching shot heights, roof/headroom collision, full two-minute assault/maze simulations, one shared finite weapon and partial-ammo transfers, real HTTP room transport, strict snapshots, spatial-audio event deduplication and mute/pause watermarks. Audio graph tests validate layered event schedules, HRTF coordinates, distance culling, changing cover filters and the 28-event ceiling; they do not rate perceived sound quality.

The browser menu and controls/audio settings were verified. A game startup attempt reported `GL_VENDOR = Disabled, GL_RENDERER = Disabled`; this browser cannot render WebGL, so no GPU frame rate, in-game screenshot, hardware controller or headphone listening validation is claimed. Scene-graph geometry and material setup were checked with real Three objects and a renderer substitute. Four independent reviewers examined camera/course logic, shared weapons, material/model geometry and audio; identified integration issues were fixed.

The new ground/wood textures are bundled local assets, not external runtime dependencies. The recorded-voice manifest is intentionally empty until generated/licensed clips are available. Browser speech remains the fallback, with the existing 22–34 second interval.

For device testing: check left/right and behind-cover audio on headphones; move close to a rival while aiming; hold/release crouch beneath each low roof; transfer the single gun through two deaths; exhaust its ammo; test the same sequence with a guest and compare events. Reload every client before starting a new online room because the snapshot protocol changed to version 4. Split-screen shares one audio listener at player 1's camera.

## Implemented

- Mouse-capture recovery after delayed grants and stale error events; bounded simulation recovery and recoverable graphics failures.
- Remixed ten-round circuit, varied maze/arena layouts, fixed standard-layout practice and maze records.
- Butter Run: 15 ordered checkpoints, ascending platforms, hurdles, jumping and fastest-attempt scoring.
- Faster running, faster throwing and higher jumping pickups, expiry, respawn and multiplayer state.
- Adjustable FOV and camera distance, lower geometry cost, adaptive resolution and reduced shadow work.
- More detailed potato skin, fuller characters, jumping poses, environment lighting and contact shadows.
- Revised effects/music and all requested dialogue phrases using available English browser voices.

## Added in 0.7.0

- Arcade points save during every active session at five-second checkpoints, on results, hidden/pagehide and exit. Client-generated run IDs, monotonic revisions and one pending storage record per run protect retries and concurrent tabs. A rejected record does not block healthy uploads. Existing circuit points are displayed separately; legacy scores convert at 100 arcade points per circuit point.
- Required named profile for solo/practice and online create/join. Accented names and apostrophes survive. Explicitly invalid remembered credentials can be recreated. The primary local player owns this browser's saved session; other local/AI players retain match scores.
- Larger spuds, Chipper Auto, Triple Mash and three-shot Spud RPG. The original periodic pads were replaced in 0.8.0 by one shared opening box, carrying finite ammunition through death drops. Death restores the base gun. RPG direct hits deal 200 damage; nearby splash falls from 80 and respects cover. The bonus hunt now shares one finite Masher; unlimited reloads were removed.
- Playable town buildings, market square, interior canal with three bridges and water respawns, and connected formal garden courtyards. Seeded circuits alternate combat/trials and vary the opening map.
- Near foliage detail with cheaper distant geometry, spatial static batches, fewer foliage shadows and sharper minimum resolution. These changes target frame budget; they are not a measured 60 fps guarantee.
- Spoken snippets wait 22–34 seconds and never repeat consecutively; only the deliberate Test Voice action bypasses the interval. Gameplay sounds remain separate.

## Verified in this update

Automated checks cover fixed-step movement, collision and projectile height; jump height and landings; boost mechanics and expiry; the complete assault trial with all Chill bots; two-minute standard and remixed maze completion; ordered course checkpoints; control migration; capture denial, delayed capture and stale errors; player-label lifecycle; audio scheduling, muting and voice interruptions; all ten Three.js scene graphs; real HTTP room transport against SQLite; short input edges; profile ownership, duplicate-score protection and leaderboards. Host seed and duration must produce exactly the same remixed maze on a guest with different local preferences.

Browser testing reached the game UI, required name prompt, profile save and persistence after reload, and the revised leaderboard. Previous checks also covered settings and startup error handling. The test browser reports `GL_VENDOR=Disabled` and `GL_RENDERER=Disabled`. It cannot render this Three.js/WebGL 2 game. Passing simulation/scene-graph checks does not establish correct GPU pixels, measured hardware FPS, working pointer lock in a real match or controller feel.

Independent read-only reviews also simulated 140 map variants for connectivity, all three canal crossings, weapon timing/ammo/RPG hits/respawn and JSON snapshot validation. A version mismatch in the transport layer and guest disconnect scoring bugs were found and fixed. Tests include the actual versioned HTTP relay.

## Required real-device checks tonight

1. Reload the game on every device so all players use the same update. Use a WebGL 2-capable browser with hardware acceleration enabled. Begin on High graphics and Chill AI.
2. Move the mouse before clicking the arena. Pan, hold a movement key to enable capture, press Escape, resume and repeat. Try Alt-Tab, opening Settings, changing levels, losing/regaining focus and fast swipes near viewport edges. Record the exact sequence if panning stops.
3. Adjust FOV from 50 to 100 and zoom from 3 to 9 metres. Move close to bins/walls and jump beside cover. Check for wall clipping, an obscured crosshair or labels floating at the wrong height.
4. Try Space to jump, left click to fire and Left Shift to dodge; remap them if preferred. Pair a PS5 controller in the device’s settings, press Cross, verify both sticks and test Cross jumping, Circle dodging and Options pause. Also test touch controls on an actual phone.
5. Choose The Butter Run. Land on all numbered platforms in sequence, jump hurdles and reach the exit. Walking directly to the exit must not score. Complete a second attempt to improve your time.
6. Reach the one central special-weapon box after the opening countdown. Die with it to confirm an ammunition-preserving drop and hand-throwing respawn, then use all its ammo. Try other gun types in another shooting round. Collect each power-up, watch its countdown, verify the effect ends and the pickup returns. Repeat in an online room; both screens must agree on pickups, airborne positions and course progress.
7. Run several remixed circuits and each standard maze. Keep the host connected; test a host pause, guest pause, dropped connection and next-round transition. Test actual latency on Wi-Fi and mobile networks.
8. Add your real name, score a hit or checkpoint and exit before the round ends. Verify the partial session on High Scores; reload and repeat. Test an offline interruption and two tabs, then reconnect. Complete a standard maze and check its separate time board. Random-layout maze times must not appear on standard-layout boards.
9. Run at least 20 minutes on target iPhone, Android, desktop and split-screen devices. Watch sustained FPS, heat, stutter, audio balance and memory growth. Switch Cinematic → High → Performance while playing.

## Remaining release gates

- Actual GPU visual/shader verification and sustained device performance measurements.
- Reproduction and elimination of any remaining mouse-pan failure on the user’s browser/OS.
- Real browser-to-browser matches and physical PS5/mobile control testing.
- Realistic recorded voice pack. AI Voice Generator must be installed and connected before those clips can be produced. Current speech quality depends on the device; it is not studio voice acting.
- The graphics are improved procedural game assets; no claim of AAA photorealistic production quality is made.
- The hosted website retains its existing access policy. Room codes do not grant website access to additional testers. Hosting access must include everyone who will join.
- Host-authoritative browser multiplayer has no host migration, dedicated simulation server or ranked anti-cheat. Community scores retain their existing trust model.

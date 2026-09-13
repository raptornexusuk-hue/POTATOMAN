# POTATOMAN asset editing guide — v0.16.0

This package contains the editable game source, shipped artwork, textures, sound effects and music. `ASSET_INVENTORY.csv` lists asset dimensions and sizes; `SOURCE_SNAPSHOT.json` identifies the source snapshot and checksums.

## Run your copy

Install Node.js 22.13 or newer, extract the ZIP, and open a terminal in the extracted project folder containing `package.json`:

```sh
npm start
```

Open **http://localhost:3000** in a browser with WebGL enabled. This path needs no dependency installation or build. Stop the server with Ctrl+C. Serve the game this way instead of opening `dist/index.html` directly: it uses JavaScript modules and HTTP asset/API requests. The server creates its own local database in `data/rooms.sqlite`.

For an editing server with automatic page reload:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite, normally **http://localhost:5173**. The development server uses a separate database at `data/preview.sqlite`. Refresh or restart a level after replacing textures or audio.

## Where to edit

**`dist/` is the actual editable client source in this project.** `npm run build` copies it into deployment outputs such as `dist/client/`; local asset editing does not require that command. Edit the original files listed below.

| Work | Files |
| --- | --- |
| Potato body, face, legs, cape, crown and character assembly | `dist/world.js`, especially `character()` and `updatePlayers()` |
| Arms, rounded hands, grips and throwing poses | `dist/character-rig.js` |
| Potato shape, carved clog geometry, rounded shapes and sky | `dist/visuals.js` |
| Spud gun geometry and material details | `dist/weapon-model.js`; weapon settings are in `dist/weapons.js` |
| Buildings, bridges, props and scene assembly | `dist/world.js` and `dist/environment-design.js` |
| Trees, leaf cards, water and fountains | `dist/nature.js` |
| World names/theme mapping; gameplay layout generation | `dist/map-catalogue.js`; `dist/core.js` |
| Texture loading and material settings | `loadMaterials()`, `loadPBR()` and `mat()` in `dist/world.js` |
| Menus, artwork placement and interface styling | `dist/index.html` and `dist/style.css` |
| Music/effect filenames and sound layering | `dist/sound-pack.js`, `dist/game-audio.js`, `dist/spatial-audio.js` |
| Existing concept/material prompts | `design/` |

## Artwork and textures

All paths below are relative to `dist/assets/`. Keeping the existing filename and format is the quickest way to try a replacement. If you rename a file or change its extension, update its code references too.

| Asset | Current file and dimensions |
| --- | --- |
| Active potato skin | `potato-skin-albedo-realistic.png` — 1254 × 1254 |
| Brick | `dutch-brick-color.png` — 1254 × 1254 |
| Stone/fallback cobblestone | `dutch-cobblestone-color.png` — 1254 × 1254 |
| Leaves with transparency | `oak-foliage-v10.png` — 1254 × 1254 RGBA |
| Main playable paving | `cobblestone_floor_08_diff_2k.jpg`, `cobblestone_floor_08_nor_gl_2k.jpg`, `cobblestone_floor_08_rough_2k.jpg` — 2048 × 2048 each |
| Wood and clogs | `oak_veneer_02_diff_1k.jpg`, `oak_veneer_02_nor_gl_1k.jpg`, `oak_veneer_02_rough_1k.jpg` — 1024 × 1024 each |
| Current menu/key artwork | `potatoman-key-art-crowned-v13.png` — 1672 × 941 |
| Menu/loading wordmark | `potatoman-wordmark-3d.png` — 2079 × 756 RGBA |
| Character/environment reference board | `potatoman-concept-board.png` — 1672 × 941 |
| Earlier reference assets | `potatoman-key-art.png` — 1672 × 941; `potato-skin-color.png` — 1254 × 1254 |

Retain PNG transparency for the wordmark and leaves. Material images should tile cleanly. The existing PBR loader expects separate diffuse, OpenGL normal and roughness JPGs; diffuse uses sRGB, while normal and roughness are data maps. Keep a layered master in your image editor and export PNG/JPG copies for the game. The included art is flattened imagery; layered Photoshop/Krita masters are not included.

## Editing models in Blender

The playable characters, clogs, weapons and worlds are constructed procedurally by Three.js code at runtime. **There are no Blender, FBX, OBJ, GLB or glTF model source files in this package**, and the concept board is a visual reference rather than a rigged model.

For the current assets, edit the JavaScript geometry and poses above. For a new Blender workflow, keep `.blend` authoring files and export `.glb` for game integration. That integration is additional work: this build has no model loader, its character animation uses a custom code rig, and its Node server's file-type list does not yet serve GLB/glTF. A new model must be wired into the scene, materials, animation, hand/muzzle sockets and collision dimensions; copying a GLB into the folder alone will not replace a character.

## Audio and credits

`dist/assets/audio/arena-funk.mp3` is the arena music; `hunt-electro.mp3` is hunt music. The other 21 MP3s are effects. For direct swaps, preserve the MP3 names. Keep WAV masters for editing, export looping MP3 music, and use mono effects for positional playback. The shipped effects are mono 32 kHz MP3; music was normalized to −18 LUFS. Update the audio credits/manifest when replacing assets. Manifest references to original OGG files describe provenance; the bundled playable copies are MP3.

No recorded voice pack is included. The build only uses installed Rishi/Moira system voices; `dist/assets/voices/manifest.json` is empty, and dropping recordings there will not activate them.

Preserve the accompanying notices when retaining these assets:

- `dist/assets/PBR-CREDITS.txt`: Poly Haven cobblestone and oak maps, recorded as CC0.
- `dist/assets/audio/AUDIO-CREDITS.txt`: Kevin MacLeod music, recorded as CC BY 4.0; Kenney and rubberduck effects, recorded as CC0. Retain the music attribution in the game's settings/credits.
- `dist/assets/audio/kenney-impact-license.txt` and `kenney-rpg-license.txt`: bundled source-pack notices.
- `dist/assets/THREE-LICENSE.txt`: vendored Three.js MIT notice.

After model or animation changes, `npm test` runs the regression suite. Check the result in an actual WebGL browser as well; the tests do not establish visual quality or device frame rate.

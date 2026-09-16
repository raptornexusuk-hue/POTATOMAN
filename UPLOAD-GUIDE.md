# Uploading POTATOMAN to your domain

The domain name points visitors to your web host. What you upload depends on what that host can run.

## Option A — plain web hosting (IONOS webspace): the whole game, solo and local

Run `npm run build:web`, then upload the **contents of `build/web/`** to the web root for your
domain (on IONOS that is usually the folder the domain is assigned to, often `/` or
`public_html/`). Keep `index.html`, the `.js` files, `style.css` and the `assets/` folder together,
with `assets/` as a subfolder. Enable SSL for the domain and open it over HTTPS.

This gives you the complete game: every world, every mode, solo against bots and local two-player
split-screen on one device. There is no build step to run on the server and no Node runtime
needed — the browser loads the game as ES modules straight from the files you uploaded.

What plain hosting cannot do is run the small API the game uses for **online rooms** and for
**shared high scores across devices**. The game detects that on its own the first time it tries:
it asks for your name as usual, keeps that player and your best scores in the browser on that
device, says so plainly, and carries on. Nothing is blocked and nothing errors.

`build/web/.htaccess` is included for Apache-based hosting like IONOS webspace. It sets the media
types for `.js` and `.mp3`, enables compression, caches images and audio for a day and revalidates
the code on every load, so a re-upload reaches visitors immediately. Delete it if your host is not
Apache.

## Option B — Node hosting: adds online rooms and shared leaderboards

Your host needs a Node.js application service supporting **Node 22.13 or newer**, an HTTPS domain and a **persistent writable disk**. Ordinary PHP-only or static-only hosting cannot run this server.

1. Extract the source ZIP into the host's application directory, outside any public static folder. Keep `dist/`, `server/`, `drizzle/` and `package.json` in their existing structure. The included Node server publishes only the game assets from `dist/`.
2. Choose this extracted directory as the application's working directory.
3. Use `npm start` as the start command. The underlying entry point is `server/node.mjs`; no third-party runtime dependencies or frontend build are needed for this Node deployment.
4. Set `POTATOMAN_PUBLIC_ORIGIN` to your actual HTTPS origin, such as `https://play.yourdomain.com` (with your own domain, without a trailing path).
5. Set `POTATOMAN_DATA_DIR` to a persistent writable directory outside `dist/`, using an absolute path. The server creates `rooms.sqlite` there and applies the included database migrations automatically. Back up this directory; replacing application files must not delete it.
6. Use the host's assigned `PORT` if required; otherwise the server listens on port 3000. Route your HTTPS domain to this Node application, including `/api/*` requests. Hostnames must be served at the domain or subdomain root for this package.
7. Keep one application instance running. This SQLite adapter is not configured for multiple independent replicas. Start a room on one device, join from another and verify a saved player score before opening it to others.

Where a host asks for an installation command, `npm ci` is compatible with the supplied lockfile, but the Node runtime itself does not require the development dependencies. A host offering only a file manager/FTP upload, with no Node application or persistent storage, needs a different deployment route.

## IONOS specifically

- **IONOS Web Hosting / webspace** runs Option A. Upload `build/web/` contents via SFTP or the
  Webspace Explorer, point the domain at that folder and switch SSL on. This is the route to use
  unless you specifically need online rooms.
- **IONOS Deploy Now** serves static sites and PHP. It does not provide a Node runtime for the
  server in Option B; selecting a Node build template does not add one. Use it for Option A only.
- **Online rooms and shared leaderboards need Option B**, which means a plan that runs a Node 22.13+
  process and keeps a writable disk between deploys — an IONOS VPS or Cloud Server, or another Node
  application host. A webspace-only plan cannot run it, whatever the control panel offers.

Check which plan you have before uploading: if the panel offers only FTP/file management and PHP
settings, it is Option A.


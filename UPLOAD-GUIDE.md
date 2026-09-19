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

You do not have to choose between the two. The game can stay on plain hosting and call a room and
score server running somewhere else — see **Option C** below.

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
5. To rank scores, the server has to be able to confirm email addresses, and sending mail is the one
   thing it does not do itself. Set `POTATOMAN_MAIL_URL` to an endpoint that will send a message for
   you, and `POTATOMAN_MAIL_TOKEN` if that endpoint wants a bearer token. The server POSTs it JSON:

   ```json
   {"to":"player@example.com","name":"MACCA","link":"https://…/?confirm=…","subject":"…","text":"…"}
   ```

   Anything that can turn that into an email will do — a Mailgun or Postmark endpoint, a small
   script of your own, or an automation service. Without it the server refuses to take email
   addresses at all and says so, rather than pretending an address was confirmed; players can still
   name themselves and play, their scores are still saved, and nobody is ranked.
6. To let a copy of the game hosted elsewhere use this server, set `POTATOMAN_ALLOWED_ORIGINS` to
   that site's address (comma-separated for several). Leave it unset when the server also serves the
   game.
7. Set `POTATOMAN_DATA_DIR` to a persistent writable directory outside `dist/`, using an absolute path. The server creates `rooms.sqlite` there and applies the included database migrations automatically. Back up this directory; replacing application files must not delete it.
8. Use the host's assigned `PORT` if required; otherwise the server listens on port 3000. Route your HTTPS domain to this Node application, including `/api/*` requests. Hostnames must be served at the domain or subdomain root for this package.
9. Keep one application instance running. This SQLite adapter is not configured for multiple independent replicas. Start a room on one device, join from another and verify a saved player score before opening it to others.

Where a host asks for an installation command, `npm ci` is compatible with the supplied lockfile, but the Node runtime itself does not require the development dependencies. A host offering only a file manager/FTP upload, with no Node application or persistent storage, needs a different deployment route.

## Option C — plain hosting for the game, a small Node host for rooms and scores

Everybody's scores are remembered in one place, and online rooms work, while the game itself stays
on the webspace you already have. The service is the same Node server as Option B; it just does not
have to serve the game files.

1. Deploy Option B somewhere that runs Node 22.13+ with a persistent disk — an IONOS VPS or Cloud
   Server, or any Node application host. Give it its own HTTPS address, such as
   `https://rooms.yourdomain.com`.
2. On that host, set `POTATOMAN_ALLOWED_ORIGINS` to the address the game is served from, exactly as
   a browser writes it and with no trailing slash — for example `https://potatoman.co.uk`. Several
   are allowed, separated by commas. Without this the service refuses requests from other sites,
   which is what stops anyone else's page driving your rooms.
3. In the uploaded game, edit `config.js` and uncomment the last line, pointing it at that address:
   `window.POTATOMAN_API='https://rooms.yourdomain.com';`
4. Reload the game over HTTPS. Both addresses must be HTTPS, or the browser blocks the request.

If the service is unreachable or the origin is not allowed, the game says so and falls back to
keeping scores on the device — it never breaks the round you are playing.

## IONOS specifically

- **IONOS Web Hosting / webspace** runs Option A. Upload `build/web/` contents via SFTP or the
  Webspace Explorer, point the domain at that folder and switch SSL on. This is the route to use
  unless you specifically need online rooms.
- **IONOS Deploy Now** serves static sites and PHP. It does not provide a Node runtime for the
  server in Option B; selecting a Node build template does not add one. Use it for Option A only.
- **Online rooms and shared leaderboards need a Node 22.13+ process** with a writable disk that
  survives deploys — an IONOS VPS or Cloud Server, or another Node application host. A webspace-only
  plan cannot run it, whatever the control panel offers. Either move the whole game there (Option B)
  or keep it on the webspace and point it at that host (Option C).

Check which plan you have before uploading: if the panel offers only FTP/file management and PHP
settings, it is Option A.


# Uploading POTATOMAN to your domain

The domain name points visitors to your web host. What you upload depends on what that host can run.

## Standard file upload: solo and local play

For a basic static website, upload the **contents of `dist/`** from this source ZIP to the domain's public web folder (often `public_html/`). Keep `index.html`, the JavaScript files, `style.css` and `assets/` together. Open the domain through HTTPS.

This runs solo games and local split-screen. Online rooms, durable player profiles and shared leaderboards need the server below; they will not work with static files alone. Do not upload the entire source ZIP into the public web folder.

## Complete game: multiplayer, profiles and leaderboards

Your host needs a Node.js application service supporting **Node 22.13 or newer**, an HTTPS domain and a **persistent writable disk**. Ordinary PHP-only or static-only hosting cannot run this server.

1. Extract the source ZIP into the host's application directory, outside any public static folder. Keep `dist/`, `server/`, `drizzle/` and `package.json` in their existing structure. The included Node server publishes only the game assets from `dist/`.
2. Choose this extracted directory as the application's working directory.
3. Use `npm start` as the start command. The underlying entry point is `server/node.mjs`; no third-party runtime dependencies or frontend build are needed for this Node deployment.
4. Set `POTATOMAN_PUBLIC_ORIGIN` to your actual HTTPS origin, such as `https://play.yourdomain.com` (with your own domain, without a trailing path).
5. Set `POTATOMAN_DATA_DIR` to a persistent writable directory outside `dist/`, using an absolute path. The server creates `rooms.sqlite` there and applies the included database migrations automatically. Back up this directory; replacing application files must not delete it.
6. Use the host's assigned `PORT` if required; otherwise the server listens on port 3000. Route your HTTPS domain to this Node application, including `/api/*` requests. Hostnames must be served at the domain or subdomain root for this package.
7. Keep one application instance running. This SQLite adapter is not configured for multiple independent replicas. Start a room on one device, join from another and verify a saved player score before opening it to others.

Where a host asks for an installation command, `npm ci` is compatible with the supplied lockfile, but the Node runtime itself does not require the development dependencies. A host offering only a file manager/FTP upload, with no Node application or persistent storage, needs a different deployment route.

## Existing hosted game

The ChatGPT Sites version already runs its server and database. It currently has private access; an online room invite does not grant access to the website itself. Attaching a custom domain and changing who can visit are separate hosting settings.

Exact control-panel steps depend on your hosting provider and plan. Check that they support the Node runtime and persistent storage above before uploading the complete application.

## IONOS and potatoman.co.uk

The supplied `my.ionos.co.uk/connect-domain/...` link is an account domain-connection page. It does not identify the hosting plan, and account details were not accessible here.

- If you have IONOS Web Hosting with webspace, upload `dist/` contents into the folder assigned to `potatoman.co.uk`, retaining the `assets/` subfolder. Use SFTP or Webspace Explorer, connect the domain to that folder and enable SSL. This gives you solo/local play with the current package.
- IONOS Deploy Now supports static sites and PHP applications but does not provide a Node.js runtime for this game's included server. Selecting a Node build template does not add server runtime support.
- The complete current game needs hosting that runs the Node server and preserves its SQLite database, such as a suitably configured VPS or another Node application host. The exact IONOS package needs confirming before providing control-panel/server setup steps.

IONOS references: [Webspace management](https://www.ionos.co.uk/help/hosting/managing-webspace/), [Deploy Now runtime support](https://docs.ionos.space/docs/faq/#does-ionos-deploy-now-support-nodejs).

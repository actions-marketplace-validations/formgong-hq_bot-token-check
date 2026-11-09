# bot-token-check

Fails your build when a Telegram bot token or a Discord webhook URL ends up in the files you are about to deploy.

A contact form that sends messages to Telegram or Discord needs a secret. If that secret is in the page or in the JavaScript bundle, every visitor can copy it. With a Telegram bot token they control the bot. With a Discord webhook URL they can post to your channel, rename the webhook or delete it, no login needed.

It happens more often than you'd think. In November 2026 we read the first 200 HTML files on GitHub that call `api.telegram.org/bot…/sendMessage`, and 155 of them had a token-shaped string in them. In a Vite or Lovable project, `VITE_TELEGRAM_BOT_TOKEN` in `.env` is copied into the public bundle at build time. Next.js does the same with `NEXT_PUBLIC_`. Your `.env` stays out of git and the token ships anyway.

This check reads the build output, which is exactly what the browser will download, whatever framework produced it.

## Use it

**GitHub Actions**, after your build step:

```yaml
- run: npm run build
- uses: formgong-hq/bot-token-check@v1
  with:
    path: dist   # build, out, .next/static, public …
```

**In `package.json`**, so it runs on every build, locally and on Vercel, Netlify or Cloudflare Pages:

```json
"scripts": {
  "build": "vite build && npx -y github:formgong-hq/bot-token-check dist"
}
```

**Once, by hand:**

```sh
npx -y github:formgong-hq/bot-token-check dist
```

Point it at the folder you upload. For Next.js that is `.next/static`. For a plain HTML site, the site folder.

## What it does

- Walks the folder and reads every `.js`, `.mjs`, `.cjs`, `.html`, `.css`, `.json`, `.map`, `.txt`, `.xml` and `.svg` file.
- Looks for the shape of a Telegram bot token (8–10 digits, `:AA`, ~35 more characters) and of a full Discord webhook URL.
- Exits with `1` if it finds one and prints only the first 14 characters, so the secret doesn't land in your CI log.
- Exits with `2` if the folder doesn't exist or holds no text files. A check that read nothing would pass on anything, so that counts as a wrong path, not a pass.
- No dependencies. Node 18 or newer.

It searches for the token's shape, not for the API URL. When we counted, GitHub's search snippets showed a token in only 10 of those 200 files, because the matching line is ``fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`)`` and the token sits in a `const` a few lines above it. Grepping for the URL followed by digits misses the most common way people write it.

## What it doesn't do

It won't catch a token that has been split up, encoded or fetched at run time, and it only knows Telegram and Discord. For scanning a whole repository and its history for every kind of secret, use a general scanner like gitleaks or TruffleHog. This one is for the narrower question of what your visitors can download.

## If it fires

Treat the secret as public, because it already was on your last deploy. Deleting the line and redeploying doesn't help: anyone who loaded the old bundle has it.

- **Telegram:** open @BotFather, send `/revoke`, pick the bot, then put the new token somewhere only the server can read.
- **Discord:** delete the webhook in Server Settings → Integrations → Webhooks and create a new one.

Then send the form through something that runs on a server: an API route, an edge function or a Worker, with the secret in that platform's environment settings and no `VITE_` or `NEXT_PUBLIC_` prefix.

## Tests

`node --test test/check.test.mjs` builds fake sites at run time and checks four cases: a token in a `const` (fails), a Discord webhook (fails), a form posting to `/api/contact` (passes), and a placeholder like `botYOUR_BOT_TOKEN` (passes). Wrong or empty folders exit with `2`. CI also runs the action itself on a leaky build and a clean one and requires the leaky one to fail.

## Who made this

[Formgong](https://formgong.com/en/blog/website-form-to-telegram/?ref=github), a form backend. We wrote it while counting leaked tokens for an article, and kept it because we needed it ourselves. You don't need Formgong to use it.

Did it find something in your project? We'd like to know how the token got there: a tutorial, an AI answer, or a `VITE_` added to fix an `undefined`. Open an issue and tell us.

## License

MIT

# slack-moth-bot
Random user picker for Slack

### Motivation
1. Slack's multi-line RNG seemed biased.
2. Not enough customizability.

### Features
1. It doesn't pick the person who called the command.
2. Automatically detects the pool to use depending on the channel it's been called from.
3. Manages pool/aliases in memory. No DB required.

### Setup
1. Create a new app under your Slack account.
2. Go to `Features` -> `OAuth & Permissions` -> `Scopes`. Add `commands` and `users:read` as token scopes.
3. Copy the Bot User OAuth Access Token above. This token needs to be provided to wherever you deploy this app under `process.env.TOKEN`.
4. Deploy the app. Copy the public url, and put it into `Features` -> `Slash Commands` -> `Create New Command` -> `Request URL`. You can set whatever command you'd like.

### In the future
1. Maybe add a `pause` feature to temporarily remove someone from the pool for a set amount of time.
2. Better channel id handling.
3. More robust alias removal handling.

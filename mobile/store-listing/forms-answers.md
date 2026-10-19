# Play Console forms: prepared answers for the app as built

These answers are true for the app **as built now: parent accounts on your Railway server (`LQ_API_BASE` set), no ads, no purchases, no analytics**.
If you leave `LQ_API_BASE` empty the app is offline-only and the Data safety answers would be "nothing collected" instead. If you later add ads, purchases or analytics, the answers and the privacy policy must change first.
I (the assistant) cannot submit these forms for you and cannot promise how Google rates or reviews the app. Read each question and answer truthfully for your own build.

## Main store listing
* App or game: **Game** (category *Educational*) or **App** (category *Education*). For a learning game for children, **Education** is the natural fit.
* Free or paid: **Free** (cannot be changed to paid later for the same app).
* Contact email (shown publicly): `chavansir12@gmail.com`. Developer name: Yogesh Chavan.
* Privacy policy URL: `https://YOUR-RAILWAY-DOMAIN/privacy.html` (the page is part of the server).

## App content
| Form | Suggested answer |
|---|---|
| Privacy policy | URL of the published page |
| App access | **"All or some functionality is restricted"** (accounts). Give reviewers a ready test parent account: create one yourself (email + password + one child profile with PIN) and type the steps: "Open app, play 3 free runs, tap Parents, log in with ..., child PIN ...". Without this Google rejects the app. |
| Ads | **No, my app does not contain ads** |
| Content rating (IARC) | Category: *Reference, news or educational* (or *Game*). Violence: none. Blood: none. Sexual content: none. Language: none. Controlled substances: none. Gambling: none. Users can interact / share location / purchase: **No**. Fear: the cartoon teacher who "catches" the runner is friendly and asks a question; answer honestly if asked about scary or threatening content. |
| Target audience | Age groups **6-8** and **9-12** (the game is for Grades 1-3). Do not tick "5 and under" (too young for the reading). Selecting children means the **Families Policy** applies. |
| Appeals to children | Yes |
| News app | No |
| Government app | No |
| Health apps | No health features |
| Financial features | None |
| Advertising ID | **No** (the app does not use it). Declare "No" in the advertising ID form |
| Data safety | See the table below. Data encrypted in transit: **Yes**. Users can request deletion: **Yes**, deletion link `https://YOUR-RAILWAY-DOMAIN/delete-account.html` (also inside the app: Parents -> Privacy and account). |
| Account deletion (Data safety section) | In-app path + web URL above. Both exist in this build. |

### Data safety: what to tick
Shared with third parties: **No** for everything (Railway only hosts it, as a service provider; Google does not count that as sharing). Optional or required: required for the account. Purpose: *App functionality*, *Account management*.
* **Personal info -> Name** (parent name, child name/nickname), **Email address** (parent), **User IDs** (account ids) : collected
* **App activity -> App interactions** (answers, runs, points, coins) : collected
* **Personal info -> Other info** (child age, class): collected
* **Credentials?** Google has no password category; "Personal info" covers it. Passwords/PINs are stored only as hashes.
* Not collected: location, contacts, photos, audio, files, financial info, health, web browsing, device or advertising IDs, crash logs.

## Families Policy: what the app does (facts to rely on)
* No ads, no ad SDKs, no analytics SDKs, no social features, no external links in the game, no in-app purchases.
* Permissions: INTERNET (to reach the LearnQuest server for sign-in and progress), VIBRATE (feedback on a hit), WAKE_LOCK (screen stays on during a run). No camera, microphone, location, contacts, storage, phone or advertising-ID permission.
* A parent creates the account (name, email, password); the child profile has a name or nickname, age, class, language, avatar and PIN. Without an account (first 3 free runs) everything stays on the device. We recommend a nickname for the child.
* Text-to-speech reading of questions uses the phone's own speech engine.
* The app talks only to your own server and does not request any third-party website while playing (Google Fonts and CDN fallbacks are removed from the app copy by `mobile/scripts/sync-web.mjs`).

## Testing track (new personal accounts)
12 testers, 14 days in a row, then "Apply for production". Plan: invite family and friends with Android phones, ask them to open the app at least once and keep it installed.

## After approval
Keep the same Play listing; each update: GitHub Actions -> Build Android app -> upload the new `.aab` to Production.

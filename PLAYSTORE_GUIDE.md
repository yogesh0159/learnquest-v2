# LearnQuest on Google Play: step by step

What is ready in this project: a **Capacitor 8 Android app** (`mobile/android`) that targets **Android 16 / API 36** (Google Play's rule for new apps from 31 Aug 2026), builds on **GitHub's servers** (no Android Studio needed) and produces the **.aab** file Play wants.
What only you can do: your Google Play developer account, the upload key secrets, the store forms (they are tied to your identity), and testing on real phones.

---------------------------------------------------------------------------------------------------

## 0. Server first (Railway)
Do `RAILWAY_SETUP.md` before everything else: you get an address like `https://xxx.up.railway.app`. The Android app, the privacy page and the account-delete page all live there.

## 1. Put the update on GitHub
Double-click `UPDATE_GITHUB.bat` (same as before). It adds `mobile/` (Android project), `.github/workflows/android.yml` and the guide.

## 2. Upload key: four secrets (one time, 3 minutes)
You were given a private folder `android-keys/` (`upload.jks`, `upload.jks.base64.txt`, `KEY_DETAILS.txt`). **Never put it on GitHub or share it.**
GitHub -> your repository -> **Settings -> Secrets and variables -> Actions -> New repository secret**, four times:

| Name | Value |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | the whole one-line text from `upload.jks.base64.txt` |
| `ANDROID_KEYSTORE_PASSWORD` | from `KEY_DETAILS.txt` |
| `ANDROID_KEY_ALIAS` | `learnquest-upload` |
| `ANDROID_KEY_PASSWORD` | from `KEY_DETAILS.txt` |

Keep two copies of `android-keys/` (Google Drive + pen drive). This is only the **upload** key: Google keeps the real signing key (Play App Signing).

Also needed: same page -> **Variables** tab -> **New variable** `LQ_API_BASE` = your Railway address (for example `https://xxx.up.railway.app`, no slash at the end). If it stays empty the app is offline-only without accounts.

## 3. Build the app
GitHub -> **Actions** -> **Build Android app** -> **Run workflow** (about 8-12 minutes).
When it is green, open the run and download **`LearnQuest-android`** at the bottom ("Artifacts"). Inside:
* `LearnQuest-release.aab` -> this is what you upload to Google Play
* `LearnQuest-release.apk` -> the same signed build as an APK, install it on a phone to try it
* `LearnQuest-test.apk` -> debug build, also installable
* `CHECK.txt` -> proof printed by the build: package name `com.learnquest.junglerun`, **targetSdkVersion 36**

The build **fails on purpose** if the app does not target API 36. Every run raises the version code by itself (Play needs a bigger number for every upload).

**Install on a phone (to test):** copy the `.apk` to the phone (WhatsApp to yourself / USB / Drive), open it, allow "install unknown apps" for that one app, install. Test on a real phone **before** uploading: sound, touch, the Ready! button, the teacher, rotate the phone, press the back button, switch to Hindi.

## 4. Google Play Console
1. https://play.google.com/console -> create a **developer account**: one-time fee (US$ 25), identity verification, phone and email. Choose **Personal** (or Organization, which needs a D-U-N-S number).
2. **Rule for new personal accounts (created after 13 Nov 2023):** before you can publish to everyone you must run a **closed test with at least 12 testers who stay opted in for 14 days in a row**, then apply for "production access". Start this early: collect 12 friends / relatives with Android phones and their Google emails.
3. **Create app**: name, default language, **App** (not a game? The game category is **Educational / Casual**; pick *Game* if you want it listed as a game), **Free**, accept the declarations.
4. **App content** (left menu) -> answer, using `mobile/store-listing/forms-answers.md` (all answers are prepared there):
   * Privacy policy URL: `https://YOUR-RAILWAY-DOMAIN/privacy.html`
   * App access: login is needed after 3 free runs -> choose "restricted" and give the reviewers a test parent email + password + child PIN (make the account yourself first)
   * Ads: **No**
   * Content rating questionnaire (IARC)
   * **Target audience and content**: age groups, children included -> Google **Families Policy** applies (we follow it: no ads, no tracking, no analytics, no external links in the game, the parent creates the account)
   * Data safety form: collects name, email, user id, app activity, child age/class; encrypted in transit; deletion supported with the link `https://YOUR-RAILWAY-DOMAIN/delete-account.html`; nothing shared (exact ticks are in `forms-answers.md`)
   * Government / news / health apps: No
5. **Store listing**: texts in `mobile/store-listing/listing-en.md` (+ Hindi, Marathi), graphics in `mobile/store-listing/graphics/` (icon 512x512, feature graphic 1024x500, screenshots).
6. **Testing -> Closed testing -> Create track -> Create new release** -> upload `LearnQuest-release.aab` -> add the 12+ testers (email list) -> send the opt-in link to them. Wait 14 days, then **Apply for production**.
7. **Production -> Create release** -> upload the **same or newer** `.aab` -> send for review (usually 1-7 days; for kids apps it can be longer).

## 5. Updates later
Change the game -> push to GitHub -> **Run workflow** again -> upload the new `.aab` (version code rises automatically) to Production.

## 6. Things to know before you submit
* **The package name `com.learnquest.junglerun` is permanent** once the app is created in Play. It is already in the code; change it now (in `mobile/capacitor.config.json`, `mobile/android/app/build.gradle`, the Java folder name and `test-platforms.mjs`) only if you want a different one.
* **Name "LearnQuest":** a company with a similar name exists. If Google or that company objects, the listing can be suspended. Consider a more distinctive public name, for example "LearnQuest Jungle Run Kids" or a new brand.
* **Accounts / server:** this build has parent accounts on your Railway server. Account deletion exists in the app (Parents -> Privacy and account) and on the web (`/delete-account.html`), as Google requires. Tell parents to use a **nickname** for the child, not the full name.
* **Your email and name** (`chavansir12@gmail.com`, Yogesh Chavan) are written in the privacy page. The date at its top is 19 Oct 2026; update it if you change the policy.
* **What was not tested here:** the live Railway deployment and MySQL (tested locally with the same server code on SQLite), the .aab build itself (this environment cannot download the Android SDK; GitHub does it), real phones and tablets, Play's review. The GitHub run's `CHECK.txt` and your own phone test are the proof.

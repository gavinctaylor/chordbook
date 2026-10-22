# Chordbook

Static, offline-capable chord viewer. Each visitor connects their own Google Sheet or imports a CSV. No personal song library is bundled.

## GitHub Pages

Upload this folder's contents to the root of a public repository named chordbook. In Settings → Pages, choose Deploy from a branch, main, / (root). Enable HTTPS. No build or server is needed. Do not upload the parent work folder or the old Sites repository.

## Google setup before public launch

The included google-config.js is intentionally blank pending public-site configuration. These are browser-visible identifiers, not an OAuth client secret. Restrict the key to the final site and Google's Picker origin before sharing.

Once GitHub provides the site address:
- Add its origin (https://YOUR-USERNAME.github.io, without the repository path) to the OAuth client's Authorized JavaScript origins.
- Add https://YOUR-USERNAME.github.io/* and https://docs.google.com/* to API-key website restrictions. Keep the Google Picker API restriction.
- Keep Google Sheets, Drive and Picker APIs enabled.
- Set the Google OAuth audience to External and publish it beyond Testing before inviting arbitrary users. Follow the Google Console's branding/verification requirements. Set the app homepage and privacy-policy URLs to this new site. A real contact email and any domain verification requirements must be completed by the owner.
- The app requests drive.file only. Google can still impose account or organization restrictions.

## Check before sharing

Connect a sheet with Artist, Song, Key, Chords. Confirm the new public app saves it. Reload in airplane mode. Use a separate browser profile to confirm it starts empty. Test Google access with an account that was not on the test-user list.

The original ChatGPT-hosted app is unchanged. Its saved data does not transfer automatically; connect the sheet again at the new address.

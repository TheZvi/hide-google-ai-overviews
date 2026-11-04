# Deploying to a school or organization

These steps are for Google Workspace (including Workspace for Education) admins who manage Chromebooks or Chrome browsers. You set this up once. After that, every managed device auto-updates whenever a new version is released.

| | |
|---|---|
| Extension ID | `hcfbhhjmjpnbacblkloeocoiaaafjbdi` |
| Update URL | `https://thezvi.github.io/hide-google-ai-overviews/updates.xml` |

## 1. Force-install

1. Go to [admin.google.com](https://admin.google.com) → **Devices → Chrome → Apps & extensions → Users & browsers** (or **Kiosks / Managed guest sessions**, as needed).
2. Select the organizational unit, such as Students.
3. Click the yellow **+** → **Add Chrome app or extension by ID**.
4. Enter the extension ID above, choose **From a custom URL**, and paste the update URL.
5. Set the installation policy to **Force install** (optionally **+ pin to browser toolbar**). Save.

Chrome only allows self-hosted extensions on *managed* devices or browsers, which is normal for school Chromebooks. If this extension is also published on the Chrome Web Store, you can force-install that listing instead and skip the custom URL.

## 2. Configure (optional)

In the same panel, select the extension and paste this into **Policy for extensions**:

```json
{
  "hideOverviews":   { "Value": true },
  "hideAiMode":      { "Value": true },
  "forceWebResults": { "Value": false }
}
```

| Setting | Default | Effect |
|---|---|---|
| `hideOverviews` | `true` | Hides the AI Overview box |
| `hideAiMode` | `true` | Hides the AI Mode tab and button, and redirects AI Mode URLs to normal search |
| `forceWebResults` | `false` | Switches every normal search to Google's plain "Web" results (`udm=14`). This is the most robust option, but it also removes maps, knowledge panels, and similar boxes |

Settings set by policy are locked, and students see them greyed out.

## 3. Pair with Google's own controls (recommended)

The extension works at the browser level. You may also want to:
- Check your Workspace admin settings for Gemini / AI features in Search for your users, since Google keeps adding controls.
- Block `udm=50` (AI Mode) and Gemini sites with your web filter, as a second layer.

## Updates and trust

- New versions come from this repository's `Release` workflow. Every release is built from public source by GitHub Actions and signed with the project's key.
- Chrome checks the update URL every few hours.
- To pin a specific version, download the `.crx` from [Releases](../../../releases), host it yourself, and point to your own `updates.xml`.

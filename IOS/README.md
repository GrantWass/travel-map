# Travel Map iOS

## Quick Start

1. **Use Node 22** (not 23+):

    ```bash
    nvm use 22
    ```

2. **Install dependencies:**

    ```bash
    cd IOS
    npm install
    ```

3. **Start the app:**
    ```bash
    npx expo start
    ```
    Then press `i` to open the iOS Simulator. Might need to install a full IOS platform through XCode settings.

> Make sure the backend is running on port 5001. See the root README for backend setup.

---

## Troubleshooting

**Wrong Node version** — if the server fails to start:

```bash
nvm use 22
```

**Stale cache / bundling errors** — clear and restart:

```bash
npx expo start -c
```

**Full reset** — if nothing else works:

```bash
rm -rf node_modules .expo
npm install
npx expo start -c
```

**Xcode / simulator not found:**

```bash
xcode-select --install
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
```

Then open Xcode and install an iOS Simulator runtime from **Settings > Platforms**.

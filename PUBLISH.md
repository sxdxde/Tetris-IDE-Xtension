# Publishing the Tetris Extension

## 1. Install vsce

```bash
npm install -g @vscode/vsce
```

## 2. Create a publisher account

1. Go to https://marketplace.visualstudio.com/manage
2. Sign in with a Microsoft account
3. Click **Create publisher**
4. Choose a publisher ID (e.g. `yourname`)
5. Replace `your-publisher-name` in `package.json` with that ID

## 3. Create a Personal Access Token (PAT)

1. Go to https://dev.azure.com → your organization → **User settings → Personal access tokens**
2. Click **New Token**
3. Set **Scopes** → **Marketplace** → check **Manage**
4. Copy the token

## 4. Log in with vsce

```bash
vsce login your-publisher-name
# paste the PAT when prompted
```

## 5. Compile and package

```bash
npm install
npm run compile
vsce package
# produces tetris-0.1.0.vsix
```

## 6. Publish

```bash
vsce publish
```

Or publish a specific version:

```bash
vsce publish minor   # bumps to 0.2.0
vsce publish 1.0.0   # explicit version
```

## 7. Install locally for testing (without publishing)

```bash
code --install-extension tetris-0.1.0.vsix
```

## Notes

- The `README.md` is shown on the Marketplace listing — add a screenshot before publishing.
- Run `vsce ls` to verify which files will be bundled (respects `.vscodeignore`).
- The extension activates automatically on startup (`onStartupFinished`) so no manual activation is needed.

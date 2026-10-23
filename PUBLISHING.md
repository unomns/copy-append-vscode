# Publishing

The extension is published as `pineapple-head-lab.copy-append` on both the
VS Code Marketplace and Open VSX. `@vscode/vsce` and `ovsx` are dev dependencies,
so everything below runs through `npx` or the npm scripts.

## 1. Before every release

1. Update `version` in `package.json` (`npm version patch|minor|major --no-git-tag-version`).
2. Move the `[Unreleased]` entries in `CHANGELOG.md` under the new version.
3. Run the checks:

   ```bash
   npm run lint
   npm run test:unit
   npm test
   ```

4. Build the package and check what it contains:

   ```bash
   npm run package         # creates copy-append-<version>.vsix
   npx vsce ls             # lists the files that go into the package
   ```

5. Try it locally: `code --install-extension copy-append-<version>.vsix`.

## 2. VS Code Marketplace (one-time setup)

1. Sign in at <https://marketplace.visualstudio.com/manage>. The `pineapple-head-lab`
   publisher already exists (it's used for Pineapple Head Theme).
2. Create a Personal Access Token in Azure DevOps
   (<https://dev.azure.com> → User settings → Personal access tokens):
   - Organization: **All accessible organizations**
   - Scopes: **Custom defined → Marketplace → Manage**
3. Log in once: `npx vsce login pineapple-head-lab` and paste the token.

## 3. Publish to the VS Code Marketplace

```bash
npm run publish:vsce
# or publish the exact file you tested:
npx vsce publish --packagePath copy-append-<version>.vsix
```

The listing appears at
<https://marketplace.visualstudio.com/items?itemName=pineapple-head-lab.copy-append>
after a few minutes of verification.

## 4. Open VSX (one-time setup)

1. Sign in at <https://open-vsx.org> with GitHub and sign the Publisher Agreement
   (user menu → Settings → Profile).
2. Create an access token (Settings → Access Tokens).
3. Create the namespace if it doesn't exist yet:

   ```bash
   npx ovsx create-namespace pineapple-head-lab -p <OPEN_VSX_TOKEN>
   ```

## 5. Publish to Open VSX

```bash
npx ovsx publish copy-append-<version>.vsix -p <OPEN_VSX_TOKEN>
# or set OVSX_PAT in the environment and run: npm run publish:ovsx -- copy-append-<version>.vsix
```

## 6. After publishing

```bash
git tag v<version>
git push --follow-tags
```

Optionally attach the `.vsix` file to a GitHub release.

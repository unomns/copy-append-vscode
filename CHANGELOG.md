# Changelog

All notable changes to this extension are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-24

### Added

- **Copy Append** command: appends the selection (or the current line) to the clipboard. Supports multiple cursors.
- **Copy Append: Clear** command: empties the clipboard and resets the counter.
- **Copy Append: Paste and Clear** command: pastes the collection, then clears it (`Ctrl+Shift+Alt+V` / `Ctrl+Cmd+V`).
- **Copy Append: Show Collected Text** command: previews the collected parts, with Clear and Open in Editor actions.
- Status bar counter and a short "Appended (n parts)" message after each append.
- Reset detection: a normal copy starts a new collection.
- Settings: `copyAppend.separator`, `copyAppend.addFileHeader`, `copyAppend.showStatusBar`.
- Default shortcuts: `Ctrl+Alt+C` / `Ctrl+Shift+Alt+C` / `Ctrl+Shift+Alt+V` (Windows/Linux), `Ctrl+Cmd+C` / `Ctrl+Shift+Cmd+C` / `Ctrl+Cmd+V` (macOS).

[Unreleased]: https://github.com/unomns/copy-append-vscode/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/unomns/copy-append-vscode/releases/tag/v0.1.0

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ShadowGit is a VS Code extension that provides a virtual git layer, allowing users to track changes, approve/disapprove diffs, and create checkpoints without affecting the actual git repository.

### Core Components:

1. **ShadowGit Core** (`src/shadowGit.js`) - JavaScript class for virtual tracking of file changes
2. **VS Code Extension** (`src/extension.js`) - Interface between VS Code and ShadowGit core
3. **Custom Diff UI** (`src/diffProvider.js`) - Enhanced visualization with approve/disapprove icons
4. **Shadow Git View** (`src/shadowGitView.js`) - A sidebar to manage tracked files and checkpoints

## Development Commands

### Building the Extension

```bash
# Set up project
npm install

# Compile the extension
npm run compile

# Watch for changes
npm run watch 

# Package the extension for deployment
npm run package
```

### Testing

```bash
# Run tests
npm test
```

### Debugging

Use VS Code's built-in debugger with the configurations defined in `.vscode/launch.json`:
- **Extension**: Launches a new VS Code window with the extension loaded
- **Extension Tests**: Runs the extension tests

## Architecture Details

The ShadowGit system operates using these key mechanisms:

1. **Snapshots**: 
   - Base state of files stored in `.vscode/.shadowgit/snapshots`
   - Used as reference points for detecting changes

2. **Change Detection**: 
   - Compares current file content with snapshots
   - Identifies additions, modifications, and deletions
   - Changes are stored in `.vscode/.shadowgit/changes`

3. **Change Approval System**:
   - UI decorations for approving/disapproving specific changes
   - Changes can be selectively included in checkpoints

4. **Checkpoints**:
   - Virtual commits containing approved changes
   - Stored in `.vscode/.shadowgit/checkpoints`
   - Can be applied to actual files

5. **Source Control Integration**:
   - Registers as a VS Code SCM provider
   - Provides familiar git-like workflow

6. **WebView UI**:
   - Custom sidebar for managing tracked files and checkpoints
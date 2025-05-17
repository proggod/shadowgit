# Shadow Git - VS Code Extension

## Overview

Shadow Git is a virtual layer that mimics git functionality but operates independently from your actual git repository. This system provides:

1. **Track changes without affecting git history** - Make checkpoints without actual commits
2. **Selective change approval** - Approve/disapprove individual diff chunks with custom UI
3. **Dual tracking systems** - Use one system for checkpoints and another for selective approvals

## Core Components

- **ShadowGit Core** - Manages virtual tracking of files and changes
- **Custom Diff UI** - Enhanced visualization with approve/disapprove icons
- **Shadow Git Panel** - Interactive webview to manage tracked files and checkpoints
- **SCM Integration** - Works with VS Code's Source Control interface
- **Timeline Integration** - Shows checkpoints in VS Code's timeline view

## Basic Usage

### Commands

- `Shadow Git: Take Main Snapshot` - Create a snapshot in the main shadow git system
- `Shadow Git: Take Working Snapshot` - Create a snapshot in the working shadow git system
- `Shadow Git: Open Shadow Diff` - Compare current file with its snapshot
- `Shadow Git: Approve Change` - Approve a specific change in the diff view
- `Shadow Git: Disapprove Change` - Disapprove a specific change in the diff view
- `Shadow Git: Create Checkpoint` - Create a checkpoint with current changes
- `Shadow Git: Apply Checkpoint` - Apply a selected checkpoint's changes
- `Shadow Git: Open Panel` - Open the interactive Shadow Git panel

### Workflow

1. Take a snapshot of files you're working on (main or working system)
2. Make changes to your code
3. Use Shadow Diff to see what's changed
4. Approve or disapprove specific changes using the gutter icons or hover buttons
5. Create checkpoints to save your current changes
6. Apply checkpoints when needed
7. Use the Shadow Git Panel for a comprehensive view of all tracked files and checkpoints

## Advanced Features

### SCM Integration

The Shadow Git system integrates with VS Code's Source Control Management:

- Files with changes appear in the Source Control view
- Changes can be viewed and managed from the SCM interface
- Checkpoints can be created from the SCM input box

### Custom UI Components

- **Diff Decorations** - Green (approved/additions), Red (disapproved/deletions), Blue (modifications) highlights
- **Gutter Icons** - Approve and disapprove buttons directly in the editor
- **Hover Actions** - Additional options when hovering over changes
- **Shadow Git Panel** - Interactive webview with tabbed interface for managing both shadow git systems

### Using Dual Shadow Git Systems

For complex projects, you can use two Shadow Git systems:

1. **Main System** (.vscode/.shadowgit-main)
   - Used for regular checkpoints of your work
   - Create formal checkpoints at logical stopping points
   - Access via the "Main" tab in the Shadow Git Panel

2. **Working System** (.vscode/.shadowgit-working)
   - Used for fine-grained change tracking
   - Approve/disapprove individual changes
   - Test experimental changes before committing
   - Access via the "Working" tab in the Shadow Git Panel

### Shadow Git Panel

The interactive panel provides a comprehensive interface for managing both shadow git systems:

1. **Tabs**: Switch between Main and Working shadow git systems
2. **Files Section**: Lists all tracked files with options to:
   - View file
   - Compare with previous version
   - See change status
3. **Checkpoints Section**: Lists all checkpoints with options to:
   - Restore checkpoint
   - Compare with current version
   - Delete checkpoint
4. **Action Buttons**: Quick access to common operations:
   - Take snapshot
   - Create checkpoint
   - Refresh view

### Timeline Integration

Shadow Git checkpoints appear in VS Code's timeline view:

- Access checkpoint history directly from the Timeline panel
- Hover over checkpoints to see details and available actions
- Jump to specific points in your development history

## Configuration

Configure Shadow Git through VS Code settings:

- **shadowGit.autoSnapshot**: Enable automatic snapshots when files are opened
- **shadowGit.customIconsInDiff**: Use custom icons in diff view
- **shadowGit.showCheckpointsInTimeline**: Show checkpoints in timeline view
- **shadowGit.colorCodedDecorations**: Use color-coded highlights for different types of changes

## Tips and Best Practices

1. Take snapshots frequently to ensure accurate change tracking
2. Use descriptive checkpoint messages
3. Review all changes carefully in the diff view
4. Use the approve/disapprove gutter icons to manage changes
5. You can also approve/disapprove changes by hovering over them and using the buttons
6. Use the main system for regular development checkpoints
7. Use the working system when you want to selectively manage changes
8. Create checkpoints before major changes to easily revert if needed
9. Use the timeline view to navigate through your checkpoints chronologically
10. Use separate branches in the real git repository for major changes
11. Consider exporting important checkpoints to the real git repository

## Troubleshooting

If you encounter issues:

- Check VS Code Developer Tools (Help > Toggle Developer Tools)
- Verify that all paths are correct
- Ensure that file permissions allow read/write operations
- Try restarting VS Code if strange behavior occurs
- Ensure both shadow git systems have properly initialized directories
- Check the VS Code output panel for any error messages (View > Output > Shadow Git)
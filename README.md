# Shadow Git for VS Code

A Visual Studio Code extension that provides a virtual git layer for tracking changes, approving/disapproving diffs, and creating checkpoints without affecting the actual git repository.

## Features

- **Two Shadow Git Systems**: Maintain separate checkpoints for different purposes
  - Main checkpoints for key development milestones
  - Working checkpoints for experimental changes

- **Selective Change Approval**: Approve or disapprove specific chunks of changes
  - Visual indicators for approved, disapproved, and pending changes
  - Approve/disapprove individual changes via hover actions
  - Bulk approve/disapprove all changes in a file

- **Checkpoints**: Create virtual commits that can be applied to files
  - Create checkpoints containing only approved changes
  - Apply checkpoints to revert to previous states
  - Maintain separate checkpoint history for main and working changes

- **Enhanced Diff Visualization**:
  - Gutter icons for change status
  - Inline controls for approving/disapproving changes
  - Color-coded change blocks

- **Comparison Features**:
  - Compare with main or working Shadow Git HEAD
  - Compare with specific checkpoints
  - View differences between snapshot and current state

- **Timeline Integration**: View checkpoint history in VS Code's timeline view
  - Chronologically arranged checkpoints
  - Compare current files with checkpoint versions

- **SCM Integration**: Native Source Control Management view
  - Work with Shadow Git through VS Code's SCM interface
  - Manage approved/disapproved changes 

- **Custom WebView UI**: Rich interface for managing Shadow Git features
  - Browse tracked files and checkpoints
  - Interactive controls for common operations

## Usage

### Taking Snapshots

1. Open a file in the editor
2. Click the "Take Snapshot" button in the editor title bar (or press `Ctrl+Alt+S` / `Cmd+Alt+S`)
3. The file is now tracked by Shadow Git

### Viewing and Approving Changes

1. Open a tracked file in the editor
2. Click the "Open Shadow Diff" button in the editor title bar (or press `Ctrl+Alt+D` / `Cmd+Alt+D`)
3. In the diff view, hover over changes to see approve/disapprove options
4. Click on the gutter icon or use the hover buttons to approve/disapprove changes

### Creating Checkpoints

1. After approving desired changes, click the "Create Checkpoint" button in the Shadow Git sidebar (or press `Ctrl+Alt+C` / `Cmd+Alt+C`)
2. Enter a message describing the checkpoint
3. The checkpoint will appear in the Checkpoints view

### Applying Checkpoints

1. In the Checkpoints view, click on a checkpoint to apply it
2. Confirm that you want to apply the checkpoint
3. The changes from the checkpoint will be applied to your files

### Comparing with HEAD

1. Click the "Compare with Shadow Git" button in the editor title bar
2. Select which Shadow Git system to compare with (Main or Working)
3. The diff view will show changes between the current file and the latest checkpoint

### Using Multiple Shadow Git Systems

This extension provides two separate Shadow Git systems:

1. **Main Shadow Git**: For stable, production-ready checkpoints
   - Use for key development milestones
   - Available in the "Main Shadow Git" view

2. **Working Shadow Git**: For experimental, in-progress changes
   - Use for exploring ideas without affecting the main checkpoints
   - Available in the "Working Shadow Git" view

## Testing

To test the extension:

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Build and Launch**:
   ```bash
   npm run watch
   ```
   Then press F5 to launch a new VS Code window with the extension loaded

3. **Basic Testing Flow**:
   1. Open or create a test file
   2. Take a snapshot (Click the "Take Snapshot" button or press `Ctrl+Alt+S` / `Cmd+Alt+S`)
   3. Make some changes to the file
   4. Open the diff view (Click the "Open Shadow Diff" button or press `Ctrl+Alt+D` / `Cmd+Alt+D`)
   5. Approve some changes (hover over a change and click "Approve" or click the gutter icon)
   6. Create a checkpoint (Click "Create Checkpoint" in the sidebar or press `Ctrl+Alt+C` / `Cmd+Alt+C`)
   7. Make more changes
   8. Apply your checkpoint from the Shadow Git sidebar
   9. Verify the changes are applied correctly

4. **Testing the Dual Shadow Git Systems**:
   1. Create checkpoints in both the Main and Working systems
   2. Apply checkpoints from each system independently
   3. Verify they operate independently
   4. Use the "Compare with Shadow Git" command to compare with either system's HEAD

5. **Testing IDE Integration**:
   1. Verify the Timeline view shows checkpoints (open the Timeline panel in VS Code)
   2. Test the SCM view integration (check VS Code's Source Control panel)
   3. Try keyboard shortcuts and context menu items

## Configuration

The extension provides several configuration options:

- **shadowGit.autoSnapshot**: Automatically take snapshots of files when they are opened
- **shadowGit.customIconsInDiff**: Use custom icons in diff view
- **shadowGit.showCheckpointsInTimeline**: Show checkpoints in VS Code timeline view

## Development

This extension is built using TypeScript and the VS Code Extension API.

### Prerequisites

- Visual Studio Code 1.60.0 or higher
- Node.js and npm

### Development Setup

1. Clone this repository
2. Run `npm install` to install dependencies
3. Run `npm run compile` to build the extension
4. Press F5 to start debugging the extension in a new VS Code window

### Live Development

The extension supports live watch mode:

1. Run `npm run watch` to start the TypeScript compiler in watch mode
2. Press F5 to start debugging
3. Make changes to the TypeScript files, save, and the extension will automatically reload

## Architecture

The extension consists of several key components:

1. **ShadowGit Core**: Manages snapshots, changes, and checkpoints
2. **Diff Decoration Provider**: Visualizes changes in the editor
3. **SCM Provider**: Integrates with VS Code's source control view
4. **WebView Provider**: Creates custom UI for the sidebar
5. **Timeline Provider**: Shows checkpoints in VS Code's timeline

## Keyboard Shortcuts

- **Take Snapshot**: `Ctrl+Alt+S` (Windows/Linux) or `Cmd+Alt+S` (Mac)
- **Open Shadow Diff**: `Ctrl+Alt+D` (Windows/Linux) or `Cmd+Alt+D` (Mac)
- **Create Checkpoint**: `Ctrl+Alt+C` (Windows/Linux) or `Cmd+Alt+C` (Mac)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
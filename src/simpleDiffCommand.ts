import * as vscode from 'vscode';
import * as path from 'path';
// import * as fs from 'fs';
import { ShadowGit } from './shadowGit';
import { ShadowGitWithGit } from './shadowGitWithGit';
// import { GitUtils } from './gitUtils';

/**
 * Creates a command to open a simple diff view - no custom decorations, just using VS Code's built-in diff
 */
export function createSimpleDiffCommand(
  context: vscode.ExtensionContext,
  mainShadowGit: ShadowGit,
  workingShadowGit?: ShadowGitWithGit | null
): vscode.Disposable[] {
  const commands: vscode.Disposable[] = [];
  
  // Main Shadow Git diff command (with checkpoints focus)
  commands.push(vscode.commands.registerCommand('shadowGit.openMainDiff', async (uri: vscode.Uri) => {
    console.log('shadowGit.openMainDiff command invoked');
    
    if (!mainShadowGit) {
      vscode.window.showErrorMessage('Main Shadow Git not initialized');
      return;
    }
    
    await openSimpleDiff(uri, mainShadowGit, 'main');
  }));
  
  // Working Shadow Git diff command (with Git-based staging)
  commands.push(vscode.commands.registerCommand('shadowGit.openSimpleWorkingDiff', async (uri: vscode.Uri) => {
    console.log('shadowGit.openSimpleWorkingDiff command invoked');
    
    if (!workingShadowGit) {
      vscode.window.showErrorMessage('Working Shadow Git not initialized');
      return;
    }
    
    // For working shadow git, use simple diff instead of trying Git commands directly
    // This avoids Git integration issues
    await openSimpleDiff(uri, workingShadowGit, 'working');
  }));
  
  return commands;
}

/**
 * Simple function to open a diff view - no custom decorations
 */
async function openSimpleDiff(
  uri: vscode.Uri, 
  shadowGit: ShadowGit | ShadowGitWithGit, 
  type: 'main' | 'working'
): Promise<void> {
  // Show progress notification
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Opening ${type === 'main' ? 'Checkpoint' : 'Comparison'} Diff`,
    cancellable: false
  }, async (progress) => {
    try {
      const filePath = uri.fsPath;
      const relativePath = path.relative(shadowGit.workspaceRoot, filePath);
      
      progress.report({ message: "Creating snapshot..." });
      
      // Take a snapshot if not already taken
      if (!shadowGit.snapshots.has(relativePath)) {
        if (shadowGit instanceof ShadowGitWithGit) {
          await shadowGit.takeSnapshot(filePath);
        } else {
          shadowGit.takeSnapshot(filePath);
        }
      }
      
      // Make sure changes are detected
      if (shadowGit instanceof ShadowGitWithGit) {
        await shadowGit.detectChanges(filePath);
      } else {
        shadowGit.detectChanges(filePath);
      }
      
      // Create temp file for the snapshot
      shadowGit.createTempSnapshotFile(relativePath);
      
      progress.report({ message: "Opening diff view..." });
      
      // Use our custom shadowgit: URI scheme with our own file system provider
      // This should give us more control over the diff view
      
      // Create a ShadowGit URI for the snapshot version of the file
      const shadowGitUri = uri.with({
        scheme: 'shadowgit',
        path: uri.path,
        query: JSON.stringify({ 
          path: uri.fsPath, 
          snapshot: 'latest',
          type
        })
      });
      
      // Open the diff using the shadowgit URI
      // The diff will respect VS Code's diffEditor.renderSideBySide setting
      // Users can toggle between split and inline view using the editor toolbar
      await vscode.commands.executeCommand('vscode.diff', 
        shadowGitUri, // Snapshot version via our custom URI scheme
        uri,         // Current file (editable)
        `Shadow Git ${type === 'main' ? 'Checkpoint' : 'Comparison'} Diff: ${path.basename(filePath)}`
      );
      
      progress.report({ message: "Opened diff with ShadowGit URI scheme" });
      
      // Try to integrate with Git for staging buttons
      try {
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        
        if (gitExtension && gitExtension.isActive) {
          const git = gitExtension.exports.getAPI(1);
          
          if (git && git.repositories && git.repositories.length > 0) {
            const repo = git.repositories[0];
            
            // Check if this file is tracked by Git
            if (repo.state.workingTreeChanges) {
              const gitChange = repo.state.workingTreeChanges.find((change: { uri: vscode.Uri }) => 
                change.uri.fsPath === uri.fsPath
              );
              
              if (gitChange) {
                console.log('Found corresponding Git change, staging buttons should appear');
              } else {
                console.log('No corresponding Git change found');
              }
            }
          }
        }
      } catch (gitError) {
        console.error('Git extension integration error:', gitError);
      }
      
      progress.report({ message: "Diff view opened successfully" });
      
    } catch (error) {
      console.error(`Failed to open diff: ${error}`);
      vscode.window.showErrorMessage(`Failed to open diff: ${(error as Error).message}`);
    }
  });
}
import * as vscode from 'vscode';
import * as path from 'path';
// import * as fs from 'fs';

/**
 * Creates a diff command that uses VS Code's Git extension API directly
 * to create diffs with native staging buttons.
 * 
 * This is a specialized implementation that leverages VS Code's built-in Git extension
 * to provide a diff view with native staging buttons.
 */
export function createGitDiffCommand(): vscode.Disposable {
  return vscode.commands.registerCommand('shadowGit.openGitDiff', async (uri: vscode.Uri) => {
    // Show progress
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Opening Git Diff',
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ message: 'Checking Git extension...' });
        
        // Get the Git extension
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        
        if (!gitExtension) {
          vscode.window.showErrorMessage('Git extension not found');
          return;
        }
        
        if (!gitExtension.isActive) {
          // Activate the extension
          await gitExtension.activate();
        }
        
        progress.report({ message: 'Accessing Git API...' });
        
        // Get the Git API
        const git = gitExtension.exports.getAPI(1);
        
        if (!git) {
          vscode.window.showErrorMessage('Git API not available');
          return;
        }
        
        // Find the repository for this file
        const repositories = git.repositories;
        
        if (repositories.length === 0) {
          vscode.window.showErrorMessage('No Git repositories found');
          return;
        }
        
        // Find the repository that contains this file
        const filePath = uri.fsPath;
        // Repository finding logic - not currently used but might be needed later
        // let repo = repositories[0]; // Default to first repo
        
        // Try to find a better match if there are multiple repositories
        if (repositories.length > 1) {
          for (const r of repositories) {
            if (filePath.startsWith(r.rootUri.fsPath)) {
              // Found matching repository for the file
              // repo = r;
              break;
            }
          }
        }
        
        progress.report({ message: 'Creating Git URI...' });
        
        // Check if file is tracked by Git
        //        // Not used currently
        // const relativePath = path.relative(repo.rootUri.fsPath, filePath);
        
        // Create a Git URI to use with VS Code's diff editor
        // This is the key to getting the native staging buttons
        const gitUri = uri.with({
          scheme: 'git',
          authority: '', // Need to clear authority
          path: uri.path,
          query: JSON.stringify({
            path: uri.fsPath,
            ref: 'HEAD' // Use HEAD as reference
          })
        });
        
        progress.report({ message: 'Opening diff...' });
        
        // Use VS Code's diff command with the Git URI
        // This should show the native staging buttons
        await vscode.commands.executeCommand('vscode.diff',
          gitUri, // Original (HEAD) version using git: scheme
          uri,    // Current file
          `Git Diff: ${path.basename(filePath)}`
        );
        
        progress.report({ message: 'Diff opened successfully' });
        
      } catch (error) {
        console.error('Error opening Git diff:', error);
        vscode.window.showErrorMessage(`Failed to open Git diff: ${(error as Error).message}`);
      }
    });
  });
}
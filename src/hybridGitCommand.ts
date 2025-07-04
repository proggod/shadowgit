import * as vscode from 'vscode';
import * as path from 'path';
import { ShadowGit } from './shadowGit';
import { ShadowGitWithGit } from './shadowGitWithGit';
import { GitIntegration } from './gitIntegration';

/**
 * A hybrid approach that uses real Git for staging/diff functionality
 * but integrates with ShadowGit for checkpoint timeline features.
 */
export function createHybridGitCommand(
  context: vscode.ExtensionContext,
  mainShadowGit: ShadowGit,
  // Not currently used but kept for API consistency
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _workingShadowGit: ShadowGitWithGit | null
): vscode.Disposable {
  // Get output channel for logging
  const outputChannel = vscode.window.createOutputChannel('Shadow Git Hybrid');
  
  return vscode.commands.registerCommand('shadowGit.openHybridDiff', async (uri: vscode.Uri) => {
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Opening Hybrid Git Diff',
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ message: 'Checking Git extension...' });
        
        // Take a ShadowGit snapshot first (for checkpoint capability)
        if (mainShadowGit) {
          const filePath = uri.fsPath;
          const relativePath = path.relative(mainShadowGit.workspaceRoot, filePath);
          
          if (!mainShadowGit.snapshots.has(relativePath)) {
            outputChannel.appendLine(`Taking ShadowGit snapshot of ${filePath}`);
            mainShadowGit.takeSnapshot(filePath);
          }
        }
        
        // Now use the real Git system for the diff with staging buttons
        progress.report({ message: 'Accessing Git extension...' });
        
        // Get the Git extension
        const gitExtension = vscode.extensions.getExtension('vscode.git');
        
        if (!gitExtension) {
          vscode.window.showErrorMessage('Git extension not found');
          return;
        }
        
        if (!gitExtension.isActive) {
          await gitExtension.activate();
        }
        
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
        let repo = repositories[0]; // Default to first repo
        
        // Try to find a better match if there are multiple repositories
        if (repositories.length > 1) {
          for (const r of repositories) {
            if (filePath.startsWith(r.rootUri.fsPath)) {
              repo = r;
              break;
            }
          }
        }
        
        // Use GitIntegration imported at the top of the file
        
        // Create a Git URI to use with VS Code's diff editor - using our improved method
        const gitUri = await GitIntegration.createGitDiffUri(uri);
        
        progress.report({ message: 'Opening Git diff (with staging buttons)...' });
        
        // Open a diff using VS Code's built-in Git diff editor
        // This will show staging buttons because it uses the git: URI scheme
        // Include "Working Tree" in the title to match VS Code's native Git diff
        await vscode.commands.executeCommand('vscode.diff',
          gitUri, // Original (HEAD) version using git: scheme
          uri,    // Current file
          `Git Diff: ${path.basename(filePath)} (Working Tree)`
        );
        
        // Register a command that can be triggered after staging
        // Using commandId instead of _commandId to follow naming conventions
        if (!context.subscriptions.find(d => (d as { commandId?: string }).commandId === 'shadowGit.createCheckpointFromStaged')) {
          // Register a command to create a ShadowGit checkpoint from staged changes
          const createCheckpointCommand = vscode.commands.registerCommand(
            'shadowGit.createCheckpointFromStaged',
            async () => {
              // Get staged files from Git
              const stagedChanges = repo.state.indexChanges;
              
              if (stagedChanges.length === 0) {
                vscode.window.showInformationMessage('No staged changes to create checkpoint from');
                return;
              }
              
              try {
                // Create a checkpoint in ShadowGit
                const message = await vscode.window.showInputBox({
                  prompt: 'Enter checkpoint message',
                  placeHolder: 'Describe the changes in this checkpoint'
                });
                
                if (!message) {
                  return; // User cancelled
                }
                
                // Create checkpoint in main ShadowGit
                if (mainShadowGit) {
                  // Take snapshots of all staged files first
                  for (const change of stagedChanges) {
                    const filePath = change.uri.fsPath;
                    mainShadowGit.takeSnapshot(filePath);
                  }
                  
                  // Create the checkpoint
                  const checkpoint = mainShadowGit.createCheckpoint(message);
                  
                  vscode.window.showInformationMessage(
                    `Created ShadowGit checkpoint: ${checkpoint.id.substring(0, 8)} - ${message}`
                  );
                }
              } catch (error) {
                vscode.window.showErrorMessage(`Failed to create checkpoint: ${(error as Error).message}`);
              }
            }
          );
          
          context.subscriptions.push(createCheckpointCommand);
        }
        
        // Show a message to connect Git staging with ShadowGit checkpoints
        vscode.window.showInformationMessage(
          'Stage changes using the buttons in the gutter, then create a ShadowGit checkpoint',
          'Create Checkpoint'
        ).then(selection => {
          if (selection === 'Create Checkpoint') {
            vscode.commands.executeCommand('shadowGit.createCheckpointFromStaged');
          }
        });
        
        progress.report({ message: 'Done' });
        
      } catch (error) {
        outputChannel.appendLine(`Error in hybrid diff: ${error}`);
        vscode.window.showErrorMessage(`Failed to open hybrid diff: ${(error as Error).message}`);
      }
    });
  });
}
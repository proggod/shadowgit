import * as vscode from 'vscode';
import * as path from 'path';
import { ShadowGit } from './shadowGit';
import { ShadowGitWithGit } from './shadowGitWithGit';

/**
 * Creates a command that directly calls VS Code's Git extension to open a diff
 * This approach ensures we get the exact same diff view (with staging icons) as VS Code's Git panel
 */
export function createDirectGitDiffCommand(
  context: vscode.ExtensionContext,
  mainShadowGit: ShadowGit,
  workingShadowGit: ShadowGitWithGit | null
): vscode.Disposable {
  // Create output channel for logging
  const outputChannel = vscode.window.createOutputChannel('Shadow Git Direct Git');
  
  return vscode.commands.registerCommand('shadowGit.openDirectGitDiff', async (uri: vscode.Uri, commit?: string) => {
    try {
      outputChannel.appendLine(`Opening direct Git diff for ${uri.fsPath}`);
      
      // Take snapshot for ShadowGit tracking
      if (workingShadowGit) {
        const filePath = uri.fsPath;
        const relativePath = path.relative(workingShadowGit.workspaceRoot, filePath);
        
        // Take a snapshot if not already taken
        if (!workingShadowGit.snapshots.has(relativePath)) {
          await workingShadowGit.takeSnapshot(filePath);
          outputChannel.appendLine(`Took snapshot of ${filePath} for ShadowGit tracking`);
        }
      }
      
      // If a specific commit is provided, use it
      if (commit) {
        outputChannel.appendLine(`Opening specific commit comparison: ${commit}`);
        // Use VS Code's git command with the commit
        try {
          const result = await vscode.commands.executeCommand('git.openChange', uri, commit);
          outputChannel.appendLine(`git.openChange with commit result: ${result ? 'success' : 'no result'}`);
          return result;
        } catch (error) {
          outputChannel.appendLine(`Error opening git diff with commit: ${error}`);
          throw error;
        }
      }
      
      // Check if this is a specific commit comparison from URI query
      const isSpecificCommit = uri.query && uri.query.includes('commit=');
      
      if (isSpecificCommit) {
        // Parse the commit info
        try {
          outputChannel.appendLine('This appears to be a specific commit comparison from URI');
          const params = new URLSearchParams(uri.query);
          const commitFromQuery = params.get('commit');
          
          if (commitFromQuery) {
            outputChannel.appendLine(`Calling git.openChange with commit from URI: ${commitFromQuery}`);
            // Use specific commit variant of openChange
            return await vscode.commands.executeCommand('git.openChange', uri, commitFromQuery);
          }
        } catch (error) {
          outputChannel.appendLine(`Error parsing commit info: ${error}`);
        }
      }
      
      // Default case: use VS Code's built-in git.openChange command directly
      // This ensures we get the exact same diff view as from the Git panel
      outputChannel.appendLine('Calling standard git.openChange command...');
      const result = await vscode.commands.executeCommand('git.openChange', uri);
      
      outputChannel.appendLine(`git.openChange result: ${result ? 'success' : 'no result'}`);
      return result;
    } catch (error) {
      outputChannel.appendLine(`Error opening Git diff: ${error}`);
      vscode.window.showErrorMessage(`Failed to open Git diff: ${(error as Error).message}`);
      
      // Fall back to regular vscode.diff
      try {
        outputChannel.appendLine('Falling back to regular diff...');
        if (workingShadowGit && mainShadowGit) {
          const filePath = uri.fsPath;
          const relativePath = path.relative(workingShadowGit.workspaceRoot, filePath);
          
          // Create temp file for the snapshot
          const tempPath = workingShadowGit.createTempSnapshotFile(relativePath);
          const leftUri = vscode.Uri.file(tempPath);
          
          return vscode.commands.executeCommand('vscode.diff',
            leftUri,
            uri,
            `Git Diff Fallback: ${path.basename(filePath)} (Working Tree)`
          );
        }
      } catch (fallbackError) {
        outputChannel.appendLine(`Fallback also failed: ${fallbackError}`);
      }
      
      return null;
    }
  });
}
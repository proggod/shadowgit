/**
 * Enhanced Shadow Git Diff Command
 * 
 * This command opens a diff view comparing the current file with its shadow git snapshot.
 * It provides progress notifications, git repository checks, and multiple diff approaches.
 * 
 * Features:
 * - Progress notifications
 * - Git repository check
 * - Multiple diff approaches (git.openChange and vscode.diff)
 * - Status bar items for approve/disapprove actions
 * - Detailed logging
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Command: Open shadow diff (enhanced with progress, git checks, and improved structure)
const openShadowDiffCommand = vscode.commands.registerCommand('shadowGit.openDiff', async () => {
  console.log('shadowGit.openDiff command invoked');
  
  if (!mainShadowGit || !workingShadowGit) {
    vscode.window.showErrorMessage('No workspace folder open');
    console.log('No workspace folder open');
    return;
  }
  
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('No active editor');
    console.log('No active editor available for diff');
    return;
  }
  
  console.log("Will open shadow diff for ${editor.document.fileName}");
  
  // Create a progress notification
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Opening Shadow Diff",
    cancellable: false
  }, async (progress) => {
    let statusBarItem: vscode.StatusBarItem | null = null;
    
    try {
      progress.report({ message: "Preparing diff view..." });
      
      // Try to reset any previously-open diff that might be interfering
      try {
        await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
        console.log('Closed any active editor');
      } catch (error) {
        console.log("Error closing editor: ${error}");
      }
      
      // Brief delay to let the editor close
      await new Promise(resolve => setTimeout(resolve, 500));
      progress.report({ message: "Creating snapshot..." });
    
      const filePath = editor.document.uri.fsPath;
      const relativePath = path.relative(mainShadowGit.workspaceRoot, filePath);
    
      // Take a snapshot if not already taken
      if (!mainShadowGit.snapshots.has(relativePath)) {
        mainShadowGit.takeSnapshot(filePath);
      }
      if (!workingShadowGit.snapshots.has(relativePath)) {
        workingShadowGit.takeSnapshot(filePath);
      }
      
      // Detect changes in both ShadowGit instances
      const mainChanges = mainShadowGit.detectChanges(filePath);
      const workingChanges = workingShadowGit.detectChanges(filePath);
      
      // Create temp file for the snapshot (using main ShadowGit)
      const tempPath = mainShadowGit.createTempSnapshotFile(relativePath);
      
      // Open the diff editor using a completely different approach
      const leftUri = vscode.Uri.file(tempPath);
      const rightUri = editor.document.uri;
      
      console.log("Opening diff with leftUri: ${leftUri.toString()}, rightUri: ${rightUri.toString()}");
      
      // Try to create a real Git-style diff which should have the stage/revert buttons
      // First, check if there's a git repo
      const fileDir = path.dirname(filePath);
      let isGitRepo = false;
      
      try {
        // Check for git repo in the current directory or any parent directory
        const hasGit = fs.existsSync(path.join(fileDir, '.git')) || 
                      fs.existsSync(path.join(mainShadowGit.workspaceRoot, '.git'));
        if (hasGit) {
          console.log('Found .git directory, this is a git repo');
          isGitRepo = true;
        } else {
          console.log('No .git directory found');
        }
      } catch (error) {
        console.log("Error checking for git repo: ${error}");
      }
      
      // Pre-register our decorations
      console.log("Pre-registering diff editor for ${rightUri.toString()}");
      mainDiffDecorationProvider!.registerDiffEditor(rightUri, mainChanges);
      workingDiffDecorationProvider!.registerDiffEditor(rightUri, workingChanges);
      
      // If it's a git repo, we can try to use git commands directly
      let usedGitDiff = false;
      
      progress.report({ message: "Opening diff view..." });
      
      if (isGitRepo) {
        try {
          // Try to use VS Code's git extension to open a proper diff with all features
          usedGitDiff = await vscode.commands.executeCommand('git.openChange', rightUri);
          console.log("Git diff command result: ${usedGitDiff ? 'success' : 'failed'}");
        } catch (error) {
          console.log("Error using git diff: ${error}");
          usedGitDiff = false;
        }
      }
      
      // If we couldn't use git diff, fall back to normal diff
      if (!usedGitDiff) {
        console.log('Falling back to normal diff');
        progress.report({ message: "Opening regular diff view..." });
        
        // Show debug info about all editors
        console.log('Current visible editors:');
        vscode.window.visibleTextEditors.forEach(e => {
          console.log("- ${e.document.uri.toString()} (${e.document.fileName})");
        });
        
        // Use standard diff command
        const diffResult = await vscode.commands.executeCommand('vscode.diff', 
          leftUri,
          rightUri,
          `Shadow Git Diff: ${path.basename(filePath)}`
        );
        
        console.log("Standard diff result: ${diffResult ? 'success' : 'no result'}");
      }
      
      // Let the diff editor fully load
      await new Promise(resolve => setTimeout(resolve, 1000));
      progress.report({ message: "Finalizing diff view..." });
      
      // Log all editors after opening the diff to see what type they are
      console.log('All editors after opening diff:');
      vscode.window.visibleTextEditors.forEach((editor, index) => {
        console.log("Editor ${index}:");
        console.log("- URI: ${editor.document.uri.toString()}");
        console.log("- Path: ${editor.document.fileName}");
        console.log("- ViewColumn: ${editor.viewColumn}");
        console.log("- Is active: ${editor === vscode.window.activeTextEditor}");
      });
      
      // Create a status bar item for approve/disapprove actions
      statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
      statusBarItem.text = "$(check) Approve All | $(x) Disapprove All";
      statusBarItem.tooltip = "Shadow Git: Approve or Disapprove All Changes";
      statusBarItem.command = "shadowGit.showApprovalOptions";
      statusBarItem.show();
      
      // Register the command for the status bar item
      context.subscriptions.push(vscode.commands.registerCommand('shadowGit.showApprovalOptions', async () => {
        const options = ['Approve All Changes', 'Disapprove All Changes'];
        const choice = await vscode.window.showQuickPick(options, { placeHolder: 'Choose an action' });
        
        if (choice === options[0]) {
          await vscode.commands.executeCommand('shadowGit.approveAllChanges', rightUri);
          vscode.window.showInformationMessage('All changes approved');
        } else if (choice === options[1]) {
          await vscode.commands.executeCommand('shadowGit.disapproveAllChanges', rightUri);
          vscode.window.showInformationMessage('All changes disapproved');
        }
      }));
      
      // Register the diff document for decoration in both providers
      console.log("Registering diff editor with ${mainChanges.length} main changes");
      console.log("Registering diff editor with ${workingChanges.length} working changes");
      mainDiffDecorationProvider!.registerDiffEditor(rightUri, mainChanges);
      workingDiffDecorationProvider!.registerDiffEditor(rightUri, workingChanges);
      
      console.log("Diff view opened. Check for decorations.");
    } catch (error) {
      console.error(`Failed to open diff: ${(error as Error).message}`);
      console.error(`Error stack: ${(error as Error).stack}`);
      vscode.window.showErrorMessage(`Failed to open diff: ${(error as Error).message}`);
      
      // Clean up status bar item on error
      if (statusBarItem) {
        statusBarItem.dispose();
      }
    }
  });
});

export { openShadowDiffCommand };
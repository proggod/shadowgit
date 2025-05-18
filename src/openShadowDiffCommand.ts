/**
 * Enhanced Shadow Git Diff Command
 * 
 * This command opens a diff view comparing the current file with its shadow git snapshot.
 * It provides progress notifications, git repository checks, and multiple diff approaches.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ShadowGit } from './shadowGit';
import { DiffDecorationProvider } from './diffProvider';

/**
 * Creates a command to open a diff view comparing the current file to its ShadowGit snapshot
 */
export function createOpenDiffCommand(
  context: vscode.ExtensionContext,
  mainShadowGit: ShadowGit,
  workingShadowGit: ShadowGit,
  mainDiffDecorationProvider: DiffDecorationProvider,
  workingDiffDecorationProvider: DiffDecorationProvider
): vscode.Disposable {
  
  return vscode.commands.registerCommand('shadowGit.openDiff', async () => {
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
    
    console.log(`Will open shadow diff for ${editor.document.fileName}`);
    
    // Create a progress notification
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Opening Shadow Diff",
      cancellable: false
    }, async (progress) => {
      let statusBarItem: vscode.StatusBarItem | null = null;
      let panel: vscode.WebviewPanel | null = null;
      
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
        
        // Save the current right URI for later reference
        const uriKey = `last_diff_${mainShadowGit.type}`;
        context.workspaceState.update(uriKey, rightUri.toString());
        
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
        
        // Pre-register our decorations with extensive URI variants
        console.log("Pre-registering diff editor for ${rightUri.toString()}");
        
        // Get all possible variations of the URI
        const rightUriVariations = [
          rightUri.toString(),
          rightUri.fsPath,
          path.normalize(rightUri.fsPath),
          rightUri.toString().replace('file://', ''),
          rightUri.path,
          rightUri.with({ scheme: 'vscode-diff' }).toString(),
          rightUri.with({ scheme: 'diff' }).toString()
        ];
        
        // Register all URI variants
        for (const uri of rightUriVariations) {
          console.log("Registering URI variant: ${uri}");
        }
        
        // Register with both providers
        mainDiffDecorationProvider.registerDiffEditor(rightUri, mainChanges);
        workingDiffDecorationProvider.registerDiffEditor(rightUri, workingChanges);
        
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
        
        // After the diff is open, force-apply decorations to all visible editors
        // This helps ensure our decorations appear even in complex diff views
        try {
          console.log("Force applying decorations to all visible editors");
          vscode.window.visibleTextEditors.forEach(editor => {
            console.log("Checking editor for decoration application: ${editor.document.uri.toString()}");
            
            // Try to apply main decorations
            try {
              mainDiffDecorationProvider.applyDecorations(editor);
            } catch (e) {
              console.log("Error applying main decorations: ${e}");
            }
            
            // Try to apply working decorations
            try {
              workingDiffDecorationProvider.applyDecorations(editor);
            } catch (e) {
              console.log("Error applying working decorations: ${e}");
            }
          });
        } catch (e) {
          console.log("Error in force-apply decorations: ${e}");
        }
        
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
        
        // Register the command for the status bar item if not already registered
        if (!context.subscriptions.find(d => (d as any)?.command === 'shadowGit.showApprovalOptions')) {
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
        }
        
        // Create direct UI for buttons via WebView panel
        const viewColumn = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;
        panel = vscode.window.createWebviewPanel(
          'shadowGitDiffControls',
          'Shadow Git Controls',
          { viewColumn: viewColumn, preserveFocus: true },
          { enableScripts: true }
        );
        
        // Create a simple UI with big, clickable buttons
        panel.webview.html = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Shadow Git Controls</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 10px; }
              .button-container { display: flex; flex-direction: column; gap: 10px; }
              button { padding: 10px; font-size: 16px; cursor: pointer; }
              .approve { background-color: #4CAF50; color: white; border: none; }
              .disapprove { background-color: #F44336; color: white; border: none; }
              h3 { margin-top: 5px; }
            </style>
          </head>
          <body>
            <h2>Shadow Git Controls</h2>
            <p>Click buttons to approve or disapprove all changes in the file:</p>
            <div class="button-container">
              <button class="approve" id="approveAll">Approve All Changes</button>
              <button class="disapprove" id="disapproveAll">Disapprove All Changes</button>
            </div>
            <h3>Change Details</h3>
            <div id="changes">
              ${mainChanges.map((change, index) => `
                <div style="margin-bottom: 15px; border: 1px solid #ccc; padding: 10px;">
                  <p><strong>Change ${index+1}</strong> (Line ${change.startLine}-${change.endLine}):</p>
                  <p>Type: ${change.type} / Status: ${change.approved === true ? 'Approved' : (change.approved === false ? 'Disapproved' : 'Pending')}</p>
                  <div class="button-container">
                    <button class="approve" data-id="${change.id}">Approve This Change</button>
                    <button class="disapprove" data-id="${change.id}">Disapprove This Change</button>
                  </div>
                </div>
              `).join('')}
            </div>
            <script>
              const vscode = acquireVsCodeApi();
              
              // Handle approve/disapprove all buttons
              document.getElementById('approveAll').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'approveAll',
                  filepath: '${rightUri.fsPath}'
                });
              });
              
              document.getElementById('disapproveAll').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'disapproveAll',
                  filepath: '${rightUri.fsPath}'
                });
              });
              
              // Handle individual change buttons
              document.querySelectorAll('button[data-id]').forEach(button => {
                button.addEventListener('click', () => {
                  const changeId = button.getAttribute('data-id');
                  const command = button.classList.contains('approve') ? 'approve' : 'disapprove';
                  vscode.postMessage({
                    command: command,
                    changeId: changeId,
                    filepath: '${rightUri.fsPath}'
                  });
                });
              });
            </script>
          </body>
          </html>
        `;
        
        // Handle webview messages
        panel.webview.onDidReceiveMessage(async message => {
          console.log(`Received message from webview: ${JSON.stringify(message)}`);
          
          if (message.command === 'approveAll') {
            console.log("Approving all changes in ${message.filepath}");
            await vscode.commands.executeCommand('shadowGit.approveAllChanges', vscode.Uri.file(message.filepath));
          } 
          else if (message.command === 'disapproveAll') {
            console.log("Disapproving all changes in ${message.filepath}");
            await vscode.commands.executeCommand('shadowGit.disapproveAllChanges', vscode.Uri.file(message.filepath));
          }
          else if (message.command === 'approve') {
            console.log("Approving change ${message.changeId} in ${message.filepath}");
            await vscode.commands.executeCommand('shadowGit.approveChange', vscode.Uri.file(message.filepath), Number(message.changeId));
          }
          else if (message.command === 'disapprove') {
            console.log("Disapproving change ${message.changeId} in ${message.filepath}");
            await vscode.commands.executeCommand('shadowGit.disapproveChange', vscode.Uri.file(message.filepath), Number(message.changeId));
          }
          
          // Update the webview with fresh data
          if (panel && message.filepath) {
            const updatedChanges = mainShadowGit.detectChanges(message.filepath);
            
            // Update the changes section of the webview
            const updatedChangesHtml = `
              <div id="changes">
                ${updatedChanges.map((change, index) => `
                  <div style="margin-bottom: 15px; border: 1px solid #ccc; padding: 10px;">
                    <p><strong>Change ${index+1}</strong> (Line ${change.startLine}-${change.endLine}):</p>
                    <p>Type: ${change.type} / Status: ${change.approved === true ? 'Approved' : (change.approved === false ? 'Disapproved' : 'Pending')}</p>
                    <div class="button-container">
                      <button class="approve" data-id="${change.id}">Approve This Change</button>
                      <button class="disapprove" data-id="${change.id}">Disapprove This Change</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `;
            
            // Replace the changes section in the webview HTML
            const currentHtml = panel.webview.html;
            const newHtml = currentHtml.replace(
              /<div id="changes">[\s\S]*?<\/div>/,
              updatedChangesHtml
            );
            
            panel.webview.html = newHtml;
          }
        });
        
        // Clean up the panel when it's closed
        panel.onDidDispose(() => {
          panel = null;
        });
        
        // Register the diff document for decoration in both providers
        console.log("Registering diff editor with ${mainChanges.length} main changes");
        console.log("Registering diff editor with ${workingChanges.length} working changes");
        mainDiffDecorationProvider.registerDiffEditor(rightUri, mainChanges);
        workingDiffDecorationProvider.registerDiffEditor(rightUri, workingChanges);
        
        console.log("Diff view opened. Check for decorations.");
      } catch (error) {
        console.error(`Failed to open diff: ${(error as Error).message}`);
        console.error(`Error stack: ${(error as Error).stack}`);
        vscode.window.showErrorMessage(`Failed to open diff: ${(error as Error).message}`);
        
        // Clean up resources on error
        if (statusBarItem) {
          statusBarItem.dispose();
        }
        if (panel) {
          panel.dispose();
        }
      }
    });
  });
}
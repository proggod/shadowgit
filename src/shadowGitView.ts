import * as vscode from 'vscode';
import * as path from 'path';
import { ShadowGit } from './shadowGit';

/**
 * WebView provider for the Shadow Git sidebar
 */
export class ShadowGitViewProvider implements vscode.WebviewViewProvider {
  private readonly context: vscode.ExtensionContext;
  private readonly shadowGit: ShadowGit;
  private _view?: vscode.WebviewView;
  
  /**
   * Creates a new ShadowGitViewProvider instance
   * @param context - Extension context
   * @param shadowGit - ShadowGit instance
   */
  constructor(context: vscode.ExtensionContext, shadowGit: ShadowGit) {
    this.context = context;
    this.shadowGit = shadowGit;
  }
  
  /**
   * Resolve the WebView
   * @param webviewView - WebView to resolve
   */
  public resolveWebviewView(webviewView: vscode.WebviewView): void {
    this._view = webviewView;
    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'resources'))
      ]
    };
    
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    
    // Handle messages from the WebView
    webviewView.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'takeSnapshot':
          vscode.commands.executeCommand('shadowGit.takeSnapshot');
          break;
        case 'openDiff':
          this.openDiff(message.path);
          break;
        case 'createCheckpoint':
          vscode.commands.executeCommand(this.shadowGit.type === 'main' ? 
            'shadowGit.createCheckpoint' : 'shadowGit.createWorkingCheckpoint');
          break;
        case 'applyCheckpoint':
          vscode.commands.executeCommand('shadowGit.applyCheckpoint', message.id);
          break;
        case 'deleteCheckpoint':
          this.deleteCheckpoint(message.id);
          break;
        case 'refresh':
          this.refresh();
          break;
        case 'openFile':
          this.openFile(message.path);
          break;
      }
    });
    
    // Initial update
    this.refresh();
  }
  
  /**
   * Get the HTML for the WebView
   * @param webview - WebView
   * @returns HTML content
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    // Get resource paths
    const mainStyleUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'resources', 'view.css'))
    );
    
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.context.extensionPath, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css'))
    );
    
    const titleCase = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Shadow Git</title>
      <link rel="stylesheet" href="${mainStyleUri}">
      <link rel="stylesheet" href="${codiconsUri}">
      <style>
        :root {
          --container-padding: 10px;
          --input-padding-vertical: 6px;
          --input-padding-horizontal: 10px;
        }
        
        body {
          padding: 0;
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-foreground);
        }
        
        .container {
          padding: var(--container-padding);
        }
        
        button {
          border: none;
          padding: var(--input-padding-vertical) var(--input-padding-horizontal);
          width: 100%;
          text-align: center;
          outline: none;
          color: var(--vscode-button-foreground);
          background: var(--vscode-button-background);
          cursor: pointer;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        button:hover {
          background: var(--vscode-button-hoverBackground);
        }
        
        button i {
          margin-right: 5px;
        }
        
        .actions {
          display: flex;
          flex-direction: column;
          margin-bottom: 16px;
        }
        
        h2, h3 {
          font-weight: 400;
          margin-top: 16px;
          margin-bottom: 8px;
        }
        
        .files-list, .checkpoints-list {
          margin-top: 8px;
        }
        
        .file-item {
          padding: 8px;
          margin-bottom: 8px;
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 2px;
        }
        
        .file-name {
          font-weight: bold;
        }
        
        .file-path {
          font-size: 0.8em;
          color: var(--vscode-descriptionForeground);
          margin-bottom: 8px;
        }
        
        .file-actions {
          display: flex;
          justify-content: space-between;
        }
        
        .file-actions button {
          width: 48%;
        }
        
        .checkpoint-actions {
          display: flex;
          justify-content: space-between;
        }
        
        .checkpoint-actions button {
          width: 48%;
        }
        
        .checkpoint-item {
          padding: 8px;
          margin-bottom: 8px;
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 2px;
        }
        
        .checkpoint-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        
        .checkpoint-id {
          font-weight: bold;
        }
        
        .checkpoint-date {
          font-size: 0.8em;
          color: var(--vscode-descriptionForeground);
        }
        
        .checkpoint-message {
          margin-bottom: 8px;
        }
        
        .empty-message {
          font-style: italic;
          color: var(--vscode-descriptionForeground);
          text-align: center;
          padding: 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Shadow Git (${titleCase(this.shadowGit.type)})</h2>
        
        <div class="actions">
          <button id="takeSnapshot"><i class="codicon codicon-device-camera"></i> Take Snapshot</button>
          <button id="createCheckpoint"><i class="codicon codicon-git-commit"></i> Create Checkpoint</button>
          <button id="refresh"><i class="codicon codicon-refresh"></i> Refresh</button>
        </div>
        
        <h3>Tracked Files</h3>
        <div class="files-list" id="filesList">
          <div class="empty-message">No tracked files</div>
        </div>
        
        <h3>Checkpoints</h3>
        <div class="checkpoints-list" id="checkpointsList">
          <div class="empty-message">No checkpoints</div>
        </div>
      </div>
      
      <script>
        // Get vscode API
        const vscode = acquireVsCodeApi();
        
        // DOM elements
        const takeSnapshotBtn = document.getElementById('takeSnapshot');
        const createCheckpointBtn = document.getElementById('createCheckpoint');
        const refreshBtn = document.getElementById('refresh');
        const filesList = document.getElementById('filesList');
        const checkpointsList = document.getElementById('checkpointsList');
        
        // Event listeners
        takeSnapshotBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'takeSnapshot' });
        });
        
        createCheckpointBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'createCheckpoint' });
        });
        
        refreshBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'refresh' });
        });
        
        // Handle messages from the extension
        window.addEventListener('message', event => {
          const message = event.data;
          
          switch (message.command) {
            case 'update':
              updateUI(message.trackedFiles, message.checkpoints);
              break;
          }
        });
        
        /**
         * Update the UI with files and checkpoints
         * @param {Array} trackedFiles - Array of tracked file paths
         * @param {Array} checkpoints - Array of checkpoint objects
         */
        function updateUI(trackedFiles, checkpoints) {
          // Update files list
          if (trackedFiles.length === 0) {
            filesList.innerHTML = '<div class="empty-message">No tracked files</div>';
          } else {
            filesList.innerHTML = '';
            
            trackedFiles.forEach(filePath => {
              const fileItem = document.createElement('div');
              fileItem.className = 'file-item';
              
              const fileName = filePath.split('/').pop();
              
              fileItem.innerHTML = \`
                <div class="file-name">\${fileName}</div>
                <div class="file-path">\${filePath}</div>
                <div class="file-actions">
                  <button class="open-btn"><i class="codicon codicon-file-code"></i> Open</button>
                  <button class="diff-btn"><i class="codicon codicon-diff"></i> Diff</button>
                </div>
              \`;
              
              // Open file button
              fileItem.querySelector('.open-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'openFile',
                  path: filePath
                });
              });
              
              // Open diff button
              fileItem.querySelector('.diff-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'openDiff',
                  path: filePath
                });
              });
              
              filesList.appendChild(fileItem);
            });
          }
          
          // Update checkpoints list
          if (checkpoints.length === 0) {
            checkpointsList.innerHTML = '<div class="empty-message">No checkpoints</div>';
          } else {
            checkpointsList.innerHTML = '';
            
            checkpoints.forEach(checkpoint => {
              const checkpointItem = document.createElement('div');
              checkpointItem.className = 'checkpoint-item';
              
              const date = new Date(checkpoint.timestamp);
              const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
              
              checkpointItem.innerHTML = \`
                <div class="checkpoint-header">
                  <div class="checkpoint-id">\${checkpoint.id.substring(0, 8)}</div>
                  <div class="checkpoint-date">\${dateStr}</div>
                </div>
                <div class="checkpoint-message">\${checkpoint.message}</div>
                <div class="checkpoint-actions">
                  <button class="apply-btn"><i class="codicon codicon-run"></i> Apply Checkpoint</button>
                  <button class="delete-btn"><i class="codicon codicon-trash"></i> Delete</button>
                </div>
              \`;
              
              // Apply checkpoint button
              checkpointItem.querySelector('.apply-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'applyCheckpoint',
                  id: checkpoint.id
                });
              });
              
              // Delete checkpoint button
              checkpointItem.querySelector('.delete-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'deleteCheckpoint',
                  id: checkpoint.id
                });
              });
              
              checkpointsList.appendChild(checkpointItem);
            });
          }
        }
        
        // Initial refresh request
        vscode.postMessage({ command: 'refresh' });
      </script>
    </body>
    </html>`;
  }
  
  /**
   * Refresh the view with updated data
   */
  public refresh(): void {
    if (!this._view) {
      return;
    }
    
    if (!this.shadowGit) {
      this._view.webview.postMessage({
        command: 'update',
        trackedFiles: [],
        checkpoints: []
      });
      return;
    }
    
    // Get tracked files and checkpoints
    const trackedFiles = this.shadowGit.getTrackedFiles();
    const checkpoints = this.shadowGit.getCheckpoints();
    
    // Send data to WebView
    this._view.webview.postMessage({
      command: 'update',
      trackedFiles,
      checkpoints
    });
  }
  
  /**
   * Open a file in the editor
   * @param filePath - Relative path to the file
   */
  private async openFile(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.shadowGit.workspaceRoot, filePath);
      const document = await vscode.workspace.openTextDocument(fullPath);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file: ${(error as Error).message}`);
    }
  }
  
  /**
   * Delete a checkpoint
   * @param checkpointId - ID of the checkpoint to delete
   */
  private async deleteCheckpoint(checkpointId: string): Promise<void> {
    try {
      // Let the command handle the confirmation dialog
      await vscode.commands.executeCommand('shadowGit.deleteCheckpoint', checkpointId);
      this.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete checkpoint: ${(error as Error).message}`);
    }
  }
  
  /**
   * Open diff view for a file
   * @param filePath - Relative path to the file
   */
  private async openDiff(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.shadowGit.workspaceRoot, filePath);
      
      // Take snapshot if not already taken
      if (!this.shadowGit.snapshots.has(filePath)) {
        this.shadowGit.takeSnapshot(fullPath);
      }
      
      // Detect changes
      this.shadowGit.detectChanges(fullPath);
      
      // Create temp file for the snapshot
      const tempPath = this.shadowGit.createTempSnapshotFile(filePath);
      
      // Open the diff editor
      const leftUri = vscode.Uri.file(tempPath);
      const rightUri = vscode.Uri.file(fullPath);
      
      await vscode.commands.executeCommand('vscode.diff', 
        leftUri,
        rightUri,
        `Shadow Diff: ${path.basename(filePath)} (${this.shadowGit.type})`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open diff: ${(error as Error).message}`);
    }
  }
}
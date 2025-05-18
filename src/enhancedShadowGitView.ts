// File handles VS Code webview integration
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ShadowGit } from './shadowGit';
import { ShadowGitWithGit } from './shadowGitWithGit';
import { GitIntegration } from './gitIntegration';

/**
 * Enhanced WebView provider for the Shadow Git sidebar
 * Supports both regular ShadowGit and ShadowGitWithGit instances
 */
export class EnhancedShadowGitViewProvider implements vscode.WebviewViewProvider {
  private readonly context: vscode.ExtensionContext;
  private readonly mainShadowGit: ShadowGit;
  private readonly workingShadowGit: ShadowGitWithGit;
  private _view?: vscode.WebviewView;
  private _openCheckpoints: Set<string> = new Set(); // Track which checkpoints have open file lists
  private _checkpointScrollPositions: Map<string, number> = new Map(); // Track scroll positions
  
  /**
   * Creates a new EnhancedShadowGitViewProvider instance
   * @param context - Extension context
   * @param mainShadowGit - Main ShadowGit instance for checkpoints
   * @param workingShadowGit - Working ShadowGit instance with Git integration
   */
  constructor(
    context: vscode.ExtensionContext, 
    mainShadowGit: ShadowGit, 
    workingShadowGit: ShadowGitWithGit
  ) {
    this.context = context;
    this.mainShadowGit = mainShadowGit;
    this.workingShadowGit = workingShadowGit;
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
      console.log('Received message from WebView:', message);
      
      switch (message.command) {
        case 'checkpointOpened':
          this._openCheckpoints.add(message.checkpointId);
          break;
        case 'checkpointClosed':
          this._openCheckpoints.delete(message.checkpointId);
          this._checkpointScrollPositions.delete(message.checkpointId);
          break;
        case 'checkpointScroll':
          this._checkpointScrollPositions.set(message.checkpointId, message.scrollTop);
          break;
        case 'takeSnapshot':
          if (message.type === 'main') {
            vscode.commands.executeCommand('shadowGit.takeMainSnapshot')
              .then(() => this.refresh()); // Refresh after taking snapshot
          } else {
            vscode.commands.executeCommand('shadowGit.takeWorkingSnapshot')
              .then(() => this.refresh()); // Refresh after taking snapshot
          }
          break;
        case 'openDiff':
          this.openDiff(message.path, message.type);
          break;
        case 'startCheckpointProcess':
          this.startCheckpointProcess();
          break;
          
        case 'createCheckpointWithMessage':
          this.createCheckpointWithMessage(message.message);
          break;
          
        case 'createCheckpoint':
          if (message.type === 'main') {
            // Using then() to refresh the view after checkpoint creation
            vscode.commands.executeCommand('shadowGit.createCheckpoint')
              .then(() => {
                console.log('Refreshing WebView after createCheckpoint command');
                
                // DO NOT manually clear changes here
                // The ShadowGit.createCheckpoint method already handles this properly
                // Manual clearing can cause issues with detecting changes
                console.log('Relying on ShadowGit.createCheckpoint to handle change clearing');
                
                // Wait a short time to ensure the checkpoint is saved and changes are cleared
                setTimeout(() => this.refresh(), 500);
              });
          } else {
            vscode.commands.executeCommand('shadowGit.createWorkingCheckpoint')
              .then(() => {
                console.log('Refreshing WebView after createWorkingCheckpoint command');
                // Wait a short time to ensure the checkpoint is saved
                setTimeout(() => this.refresh(), 500);
              });
          }
          break;
        case 'applyCheckpoint':
          vscode.commands.executeCommand('shadowGit.applyCheckpoint', message.id)
            .then(() => {
              console.log('Refreshing WebView after applyCheckpoint command');
              // Wait a short time to ensure the checkpoint is applied
              setTimeout(() => this.refresh(), 500);
            });
          break;
        case 'deleteCheckpoint':
          console.log('WebView requested deleteCheckpoint for ID:', message.id);
          // Let the command handle the confirmation dialog
          vscode.commands.executeCommand('shadowGit.deleteCheckpoint', message.id)
            .then(() => {
              console.log('Refreshing WebView after deleteCheckpoint command');
              // Wait a short time to ensure the checkpoint is deleted
              setTimeout(() => this.refresh(), 500);
            });
          break;
        case 'refresh':
          this.refresh();
          break;
        case 'openFile':
          this.openFile(message.path);
          break;
        case 'setBaseCommit':
          this.setBaseCommit(message.id);
          break;
        case 'stageFile':
          this.stageFile(message.path);
          break;
        case 'unstageFile':
          this.unstageFile(message.path);
          break;
        case 'setActiveTab':
          this.refresh(); // Refresh data when changing tabs
          break;
        default:
          console.log('Unknown command received from WebView:', message.command);
          break;
      }
    });
    
    // Register automatic refresh when the panel becomes visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        console.log('Shadow Git view became visible, refreshing');
        this.refresh();
      }
    });
    
    // Setup smart refresh that only updates when data changes
    const refreshInterval = setInterval(async () => {
      if (this._view && this._view.visible) {
        // Check for changes without rebuilding UI
        await this.checkForChanges();
      }
    }, 5000); // Check for changes every 5 seconds while visible
    
    // Clear interval when the webview is disposed
    webviewView.onDidDispose(() => {
      clearInterval(refreshInterval);
    });
    
    // Initial update and store initial state
    this.refresh().then(() => {
      // Store initial state hashes to prevent unnecessary refreshes
      this._lastMainFilesHash = JSON.stringify(this.getFilesWithChanges().sort());
      this._lastMainCheckpointsHash = JSON.stringify(this.mainShadowGit.getCheckpoints().map(cp => ({
        id: cp.id,
        message: cp.message,
        timestamp: cp.timestamp,
        changesCount: Object.keys(cp.changes).length
      })));
      this.getGitChangedFiles().then(gitFiles => {
        this._lastWorkingFilesHash = JSON.stringify(gitFiles.sort());
      });
    });
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
          margin-bottom: 4px;
        }
        
        .checkpoint-files {
          font-size: 0.8em;
          color: var(--vscode-descriptionForeground);
          margin-bottom: 8px;
        }
        
        .checkpoint-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-bottom: 8px;
        }
        
        .checkpoint-buttons button {
          flex: 1;
          min-width: 100px;
          margin-bottom: 0;
        }
        
        .delete-btn {
          background-color: var(--vscode-errorForeground, #F44336);
          color: white;
        }
        
        .checkpoint-files-list {
          margin-top: 8px;
          margin-bottom: 8px;
          max-height: 200px;
          overflow-y: auto;
          overflow-x: hidden;
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 4px;
          padding: 12px;
          display: none;
          position: relative;
          z-index: 10;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        }
        
        .checkpoint-files-list ul {
          margin: 0;
          padding-left: 16px;
        }
        
        .checkpoint-files-list li {
          font-size: 0.85em;
          margin-bottom: 4px;
          word-break: break-all;
        }
        
        .files-header {
          font-weight: bold;
          font-size: 0.9em;
        }
        
        .files-list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .close-btn {
          background: none;
          border: none;
          color: var(--vscode-foreground);
          font-size: 20px;
          cursor: pointer;
          padding: 0;
          width: 20px;
          height: 20px;
          line-height: 18px;
          text-align: center;
          border-radius: 3px;
        }
        
        .close-btn:hover {
          background-color: var(--vscode-toolbar-hoverBackground);
        }
        
        .empty-message {
          font-style: italic;
          color: var(--vscode-descriptionForeground);
          text-align: center;
          padding: 10px;
        }
        
        .info-message {
          color: var(--vscode-infoForeground, #2196F3);
          text-align: center;
          padding: 10px;
          font-weight: 500;
        }
        
        /* Tabs styling */
        .tabs {
          display: flex;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .tab {
          padding: 8px 16px;
          cursor: pointer;
          background: none;
          margin: 0;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--vscode-foreground);
          opacity: 0.7;
        }
        
        .tab.active {
          border-bottom: 2px solid var(--vscode-button-background);
          opacity: 1;
        }
        
        .tab-content {
          display: none;
        }
        
        .tab-content.active {
          display: block;
        }
        
        /* Badge for checkpoints/comparisons count */
        .badge {
          display: inline-block;
          background-color: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          border-radius: 50%;
          padding: 2px 6px;
          font-size: 0.8em;
          margin-left: 5px;
        }
        
        /* Working Git specific styles */
        .working-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 8px;
          margin-bottom: 8px;
        }
        
        .working-actions button {
          flex: 1;
          min-width: 100px;
          margin-bottom: 0;
        }
        
        .set-base-btn {
          background-color: var(--vscode-statusBarItem-warningBackground);
          color: var(--vscode-statusBarItem-warningForeground);
        }
        
        .stage-btn {
          background-color: #4CAF50;
        }
        
        .unstage-btn {
          background-color: #F44336;
        }
        
        .base-commit-info {
          margin: 10px 0;
          padding: 8px;
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 2px;
        }
        
        /* Git status styling */
        .git-status {
          display: inline-block;
          margin-left: 5px;
          padding: 2px 4px;
          font-size: 0.7em;
          color: var(--vscode-badge-foreground);
          background-color: var(--vscode-badge-background);
          border-radius: 3px;
        }
        
        .git-modified .file-name {
          color: #FFAB00;
        }
        
        .git-untracked .file-name {
          color: #26A69A;
        }
        
        .git-index-modified .file-name,
        .git-index-added .file-name {
          color: #66BB6A;
        }
        
        .git-type {
          display: inline-block;
          margin-left: 5px;
          padding: 2px 4px;
          font-size: 0.7em;
          background-color: #424242;
          border-radius: 3px;
        }
        
        .git-status.working {
          background-color: #03A9F4;
        }
        
        .git-status.index {
          background-color: #4CAF50;
        }
        
        .git-status.commit {
          background-color: #7B1FA2;
        }
        
        .git-type-working .stage-btn {
          display: block;
        }
        
        .git-type-index .unstage-btn {
          display: block;
        }
        
        .git-type-working .unstage-btn,
        .git-type-index .stage-btn {
          display: none;
        }
        
        /* Dialog overlay styles */
        .overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        
        .dialog {
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 8px;
          padding: 20px;
          min-width: 400px;
          max-width: 500px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        }
        
        .dialog h3 {
          margin-top: 0;
          margin-bottom: 16px;
        }
        
        .status-message {
          margin: 16px 0;
          text-align: center;
          font-size: 14px;
        }
        
        .status-message i {
          font-size: 20px;
          margin-bottom: 8px;
          display: block;
        }
        
        .dialog input[type="text"] {
          width: 100%;
          padding: 8px;
          margin: 8px 0;
          background-color: var(--vscode-input-background);
          color: var(--vscode-input-foreground);
          border: 1px solid var(--vscode-input-border);
          border-radius: 2px;
        }
        
        .dialog-buttons {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 16px;
        }
        
        .dialog button {
          min-width: 80px;
        }
        
        .success-message {
          text-align: center;
          color: var(--vscode-testing-iconPassed);
          margin: 16px 0;
        }
        
        .success-message i {
          font-size: 24px;
          margin-bottom: 8px;
          display: block;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .codicon-modifier-spin {
          animation: spin 1s linear infinite;
          display: inline-block;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Shadow Git</h2>
        <div class="info-message" style="margin-bottom: 10px;">
          <strong>Checkpoints Tab:</strong> Create and manage checkpoints to save and restore file states. Checkpoints track files in your workspace and allow you to revert to previous states.<br>
          <strong>Git Changes Tab:</strong> View and manage actual Git changes (with staging buttons)
        </div>
        
        <div class="tabs">
          <button class="tab active" data-tab="checkpoints">
            Checkpoints <span class="badge" id="checkpointsBadge">0</span>
          </button>
          <button class="tab" data-tab="comparisons">
            Git Changes <span class="badge" id="comparisonsBadge">0</span>
          </button>
        </div>
        
        <!-- Checkpoints Tab -->
        <div class="tab-content active" id="checkpointsTab">
          <div class="actions">
            <button id="takeMainSnapshot">
              <i class="codicon codicon-device-camera"></i> Update File Tracking
            </button>
            <button id="createMainCheckpoint">
              <i class="codicon codicon-git-commit"></i> Save Checkpoint
            </button>
            <button id="refreshMain">
              <i class="codicon codicon-refresh"></i> Refresh
            </button>
          </div>
          
          <h3>Files with Changes</h3>
          <div class="info-message" style="margin-bottom: 10px;">
            Files below have been tracked and contain changes that have not yet been included in a checkpoint.
            Click "Save Checkpoint" to preserve the current state of these files.
          </div>
          <div class="files-list" id="mainFilesList">
            <div class="empty-message">No changed files detected</div>
          </div>
          
          <h3>Checkpoints</h3>
          <div class="checkpoints-list" id="mainCheckpointsList">
            <div class="empty-message">No checkpoints saved yet. Click "Save Checkpoint" above to preserve the current state of your workspace files.</div>
          </div>
        </div>
        
        <!-- Comparisons Tab -->
        <div class="tab-content" id="comparisonsTab">
          <div class="actions">
            <button id="refreshWorking">
              <i class="codicon codicon-refresh"></i> Refresh Git Changes
            </button>
          </div>
          
          <div id="baseCommitInfo" class="base-commit-info">
            <div class="info-message">Showing changes against latest commit (HEAD)</div>
          </div>
          
          <h3>Changed Files</h3>
          <div class="files-list" id="workingFilesList">
            <div class="empty-message">No changed files in Git</div>
          </div>
        </div>
      </div>
      
      <!-- Checkpoint Dialog Overlay -->
      <div id="checkpointDialog" class="overlay" style="display: none;">
        <div class="dialog">
          <h3>Create Checkpoint</h3>
          <div id="checkpointStatus" class="status-message">
            <i class="codicon codicon-loading codicon-modifier-spin"></i>
            <span id="statusText">Scanning workspace files...</span>
          </div>
          <div id="checkpointInput" style="display: none;">
            <p>Enter a message for this checkpoint:</p>
            <input type="text" id="checkpointMessage" placeholder="Describe what changes this checkpoint includes..." />
            <div class="dialog-buttons">
              <button id="createCheckpointBtn" class="primary">Create Checkpoint</button>
              <button id="cancelCheckpointBtn">Cancel</button>
            </div>
          </div>
          <div id="checkpointResult" style="display: none;">
            <div class="success-message">
              <i class="codicon codicon-check"></i>
              <span id="resultText"></span>
            </div>
            <button id="closeDialogBtn">Close</button>
          </div>
        </div>
      </div>
      
      <script>
        // Get vscode API
        const vscode = acquireVsCodeApi();
        
        // Tabs functionality
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
          tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(tabId + 'Tab').classList.add('active');
            
            // Notify extension about tab change
            vscode.postMessage({
              command: 'setActiveTab',
              tab: tabId
            });
          });
        });
        
        // DOM elements
        const takeMainSnapshotBtn = document.getElementById('takeMainSnapshot');
        const createMainCheckpointBtn = document.getElementById('createMainCheckpoint');
        const refreshMainBtn = document.getElementById('refreshMain');
        const mainFilesList = document.getElementById('mainFilesList');
        const mainCheckpointsList = document.getElementById('mainCheckpointsList');
        
        const refreshWorkingBtn = document.getElementById('refreshWorking');
        const workingFilesList = document.getElementById('workingFilesList');
        const baseCommitInfo = document.getElementById('baseCommitInfo');
        
        // Badges
        const checkpointsBadge = document.getElementById('checkpointsBadge');
        const comparisonsBadge = document.getElementById('comparisonsBadge');
        
        // Event listeners - Main tab
        takeMainSnapshotBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'takeSnapshot', type: 'main' });
        });
        
        // Dialog elements
        const checkpointDialog = document.getElementById('checkpointDialog');
        const statusText = document.getElementById('statusText');
        const checkpointStatus = document.getElementById('checkpointStatus');
        const checkpointInput = document.getElementById('checkpointInput');
        const checkpointResult = document.getElementById('checkpointResult');
        const checkpointMessage = document.getElementById('checkpointMessage');
        const createCheckpointBtn = document.getElementById('createCheckpointBtn');
        const cancelCheckpointBtn = document.getElementById('cancelCheckpointBtn');
        const closeDialogBtn = document.getElementById('closeDialogBtn');
        const resultText = document.getElementById('resultText');
        
        createMainCheckpointBtn.addEventListener('click', () => {
          // Show dialog with status
          checkpointDialog.style.display = 'flex';
          checkpointStatus.style.display = 'block';
          checkpointInput.style.display = 'none';
          checkpointResult.style.display = 'none';
          statusText.textContent = 'Scanning workspace files...';
          
          // Request to start checkpoint process
          vscode.postMessage({ command: 'startCheckpointProcess', type: 'main' });
        });
        
        createCheckpointBtn.addEventListener('click', () => {
          const message = checkpointMessage.value.trim();
          if (message) {
            checkpointStatus.style.display = 'block';
            checkpointInput.style.display = 'none';
            statusText.textContent = 'Creating checkpoint...';
            vscode.postMessage({ 
              command: 'createCheckpointWithMessage', 
              type: 'main',
              message: message
            });
          }
        });
        
        cancelCheckpointBtn.addEventListener('click', () => {
          checkpointDialog.style.display = 'none';
          checkpointMessage.value = '';
        });
        
        closeDialogBtn.addEventListener('click', () => {
          checkpointDialog.style.display = 'none';
          checkpointMessage.value = '';
        });
        
        refreshMainBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'refresh' });
        });
        
        // Event listeners - Working tab
        refreshWorkingBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'refresh' });
        });
        
        // Track which checkpoints have open file lists and their scroll positions
        let openCheckpoints = new Set();
        let scrollPositions = new Map();
        
        // Handle messages from the extension
        window.addEventListener('message', event => {
          const message = event.data;
          
          switch (message.command) {
            case 'update':
              // Update the set of open checkpoints if provided
              if (message.openCheckpoints) {
                openCheckpoints = new Set(message.openCheckpoints);
              }
              // Update scroll positions if provided
              if (message.checkpointScrollPositions) {
                scrollPositions = new Map(message.checkpointScrollPositions);
              }
              updateMainUI(message.mainFiles, message.mainCheckpoints);
              updateWorkingUI(
                message.workingFiles, 
                message.workingCheckpoints, 
                message.baseCommit, 
                message.gitStatus, 
                message.gitType,
                message.gitUriMap
              );
              break;
            
            case 'checkpointProgress':
              // Update status during checkpoint process
              statusText.textContent = message.text;
              break;
              
            case 'checkpointReady':
              // Show input for checkpoint message
              checkpointStatus.style.display = 'none';
              checkpointInput.style.display = 'block';
              checkpointMessage.focus();
              break;
              
            case 'checkpointCreated':
              // Show success message
              checkpointInput.style.display = 'none';
              checkpointResult.style.display = 'block';
              resultText.textContent = message.text;
              
              // Auto-close after 3 seconds
              setTimeout(() => {
                checkpointDialog.style.display = 'none';
                checkpointMessage.value = '';
              }, 3000);
              break;
              
            case 'checkpointError':
              // Show error
              statusText.textContent = 'Error: ' + message.text;
              statusText.style.color = 'var(--vscode-errorForeground)';
              setTimeout(() => {
                checkpointDialog.style.display = 'none';
                statusText.style.color = '';
              }, 3000);
              break;
          }
        });
        
        /**
         * Update the main tab UI with files and checkpoints
         * @param {Array} trackedFiles - Array of tracked file paths
         * @param {Array} checkpoints - Array of checkpoint objects
         */
        function updateMainUI(trackedFiles, checkpoints) {
          // Update badge count
          checkpointsBadge.textContent = checkpoints.length;
          
          // Update files list
          if (trackedFiles.length === 0) {
            mainFilesList.innerHTML = '<div class="empty-message">No tracked files</div>';
          } else {
            mainFilesList.innerHTML = '';
            
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
                  path: filePath,
                  type: 'main'
                });
              });
              
              mainFilesList.appendChild(fileItem);
            });
          }
          
          // Update checkpoints list
          if (checkpoints.length === 0) {
            mainCheckpointsList.innerHTML = '<div class="empty-message">No checkpoints</div>';
          } else {
            mainCheckpointsList.innerHTML = '';
            
            checkpoints.forEach(checkpoint => {
              const checkpointItem = document.createElement('div');
              checkpointItem.className = 'checkpoint-item';
              checkpointItem.setAttribute('data-checkpoint-id', checkpoint.id);
              
              const date = new Date(checkpoint.timestamp);
              const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
              
              checkpointItem.innerHTML = \`
                <div class="checkpoint-header">
                  <div class="checkpoint-id">\${checkpoint.id.substring(0, 8)}</div>
                  <div class="checkpoint-date">\${dateStr}</div>
                </div>
                <div class="checkpoint-message">\${checkpoint.message}</div>
                <div class="checkpoint-files">Files: \${Object.keys(checkpoint.changes).length}</div>
                <div class="checkpoint-buttons">
                  <button class="view-files-btn"><i class="codicon codicon-list-tree"></i> View Files</button>
                  <button class="apply-btn"><i class="codicon codicon-run"></i> Restore Checkpoint</button>
                  <button class="delete-btn"><i class="codicon codicon-trash"></i> Delete</button>
                </div>
              \`;
              
              // View files button
              checkpointItem.querySelector('.view-files-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const filesInCheckpoint = Object.keys(checkpoint.changes);
                
                // Create or update files list element
                let filesList = checkpointItem.querySelector('.checkpoint-files-list');
                if (!filesList) {
                  filesList = document.createElement('div');
                  filesList.className = 'checkpoint-files-list';
                  checkpointItem.appendChild(filesList);
                }
                
                // Toggle visibility
                if (filesList.style.display === 'block') {
                  filesList.style.display = 'none';
                  openCheckpoints.delete(checkpoint.id);
                  vscode.postMessage({
                    command: 'checkpointClosed',
                    checkpointId: checkpoint.id
                  });
                  return;
                }
                
                // Clear content and create header with close button
                filesList.innerHTML = '';
                
                // Create header with close button
                const header = document.createElement('div');
                header.className = 'files-list-header';
                header.innerHTML = \`
                  <span class="files-header">Files in this checkpoint:</span>
                  <button class="close-btn" title="Close">×</button>
                \`;
                filesList.appendChild(header);
                
                // Add close button handler
                header.querySelector('.close-btn').addEventListener('click', (e) => {
                  e.stopPropagation();
                  filesList.style.display = 'none';
                  openCheckpoints.delete(checkpoint.id);
                  vscode.postMessage({
                    command: 'checkpointClosed',
                    checkpointId: checkpoint.id
                  });
                });
                
                if (filesInCheckpoint.length === 0) {
                  const emptyMsg = document.createElement('div');
                  emptyMsg.className = 'empty-message';
                  emptyMsg.textContent = 'No files in this checkpoint';
                  filesList.appendChild(emptyMsg);
                } else {
                  const fileItems = document.createElement('ul');
                  filesInCheckpoint.forEach(file => {
                    const item = document.createElement('li');
                    item.textContent = file;
                    fileItems.appendChild(item);
                  });
                  
                  filesList.appendChild(fileItems);
                }
                
                filesList.style.display = 'block';
                openCheckpoints.add(checkpoint.id);
                vscode.postMessage({
                  command: 'checkpointOpened',
                  checkpointId: checkpoint.id
                });
                
                // Track scroll events on the file list
                filesList.addEventListener('scroll', (e) => {
                  vscode.postMessage({
                    command: 'checkpointScroll',
                    checkpointId: checkpoint.id,
                    scrollTop: e.target.scrollTop
                  });
                });
              });
              
              // Restore checkpoint button
              checkpointItem.querySelector('.apply-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'applyCheckpoint',
                  id: checkpoint.id
                });
              });
              
              // Delete checkpoint button
              checkpointItem.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                console.log("Delete button clicked for checkpoint " + checkpoint.id);
                
                // Provide visual feedback
                const button = e.target.closest('button');
                button.innerHTML = '<i class="codicon codicon-loading codicon-modifier-spin"></i> Deleting...';
                button.disabled = true;
                
                // Disable all buttons in the checkpoint item
                checkpointItem.querySelectorAll('button').forEach(btn => {
                  btn.disabled = true;
                });
                
                vscode.postMessage({
                  command: 'deleteCheckpoint',
                  id: checkpoint.id
                });
              });
              
              mainCheckpointsList.appendChild(checkpointItem);
              
              // Restore open state if this checkpoint was previously open
              if (openCheckpoints.has(checkpoint.id)) {
                // Don't simulate click - directly recreate the open state
                const filesInCheckpoint = Object.keys(checkpoint.changes);
                
                // Create files list element
                const filesList = document.createElement('div');
                filesList.className = 'checkpoint-files-list';
                checkpointItem.appendChild(filesList);
                
                // Create header with close button
                const header = document.createElement('div');
                header.className = 'files-list-header';
                header.innerHTML = \`
                  <span class="files-header">Files in this checkpoint:</span>
                  <button class="close-btn" title="Close">×</button>
                \`;
                filesList.appendChild(header);
                
                // Add close button handler
                header.querySelector('.close-btn').addEventListener('click', (e) => {
                  e.stopPropagation();
                  filesList.style.display = 'none';
                  openCheckpoints.delete(checkpoint.id);
                  scrollPositions.delete(checkpoint.id);
                  vscode.postMessage({
                    command: 'checkpointClosed',
                    checkpointId: checkpoint.id
                  });
                });
                
                if (filesInCheckpoint.length === 0) {
                  const emptyMsg = document.createElement('div');
                  emptyMsg.className = 'empty-message';
                  emptyMsg.textContent = 'No files in this checkpoint';
                  filesList.appendChild(emptyMsg);
                } else {
                  const fileItems = document.createElement('ul');
                  filesInCheckpoint.forEach(file => {
                    const item = document.createElement('li');
                    item.textContent = file;
                    fileItems.appendChild(item);
                  });
                  
                  filesList.appendChild(fileItems);
                }
                
                filesList.style.display = 'block';
                
                // Track scroll events
                filesList.addEventListener('scroll', (e) => {
                  scrollPositions.set(checkpoint.id, e.target.scrollTop);
                  vscode.postMessage({
                    command: 'checkpointScroll',
                    checkpointId: checkpoint.id,
                    scrollTop: e.target.scrollTop
                  });
                });
                
                // Restore scroll position
                const savedScrollTop = scrollPositions.get(checkpoint.id);
                if (savedScrollTop !== undefined) {
                  // Use setTimeout to ensure DOM is ready
                  setTimeout(() => {
                    filesList.scrollTop = savedScrollTop;
                  }, 0);
                }
              }
            });
          }
        }
        
        /**
         * Update the working tab UI with Git changed files
         * @param {Array} trackedFiles - Array of tracked file paths
         * @param {Array} checkpoints - Array of checkpoint/commit objects (not used)
         * @param {Object} baseCommit - The current base commit info (not used)
         * @param {Object} gitStatus - Map of file paths to Git status
         * @param {Object} gitType - Map of file paths to Git change type (working/index)
         * @param {Object} gitUriMap - Map of file paths to their Git URIs for diffing
         */
        function updateWorkingUI(trackedFiles, checkpoints, baseCommit, gitStatus = {}, gitType = {}, gitUriMap = {}) {
          // Update badge count with number of changed files
          comparisonsBadge.textContent = trackedFiles.length;
          
          // Always show the same base commit info message
          baseCommitInfo.innerHTML = '<div class="info-message">Showing changes against latest commit (HEAD)</div>';
          
          // Update files list
          if (trackedFiles.length === 0) {
            workingFilesList.innerHTML = '<div class="empty-message">No changed files in Git</div>';
          } else {
            workingFilesList.innerHTML = '';
            
            trackedFiles.forEach(filePath => {
              const fileItem = document.createElement('div');
              fileItem.className = 'file-item';
              
              const fileName = filePath.split('/').pop();
              const status = gitStatus[filePath] || '';
              const type = gitType[filePath] || '';
              
              // Create status label that includes both status and type
              let statusLabel = '';
              if (status) {
                statusLabel = \` <span class="git-status \${type}">\${status}</span>\`;
                if (type) {
                  statusLabel += \` <span class="git-type">\${type}</span>\`;
                }
              }
              
              // Add Git status-specific class
              if (status) {
                fileItem.classList.add('git-' + status.toLowerCase().replace('_', '-'));
                if (type) {
                  fileItem.classList.add('git-type-' + type);
                }
              }
              
              fileItem.innerHTML = \`
                <div class="file-name">\${fileName}\${statusLabel}</div>
                <div class="file-path">\${filePath}</div>
                <div class="file-actions">
                  <button class="open-btn"><i class="codicon codicon-file-code"></i> Open</button>
                  <button class="diff-btn"><i class="codicon codicon-diff"></i> Diff</button>
                </div>
                <div class="working-actions">
                  <button class="stage-btn"><i class="codicon codicon-add"></i> Stage All Changes</button>
                  <button class="unstage-btn"><i class="codicon codicon-remove"></i> Unstage All Changes</button>
                </div>
              \`;
              
              // Open file button
              fileItem.querySelector('.open-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'openFile',
                  path: filePath
                });
              });
              
              // Open diff button with Git URI info if available
              fileItem.querySelector('.diff-btn').addEventListener('click', () => {
                // Include Git URI information if available
                const gitUri = gitUriMap[filePath];
                const type = gitType[filePath] || 'working';
                
                vscode.postMessage({
                  command: 'openDiff',
                  path: filePath,
                  type: 'working',
                  gitUri: gitUri,
                  gitType: type
                });
              });
              
              // Stage file button
              fileItem.querySelector('.stage-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'stageFile',
                  path: filePath
                });
              });
              
              // Unstage file button
              fileItem.querySelector('.unstage-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'unstageFile',
                  path: filePath
                });
              });
              
              workingFilesList.appendChild(fileItem);
            });
          }
          
          // Update checkpoints/commits list
          if (checkpoints.length === 0) {
            workingCheckpointsList.innerHTML = '<div class="empty-message">No comparison commits</div>';
          } else {
            workingCheckpointsList.innerHTML = '';
            
            checkpoints.forEach(checkpoint => {
              const checkpointItem = document.createElement('div');
              checkpointItem.className = 'checkpoint-item';
              checkpointItem.setAttribute('data-checkpoint-id', checkpoint.id);
              
              const date = new Date(checkpoint.timestamp);
              const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
              const isBase = baseCommit && checkpoint.id === baseCommit.id;
              
              checkpointItem.innerHTML = \`
                <div class="checkpoint-header">
                  <div class="checkpoint-id">\${checkpoint.id.substring(0, 8)}</div>
                  <div class="checkpoint-date">\${dateStr}</div>
                </div>
                <div class="checkpoint-message">\${checkpoint.message}</div>
                <div class="checkpoint-files">Files: \${Object.keys(checkpoint.changes).length}</div>
                <div class="working-actions">
                  <button class="view-files-btn"><i class="codicon codicon-list-tree"></i> View Files</button>
                  <button class="apply-btn"><i class="codicon codicon-run"></i> Restore Commit</button>
                  <button class="set-base-btn" \${isBase ? 'disabled' : ''}>\${isBase ? 'Current Base' : 'Set as Base'}</button>
                  <button class="delete-btn"><i class="codicon codicon-trash"></i> Delete</button>
                </div>
              \`;
              
              // View files button
              checkpointItem.querySelector('.view-files-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const filesInCheckpoint = Object.keys(checkpoint.changes);
                
                // Create or update files list element
                let filesList = checkpointItem.querySelector('.checkpoint-files-list');
                if (!filesList) {
                  filesList = document.createElement('div');
                  filesList.className = 'checkpoint-files-list';
                  checkpointItem.appendChild(filesList);
                }
                
                // Toggle visibility
                if (filesList.style.display === 'block') {
                  filesList.style.display = 'none';
                  openCheckpoints.delete(checkpoint.id);
                  vscode.postMessage({
                    command: 'checkpointClosed',
                    checkpointId: checkpoint.id
                  });
                  return;
                }
                
                // Clear content and create header with close button
                filesList.innerHTML = '';
                
                // Create header with close button
                const header = document.createElement('div');
                header.className = 'files-list-header';
                header.innerHTML = \`
                  <span class="files-header">Files in this checkpoint:</span>
                  <button class="close-btn" title="Close">×</button>
                \`;
                filesList.appendChild(header);
                
                // Add close button handler
                header.querySelector('.close-btn').addEventListener('click', (e) => {
                  e.stopPropagation();
                  filesList.style.display = 'none';
                  openCheckpoints.delete(checkpoint.id);
                  vscode.postMessage({
                    command: 'checkpointClosed',
                    checkpointId: checkpoint.id
                  });
                });
                
                if (filesInCheckpoint.length === 0) {
                  const emptyMsg = document.createElement('div');
                  emptyMsg.className = 'empty-message';
                  emptyMsg.textContent = 'No files in this checkpoint';
                  filesList.appendChild(emptyMsg);
                } else {
                  const fileItems = document.createElement('ul');
                  filesInCheckpoint.forEach(file => {
                    const item = document.createElement('li');
                    item.textContent = file;
                    fileItems.appendChild(item);
                  });
                  
                  filesList.appendChild(fileItems);
                }
                
                filesList.style.display = 'block';
                openCheckpoints.add(checkpoint.id);
                vscode.postMessage({
                  command: 'checkpointOpened',
                  checkpointId: checkpoint.id
                });
                
                // Track scroll events on the file list
                filesList.addEventListener('scroll', (e) => {
                  vscode.postMessage({
                    command: 'checkpointScroll',
                    checkpointId: checkpoint.id,
                    scrollTop: e.target.scrollTop
                  });
                });
              });
              
              // Restore checkpoint button
              checkpointItem.querySelector('.apply-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'applyCheckpoint',
                  id: checkpoint.id
                });
              });
              
              // Set as base button
              if (!isBase) {
                checkpointItem.querySelector('.set-base-btn').addEventListener('click', () => {
                  vscode.postMessage({
                    command: 'setBaseCommit',
                    id: checkpoint.id
                  });
                });
              }
              
              // Delete checkpoint button
              checkpointItem.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                
                console.log("Delete button clicked for checkpoint " + checkpoint.id);
                
                // Provide visual feedback
                const button = e.target.closest('button');
                button.innerHTML = '<i class="codicon codicon-loading codicon-modifier-spin"></i> Deleting...';
                button.disabled = true;
                
                // Disable all buttons in the checkpoint item
                checkpointItem.querySelectorAll('button').forEach(btn => {
                  btn.disabled = true;
                });
                
                vscode.postMessage({
                  command: 'deleteCheckpoint',
                  id: checkpoint.id
                });
              });
              
              workingCheckpointsList.appendChild(checkpointItem);
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
   * Check for changes and update only if data has changed
   */
  private async checkForChanges(): Promise<void> {
    if (!this._view) {
      return;
    }
    
    try {
      // Get current data
      const filesWithChanges = this.getFilesWithChanges();
      const mainCheckpoints = this.mainShadowGit.getCheckpoints();
      const gitFiles = await this.getGitChangedFiles();
      
      // Create simple hashes to compare data
      const mainFilesHash = JSON.stringify(filesWithChanges.sort());
      const mainCheckpointsHash = JSON.stringify(mainCheckpoints.map(cp => ({
        id: cp.id,
        message: cp.message,
        timestamp: cp.timestamp,
        changesCount: Object.keys(cp.changes).length
      })));
      const workingFilesHash = JSON.stringify(gitFiles.sort());
      
      // Compare with last known state
      if (mainFilesHash !== this._lastMainFilesHash || 
          mainCheckpointsHash !== this._lastMainCheckpointsHash ||
          workingFilesHash !== this._lastWorkingFilesHash) {
        
        // Data has changed, update the UI
        this._lastMainFilesHash = mainFilesHash;
        this._lastMainCheckpointsHash = mainCheckpointsHash;  
        this._lastWorkingFilesHash = workingFilesHash;
        
        await this.refresh();
      }
    } catch (error) {
      console.error('Error checking for changes:', error);
    }
  }
  
  // Cache for gitignore patterns
  private _gitignorePatterns: string[] | null = null;
  private _gitignorePatternsTimestamp = 0;
  
  // Add state tracking properties
  private _lastMainFilesHash = '';
  private _lastMainCheckpointsHash = '';
  private _lastWorkingFilesHash = '';
  
  /**
   * Get files with changes
   */
  private getFilesWithChanges(): string[] {
    const filesWithChanges: string[] = [];
    
    this.mainShadowGit.changes.forEach((changes, relativePath) => {
      if (changes.length > 0) {
        filesWithChanges.push(relativePath);
      }
    });
    
    return filesWithChanges;
  }
  
  /**
   * Get Git changed files  
   */
  private async getGitChangedFiles(): Promise<string[]> {
    try {
      const gitIntegration = await GitIntegration.getGitAPI();
      const changes = await gitIntegration.repositories[0].state.workingTreeChanges;
      return changes.map(change => path.relative(this.mainShadowGit.workspaceRoot, change.uri.fsPath));
    } catch (error) {
      return [];
    }
  }
  
  /**
   * Refresh the view with updated data
   */
  public async refresh(): Promise<void> {
    if (!this._view) {
      return;
    }
    
    // Get files with changes using helper method
    const filesWithChanges = this.getFilesWithChanges();
    console.log(`Refresh: Found ${filesWithChanges.length} files with changes`);
    
    // Get checkpoints
    const mainCheckpoints = this.mainShadowGit.getCheckpoints();
    
    // Get changes from actual Git for the Git Changes tab
    try {
      // Get changed files directly from Git - no shadow git files needed for this tab
      const gitChanges = await GitIntegration.getChangedFiles();
      
      // Convert to relative paths
      const workspaceRoot = this.mainShadowGit.workspaceRoot;
      
      // Get just the Git changed files
      const gitFiles = gitChanges.map(change => 
        path.relative(workspaceRoot, change.filePath)
      );
      
      // Create status and type maps for the UI
      const gitStatusMap = {} as Record<string, string>;
      const gitTypeMap = {} as Record<string, string>;
      const gitUriMap = {} as Record<string, string>;
      
      // Populate the maps
      for (const change of gitChanges) {
        const relativePath = path.relative(workspaceRoot, change.filePath);
        gitStatusMap[relativePath] = change.status;
        gitTypeMap[relativePath] = change.type;
        gitUriMap[relativePath] = change.uri.toString();
      }
      
      // Send data to WebView
      this._view.webview.postMessage({
        command: 'update',
        mainFiles: filesWithChanges, // Only files that have actual changes, not all tracked files
        mainCheckpoints,
        workingFiles: gitFiles,      // Only show actual Git changed files
        workingCheckpoints: [],      // No need for checkpoints in Git Changes tab
        baseCommit: null,            // No concept of base commit anymore
        gitStatus: gitStatusMap,
        gitType: gitTypeMap,
        gitUriMap: gitUriMap,
        openCheckpoints: Array.from(this._openCheckpoints), // Pass which checkpoints are open
        checkpointScrollPositions: Array.from(this._checkpointScrollPositions.entries()) // Pass scroll positions
      });
    } catch (error) {
      console.error('Failed to get Git changes:', error);
      
      // Fall back to showing no Git changes
      this._view.webview.postMessage({
        command: 'update',
        mainFiles: filesWithChanges, // Still show files with changes in the main tab
        mainCheckpoints,
        workingFiles: [],
        workingCheckpoints: [],
        baseCommit: null,
        gitStatus: {},
        gitType: {},
        gitUriMap: {}
      });
    }
  }
  
  /**
   * Read .gitignore patterns with caching
   */
  private async readGitignorePatterns(): Promise<string[]> {
    const gitignorePath = path.join(this.mainShadowGit.workspaceRoot, '.gitignore');
    const now = Date.now();
    
    // Check if we have cached patterns and if they're still valid (5 minutes cache)
    if (this._gitignorePatterns && now - this._gitignorePatternsTimestamp < 300000) {
      return this._gitignorePatterns;
    }
    
    const patterns: string[] = [];
    
    try {
      if (fs.existsSync(gitignorePath)) {
        const content = fs.readFileSync(gitignorePath, 'utf8');
        const lines = content.split('\n');
        
        for (const line of lines) {
          const trimmed = line.trim();
          // Skip empty lines and comments
          if (trimmed && !trimmed.startsWith('#')) {
            // Handle negation patterns (!)
            if (trimmed.startsWith('!')) {
              // For now, we'll skip negation patterns as they're complex to implement
              continue;
            }
            patterns.push(trimmed);
          }
        }
      }
    } catch (error) {
      console.error('Error reading .gitignore:', error);
    }
    
    // Add common patterns that should always be ignored
    patterns.push('node_modules/**');
    patterns.push('.git/**');
    patterns.push('dist/**');
    patterns.push('build/**');
    patterns.push('out/**');
    patterns.push('*.log');
    patterns.push('*.log.*');
    patterns.push('.DS_Store');
    patterns.push('Thumbs.db');
    patterns.push('.vscode/.shadowgit-*/**');
    patterns.push('*.tmp');
    patterns.push('*.temp');
    patterns.push('*.cache');
    
    // If .vscode is in gitignore, make sure we honor it completely
    // Some projects ignore entire .vscode directory
    if (patterns.some(p => p === '.vscode' || p === '.vscode/')) {
      patterns.push('.vscode/**');
    }
    
    // Cache the patterns
    this._gitignorePatterns = patterns;
    this._gitignorePatternsTimestamp = now;
    
    return patterns;
  }
  
  /**
   * Check if a file should be ignored based on gitignore patterns
   * 
   * Examples of patterns and what they match:
   * - `.vscode` -> Ignores .vscode directory and all its contents
   * - `.vscode/` -> Same as above
   * - `.vscode/**` -> Same as above
   * - `.vscode/*` -> Only immediate children of .vscode
   * - `*.log` -> All files ending with .log
   * - `/dist` -> Only dist at root level
   * - `dist` -> Any dist directory at any level
   */
  private shouldIgnoreFile(filePath: string, patterns: string[]): boolean {
    const relativePath = path.relative(this.mainShadowGit.workspaceRoot, filePath);
    const pathParts = relativePath.split(path.sep);
    
    for (const pattern of patterns) {
      // Remove leading slash if present
      const cleanPattern = pattern.startsWith('/') ? pattern.slice(1) : pattern;
      
      // Handle different pattern types
      if (cleanPattern.endsWith('/**')) {
        // Directory with all subdirectories pattern
        const dir = cleanPattern.slice(0, -3);
        if (relativePath.startsWith(dir + '/') || relativePath === dir) {
          return true;
        }
      } else if (cleanPattern.endsWith('/*')) {
        // Directory with immediate children only
        const dir = cleanPattern.slice(0, -2);
        const dirParts = dir.split('/');
        if (pathParts.length === dirParts.length + 1 && relativePath.startsWith(dir + '/')) {
          return true;
        }
      } else if (cleanPattern.endsWith('/')) {
        // Directory pattern (same as without trailing slash)
        const dir = cleanPattern.slice(0, -1);
        if (relativePath.startsWith(dir + '/') || relativePath === dir) {
          return true;
        }
      } else if (cleanPattern.startsWith('*.')) {
        // Extension pattern
        const ext = cleanPattern.slice(1);
        if (relativePath.endsWith(ext)) {
          return true;
        }
      } else if (cleanPattern.includes('*')) {
        // Wildcard pattern - convert to regex
        const regexPattern = cleanPattern
          .replace(/\./g, '\\.')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        const regex = new RegExp('^' + regexPattern + '$');
        if (regex.test(relativePath)) {
          return true;
        }
      } else {
        // Exact match or directory without trailing slash
        // Check if it's a directory pattern (matches directory and all contents)
        if (relativePath === cleanPattern || 
            relativePath.startsWith(cleanPattern + '/') ||
            // Also check each directory in the path
            pathParts.some((_, index) => 
              pathParts.slice(0, index + 1).join('/') === cleanPattern
            )) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  /**
   * Start the checkpoint creation process
   */
  private async startCheckpointProcess(): Promise<void> {
    try {
      // Send progress update
      this._view?.webview.postMessage({
        command: 'checkpointProgress',
        text: 'Reading .gitignore patterns...'
      });
      
      // Read gitignore patterns
      const gitignorePatterns = await this.readGitignorePatterns();
      
      this._view?.webview.postMessage({
        command: 'checkpointProgress',
        text: 'Scanning workspace files...'
      });
      
      // Find all files in workspace
      const files = await vscode.workspace.findFiles(
        '**/*',
        undefined, // Let's handle exclusion ourselves
        10000
      );
      
      // Filter files based on gitignore
      const validFiles = files.filter(file => !this.shouldIgnoreFile(file.fsPath, gitignorePatterns));
      
      this._view?.webview.postMessage({
        command: 'checkpointProgress',
        text: `Found ${validFiles.length} files to check (${files.length - validFiles.length} ignored)...`
      });
      
      // Track untracked files
      let trackedCount = 0;
      for (const file of validFiles) {
        try {
          const relativePath = path.relative(this.mainShadowGit.workspaceRoot, file.fsPath);
          
          if (!this.mainShadowGit.snapshots.has(relativePath)) {
            const stats = fs.statSync(file.fsPath);
            if (stats.size > 5 * 1024 * 1024) {
              continue;
            }
            
            this.mainShadowGit.takeSnapshot(file.fsPath);
            trackedCount++;
          }
        } catch (error) {
          // Skip files that can't be processed
        }
      }
      
      this._view?.webview.postMessage({
        command: 'checkpointProgress',
        text: `Tracked ${trackedCount} new files. Detecting changes...`
      });
      
      // Detect changes
      this.mainShadowGit.detectChangesInAllTrackedFiles();
      const changedFilesCount = this.mainShadowGit.changes.size;
      
      this._view?.webview.postMessage({
        command: 'checkpointProgress',
        text: `Found ${changedFilesCount} files with changes`
      });
      
      // Ready for message input
      this._view?.webview.postMessage({
        command: 'checkpointReady'
      });
      
    } catch (error) {
      this._view?.webview.postMessage({
        command: 'checkpointError',
        text: (error as Error).message
      });
    }
  }
  
  /**
   * Create checkpoint with the provided message
   */
  private async createCheckpointWithMessage(message: string): Promise<void> {
    try {
      const filesWithChanges = Array.from(this.mainShadowGit.changes.keys());
      
      // Approve all changes
      for (const filePath of filesWithChanges) {
        try {
          const fullPath = path.join(this.mainShadowGit.workspaceRoot, filePath);
          this.mainShadowGit.approveAllChanges(fullPath);
        } catch (error) {
          console.error(`Error approving changes for ${filePath}:`, error);
        }
      }
      
      // Create the checkpoint
      const checkpoint = this.mainShadowGit.createCheckpoint(message);
      const filesCount = Object.keys(checkpoint.changes).length;
      
      this._view?.webview.postMessage({
        command: 'checkpointCreated',
        text: `Checkpoint created with ${filesCount} files`
      });
      
      // Refresh the view
      setTimeout(() => this.refresh(), 500);
      
    } catch (error) {
      this._view?.webview.postMessage({
        command: 'checkpointError',
        text: (error as Error).message
      });
    }
  }
  
  /**
   * Open a file in the editor
   * @param filePath - Relative path to the file
   */
  private async openFile(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.mainShadowGit.workspaceRoot, filePath);
      const document = await vscode.workspace.openTextDocument(fullPath);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file: ${(error as Error).message}`);
    }
  }
  
  /**
   * Open diff view for a file
   * @param filePath - Relative path to the file
   * @param type - Type of ShadowGit ('main' or 'working')
   * @param gitUri - Optional Git URI string for direct diffing (ignored)
   * @param gitType - Optional Git change type (working/index) (ignored)
   */
  private async openDiff(filePath: string, type: 'main' | 'working'): Promise<void> {
    try {
      const fullPath = path.join(this.mainShadowGit.workspaceRoot, filePath);
      
      if (type === 'main') {
        // Check if file exists
        if (!fs.existsSync(fullPath)) {
          vscode.window.showErrorMessage(`File ${filePath} does not exist`);
          return;
        }
        
        // DO NOT update the snapshot here as it would overwrite the baseline
        // Instead, just detect changes against the existing snapshot
        console.log(`Detecting changes for ${filePath} before diffing`);
        
        // Detect changes using the existing snapshot
        const changes = this.mainShadowGit.detectChanges(fullPath);
        console.log(`Detected ${changes.length} changes in ${filePath} for diff view`);
        
        // Only show diff if there are changes
        if (changes.length === 0) {
          vscode.window.showInformationMessage(`No changes detected in ${path.basename(filePath)}`);
          
          // Open the file in the editor for reference
          const document = await vscode.workspace.openTextDocument(fullPath);
          await vscode.window.showTextDocument(document);
          return;
        }
        
        // Use the main shadow git for diff
        await vscode.commands.executeCommand('shadowGit.openMainDiff', vscode.Uri.file(fullPath));
      } else {
        // For Git Changes tab, always use VS Code's native Git diff command
        try {
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Opening Git Diff',
            cancellable: false
          }, async (progress) => {
            progress.report({ message: 'Opening Git diff...' });
            
            // Use direct VS Code Git command
            const fileUri = vscode.Uri.file(fullPath);
            
            // Always use the direct Git diff command that uses git.openChange
            await vscode.commands.executeCommand('shadowGit.openDirectGitDiff', fileUri);
          
            progress.report({ message: 'Done' });
          });
        } catch (error) {
          console.error('Error opening Git diff:', error);
          vscode.window.showErrorMessage(`Failed to open Git diff: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open diff: ${(error as Error).message}`);
    }
  }
  
  /**
   * Set a commit as the base reference
   * @param commitId - ID of the commit to use as base
   */
  private setBaseCommit(commitId: string): void {
    // Store the base commit ID in workspace state
    this.context.workspaceState.update('shadowgit.baseCommit', commitId);
    this.workingShadowGit.setBaseCommit(commitId);
    vscode.window.showInformationMessage(`Set commit ${commitId.substring(0, 8)} as the new base reference`);
    this.refresh();
  }
  
  /**
   * Stage all changes in a file
   * @param filePath - Relative path to the file
   */
  private async stageFile(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.mainShadowGit.workspaceRoot, filePath);
      
      // Use both our ShadowGit and the actual Git
      await this.workingShadowGit.approveAllChanges(fullPath);
      await GitIntegration.stageFile(fullPath);
      
      vscode.window.showInformationMessage(`Staged all changes in ${path.basename(filePath)}`);
      this.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to stage file: ${(error as Error).message}`);
    }
  }
  
  /**
   * Unstage all changes in a file
   * @param filePath - Relative path to the file
   */
  private async unstageFile(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.mainShadowGit.workspaceRoot, filePath);
      
      // Use both our ShadowGit and the actual Git
      await this.workingShadowGit.disapproveAllChanges(fullPath);
      await GitIntegration.unstageFile(fullPath);
      
      vscode.window.showInformationMessage(`Unstaged all changes in ${path.basename(filePath)}`);
      this.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to unstage file: ${(error as Error).message}`);
    }
  }
}
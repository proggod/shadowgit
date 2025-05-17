import * as vscode from 'vscode';
import * as path from 'path';
import { ShadowGit } from './shadowGit';

/**
 * Message interface for communication with the webview
 */
interface WebviewMessage {
    command: string;
    type?: 'main' | 'working';
    file?: string;
    checkpoint?: string;
    [key: string]: unknown;
}

/**
 * Shadow Git Panel
 * Provides a webview interface for the Shadow Git extension
 */
export class ShadowGitPanel {
    public static currentPanel: ShadowGitPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private readonly _mainShadowGit: ShadowGit;
    private readonly _workingShadowGit: ShadowGit;
    private _disposables: vscode.Disposable[] = [];

    /**
     * Create or show the panel
     */
    public static createOrShow(
        extensionUri: vscode.Uri, 
        mainShadowGit: ShadowGit,
        workingShadowGit: ShadowGit
    ): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (ShadowGitPanel.currentPanel) {
            ShadowGitPanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'shadowGit',
            'Shadow Git',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'resources')]
            }
        );

        ShadowGitPanel.currentPanel = new ShadowGitPanel(
            panel, 
            extensionUri,
            mainShadowGit,
            workingShadowGit
        );
    }

    /**
     * Constructor for ShadowGitPanel
     */
    private constructor(
        panel: vscode.WebviewPanel, 
        extensionUri: vscode.Uri,
        mainShadowGit: ShadowGit,
        workingShadowGit: ShadowGit
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._mainShadowGit = mainShadowGit;
        this._workingShadowGit = workingShadowGit;

        // Set the webview's initial html content
        this._panel.webview.html = this._getHtmlForWebview();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => this._handleMessage(message),
            null,
            this._disposables
        );

        // Update the content when the panel is revealed
        this._panel.onDidChangeViewState(
            e => {
                if (e.webviewPanel.visible) {
                    this._sendDataToWebview();
                }
            },
            null,
            this._disposables
        );

        // Initial data send
        this._sendDataToWebview();
    }

    /**
     * Get webview HTML content
     */
    private _getHtmlForWebview(): string {
        // Get resource paths
        const scriptUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'resources', 'scripts', 'panel.js')
        );
        const styleUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'resources', 'styles', 'panel.css')
        );
        const nonce = this._getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src ${this._panel.webview.cspSource};">
            <title>Shadow Git</title>
            <link href="${styleUri}" rel="stylesheet" />
        </head>
        <body>
            <div class="container">
                <header>
                    <h1>Shadow Git</h1>
                    <div class="tab-container">
                        <button class="tab active" data-tab="main">Main System</button>
                        <button class="tab" data-tab="working">Working System</button>
                    </div>
                </header>
                
                <main>
                    <div class="tab-content active" id="main-content">
                        <div class="actions">
                            <button class="action-btn" id="main-take-snapshot">Take Snapshot</button>
                            <button class="action-btn" id="main-create-checkpoint">Create Checkpoint</button>
                            <button class="action-btn" id="main-open-diff">Open Diff</button>
                        </div>
                        
                        <div class="section">
                            <h2>Tracked Files</h2>
                            <div class="files-list" id="main-files-list">
                                <p class="no-items">No tracked files</p>
                            </div>
                        </div>
                        
                        <div class="section">
                            <h2>Checkpoints</h2>
                            <div class="checkpoint-list" id="main-checkpoint-list">
                                <p class="no-items">No checkpoints</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="tab-content" id="working-content">
                        <div class="actions">
                            <button class="action-btn" id="working-take-snapshot">Take Snapshot</button>
                            <button class="action-btn" id="working-create-checkpoint">Create Checkpoint</button>
                            <button class="action-btn" id="working-open-diff">Open Diff</button>
                        </div>
                        
                        <div class="section">
                            <h2>Tracked Files</h2>
                            <div class="files-list" id="working-files-list">
                                <p class="no-items">No tracked files</p>
                            </div>
                        </div>
                        
                        <div class="section">
                            <h2>Checkpoints</h2>
                            <div class="checkpoint-list" id="working-checkpoint-list">
                                <p class="no-items">No checkpoints</p>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
            
            <script nonce="${nonce}">
                const vscode = acquireVsCodeApi();
                
                // Handle tabs
                document.querySelectorAll('.tab').forEach(tab => {
                    tab.addEventListener('click', () => {
                        // Remove active class from all tabs
                        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                        
                        // Add active class to clicked tab and corresponding content
                        tab.classList.add('active');
                        document.getElementById(tab.dataset.tab + '-content').classList.add('active');
                    });
                });
                
                // Main system buttons
                document.getElementById('main-take-snapshot').addEventListener('click', () => {
                    vscode.postMessage({ command: 'takeSnapshot', type: 'main' });
                });
                
                document.getElementById('main-create-checkpoint').addEventListener('click', () => {
                    vscode.postMessage({ command: 'createCheckpoint', type: 'main' });
                });
                
                document.getElementById('main-open-diff').addEventListener('click', () => {
                    vscode.postMessage({ command: 'openDiff', type: 'main' });
                });
                
                // Working system buttons
                document.getElementById('working-take-snapshot').addEventListener('click', () => {
                    vscode.postMessage({ command: 'takeSnapshot', type: 'working' });
                });
                
                document.getElementById('working-create-checkpoint').addEventListener('click', () => {
                    vscode.postMessage({ command: 'createCheckpoint', type: 'working' });
                });
                
                document.getElementById('working-open-diff').addEventListener('click', () => {
                    vscode.postMessage({ command: 'openDiff', type: 'working' });
                });
                
                // Handle messages from the extension
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    if (message.command === 'updateData') {
                        updateFilesLists(message.mainFiles, message.workingFiles);
                        updateCheckpointLists(message.mainCheckpoints, message.workingCheckpoints);
                    }
                });
                
                function updateFilesLists(mainFiles, workingFiles) {
                    const mainFilesList = document.getElementById('main-files-list');
                    const workingFilesList = document.getElementById('working-files-list');
                    
                    // Update main files list
                    if (mainFiles && mainFiles.length > 0) {
                        mainFilesList.innerHTML = '';
                        mainFiles.forEach(file => {
                            const fileItem = document.createElement('div');
                            fileItem.className = 'file-item';
                            fileItem.innerHTML = \`
                                <div class="file-name">\${file}</div>
                                <div class="file-actions">
                                    <button class="file-action" data-action="openFile" data-file="\${file}" data-type="main">Open</button>
                                    <button class="file-action" data-action="compareFile" data-file="\${file}" data-type="main">Compare</button>
                                </div>
                            \`;
                            mainFilesList.appendChild(fileItem);
                        });
                    } else {
                        mainFilesList.innerHTML = '<p class="no-items">No tracked files</p>';
                    }
                    
                    // Update working files list
                    if (workingFiles && workingFiles.length > 0) {
                        workingFilesList.innerHTML = '';
                        workingFiles.forEach(file => {
                            const fileItem = document.createElement('div');
                            fileItem.className = 'file-item';
                            fileItem.innerHTML = \`
                                <div class="file-name">\${file}</div>
                                <div class="file-actions">
                                    <button class="file-action" data-action="openFile" data-file="\${file}" data-type="working">Open</button>
                                    <button class="file-action" data-action="compareFile" data-file="\${file}" data-type="working">Compare</button>
                                </div>
                            \`;
                            workingFilesList.appendChild(fileItem);
                        });
                    } else {
                        workingFilesList.innerHTML = '<p class="no-items">No tracked files</p>';
                    }
                    
                    // Add event listeners to file action buttons
                    document.querySelectorAll('.file-action').forEach(button => {
                        button.addEventListener('click', () => {
                            const action = button.dataset.action;
                            const file = button.dataset.file;
                            const type = button.dataset.type;
                            
                            if (action === 'openFile') {
                                vscode.postMessage({ command: 'openFile', file, type });
                            } else if (action === 'compareFile') {
                                vscode.postMessage({ command: 'compareFile', file, type });
                            }
                        });
                    });
                }
                
                function updateCheckpointLists(mainCheckpoints, workingCheckpoints) {
                    const mainCheckpointList = document.getElementById('main-checkpoint-list');
                    const workingCheckpointList = document.getElementById('working-checkpoint-list');
                    
                    // Update main checkpoints list
                    if (mainCheckpoints && mainCheckpoints.length > 0) {
                        mainCheckpointList.innerHTML = '';
                        mainCheckpoints.forEach(checkpoint => {
                            const checkpointItem = document.createElement('div');
                            checkpointItem.className = 'checkpoint-item';
                            const date = new Date(checkpoint.timestamp);
                            const formattedDate = \`\${date.toLocaleDateString()} \${date.toLocaleTimeString()}\`;
                            checkpointItem.innerHTML = \`
                                <div class="checkpoint-header">
                                    <div class="checkpoint-id">\${checkpoint.id.substring(0, 8)}</div>
                                    <div class="checkpoint-date">\${formattedDate}</div>
                                </div>
                                <div class="checkpoint-message">\${checkpoint.message}</div>
                                <div class="checkpoint-actions">
                                    <button class="checkpoint-action" data-action="applyCheckpoint" data-checkpoint="\${checkpoint.id}" data-type="main">Apply</button>
                                    <button class="checkpoint-action" data-action="compareCheckpoint" data-checkpoint="\${checkpoint.id}" data-type="main">Compare</button>
                                </div>
                            \`;
                            mainCheckpointList.appendChild(checkpointItem);
                        });
                    } else {
                        mainCheckpointList.innerHTML = '<p class="no-items">No checkpoints</p>';
                    }
                    
                    // Update working checkpoints list
                    if (workingCheckpoints && workingCheckpoints.length > 0) {
                        workingCheckpointList.innerHTML = '';
                        workingCheckpoints.forEach(checkpoint => {
                            const checkpointItem = document.createElement('div');
                            checkpointItem.className = 'checkpoint-item';
                            const date = new Date(checkpoint.timestamp);
                            const formattedDate = \`\${date.toLocaleDateString()} \${date.toLocaleTimeString()}\`;
                            checkpointItem.innerHTML = \`
                                <div class="checkpoint-header">
                                    <div class="checkpoint-id">\${checkpoint.id.substring(0, 8)}</div>
                                    <div class="checkpoint-date">\${formattedDate}</div>
                                </div>
                                <div class="checkpoint-message">\${checkpoint.message}</div>
                                <div class="checkpoint-actions">
                                    <button class="checkpoint-action" data-action="applyCheckpoint" data-checkpoint="\${checkpoint.id}" data-type="working">Apply</button>
                                    <button class="checkpoint-action" data-action="compareCheckpoint" data-checkpoint="\${checkpoint.id}" data-type="working">Compare</button>
                                </div>
                            \`;
                            workingCheckpointList.appendChild(checkpointItem);
                        });
                    } else {
                        workingCheckpointList.innerHTML = '<p class="no-items">No checkpoints</p>';
                    }
                    
                    // Add event listeners to checkpoint action buttons
                    document.querySelectorAll('.checkpoint-action').forEach(button => {
                        button.addEventListener('click', () => {
                            const action = button.dataset.action;
                            const checkpoint = button.dataset.checkpoint;
                            const type = button.dataset.type;
                            
                            if (action === 'applyCheckpoint') {
                                vscode.postMessage({ command: 'applyCheckpoint', checkpoint, type });
                            } else if (action === 'compareCheckpoint') {
                                vscode.postMessage({ command: 'compareCheckpoint', checkpoint, type });
                            }
                        });
                    });
                }
                
                // Request data refresh
                vscode.postMessage({ command: 'refreshData' });
            </script>
        </body>
        </html>`;
    }

    /**
     * Handle messages from the webview
     */
    private _handleMessage(message: WebviewMessage): void {
        switch (message.command) {
            case 'takeSnapshot':
                if (message.type === 'main') {
                    vscode.commands.executeCommand('shadowGit.takeMainSnapshot');
                } else if (message.type === 'working') {
                    vscode.commands.executeCommand('shadowGit.takeWorkingSnapshot');
                }
                break;

            case 'createCheckpoint':
                if (message.type === 'main') {
                    vscode.commands.executeCommand('shadowGit.createCheckpoint');
                } else if (message.type === 'working') {
                    vscode.commands.executeCommand('shadowGit.createWorkingCheckpoint');
                }
                break;

            case 'openDiff':
                vscode.commands.executeCommand('shadowGit.openDiff');
                break;

            case 'openFile':
                if (message.file) {
                    this._openFile(message.file);
                }
                break;

            case 'compareFile':
                if (message.file && message.type) {
                    this._compareFile(message.file, message.type);
                }
                break;

            case 'applyCheckpoint':
                if (message.checkpoint) {
                    vscode.commands.executeCommand('shadowGit.applyCheckpoint', message.checkpoint);
                }
                break;

            case 'compareCheckpoint':
                if (message.checkpoint) {
                    vscode.commands.executeCommand('shadowGit.compareWithCheckpoint', null, message.checkpoint);
                }
                break;

            case 'refreshData':
                this._sendDataToWebview();
                break;
        }
    }

    /**
     * Open a file in the editor
     */
    private _openFile(relativePath: string): void {
        try {
            const filePath = path.join(this._mainShadowGit.workspaceRoot, relativePath);
            vscode.workspace.openTextDocument(filePath).then((doc) => {
                vscode.window.showTextDocument(doc);
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${(error as Error).message}`);
        }
    }

    /**
     * Compare a file with its snapshot
     */
    private _compareFile(relativePath: string, type: 'main' | 'working'): void {
        try {
            const shadowGit = type === 'main' ? this._mainShadowGit : this._workingShadowGit;
            const filePath = path.join(shadowGit.workspaceRoot, relativePath);
            
            // Create temp file for the snapshot
            const tempPath = shadowGit.createTempSnapshotFile(relativePath);
            
            // Open the diff editor
            const leftUri = vscode.Uri.file(tempPath);
            const rightUri = vscode.Uri.file(filePath);
            
            vscode.commands.executeCommand('vscode.diff', 
                leftUri,
                rightUri,
                `Compare with ${type} Shadow Git: ${path.basename(filePath)}`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to compare file: ${(error as Error).message}`);
        }
    }

    /**
     * Send data to the webview
     */
    private _sendDataToWebview(): void {
        try {
            // Get tracked files for both shadow git systems
            const mainFiles = this._mainShadowGit.getTrackedFiles();
            const workingFiles = this._workingShadowGit.getTrackedFiles();
            
            // Get checkpoints for both shadow git systems
            const mainCheckpoints = this._mainShadowGit.getCheckpoints();
            const workingCheckpoints = this._workingShadowGit.getCheckpoints();
            
            // Send data to webview
            this._panel.webview.postMessage({
                command: 'updateData',
                mainFiles,
                workingFiles,
                mainCheckpoints,
                workingCheckpoints
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to send data to webview: ${(error as Error).message}`);
        }
    }

    /**
     * Refreshes the webview data
     */
    public refresh(): void {
        if (this._panel && this._panel.visible) {
            this._sendDataToWebview();
        }
    }

    /**
     * Generate a nonce string
     */
    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * Dispose of the panel
     */
    public dispose(): void {
        ShadowGitPanel.currentPanel = undefined;
        this._panel.dispose();
        
        // Clean up our resources
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}
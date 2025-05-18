// @ts-nocheck
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ShadowGit } from './shadowGit';
import { ShadowGitWithGit } from './shadowGitWithGit';
import { DiffDecorationProvider } from './diffProvider';
import { ShadowGitSCMProvider } from './scmProvider';
import { EnhancedShadowGitViewProvider } from './enhancedShadowGitView';
import { ShadowGitTimelineProvider } from './timelineProvider';
import { createShadowGitCommands } from './shadowGitCommands';
import { createSimpleDiffCommand } from './simpleDiffCommand';

/**
 * Activate the enhanced ShadowGit extension
 * @param context - Extension context
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Create output channel for logging
  const outputChannel = vscode.window.createOutputChannel('Shadow Git');
  outputChannel.show(true);
  outputChannel.appendLine('Enhanced Shadow Git extension activated');
  
  // Redirect console.log to VS Code output channel
  const originalConsoleLog = console.log;
  console.log = function(...args) {
    originalConsoleLog(...args);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    outputChannel.appendLine(message);
  };
  
  console.log('Enhanced Shadow Git extension is now active');
  
  // Initialize ShadowGit instances
  let mainShadowGit: ShadowGit | null = null;
  let workingShadowGit: ShadowGitWithGit | null = null;
  let mainDiffDecorationProvider: DiffDecorationProvider | null = null;
  let workingDiffDecorationProvider: DiffDecorationProvider | null = null;
  let mainSCMProvider: ShadowGitSCMProvider | null = null;
  let mainTimelineProvider: ShadowGitTimelineProvider | null = null;
  let enhancedViewProvider: EnhancedShadowGitViewProvider | null = null;

  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: 'Initializing Shadow Git',
      cancellable: false
    }, async (progress) => {
      try {
        // Create both ShadowGit instances
        progress.report({ message: 'Creating main Shadow Git instance...' });
        mainShadowGit = new ShadowGit(workspaceRoot, 'main');
        
        progress.report({ message: 'Creating working Shadow Git instance with Git integration...' });
        workingShadowGit = new ShadowGitWithGit(workspaceRoot, 'working');
        await workingShadowGit.initialize();
        
        // Create diff decoration providers (still needed for backwards compatibility)
        progress.report({ message: 'Setting up diff decorations...' });
        mainDiffDecorationProvider = new DiffDecorationProvider(context, mainShadowGit);
        workingDiffDecorationProvider = new DiffDecorationProvider(context, workingShadowGit as any); // Type compatibility
        
        // Create SCM provider for main ShadowGit (optional for working since we have Git)
        progress.report({ message: 'Creating SCM integration...' });
        mainSCMProvider = new ShadowGitSCMProvider(context, mainShadowGit);
        
        // Create timeline provider for main ShadowGit
        mainTimelineProvider = new ShadowGitTimelineProvider(mainShadowGit);
        
        // Register timeline if available
        if (vscode.workspace.getConfiguration('shadowGit').get('showCheckpointsInTimeline')) {
          try {
            // Check if the timeline API is available
            // @ts-ignore - using the timeline API dynamically
            if (vscode.timeline && typeof vscode.timeline.registerTimelineProvider === 'function') {
              // @ts-ignore - using the timeline API dynamically
              context.subscriptions.push(
                // @ts-ignore - using the timeline API dynamically
                vscode.timeline.registerTimelineProvider(['file', 'git'], mainTimelineProvider, {
                  scheme: 'file',
                  enableForWorkspace: true
                })
              );
            } else {
              console.log('Timeline API not found, skipping timeline integration');
            }
          } catch (error) {
            console.log('Timeline API not available, skipping timeline integration');
          }
        }
        
        // Register enhanced WebView provider
        progress.report({ message: 'Creating enhanced UI...' });
        enhancedViewProvider = new EnhancedShadowGitViewProvider(
          context,
          mainShadowGit,
          workingShadowGit
        );
        
        context.subscriptions.push(
          vscode.window.registerWebviewViewProvider('shadowGitView', enhancedViewProvider)
        );
        
        // Register specialized commands
        progress.report({ message: 'Setting up commands...' });
        
        // Use the simplified diff command instead of the complex one
        const simpleDiffCommands = createSimpleDiffCommand(
          context,
          mainShadowGit,
          workingShadowGit
        );
        
        // Register additional specialized commands (excluding diff commands)
        const commands = createShadowGitCommands(
          context,
          mainShadowGit,
          workingShadowGit,
          mainDiffDecorationProvider,
          workingDiffDecorationProvider
        );
        
        context.subscriptions.push(...simpleDiffCommands, ...commands);
        
        // Command: Take a snapshot in Main Shadow Git
        const takeMainSnapshotCommand = vscode.commands.registerCommand(
          'shadowGit.takeMainSnapshot', 
          async () => {
            if (!mainShadowGit) {
              vscode.window.showErrorMessage('Main Shadow Git not initialized');
              return;
            }
            
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
              vscode.window.showErrorMessage('No active editor');
              return;
            }
            
            try {
              const filePath = editor.document.uri.fsPath;
              await editor.document.save();
              
              const snapshot = mainShadowGit.takeSnapshot(filePath);
              const fileName = path.basename(filePath);
              
              vscode.window.showInformationMessage(`Checkpoint snapshot taken: ${fileName}`);
              
              enhancedViewProvider?.refresh();
              mainSCMProvider?.update();
            } catch (error) {
              vscode.window.showErrorMessage(`Failed to take snapshot: ${(error as Error).message}`);
            }
          }
        );
        
        // Command: Take a snapshot in Working Shadow Git
        const takeWorkingSnapshotCommand = vscode.commands.registerCommand(
          'shadowGit.takeWorkingSnapshot', 
          async () => {
            if (!workingShadowGit) {
              vscode.window.showErrorMessage('Working Shadow Git not initialized');
              return;
            }
            
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
              vscode.window.showErrorMessage('No active editor');
              return;
            }
            
            try {
              const filePath = editor.document.uri.fsPath;
              await editor.document.save();
              
              await workingShadowGit.takeSnapshot(filePath);
              const fileName = path.basename(filePath);
              
              vscode.window.showInformationMessage(`Comparison snapshot taken: ${fileName}`);
              
              enhancedViewProvider?.refresh();
            } catch (error) {
              vscode.window.showErrorMessage(`Failed to take snapshot: ${(error as Error).message}`);
            }
          }
        );
        
        // Command: Create checkpoint in main ShadowGit
        const createCheckpointCommand = vscode.commands.registerCommand(
          'shadowGit.createCheckpoint', 
          async () => {
            if (!mainShadowGit) {
              vscode.window.showErrorMessage('Main Shadow Git not initialized');
              return;
            }
            
            try {
              const message = await vscode.window.showInputBox({
                prompt: 'Enter a checkpoint message',
                placeHolder: 'What changes does this checkpoint include?'
              });
              
              if (!message) {
                return; // User cancelled
              }
              
              const checkpoint = mainShadowGit.createCheckpoint(message);
              vscode.window.showInformationMessage(`Checkpoint created: ${checkpoint.id.substring(0, 8)}`);
              
              enhancedViewProvider?.refresh();
              mainSCMProvider?.update();
              if (mainTimelineProvider) {
                mainTimelineProvider.refresh();
              }
            } catch (error) {
              vscode.window.showErrorMessage(`Failed to create checkpoint: ${(error as Error).message}`);
            }
          }
        );
        
        // Command: Create commit in working ShadowGit
        const createWorkingCommitCommand = vscode.commands.registerCommand(
          'shadowGit.createWorkingCheckpoint', 
          async () => {
            if (!workingShadowGit) {
              vscode.window.showErrorMessage('Working Shadow Git not initialized');
              return;
            }
            
            try {
              const message = await vscode.window.showInputBox({
                prompt: 'Enter a commit message',
                placeHolder: 'What changes does this comparison commit include?'
              });
              
              if (!message) {
                return; // User cancelled
              }
              
              const checkpoint = await workingShadowGit.createCheckpoint(message);
              vscode.window.showInformationMessage(`Comparison commit created: ${checkpoint.id.substring(0, 8)}`);
              
              enhancedViewProvider?.refresh();
            } catch (error) {
              vscode.window.showErrorMessage(`Failed to create commit: ${(error as Error).message}`);
            }
          }
        );
        
        // Command: Apply a checkpoint
        const applyCheckpointCommand = vscode.commands.registerCommand(
          'shadowGit.applyCheckpoint', 
          async (checkpointId: string) => {
            let targetShadowGit: ShadowGit | ShadowGitWithGit | null = null;
            let checkpointType = '';
            
            if (mainShadowGit && mainShadowGit.checkpoints.find(cp => cp.id === checkpointId)) {
              targetShadowGit = mainShadowGit;
              checkpointType = 'Checkpoint';
            } else if (workingShadowGit && workingShadowGit.checkpoints.find(cp => cp.id === checkpointId)) {
              targetShadowGit = workingShadowGit;
              checkpointType = 'Comparison commit';
            }
            
            if (!targetShadowGit) {
              vscode.window.showErrorMessage(`Checkpoint ${checkpointId} not found`);
              return;
            }
            
            try {
              const confirmApply = await vscode.window.showWarningMessage(
                `Are you sure you want to apply ${checkpointType} ${checkpointId.substring(0, 8)}? This will modify your files.`,
                { modal: true },
                'Apply'
              );
              
              if (confirmApply !== 'Apply') {
                return; // User cancelled
              }
              
              if (targetShadowGit instanceof ShadowGitWithGit) {
                await targetShadowGit.applyCheckpoint(checkpointId);
              } else {
                targetShadowGit.applyCheckpoint(checkpointId);
              }
              
              vscode.window.showInformationMessage(`${checkpointType} applied: ${checkpointId.substring(0, 8)}`);
              
              enhancedViewProvider?.refresh();
              mainSCMProvider?.update();
              if (mainTimelineProvider) {
                mainTimelineProvider.refresh();
              }
            } catch (error) {
              vscode.window.showErrorMessage(`Failed to apply ${checkpointType}: ${(error as Error).message}`);
            }
          }
        );
        
        // Register additional commands
        context.subscriptions.push(
          takeMainSnapshotCommand,
          takeWorkingSnapshotCommand,
          createCheckpointCommand,
          createWorkingCommitCommand,
          applyCheckpointCommand
        );
        
        // Create file watcher to detect file changes
        const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        fileWatcher.onDidChange(async uri => {
          // Skip files in .vscode/.shadowgit-*
          if (uri.fsPath.includes('.vscode/.shadowgit-')) {
            return;
          }
          
          // Check if this is a tracked file
          if (mainShadowGit) {
            const relativePath = path.relative(mainShadowGit.workspaceRoot, uri.fsPath);
            
            if (mainShadowGit.snapshots.has(relativePath)) {
              // Detect changes in main system
              mainShadowGit.detectChanges(uri.fsPath);
              mainSCMProvider?.update();
            }
            
            if (workingShadowGit && workingShadowGit.snapshots.has(relativePath)) {
              // Detect changes in working system
              await workingShadowGit.detectChanges(uri.fsPath);
            }
            
            // Refresh the view
            enhancedViewProvider?.refresh();
          }
        });
        
        context.subscriptions.push(fileWatcher);
        
        // Auto-snapshot on file open when setting is enabled
        if (vscode.workspace.getConfiguration('shadowGit').get('autoSnapshot')) {
          vscode.workspace.onDidOpenTextDocument(async document => {
            if (document.uri.scheme === 'file' && 
                !document.uri.fsPath.includes('.vscode/.shadowgit-') &&
                mainShadowGit && workingShadowGit) {
              try {
                mainShadowGit.takeSnapshot(document.uri.fsPath);
                await workingShadowGit.takeSnapshot(document.uri.fsPath);
                
                enhancedViewProvider?.refresh();
                mainSCMProvider?.update();
              } catch (error) {
                // Silently ignore errors
                console.error('Auto-snapshot failed:', error);
              }
            }
          });
        }
        
        // Show success message
        vscode.window.showInformationMessage('Enhanced Shadow Git initialized successfully');
      } catch (error) {
        vscode.window.showErrorMessage(`Failed to initialize Shadow Git: ${(error as Error).message}`);
        console.error('Initialization error:', error);
      }
    });
  } else {
    vscode.window.showErrorMessage('No workspace folder open. Shadow Git requires a workspace folder.');
  }
}

export function deactivate(): void {
  // Clean up resources
}
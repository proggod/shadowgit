import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ShadowGit } from './shadowGit';
import { ShadowGitWithGit } from './shadowGitWithGit';
import { DiffDecorationProvider } from './diffProvider';
import { ShadowGitFilesProvider, ShadowGitCheckpointsProvider } from './viewProvider';
import { ShadowGitSCMProvider } from './scmProvider';
import { ShadowGitViewProvider } from './shadowGitView';
import { EnhancedShadowGitViewProvider } from './enhancedShadowGitView';
import { ShadowGitTimelineProvider } from './timelineProvider';
import { createSimpleDiffCommand } from './simpleDiffCommand';
import { createWorkingDiffCommand } from './workingDiffCommand';
import { ShadowGitFileSystemProvider } from './shadowGitFileSystemProvider';
import { createGitDiffCommand } from './gitDiffCommand';
import { createHybridGitCommand } from './hybridGitCommand';
import { GitIntegration } from './gitIntegration';
import { createDebugDiffCommand } from './debugDiffCommand';
import { createDirectGitDiffCommand } from './directGitDiffCommand';

// Add ShadowGitType to types that can be imported
type ShadowGitType = 'main' | 'working';

// Define TimelineOptions interface for proper typing with timeline provider
interface TimelineOptions {
  cursor?: string;
  limit?: number;
}

/**
 * Activate the extension
 * @param context - Extension context
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Create output channel for logging with more verbose output
  // Always create a new output channel (VS Code API doesn't provide a way to find existing ones)
  const outputChannel = vscode.window.createOutputChannel('Shadow Git');
  outputChannel.clear(); // Clear any previous output
  outputChannel.show(true); // Show it now
  outputChannel.appendLine('Shadow Git extension activated - START');
  
  // Debug output to help troubleshoot
  console.log('SHADOW_GIT_DEBUG: Extension activation starting');
  
  try {
    // Add version info
    const packageJson = require('../package.json');
    outputChannel.appendLine("Shadow Git version: " + packageJson.version);
    console.log("SHADOW_GIT_DEBUG: Extension version " + packageJson.version);
    
    // Log environment details
    outputChannel.appendLine("VS Code version: " + vscode.version);
    outputChannel.appendLine("Platform: " + process.platform);
    console.log("SHADOW_GIT_DEBUG: Running on " + process.platform + ", VS Code " + vscode.version);
  } catch (error) {
    outputChannel.appendLine("Error loading package info: " + error);
    console.error('SHADOW_GIT_DEBUG: Error loading package info:', error);
  }
  
  // Redirect console.log to VS Code output channel
  const originalConsoleLog = console.log;
  console.log = function(...args) {
    originalConsoleLog(...args);
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(' ');
    outputChannel.appendLine(message);
  };
  
  console.log('Shadow Git extension is now active');
  console.log('Console logging redirected to output channel');
  
  outputChannel.appendLine('Initializing ShadowGit instances...');
  console.log('SHADOW_GIT_DEBUG: Initializing ShadowGit instances');
  
  // Initialize ShadowGit instances
  let mainShadowGit: ShadowGit | null = null;
  let workingShadowGit: ShadowGitWithGit | null = null;
  let mainDiffDecorationProvider: DiffDecorationProvider | null = null;
  let workingDiffDecorationProvider: DiffDecorationProvider | null = null;
  let mainSCMProvider: ShadowGitSCMProvider | null = null;
  let workingSCMProvider: ShadowGitSCMProvider | null = null;
  let mainTimelineProvider: ShadowGitTimelineProvider | null = null;
  let workingTimelineProvider: ShadowGitTimelineProvider | null = null;

  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    outputChannel.appendLine(`Workspace root: ${workspaceRoot}`);
    console.log("SHADOW_GIT_DEBUG: Workspace root: ${workspaceRoot}");
    
    try {
      // Create main ShadowGit instance
      outputChannel.appendLine('Creating main ShadowGit instance');
      console.log('SHADOW_GIT_DEBUG: Creating main ShadowGit instance');
      mainShadowGit = new ShadowGit(workspaceRoot, 'main');
      outputChannel.appendLine('Main ShadowGit created successfully');
      
      // Initialize ShadowGitWithGit for the working tab
      try {
        outputChannel.appendLine('Creating working ShadowGit with Git integration');
        console.log('SHADOW_GIT_DEBUG: Creating ShadowGitWithGit');
        
        workingShadowGit = new ShadowGitWithGit(workspaceRoot, 'working');
        
        // Initialize the working shadow git with Git integration
        outputChannel.appendLine('Initializing working ShadowGit with Git');
        await workingShadowGit.initialize();
        outputChannel.appendLine('Working Shadow Git initialized successfully');
        console.log('SHADOW_GIT_DEBUG: Working ShadowGit initialized successfully');
      } catch (error) {
        outputChannel.appendLine(`Failed to initialize Working Shadow Git: ${error}`);
        console.error('SHADOW_GIT_DEBUG: Failed to initialize Working Shadow Git:', error);
        vscode.window.showErrorMessage(`Failed to initialize Working Shadow Git: ${(error as Error).message}`);
        // We'll continue without workingShadowGit and just use mainShadowGit
        workingShadowGit = null;
      }
    } catch (error) {
      outputChannel.appendLine(`Error creating ShadowGit instances: ${error}`);
      console.error('SHADOW_GIT_DEBUG: Error creating ShadowGit instances:', error);
      vscode.window.showErrorMessage(`Failed to initialize Shadow Git: ${(error as Error).message}`);
    }
    
    try {
      // Register our custom file system provider for shadowgit: URIs
      // This is necessary to enable proper diff views with staging buttons
      if (mainShadowGit) {
        try {
          outputChannel.appendLine('Registering ShadowGit file system provider');
          console.log('SHADOW_GIT_DEBUG: Registering file system provider');
          
          // Create the file system provider
          const fileSystemProvider = new ShadowGitFileSystemProvider(
            mainShadowGit, 
            workingShadowGit, 
            outputChannel
          );
          
          // Register the provider with VS Code for our custom URI scheme
          const fsRegistration = vscode.workspace.registerFileSystemProvider(
            'shadowgit', 
            fileSystemProvider, 
            { isCaseSensitive: true }
          );
          
          // Add to disposables so it gets cleaned up when extension is deactivated
          context.subscriptions.push(fsRegistration);
          
          outputChannel.appendLine('ShadowGit file system provider registered successfully');
          console.log('SHADOW_GIT_DEBUG: File system provider registered successfully');
        } catch (error) {
          outputChannel.appendLine(`Error registering file system provider: ${error}`);
          console.error('SHADOW_GIT_DEBUG: Error registering file system provider:', error);
        }
      }
    } catch (error) {
      outputChannel.appendLine(`Error creating providers: ${error}`);
      console.error('SHADOW_GIT_DEBUG: Error creating providers:', error);
      vscode.window.showErrorMessage(`Failed to initialize providers: ${(error as Error).message}`);
    }
    
    // Note: We properly register timeline provider if it's enabled in settings
    try {
      outputChannel.appendLine('Checking timeline API availability');
      console.log('SHADOW_GIT_DEBUG: Checking timeline API availability');
      
      // Check if timeline integration is enabled in settings
      if (mainShadowGit && vscode.workspace.getConfiguration('shadowGit').get('showCheckpointsInTimeline')) {
        try {
          outputChannel.appendLine('Timeline integration enabled in settings');
          
          // Create the timeline provider
          mainTimelineProvider = new ShadowGitTimelineProvider(mainShadowGit);
          outputChannel.appendLine('Created ShadowGitTimelineProvider instance');
          
          // Use a compatible approach to register the timeline provider
          // The API has changed since this code was written, so we need to fix it
          // @ts-ignore - The timeline API might not be fully declared in the TypeScript definitions
          if (vscode.timeline) {
            outputChannel.appendLine('Timeline API found, attempting to register provider');
            
            // Register the timeline provider properly
            // Note: We register for both 'file' and 'git' sources since our checkpoints 
            // are relevant to both types of resources
            // @ts-ignore - Using the timeline API dynamically
            const disposable = vscode.timeline.registerTimelineProvider(
              ['file', 'git'],
              {
                id: 'shadowgit',
                label: 'Shadow Git',
                // @ts-ignore - Using the timeline API dynamically with proper types
                provideTimeline: (uri: vscode.Uri, options: TimelineOptions, token: vscode.CancellationToken) => {
                  return mainTimelineProvider!.provideTimeline(uri, options, token);
                },
                onDidChange: mainTimelineProvider!.onDidChange
              }
            );
            
            context.subscriptions.push(disposable);
            outputChannel.appendLine('Timeline provider registered successfully');
            console.log('SHADOW_GIT_DEBUG: Timeline provider registered successfully');
          } else {
            outputChannel.appendLine('Timeline API not found, skipping');
            console.log('SHADOW_GIT_DEBUG: Timeline API not found, skipping timeline integration');
          }
        } catch (error) {
          outputChannel.appendLine(`Timeline API error: ${error}`);
          console.log('SHADOW_GIT_DEBUG: Timeline API error:', error);
        }
      } else {
        outputChannel.appendLine('Timeline integration disabled in settings or no mainShadowGit, skipping');
        console.log('SHADOW_GIT_DEBUG: Timeline integration disabled in settings or no mainShadowGit');
      }
    } catch (error) {
      outputChannel.appendLine(`Error in timeline setup: ${error}`);
      console.error('SHADOW_GIT_DEBUG: Error in timeline setup:', error);
    }
  }
  
  try {
    outputChannel.appendLine('Setting up WebView provider');
    console.log('SHADOW_GIT_DEBUG: Setting up WebView provider');
    
    if (mainShadowGit) {
      // Initialize working shadow git if it wasn't already done
      if (!workingShadowGit) {
        try {
          outputChannel.appendLine('Creating working ShadowGit for enhanced WebView');
          console.log('SHADOW_GIT_DEBUG: Creating working ShadowGit for enhanced WebView');
          
          workingShadowGit = new ShadowGitWithGit(mainShadowGit.workspaceRoot, 'working');
          await workingShadowGit.initialize();
          
          outputChannel.appendLine('Working ShadowGit initialized successfully');
          console.log('SHADOW_GIT_DEBUG: Working ShadowGit initialized successfully');
        } catch (error) {
          outputChannel.appendLine(`Failed to initialize Working ShadowGit: ${error}`);
          console.error('SHADOW_GIT_DEBUG: Failed to initialize Working ShadowGit:', error);
          // Continue even if workingShadowGit failed, we'll just use the single-tab view
        }
      }
      
      // Choose the appropriate WebView provider based on what's available
      if (workingShadowGit) {
        // Use the enhanced provider with both shadow git instances
        outputChannel.appendLine('Creating WebView provider with EnhancedShadowGitViewProvider');
        console.log('SHADOW_GIT_DEBUG: Creating EnhancedShadowGitViewProvider');
        
        const enhancedViewProvider = new EnhancedShadowGitViewProvider(
          context, 
          mainShadowGit, 
          workingShadowGit
        );
        
        // Register the enhanced WebView provider
        outputChannel.appendLine('Registering Enhanced WebView provider');
        console.log('SHADOW_GIT_DEBUG: Registering Enhanced WebView provider');
        
        context.subscriptions.push(
          vscode.window.registerWebviewViewProvider('shadowGitView', enhancedViewProvider)
        );
      } else {
        // Fall back to the regular provider with just mainShadowGit
        outputChannel.appendLine('Creating WebView provider with ShadowGitViewProvider (fallback)');
        console.log('SHADOW_GIT_DEBUG: Creating ShadowGitViewProvider (fallback)');
        
        const shadowGitViewProvider = new ShadowGitViewProvider(context, mainShadowGit);
        
        // Register the WebView provider
        outputChannel.appendLine('Registering WebView provider');
        console.log('SHADOW_GIT_DEBUG: Registering WebView provider');
        
        context.subscriptions.push(
          vscode.window.registerWebviewViewProvider('shadowGitView', shadowGitViewProvider)
        );
      }
      
      outputChannel.appendLine('WebView provider registered successfully');
      console.log('SHADOW_GIT_DEBUG: WebView provider registered successfully');
    } else {
      outputChannel.appendLine('Skipping WebView registration - no mainShadowGit available');
      console.log('SHADOW_GIT_DEBUG: Skipping WebView registration - no mainShadowGit');
    }
  } catch (error) {
    outputChannel.appendLine(`Error setting up WebView: ${error}`);
    console.error('SHADOW_GIT_DEBUG: Error setting up WebView:', error);
    vscode.window.showErrorMessage(`Failed to initialize WebView: ${(error as Error).message}`);
  }
  
  // Add more debug logging before command registration
  outputChannel.appendLine('Registering extension commands');
  console.log('SHADOW_GIT_DEBUG: Registering commands');
  
  // Command: Take a snapshot in both Shadow Git systems
  const takeSnapshotCommand = vscode.commands.registerCommand('shadowGit.takeSnapshot', async () => {
    outputChannel.appendLine('takeSnapshot command invoked');
    
    if (!mainShadowGit) {
      vscode.window.showErrorMessage('No workspace folder open');
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
      
      // Take snapshot in main ShadowGit only
      outputChannel.appendLine(`Taking snapshot of ${filePath}`);
      const mainSnapshot = mainShadowGit.takeSnapshot(filePath);
      
      const fileName = path.basename(filePath);
      outputChannel.appendLine(`Snapshot taken successfully: ${fileName}`);
      
      vscode.window.showInformationMessage(`Snapshot taken in Main Shadow Git: ${fileName}`);
      
      // No UI to refresh since providers are disabled
      outputChannel.appendLine('Skipping UI refresh (providers are disabled)');
      console.log('SHADOW_GIT_DEBUG: Skipping UI refresh');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to take snapshot: ${(error as Error).message}`);
    }
  });
  
  // Command: Take a snapshot in Main Shadow Git only - Enhanced to handle all open editors
  const takeMainSnapshotCommand = vscode.commands.registerCommand('shadowGit.takeMainSnapshot', async () => {
    if (!mainShadowGit) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }
    
    // Get all visible text editors
    const allOpenEditors = vscode.window.visibleTextEditors;
    
    if (allOpenEditors.length === 0) {
      vscode.window.showErrorMessage('No open editors to snapshot');
      return;
    }
    
    try {
      // Create progress indicator
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Taking Checkpoint Snapshots',
        cancellable: false
      }, async (progress) => {
        // Track how many files we snapshot
        let fileCount = 0;
        
        // Process each editor
        for (const editor of allOpenEditors) {
          // Skip non-file schemes and shadow git files
          if (editor.document.uri.scheme !== 'file' || 
              editor.document.uri.fsPath.includes('.vscode/.shadowgit-')) {
            continue;
          }
          
          try {
            // Update progress
            progress.report({ 
              message: `Processing ${path.basename(editor.document.uri.fsPath)}`,
              increment: 100 / allOpenEditors.length
            });
            
            // Save the document first
            await editor.document.save();
            
            // Take the snapshot
            const filePath = editor.document.uri.fsPath;
            if (mainShadowGit) {
              mainShadowGit.takeSnapshot(filePath);
            }
            fileCount++;
          } catch (error) {
            console.error(`Failed to take snapshot of ${editor.document.uri.fsPath}:`, error);
          }
        }
        
        // Show success message
        if (fileCount > 0) {
          vscode.window.showInformationMessage(`Snapshots taken of ${fileCount} files`);
        } else {
          vscode.window.showInformationMessage('No new snapshots taken');
        }
        
        // Refresh UI
        mainSCMProvider?.update();
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to take snapshots: ${(error as Error).message}`);
    }
  });
  
  // Command: Take a snapshot in Working Shadow Git only
  const takeWorkingSnapshotCommand = vscode.commands.registerCommand('shadowGit.takeWorkingSnapshot', async () => {
    if (!workingShadowGit) {
      vscode.window.showErrorMessage('No workspace folder open');
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
      
      // Take snapshot in Working ShadowGit only
      await workingShadowGit.takeSnapshot(filePath);
      
      const fileName = path.basename(filePath);
      
      vscode.window.showInformationMessage(`Snapshot taken in Working system: ${fileName}`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to take snapshot: ${(error as Error).message}`);
    }
  });
  
  // Register diff commands
  outputChannel.appendLine('Registering diff commands');
  console.log('SHADOW_GIT_DEBUG: Registering diff commands');
  
  // Register simple diff commands
  let mainDiffCommands: vscode.Disposable[] = [];
  
  if (mainShadowGit) {
    try {
      outputChannel.appendLine('Creating simple diff command');
      console.log('SHADOW_GIT_DEBUG: Creating simple diff command');
      
      // Use the simple diff command implementation
      mainDiffCommands = createSimpleDiffCommand(context, mainShadowGit, workingShadowGit!);
      
      outputChannel.appendLine(`Created ${mainDiffCommands.length} diff commands`);
      console.log("SHADOW_GIT_DEBUG: Created ${mainDiffCommands.length} diff commands");
    } catch (error) {
      outputChannel.appendLine(`Error creating diff commands: ${error}`);
      console.error('SHADOW_GIT_DEBUG: Error creating diff commands:', error);
    }
  }
  
  // Use direct Git command approach for best compatibility
  let workingDiffCommand: vscode.Disposable = vscode.commands.registerCommand('shadowGit.openWorkingDiff', async (uri: vscode.Uri, commit?: string) => {
    outputChannel.appendLine('Opening working diff with direct Git command integration');
    console.log('SHADOW_GIT_DEBUG: Opening diff using git.openChange for staging buttons');
    
    try {
      // Use the direct Git command that calls git.openChange directly
      // Pass along the commit parameter if provided
      await vscode.commands.executeCommand('shadowGit.openDirectGitDiff', uri, commit);
    } catch (error) {
      outputChannel.appendLine(`Error in openWorkingDiff: ${error}`);
      console.error('Error in openWorkingDiff:', error);
      
      // Try hybrid approach as first fallback
      try {
        outputChannel.appendLine('Falling back to hybrid Git/ShadowGit approach');
        await vscode.commands.executeCommand('shadowGit.openHybridDiff', uri);
      } catch (hybridError) {
        // Fall back to simple diff if anything fails
        outputChannel.appendLine('Falling back to simple diff');
        vscode.commands.executeCommand('shadowGit.openSimpleWorkingDiff', uri);
      }
    }
  });
  
  // Command: Compare with checkpoint
  const compareWithCheckpointCommand = vscode.commands.registerCommand('shadowGit.compareWithCheckpoint', async (uri: vscode.Uri, checkpointId: string) => {
    // Determine which ShadowGit instance has this checkpoint
    let targetShadowGit: ShadowGit | null = null;
    
    if (mainShadowGit && mainShadowGit.checkpoints.find(cp => cp.id === checkpointId)) {
      targetShadowGit = mainShadowGit;
    } else if (workingShadowGit && workingShadowGit.checkpoints.find(cp => cp.id === checkpointId)) {
      targetShadowGit = workingShadowGit as any;
    }
    
    if (!targetShadowGit) {
      vscode.window.showErrorMessage(`Checkpoint ${checkpointId} not found`);
      return;
    }
    
    try {
      const filePath = uri.fsPath;
      const relativePath = path.relative(targetShadowGit.workspaceRoot, filePath);
      
      // Get checkpoint
      const checkpoint = targetShadowGit.checkpoints.find(cp => cp.id === checkpointId)!;
      
      // Only continue if the checkpoint affected this file
      if (!checkpoint.changes[relativePath]) {
        vscode.window.showInformationMessage(`Checkpoint ${checkpointId.substring(0, 8)} does not affect this file`);
        return;
      }
      
      // Create temp file for the snapshot
      const tempPath = targetShadowGit.createTempSnapshotFile(relativePath);
      
      // Open the diff editor
      const leftUri = vscode.Uri.file(tempPath);
      
      await vscode.commands.executeCommand('vscode.diff', 
        leftUri,
        uri,
        `Compare with ${targetShadowGit.type} Checkpoint: ${checkpoint.message}`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to compare with checkpoint: ${(error as Error).message}`);
    }
  });
  
  // Command: Compare with HEAD
  const compareWithHeadCommand = vscode.commands.registerCommand('shadowGit.compareWithHead', async (shadowGitType: ShadowGitType) => {
    const targetShadowGit = shadowGitType === 'main' ? mainShadowGit : workingShadowGit;
    
    if (!targetShadowGit) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }
    
    try {
      const filePath = editor.document.uri.fsPath;
      const relativePath = path.relative(targetShadowGit.workspaceRoot, filePath);
      
      // Get latest checkpoint for this file
      const checkpoints = targetShadowGit.getCheckpoints()
        .filter(cp => cp.changes[relativePath])
        .sort((a, b) => b.timestamp - a.timestamp);
      
      if (checkpoints.length === 0) {
        vscode.window.showInformationMessage(`No checkpoints found for this file in ${shadowGitType} Shadow Git`);
        return;
      }
      
      const latestCheckpoint = checkpoints[0];
      
      // Create temp file for the latest checkpoint
      const tempPath = targetShadowGit.createTempSnapshotFile(relativePath);
      
      // Open the diff editor
      const leftUri = vscode.Uri.file(tempPath);
      const rightUri = editor.document.uri;
      
      await vscode.commands.executeCommand('vscode.diff', 
        leftUri,
        rightUri,
        `Compare with ${shadowGitType} HEAD: ${latestCheckpoint.message}`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to compare with HEAD: ${(error as Error).message}`);
    }
  });
  
  // Command: Compare with specific Shadow Git
  const compareWithShadowGitCommand = vscode.commands.registerCommand('shadowGit.compareWithShadowGit', async () => {
    if (!mainShadowGit || !workingShadowGit) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }
    
    try {
      const filePath = editor.document.uri.fsPath;
      const relativePath = path.relative(mainShadowGit.workspaceRoot, filePath);
      
      // Check if snapshots exist in either system
      const hasMainSnapshot = mainShadowGit.snapshots.has(relativePath);
      const hasWorkingSnapshot = workingShadowGit.snapshots.has(relativePath);
      
      if (!hasMainSnapshot && !hasWorkingSnapshot) {
        vscode.window.showWarningMessage('No snapshots found for this file. Take a snapshot first.');
        return;
      }
      
      // Let user choose which Shadow Git to compare with
      const options = [];
      if (hasMainSnapshot) {
        options.push({ label: 'Main Shadow Git', value: 'main', description: 'Compare with Main snapshot' });
      }
      if (hasWorkingSnapshot) {
        options.push({ label: 'Working Shadow Git', value: 'working', description: 'Compare with Working snapshot' });
      }
      
      const choice = await vscode.window.showQuickPick(
        options,
        { placeHolder: 'Select Shadow Git to compare with' }
      );
      
      if (!choice) {
        return; // User cancelled
      }
      
      // Choose the correct shadow git system
      const targetShadowGit = choice.value === 'main' ? mainShadowGit : workingShadowGit;
      
      // Create temp file for the snapshot
      const tempPath = targetShadowGit.createTempSnapshotFile(relativePath);
      
      // Open the diff editor - simple diff without custom decorations
      // This should allow the standard VS Code Git diff to take over
      const leftUri = vscode.Uri.file(tempPath);
      const rightUri = editor.document.uri;
      
      await vscode.commands.executeCommand('vscode.diff', 
        leftUri,
        rightUri,
        `Compare with ${choice.value} Shadow Git: ${path.basename(filePath)}`
      );
      
      // Skip registering for decoration to avoid overriding native VS Code Git icons
      // This comment explains why we removed the code:
      // We don't want custom decorations and icons in the diff view
      // VS Code's built-in Git integration provides better diff decorations with staging icons
      
    } catch (error) {
      vscode.window.showErrorMessage(`Error: ${(error as Error).message}`);
    }
  });
  
  // Command: Approve a change (for main ShadowGit)
  const approveChangeCommand = vscode.commands.registerCommand('shadowGit.approveChange', async (uri: vscode.Uri, changeId: number) => {
    console.log("shadowGit.approveChange command invoked with URI: ${uri}, changeId: ${changeId}");
    
    if (!mainShadowGit) {
      vscode.window.showErrorMessage('No workspace folder open');
      console.log('No workspace folder open');
      return;
    }
    
    try {
      const filePath = uri.fsPath;
      console.log("Approving change ${changeId} in file ${filePath}");
      
      const success = mainShadowGit.approveChange(filePath, changeId);
      
      if (success) {
        console.log("Change approved successfully, refreshing decorations");
        mainDiffDecorationProvider!.refreshDecorations(uri);
        mainSCMProvider?.update();
        vscode.window.showInformationMessage(`Change approved`);
      } else {
        console.log(`Change not found: ${changeId}`);
        vscode.window.showErrorMessage(`Change not found: ${changeId}`);
      }
    } catch (error) {
      console.log(`Failed to approve change: ${(error as Error).message}`);
      vscode.window.showErrorMessage(`Failed to approve change: ${(error as Error).message}`);
    }
  });
  
  // Command: Disapprove a change (for main ShadowGit)
  const disapproveChangeCommand = vscode.commands.registerCommand('shadowGit.disapproveChange', async (uri: vscode.Uri, changeId: number) => {
    if (!mainShadowGit) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }
    
    try {
      const filePath = uri.fsPath;
      const success = mainShadowGit.disapproveChange(filePath, changeId);
      
      if (success) {
        mainDiffDecorationProvider!.refreshDecorations(uri);
        mainSCMProvider?.update();
        vscode.window.showInformationMessage(`Change disapproved`);
      } else {
        vscode.window.showErrorMessage(`Change not found: ${changeId}`);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to disapprove change: ${(error as Error).message}`);
    }
  });
  
  // Command: Approve all changes in a file (for main ShadowGit)
  const approveAllChangesCommand = vscode.commands.registerCommand('shadowGit.approveAllChanges', async () => {
    if (!mainShadowGit) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }
    
    try {
      const filePath = editor.document.uri.fsPath;
      const count = mainShadowGit.approveAllChanges(filePath);
      
      mainDiffDecorationProvider!.refreshDecorations(editor.document.uri);
      mainSCMProvider?.update();
      vscode.window.showInformationMessage(`Approved ${count} changes`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to approve changes: ${(error as Error).message}`);
    }
  });
  
  // Command: Disapprove all changes in a file (for main ShadowGit)
  const disapproveAllChangesCommand = vscode.commands.registerCommand('shadowGit.disapproveAllChanges', async () => {
    if (!mainShadowGit) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }
    
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return;
    }
    
    try {
      const filePath = editor.document.uri.fsPath;
      const count = mainShadowGit.disapproveAllChanges(filePath);
      
      mainDiffDecorationProvider!.refreshDecorations(editor.document.uri);
      mainSCMProvider?.update();
      vscode.window.showInformationMessage(`Disapproved ${count} changes`);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to disapprove changes: ${(error as Error).message}`);
    }
  });
  
  // Command: Create a checkpoint (for main ShadowGit)
  const createCheckpointCommand = vscode.commands.registerCommand('shadowGit.createCheckpoint', async () => {
    if (!mainShadowGit) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }
    
    try {
      // Show progress indicator while taking snapshots of all project files
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Preparing Checkpoint',
        cancellable: false
      }, async (progress) => {
        progress.report({ message: 'Taking snapshots of all project files...' });
        
        // Get all files in the project (excluding those in .gitignore)
        outputChannel.appendLine('Finding all files in project for checkpoint');
        console.log('SHADOW_GIT_DEBUG: Finding all files in project for checkpoint');
        
        // Find all files using VS Code workspace find files API
        const files = await vscode.workspace.findFiles(
          '**/*.*', // Include all files
          '**/{node_modules,.git,.vscode,.vscode-insiders,dist,build}/**' // Exclude common directories
        );
        
        outputChannel.appendLine(`Found ${files.length} files in project`);
        console.log("SHADOW_GIT_DEBUG: Found ${files.length} files in project");
        
        // Take snapshots of all files
        let processedCount = 0;
        for (const file of files) {
          try {
            // Skip very large files, binary files, etc.
            const stats = fs.statSync(file.fsPath);
            if (stats.size > 1024 * 1024) { // Skip files larger than 1MB
              continue;
            }
            
            // Take snapshot (with null check even though we've already checked above)
            if (mainShadowGit) {
              mainShadowGit.takeSnapshot(file.fsPath);
              processedCount++;
            }
            
            // Update progress periodically
            if (processedCount % 10 === 0) {
              progress.report({ 
                message: `Processing files... ${processedCount}/${files.length}`,
                increment: (10 / files.length) * 100
              });
            }
          } catch (error) {
            // Skip files that can't be processed
            console.error(`Failed to take snapshot of ${file.fsPath}:`, error);
          }
        }
        
        outputChannel.appendLine(`Processed ${processedCount} files for checkpoint`);
        console.log("SHADOW_GIT_DEBUG: Processed ${processedCount} files for checkpoint");
      });
      
      // Now prompt for checkpoint message
      const message = await vscode.window.showInputBox({
        prompt: 'Enter a checkpoint message',
        placeHolder: 'What changes does this checkpoint include?'
      });
      
      if (!message) {
        return; // User cancelled
      }
      
      // Create the checkpoint
      outputChannel.appendLine(`Creating checkpoint with message: ${message}`);
      console.log("SHADOW_GIT_DEBUG: Creating checkpoint with message: ${message}");
      
      const checkpoint = mainShadowGit.createCheckpoint(message);
      
      // Show information about the checkpoint files
      const filesCount = Object.keys(checkpoint.changes).length;
      const filesList = Object.keys(checkpoint.changes).join(', ');
      
      outputChannel.appendLine(`Created checkpoint ${checkpoint.id} with message "${message}"`);
      outputChannel.appendLine(`Checkpoint contains ${filesCount} files: ${filesList}`);
      console.log("SHADOW_GIT_DEBUG: Created checkpoint with ${filesCount} files: ${filesList}");
      
      // More descriptive success message
      vscode.window.showInformationMessage(
        `Checkpoint created: ${checkpoint.id.substring(0, 8)} with ${filesCount} files`
      );
      
      // Refresh WebView - first try through commands
      try {
        // Force refresh the WebView
        outputChannel.appendLine(`Refreshing WebView after checkpoint creation`);
        await vscode.commands.executeCommand('workbench.view.extension.shadowGitView');
        await vscode.commands.executeCommand('shadowGit.refresh');
      } catch (refreshError) {
        outputChannel.appendLine(`Error refreshing view: ${refreshError}`);
      }
      
      // Refresh everything
      mainSCMProvider?.update();
      if (mainTimelineProvider) {
        mainTimelineProvider.refresh();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create checkpoint: ${(error as Error).message}`);
    }
  });
  
  // Command: Create a working checkpoint (for working ShadowGit)
  const createWorkingCheckpointCommand = vscode.commands.registerCommand('shadowGit.createWorkingCheckpoint', async () => {
    if (!workingShadowGit) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }
    
    try {
      const message = await vscode.window.showInputBox({
        prompt: 'Enter a working checkpoint message',
        placeHolder: 'What changes does this working checkpoint include?'
      });
      
      if (!message) {
        return; // User cancelled
      }
      
      const checkpoint = await workingShadowGit.createCheckpoint(message);
      vscode.window.showInformationMessage(`Working checkpoint created: ${checkpoint.id.substring(0, 8)}`);
      
      // Refresh everything
      // No UI to refresh since we're not using working view/SCM providers
      // Commented out since workingTimelineProvider isn't initialized
      // if (workingTimelineProvider) {
      //   workingTimelineProvider.refresh();
      // }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create working checkpoint: ${(error as Error).message}`);
    }
  });
  
  // Command: Delete a checkpoint
  const deleteCheckpointCommand = vscode.commands.registerCommand('shadowGit.deleteCheckpoint', async (checkpointId: string) => {
    outputChannel.appendLine(`deleteCheckpoint command invoked for checkpoint ${checkpointId}`);
    console.log(`SHADOW_GIT_DEBUG: deleteCheckpoint command invoked for checkpoint ${checkpointId}`);
    console.log(`SHADOW_GIT_DEBUG: Checkpoint ID type: ${typeof checkpointId}, value: "${checkpointId}"`);
    
    // Extra validation for the checkpoint ID
    if (!checkpointId || typeof checkpointId !== 'string') {
      const errorMsg = `Invalid checkpoint ID: ${checkpointId}`;
      outputChannel.appendLine(errorMsg);
      console.error(`SHADOW_GIT_DEBUG: ${errorMsg}`);
      vscode.window.showErrorMessage(errorMsg);
      return;
    }
    
    // Strip any whitespace that might have come from the UI
    const cleanCheckpointId = checkpointId.trim();
    
    // Determine which ShadowGit instance has this checkpoint
    let targetShadowGit: ShadowGit | null = null;
    let foundCheckpoint = null;
    
    if (mainShadowGit) {
      // Log all available checkpoints for debugging
      const mainCheckpoints = mainShadowGit.getCheckpoints();
      console.log("SHADOW_GIT_DEBUG: Available main checkpoints: ${mainCheckpoints.map(cp => cp.id).join(', ')}");
      
      // Find checkpoint with partial match (first 8 chars)
      foundCheckpoint = mainCheckpoints.find(cp => 
        cp.id === cleanCheckpointId || cp.id.startsWith(cleanCheckpointId) || cleanCheckpointId.startsWith(cp.id)
      );
      
      if (foundCheckpoint) {
        targetShadowGit = mainShadowGit;
        outputChannel.appendLine(`Found checkpoint in main ShadowGit instance: ${foundCheckpoint.id}`);
        console.log("SHADOW_GIT_DEBUG: Found checkpoint in main ShadowGit instance: ${foundCheckpoint.id}");
      }
    }
    
    if (!foundCheckpoint && workingShadowGit) {
      // Try working ShadowGit if not found in main
      const workingCheckpoints = workingShadowGit.getCheckpoints();
      console.log("SHADOW_GIT_DEBUG: Available working checkpoints: ${workingCheckpoints.map(cp => cp.id).join(', ')}");
      
      // Find checkpoint with partial match (first 8 chars)
      foundCheckpoint = workingCheckpoints.find(cp => 
        cp.id === cleanCheckpointId || cp.id.startsWith(cleanCheckpointId) || cleanCheckpointId.startsWith(cp.id)
      );
      
      if (foundCheckpoint) {
        targetShadowGit = workingShadowGit as any;
        outputChannel.appendLine(`Found checkpoint in working ShadowGit instance: ${foundCheckpoint.id}`);
        console.log("SHADOW_GIT_DEBUG: Found checkpoint in working ShadowGit instance: ${foundCheckpoint.id}");
      }
    }
    
    if (!targetShadowGit || !foundCheckpoint) {
      const errorMsg = `Checkpoint ${cleanCheckpointId} not found`;
      outputChannel.appendLine(errorMsg);
      console.error(`SHADOW_GIT_DEBUG: ${errorMsg}`);
      vscode.window.showErrorMessage(errorMsg);
      return;
    }
    
    try {
      // Use the actual full checkpoint ID, not the possibly truncated one from UI
      const actualCheckpointId = foundCheckpoint.id;
      const message = foundCheckpoint.message;
      
      // Confirm deletion
      const confirmDelete = await vscode.window.showWarningMessage(
        `Are you sure you want to delete checkpoint "${message}" (${actualCheckpointId.substring(0, 8)})? This action cannot be undone.`,
        { modal: true },
        'Delete'
      );
      
      if (confirmDelete !== 'Delete') {
        outputChannel.appendLine(`User cancelled checkpoint deletion`);
        console.log("SHADOW_GIT_DEBUG: User cancelled checkpoint deletion");
        return; // User cancelled
      }
      
      // Delete the checkpoint using the full ID
      console.log("SHADOW_GIT_DEBUG: Deleting checkpoint with full ID: ${actualCheckpointId}");
      const success = targetShadowGit.deleteCheckpoint(actualCheckpointId);
      
      if (success) {
        vscode.window.showInformationMessage(`Checkpoint "${message}" (${actualCheckpointId.substring(0, 8)}) was deleted successfully.`);
        outputChannel.appendLine(`Checkpoint deleted successfully`);
        console.log("SHADOW_GIT_DEBUG: Checkpoint deleted successfully");
        
        // Refresh everything
        mainSCMProvider?.update();
        if (mainTimelineProvider) {
          mainTimelineProvider.refresh();
        }
        
        // Force refresh the WebView directly
        try {
          // First try the command
          await vscode.commands.executeCommand('shadowGit.refresh');
          
          // Try to find the view in other ways
          try {
            // This may not be available in all VS Code versions
            // @ts-ignore - This might not be in the typings
            const views = vscode.window.visibleWebviewPanels;
            if (views && views.length > 0) {
              console.log("SHADOW_GIT_DEBUG: Found ${views.length} visible WebView panels");
            }
          } catch (error) {
            // Ignore errors, this is just an extra attempt
          }
        } catch (error) {
          console.error(`SHADOW_GIT_DEBUG: Error refreshing view:`, error);
        }
      } else {
        const errorMsg = `Failed to delete checkpoint "${message}" (${actualCheckpointId.substring(0, 8)})`;
        outputChannel.appendLine(errorMsg);
        console.error(`SHADOW_GIT_DEBUG: ${errorMsg}`);
        vscode.window.showErrorMessage(errorMsg);
      }
    } catch (error) {
      const errorMsg = `Failed to delete checkpoint: ${(error as Error).message}`;
      outputChannel.appendLine(errorMsg);
      console.error(`SHADOW_GIT_DEBUG: ${errorMsg}`);
      vscode.window.showErrorMessage(errorMsg);
    }
  });
  
  // Command: Apply a checkpoint
  const applyCheckpointCommand = vscode.commands.registerCommand('shadowGit.applyCheckpoint', async (checkpointId: string) => {
    outputChannel.appendLine(`applyCheckpoint command invoked for checkpoint ${checkpointId}`);
    console.log("SHADOW_GIT_DEBUG: applyCheckpoint command invoked for checkpoint ${checkpointId}");
    
    // Determine which ShadowGit instance has this checkpoint
    let targetShadowGit: ShadowGit | null = null;
    
    if (mainShadowGit && mainShadowGit.checkpoints.find(cp => cp.id === checkpointId)) {
      targetShadowGit = mainShadowGit;
      outputChannel.appendLine(`Found checkpoint in main ShadowGit instance`);
      console.log("SHADOW_GIT_DEBUG: Found checkpoint in main ShadowGit instance");
    } else if (workingShadowGit && workingShadowGit.checkpoints.find(cp => cp.id === checkpointId)) {
      targetShadowGit = workingShadowGit as any;
      outputChannel.appendLine(`Found checkpoint in working ShadowGit instance`);
      console.log("SHADOW_GIT_DEBUG: Found checkpoint in working ShadowGit instance");
    }
    
    if (!targetShadowGit) {
      const errorMsg = `Checkpoint ${checkpointId} not found`;
      outputChannel.appendLine(errorMsg);
      console.log("SHADOW_GIT_DEBUG: ${errorMsg}");
      vscode.window.showErrorMessage(errorMsg);
      return;
    }
    
    try {
      // Get checkpoint details for better messages
      const checkpoint = targetShadowGit.checkpoints.find(cp => cp.id === checkpointId)!;
      const affectedFiles = Object.keys(checkpoint.changes);
      
      outputChannel.appendLine(`Checkpoint will restore ${affectedFiles.length} files: ${affectedFiles.join(', ')}`);
      console.log("SHADOW_GIT_DEBUG: Checkpoint will restore ${affectedFiles.length} files: ${affectedFiles.join(', ')}");
      
      const confirmApply = await vscode.window.showWarningMessage(
        `Are you sure you want to restore checkpoint "${checkpoint.message}" (${checkpointId.substring(0, 8)})? This will restore ${affectedFiles.length} files to their state at checkpoint creation.`,
        { modal: true },
        'Restore'
      );
      
      if (confirmApply !== 'Restore') {
        outputChannel.appendLine(`User cancelled checkpoint restore`);
        console.log("SHADOW_GIT_DEBUG: User cancelled checkpoint restore");
        return; // User cancelled
      }
      
      outputChannel.appendLine(`Applying checkpoint ${checkpointId}`);
      console.log("SHADOW_GIT_DEBUG: Applying checkpoint ${checkpointId}");
      
      // Show progress indicator while applying checkpoint
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Restoring checkpoint: ${checkpoint.message}`,
        cancellable: false
      }, async (progress) => {
        // Apply the checkpoint
        targetShadowGit!.applyCheckpoint(checkpointId);
        
        // Show detailed information
        progress.report({ message: `Restored ${affectedFiles.length} files` });
      });
      
      // Show detailed success message
      vscode.window.showInformationMessage(
        `Checkpoint "${checkpoint.message}" (${checkpointId.substring(0, 8)}) successfully restored. ${affectedFiles.length} files were restored.`
      );
      
      outputChannel.appendLine(`Checkpoint applied successfully, restored ${affectedFiles.length} files`);
      console.log("SHADOW_GIT_DEBUG: Checkpoint applied successfully, restored ${affectedFiles.length} files");
      
      // Attempt to open one of the restored files to confirm changes
      if (affectedFiles.length > 0) {
        try {
          const firstFile = path.join(targetShadowGit.workspaceRoot, affectedFiles[0]);
          outputChannel.appendLine(`Opening restored file for confirmation: ${firstFile}`);
          const document = await vscode.workspace.openTextDocument(firstFile);
          await vscode.window.showTextDocument(document);
          outputChannel.appendLine(`Successfully opened restored file: ${firstFile}`);
        } catch (err) {
          outputChannel.appendLine(`Failed to open restored file for confirmation: ${err}`);
        }
      }
      
      // Refresh everything
      mainSCMProvider?.update();
      if (mainTimelineProvider) {
        mainTimelineProvider.refresh();
      }
      // Commented out since workingTimelineProvider isn't initialized
      // if (workingTimelineProvider) {
      //   workingTimelineProvider.refresh();
      // }
    } catch (error) {
      const errorMsg = `Failed to apply checkpoint: ${(error as Error).message}`;
      outputChannel.appendLine(errorMsg);
      console.log("SHADOW_GIT_DEBUG: ${errorMsg}");
      vscode.window.showErrorMessage(errorMsg);
    }
  });
  
  // Add a test command for debugging
  const testCommand = vscode.commands.registerCommand('shadowGit.test', () => {
    outputChannel.appendLine('Test command executed!');
    console.log('SHADOW_GIT_DEBUG: Test command executed');
    vscode.window.showInformationMessage('Shadow Git Test Command Works!');
  });

  // Add a test command for debugging purposes (disabled for production)
  const testDeleteCommand = vscode.commands.registerCommand('shadowGit.testDelete', async () => {
    outputChannel.appendLine('Test delete command executed!');
    console.log('SHADOW_GIT_DEBUG: Test delete command is now disabled to avoid duplication');
    vscode.window.showInformationMessage('Please use the regular deletion functionality from the UI');
    
    // Original functionality is commented out to avoid duplicate deletion workflow
    /*
    try {
      // Get the workspace root
      if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }
      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      console.log('Workspace root:', workspaceRoot);
      
      // Find checkpoints in the .vscode/.shadowgit-main directory
      const checkpointsDir = path.join(workspaceRoot, '.vscode', '.shadowgit-main', 'checkpoints');
      console.log('Looking for checkpoints in:', checkpointsDir);
      
      if (!fs.existsSync(checkpointsDir)) {
        console.log('Checkpoints directory not found');
        vscode.window.showErrorMessage('Checkpoints directory not found');
        return;
      }
      
      // Get all checkpoint files
      const checkpointFiles = fs.readdirSync(checkpointsDir).filter(file => file.endsWith('.json'));
      console.log('Found checkpoints:', checkpointFiles);
      
      if (checkpointFiles.length === 0) {
        console.log('No checkpoints found');
        vscode.window.showErrorMessage('No checkpoints found');
        return;
      }
      
      // Get the first checkpoint ID
      const checkpointId = checkpointFiles[0].replace('.json', '');
      console.log('Selected checkpoint for deletion:', checkpointId);
      
      // Let user confirm
      const confirmDelete = await vscode.window.showWarningMessage(
        `Are you sure you want to delete checkpoint ${checkpointId.substring(0, 8)}?`,
        { modal: true },
        'Delete'
      );
      
      if (confirmDelete !== 'Delete') {
        console.log('Deletion cancelled by user');
        return;
      }
      
      // Delete the checkpoint file
      const checkpointPath = path.join(checkpointsDir, `${checkpointId}.json`);
      fs.unlinkSync(checkpointPath);
      console.log('Deleted checkpoint file:', checkpointPath);
      
      // Show success message
      vscode.window.showInformationMessage(`Manually deleted checkpoint: ${checkpointId.substring(0, 8)}`);
      
      // Refresh everything
      mainSCMProvider?.update();
      if (mainTimelineProvider) {
        mainTimelineProvider.refresh();
      }

      // Force WebView refresh
      vscode.commands.executeCommand('shadowGit.refresh');
    } catch (error) {
      console.error('Error deleting checkpoint:', error);
      vscode.window.showErrorMessage(`Manual deletion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    */
  });
  
  // Register the Git diff command
  const gitDiffCommand = createGitDiffCommand();
  
  // Register the hybrid Git/ShadowGit command
  const hybridDiffCommand = createHybridGitCommand(context, mainShadowGit!, workingShadowGit);
  
  // Register the debug diff command
  const debugDiffCommand = createDebugDiffCommand(context);
  
  // Register the direct Git diff command
  const directGitDiffCommand = createDirectGitDiffCommand(context, mainShadowGit!, workingShadowGit);
  
  // Command: Refresh UI and data
  const refreshCommand = vscode.commands.registerCommand('shadowGit.refresh', async () => {
    try {
      outputChannel.appendLine('Manually refreshing ShadowGit views');
      console.log('SHADOW_GIT_DEBUG: Refreshing ShadowGit views');
      
      // Find any registered WebView provider and refresh it
      const extensions = vscode.extensions.all.filter(ext => 
        ext.id === 'shadowgit.shadowgit' || ext.id.includes('shadowgit')
      );
      
      // Reload any existing WebViews
      for (const view of vscode.window.visibleTextEditors) {
        if (view.document.uri.scheme === 'file') {
          try {
            mainShadowGit?.detectChanges(view.document.uri.fsPath);
          } catch (error) {
            // Ignore errors during refresh
          }
        }
      }
      
      // Force the WebView to update if possible
      try {
        // This focuses the view which should cause it to refresh
        await vscode.commands.executeCommand('workbench.view.extension.shadowGitView');
      } catch (error) {
        // Ignore errors
      }
      
      // Update SCM providers
      mainSCMProvider?.update();
      if (mainTimelineProvider) {
        mainTimelineProvider.refresh();
      }
      
      // Show confirmation
      vscode.window.showInformationMessage('ShadowGit refreshed');
    } catch (error) {
      outputChannel.appendLine(`Error during refresh: ${error}`);
      console.error('SHADOW_GIT_DEBUG: Error during refresh', error);
    }
  });

  // Register all commands
  context.subscriptions.push(
    testCommand, // Add the test command first
    testDeleteCommand, // Add the test delete command
    takeSnapshotCommand,
    takeMainSnapshotCommand,
    takeWorkingSnapshotCommand,
    workingDiffCommand,
    gitDiffCommand, // Add the Git diff command
    hybridDiffCommand, // Add the hybrid Git/ShadowGit command
    directGitDiffCommand, // Add the direct Git diff command
    compareWithCheckpointCommand,
    compareWithHeadCommand,
    compareWithShadowGitCommand,
    approveChangeCommand,
    disapproveChangeCommand,
    approveAllChangesCommand,
    disapproveAllChangesCommand,
    createCheckpointCommand,
    createWorkingCheckpointCommand,
    deleteCheckpointCommand,
    applyCheckpointCommand,
    refreshCommand, // Add the refresh command
    debugDiffCommand, // Add the debug diff command
    ...mainDiffCommands // Add all commands from mainDiffCommands
  );
  
  // Command: Show change context menu
  const showChangeContextMenuCommand = vscode.commands.registerCommand('shadowGit.showChangeContextMenu', async (uri: vscode.Uri, line: number) => {
    if (mainDiffDecorationProvider) {
      await mainDiffDecorationProvider.handleChangeContextMenu(uri, line);
    }
  });
  
  // Add command to subscriptions
  context.subscriptions.push(showChangeContextMenuCommand);
  
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
        // Detect changes
        mainShadowGit.detectChanges(uri.fsPath);
        workingShadowGit!.detectChanges(uri.fsPath);
        
        // Update SCM
        mainSCMProvider?.update();
        workingSCMProvider?.update();
      }
    }
  });
  
  context.subscriptions.push(fileWatcher);
  
  // Always enable auto-snapshot for better user experience
  // This ensures files are tracked automatically
  vscode.workspace.onDidOpenTextDocument(async document => {
    if (document.uri.scheme === 'file' && 
        !document.uri.fsPath.includes('.vscode/.shadowgit-') &&
        mainShadowGit) {
      try {
        console.log("Taking auto-snapshot of ${document.uri.fsPath}");
        mainShadowGit.takeSnapshot(document.uri.fsPath);
        if (workingShadowGit) {
          workingShadowGit.takeSnapshot(document.uri.fsPath);
        }
        
        // Update UI
        mainSCMProvider?.update();
        
        // Log success
        console.log("Successfully took snapshot of ${document.fileName}");
      } catch (error) {
        // Log errors
        console.error(`Auto-snapshot failed for ${document.fileName}:`, error);
      }
    }
  });
  
  // Also take snapshots when files are saved
  vscode.workspace.onDidSaveTextDocument(document => {
    if (document.uri.scheme === 'file' && 
        !document.uri.fsPath.includes('.vscode/.shadowgit-') &&
        mainShadowGit) {
      try {
        console.log("Taking snapshot of saved file ${document.uri.fsPath}");
        mainShadowGit.takeSnapshot(document.uri.fsPath);
        if (workingShadowGit) {
          workingShadowGit.takeSnapshot(document.uri.fsPath);
        }
        
        // Update UI
        mainSCMProvider?.update();
      } catch (error) {
        console.error(`Save-snapshot failed for ${document.fileName}:`, error);
      }
    }
  });
}

export function deactivate(): void {
  // Clean up resources
}
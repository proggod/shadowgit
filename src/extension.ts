import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ShadowGit } from './shadowGit';
import { DiffDecorationProvider } from './diffProvider';
import { ShadowGitFilesProvider, ShadowGitCheckpointsProvider } from './viewProvider';
import { ShadowGitSCMProvider } from './scmProvider';
import { ShadowGitViewProvider } from './shadowGitView';
import { ShadowGitTimelineProvider } from './timelineProvider';

// Add ShadowGitType to types that can be imported
type ShadowGitType = 'main' | 'working';

/**
 * Activate the extension
 * @param context - Extension context
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('Shadow Git extension is now active');
  
  // Initialize ShadowGit instances
  let mainShadowGit: ShadowGit | null = null;
  let workingShadowGit: ShadowGit | null = null;
  let mainDiffDecorationProvider: DiffDecorationProvider | null = null;
  let workingDiffDecorationProvider: DiffDecorationProvider | null = null;
  let mainSCMProvider: ShadowGitSCMProvider | null = null;
  let workingSCMProvider: ShadowGitSCMProvider | null = null;
  let mainTimelineProvider: ShadowGitTimelineProvider | null = null;
  let workingTimelineProvider: ShadowGitTimelineProvider | null = null;

  if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    
    // Create both ShadowGit instances
    mainShadowGit = new ShadowGit(workspaceRoot, 'main');
    workingShadowGit = new ShadowGit(workspaceRoot, 'working');
    
    // Create diff decoration providers
    mainDiffDecorationProvider = new DiffDecorationProvider(context, mainShadowGit);
    workingDiffDecorationProvider = new DiffDecorationProvider(context, workingShadowGit);
    
    // Create SCM providers
    mainSCMProvider = new ShadowGitSCMProvider(context, mainShadowGit);
    workingSCMProvider = new ShadowGitSCMProvider(context, workingShadowGit);
    
    // Create timeline providers
    mainTimelineProvider = new ShadowGitTimelineProvider(mainShadowGit);
    workingTimelineProvider = new ShadowGitTimelineProvider(workingShadowGit);
    
    // Note: We skip timeline registration if the API isn't available
    // Timeline integration is only available in newer VS Code versions
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
            }),
            // @ts-ignore - using the timeline API dynamically
            vscode.timeline.registerTimelineProvider(['file', 'git'], workingTimelineProvider, {
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
  }
  
  // Register WebView providers
  const mainViewProvider = new ShadowGitViewProvider(context, mainShadowGit!);
  const workingViewProvider = new ShadowGitViewProvider(context, workingShadowGit!);
  
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('shadowGitMain', mainViewProvider),
    vscode.window.registerWebviewViewProvider('shadowGitWorking', workingViewProvider)
  );
  
  // Command: Take a snapshot in both Shadow Git systems
  const takeSnapshotCommand = vscode.commands.registerCommand('shadowGit.takeSnapshot', async () => {
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
      await editor.document.save();
      
      // Take snapshot in both ShadowGit instances
      const mainSnapshot = mainShadowGit.takeSnapshot(filePath);
      const workingSnapshot = workingShadowGit.takeSnapshot(filePath);
      
      const fileName = path.basename(filePath);
      
      vscode.window.showInformationMessage(`Snapshots taken in both Main and Working systems: ${fileName}`);
      
      // Refresh everything
      mainViewProvider.refresh();
      workingViewProvider.refresh();
      mainSCMProvider?.update();
      workingSCMProvider?.update();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to take snapshot: ${(error as Error).message}`);
    }
  });
  
  // Command: Take a snapshot in Main Shadow Git only
  const takeMainSnapshotCommand = vscode.commands.registerCommand('shadowGit.takeMainSnapshot', async () => {
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
      
      // Take snapshot in Main ShadowGit only
      const mainSnapshot = mainShadowGit.takeSnapshot(filePath);
      
      const fileName = path.basename(filePath);
      
      vscode.window.showInformationMessage(`Snapshot taken in Main system: ${fileName}`);
      
      // Refresh Main-related UI
      mainViewProvider.refresh();
      mainSCMProvider?.update();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to take snapshot: ${(error as Error).message}`);
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
      const workingSnapshot = workingShadowGit.takeSnapshot(filePath);
      
      const fileName = path.basename(filePath);
      
      vscode.window.showInformationMessage(`Snapshot taken in Working system: ${fileName}`);
      
      // Refresh Working-related UI
      workingViewProvider.refresh();
      workingSCMProvider?.update();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to take snapshot: ${(error as Error).message}`);
    }
  });
  
  // Command: Open shadow diff
  const openShadowDiffCommand = vscode.commands.registerCommand('shadowGit.openDiff', async () => {
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
      
      // Open the diff editor
      const leftUri = vscode.Uri.file(tempPath);
      const rightUri = editor.document.uri;
      
      await vscode.commands.executeCommand('vscode.diff', 
        leftUri,
        rightUri,
        `Shadow Diff: ${path.basename(filePath)}`
      );
      
      // Register the diff document for decoration in both providers
      mainDiffDecorationProvider!.registerDiffEditor(rightUri, mainChanges);
      workingDiffDecorationProvider!.registerDiffEditor(rightUri, workingChanges);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open diff: ${(error as Error).message}`);
    }
  });
  
  // Command: Compare with checkpoint
  const compareWithCheckpointCommand = vscode.commands.registerCommand('shadowGit.compareWithCheckpoint', async (uri: vscode.Uri, checkpointId: string) => {
    // Determine which ShadowGit instance has this checkpoint
    let targetShadowGit: ShadowGit | null = null;
    
    if (mainShadowGit && mainShadowGit.checkpoints.find(cp => cp.id === checkpointId)) {
      targetShadowGit = mainShadowGit;
    } else if (workingShadowGit && workingShadowGit.checkpoints.find(cp => cp.id === checkpointId)) {
      targetShadowGit = workingShadowGit;
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
      
      // Open the diff editor
      const leftUri = vscode.Uri.file(tempPath);
      const rightUri = editor.document.uri;
      
      await vscode.commands.executeCommand('vscode.diff', 
        leftUri,
        rightUri,
        `Compare with ${choice.value} Shadow Git: ${path.basename(filePath)}`
      );
      
      // Detect changes and register for decoration
      const changes = targetShadowGit.detectChanges(filePath);
      const diffDecorationProvider = choice.value === 'main' 
        ? mainDiffDecorationProvider 
        : workingDiffDecorationProvider;
        
      diffDecorationProvider!.registerDiffEditor(rightUri, changes);
      
    } catch (error) {
      vscode.window.showErrorMessage(`Error: ${(error as Error).message}`);
    }
  });
  
  // Command: Approve a change (for main ShadowGit)
  const approveChangeCommand = vscode.commands.registerCommand('shadowGit.approveChange', async (uri: vscode.Uri, changeId: number) => {
    if (!mainShadowGit) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }
    
    try {
      const filePath = uri.fsPath;
      const success = mainShadowGit.approveChange(filePath, changeId);
      
      if (success) {
        mainDiffDecorationProvider!.refreshDecorations(uri);
        mainSCMProvider?.update();
        vscode.window.showInformationMessage(`Change approved`);
      } else {
        vscode.window.showErrorMessage(`Change not found: ${changeId}`);
      }
    } catch (error) {
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
      const message = await vscode.window.showInputBox({
        prompt: 'Enter a checkpoint message',
        placeHolder: 'What changes does this checkpoint include?'
      });
      
      if (!message) {
        return; // User cancelled
      }
      
      const checkpoint = mainShadowGit.createCheckpoint(message);
      vscode.window.showInformationMessage(`Checkpoint created: ${checkpoint.id.substring(0, 8)}`);
      
      // Refresh everything
      mainViewProvider.refresh();
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
      
      const checkpoint = workingShadowGit.createCheckpoint(message);
      vscode.window.showInformationMessage(`Working checkpoint created: ${checkpoint.id.substring(0, 8)}`);
      
      // Refresh everything
      workingViewProvider.refresh();
      workingSCMProvider?.update();
      if (workingTimelineProvider) {
        workingTimelineProvider.refresh();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to create working checkpoint: ${(error as Error).message}`);
    }
  });
  
  // Command: Apply a checkpoint
  const applyCheckpointCommand = vscode.commands.registerCommand('shadowGit.applyCheckpoint', async (checkpointId: string) => {
    // Determine which ShadowGit instance has this checkpoint
    let targetShadowGit: ShadowGit | null = null;
    
    if (mainShadowGit && mainShadowGit.checkpoints.find(cp => cp.id === checkpointId)) {
      targetShadowGit = mainShadowGit;
    } else if (workingShadowGit && workingShadowGit.checkpoints.find(cp => cp.id === checkpointId)) {
      targetShadowGit = workingShadowGit;
    }
    
    if (!targetShadowGit) {
      vscode.window.showErrorMessage(`Checkpoint ${checkpointId} not found`);
      return;
    }
    
    try {
      const confirmApply = await vscode.window.showWarningMessage(
        `Are you sure you want to apply checkpoint ${checkpointId.substring(0, 8)}? This will modify your files.`,
        { modal: true },
        'Apply'
      );
      
      if (confirmApply !== 'Apply') {
        return; // User cancelled
      }
      
      targetShadowGit.applyCheckpoint(checkpointId);
      vscode.window.showInformationMessage(`Checkpoint applied: ${checkpointId.substring(0, 8)}`);
      
      // Refresh everything
      mainViewProvider.refresh();
      workingViewProvider.refresh();
      mainSCMProvider?.update();
      workingSCMProvider?.update();
      if (mainTimelineProvider) {
        mainTimelineProvider.refresh();
      }
      if (workingTimelineProvider) {
        workingTimelineProvider.refresh();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to apply checkpoint: ${(error as Error).message}`);
    }
  });
  
  // Register all commands
  context.subscriptions.push(
    takeSnapshotCommand,
    takeMainSnapshotCommand,
    takeWorkingSnapshotCommand,
    openShadowDiffCommand,
    compareWithCheckpointCommand,
    compareWithHeadCommand,
    compareWithShadowGitCommand,
    approveChangeCommand,
    disapproveChangeCommand,
    approveAllChangesCommand,
    disapproveAllChangesCommand,
    createCheckpointCommand,
    createWorkingCheckpointCommand,
    applyCheckpointCommand
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
  
  // Auto-snapshot on file open when setting is enabled
  if (vscode.workspace.getConfiguration('shadowGit').get('autoSnapshot')) {
    vscode.workspace.onDidOpenTextDocument(async document => {
      if (document.uri.scheme === 'file' && 
          !document.uri.fsPath.includes('.vscode/.shadowgit-') &&
          mainShadowGit && workingShadowGit) {
        try {
          mainShadowGit.takeSnapshot(document.uri.fsPath);
          workingShadowGit.takeSnapshot(document.uri.fsPath);
          
          // Update everything
          mainViewProvider.refresh();
          workingViewProvider.refresh();
          mainSCMProvider?.update();
          workingSCMProvider?.update();
        } catch (error) {
          // Silently ignore errors
          console.error('Auto-snapshot failed:', error);
        }
      }
    });
  }
}

export function deactivate(): void {
  // Clean up resources
}
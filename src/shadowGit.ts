import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Change, Checkpoint, ShadowGitType, Snapshot } from './types';

/**
 * ShadowGit - Virtual git layer that tracks changes without affecting the real repo
 */
export class ShadowGit {
  public readonly workspaceRoot: string;
  public readonly type: ShadowGitType;
  public readonly shadowDir: string;
  public readonly snapshots: Map<string, Snapshot>;
  public readonly changes: Map<string, Change[]>;
  public readonly checkpoints: Checkpoint[];

  /**
   * Creates a new ShadowGit instance
   * @param workspaceRoot - Root path of the workspace
   * @param type - Type of ShadowGit ('main' or 'working')
   */
  constructor(workspaceRoot: string, type: ShadowGitType = 'main') {
    this.workspaceRoot = workspaceRoot;
    this.type = type;
    this.shadowDir = path.join(workspaceRoot, '.vscode', `.shadowgit-${type}`);
    this.snapshots = new Map(); // Map of file paths to their snapshots
    this.changes = new Map();   // Map of file paths to their pending changes
    this.checkpoints = [];      // List of checkpoints (virtual commits)
    this.initialize();
  }

  /**
   * Initialize ShadowGit system
   */
  private initialize(): void {
    // Create shadow directory if it doesn't exist
    if (!fs.existsSync(this.shadowDir)) {
      fs.mkdirSync(this.shadowDir, { recursive: true });
    }
    
    // Create subdirectories
    const dirs = ['snapshots', 'changes', 'checkpoints', 'temp'];
    dirs.forEach(dir => {
      const dirPath = path.join(this.shadowDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
    
    // Load existing snapshots and checkpoints
    this.loadSnapshots();
    this.loadCheckpoints();
  }

  /**
   * Take a snapshot of the current file state
   * @param filePath - Absolute path to the file
   * @returns The snapshot object
   */
  public takeSnapshot(filePath: string): Snapshot {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    
    try {
      // Read the file content
      const content = fs.readFileSync(filePath, 'utf8');
      const hash = this.hashContent(content);
      
      // Store the snapshot
      const snapshot: Snapshot = {
        hash,
        content,
        timestamp: Date.now(),
        lines: content.split('\n')
      };
      
      this.snapshots.set(relativePath, snapshot);
      this.saveSnapshot(relativePath, snapshot);
      
      return snapshot;
    } catch (error) {
      console.error(`Failed to take snapshot of ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Detect changes between current file and its snapshot
   * @param filePath - Absolute path to the file
   * @returns Array of change objects
   */
  public detectChanges(filePath: string): Change[] {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    
    console.log(`ShadowGit.detectChanges: Detecting changes in ${filePath} (${relativePath})`);
    
    // Check if we have a snapshot
    if (!this.snapshots.has(relativePath)) {
      console.log(`ShadowGit.detectChanges: No snapshot found for ${relativePath}, taking one now`);
      try {
        // Take initial snapshot
        this.takeSnapshot(filePath);
        console.log(`ShadowGit.detectChanges: Successfully took initial snapshot for ${relativePath}`);
        
        // Add an initial change - since this is the first time we're tracking this file, 
        // we should consider it a change from nothing to its current state
        const initialContent = fs.readFileSync(filePath, 'utf8');
        const initialChange: Change = {
          id: 0,
          type: 'addition',
          startLine: 0,
          endLine: initialContent.split('\n').length - 1,
          content: initialContent,
          approved: false
        };
        
        const changes = [initialChange];
        this.changes.set(relativePath, changes);
        console.log(`ShadowGit.detectChanges: Added initial content change for new file ${relativePath}`);
        
        return changes;
      } catch (error) {
        console.error(`ShadowGit.detectChanges: Failed to take initial snapshot of ${relativePath}:`, error);
        return [];
      }
    }
    
    try {
      // Check if file exists
      if (!fs.existsSync(filePath)) {
        console.log(`ShadowGit.detectChanges: File ${filePath} no longer exists`);
        // File was deleted - consider this a special case
        const snapshot = this.snapshots.get(relativePath)!;
        const deletionChange: Change = {
          id: 0,
          type: 'deletion',
          startLine: 0,
          endLine: snapshot.lines.length - 1,
          content: snapshot.content,
          approved: false
        };
        
        const changes = [deletionChange];
        this.changes.set(relativePath, changes);
        this.saveChanges(relativePath, changes);
        
        return changes;
      }
      
      // Read current file content
      const currentContent = fs.readFileSync(filePath, 'utf8');
      const currentLines = currentContent.split('\n');
      
      // Get snapshot content
      const snapshot = this.snapshots.get(relativePath)!;
      const snapshotLines = snapshot.lines;
      
      // Quick check - if content is identical, no changes
      if (currentContent === snapshot.content) {
        console.log(`ShadowGit.detectChanges: No changes in ${relativePath}`);
        this.changes.set(relativePath, []);
        this.saveChanges(relativePath, []);
        return [];
      }
      
      console.log(`ShadowGit.detectChanges: Content changed in ${relativePath}, performing diff`);
      
      // Improved line-by-line diff
      const changes: Change[] = [];
      let changeId = 0;
      
      // Find added/modified lines
      for (let i = 0; i < currentLines.length; i++) {
        if (i >= snapshotLines.length || currentLines[i] !== snapshotLines[i]) {
          // Find the end of this change chunk
          let endLine = i;
          while (
            endLine < currentLines.length && 
            (endLine >= snapshotLines.length || currentLines[endLine] !== snapshotLines[endLine])
          ) {
            endLine++;
          }
          
          console.log(`ShadowGit.detectChanges: Found ${i >= snapshotLines.length ? 'addition' : 'modification'} at lines ${i}-${endLine - 1}`);
          
          changes.push({
            id: changeId++,
            type: i >= snapshotLines.length ? 'addition' : 'modification',
            startLine: i,
            endLine: endLine - 1,
            content: currentLines.slice(i, endLine).join('\n'),
            approved: false
          });
          
          i = endLine - 1;
        }
      }
      
      // Find deleted lines
      for (let i = 0; i < snapshotLines.length; i++) {
        if (i >= currentLines.length || currentLines[i] !== snapshotLines[i]) {
          // Find the end of this deletion chunk
          let endLine = i;
          while (
            endLine < snapshotLines.length && 
            (endLine >= currentLines.length || currentLines[endLine] !== snapshotLines[endLine])
          ) {
            endLine++;
          }
          
          // Check if this deletion is already accounted for in a modification
          const isModification = changes.some(change => 
            change.type === 'modification' && 
            change.startLine <= i && 
            change.endLine >= i
          );
          
          if (!isModification) {
            console.log(`ShadowGit.detectChanges: Found deletion at lines ${i}-${endLine - 1}`);
            
            changes.push({
              id: changeId++,
              type: 'deletion',
              startLine: i,
              endLine: endLine - 1,
              content: snapshotLines.slice(i, endLine).join('\n'),
              approved: false
            });
          }
          
          i = endLine - 1;
        }
      }
      
      // Check if file was completely changed
      if (changes.length > 0 && 
          changes.length === 1 && 
          changes[0].startLine === 0 && 
          changes[0].endLine === currentLines.length - 1 &&
          changes[0].type === 'modification') {
        console.log(`ShadowGit.detectChanges: File ${relativePath} was completely changed`);
        // Auto-approve the change since it's a complete file change
        changes[0].approved = true;
      }
      
      // Update and save the changes
      console.log(`ShadowGit.detectChanges: Found ${changes.length} changes in ${relativePath}`);
      this.changes.set(relativePath, changes);
      this.saveChanges(relativePath, changes);
      
      return changes;
    } catch (error) {
      console.error(`ShadowGit.detectChanges: Failed to detect changes in ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Track changes for a file
   * @param filePath - Absolute path to the file
   * @param changes - Array of change objects
   */
  public trackChanges(filePath: string, changes: Change[]): void {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    this.changes.set(relativePath, changes);
    this.saveChanges(relativePath, changes);
  }

  /**
   * Approve a specific change
   * @param filePath - Absolute path to the file
   * @param changeId - ID of the change to approve
   * @returns Whether the operation was successful
   */
  public approveChange(filePath: string, changeId: number): boolean {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    const changes = this.changes.get(relativePath) || [];
    
    const change = changes.find(c => c.id === changeId);
    if (change) {
      change.approved = true;
      this.saveChanges(relativePath, changes);
      return true;
    }
    
    return false;
  }

  /**
   * Disapprove a specific change
   * @param filePath - Absolute path to the file
   * @param changeId - ID of the change to disapprove
   * @returns Whether the operation was successful
   */
  public disapproveChange(filePath: string, changeId: number): boolean {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    const changes = this.changes.get(relativePath) || [];
    
    const change = changes.find(c => c.id === changeId);
    if (change) {
      change.approved = false;
      this.saveChanges(relativePath, changes);
      return true;
    }
    
    return false;
  }

  /**
   * Approve all changes in a file
   * @param filePath - Absolute path to the file
   * @returns Number of changes approved
   */
  public approveAllChanges(filePath: string): number {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    const changes = this.changes.get(relativePath) || [];
    
    changes.forEach(change => {
      change.approved = true;
    });
    
    this.saveChanges(relativePath, changes);
    return changes.length;
  }

  /**
   * Disapprove all changes in a file
   * @param filePath - Absolute path to the file
   * @returns Number of changes disapproved
   */
  public disapproveAllChanges(filePath: string): number {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    const changes = this.changes.get(relativePath) || [];
    
    changes.forEach(change => {
      change.approved = false;
    });
    
    this.saveChanges(relativePath, changes);
    return changes.length;
  }

  /**
   * Create a checkpoint (virtual commit)
   * @param message - Checkpoint message
   * @returns The checkpoint object
   */
  public createCheckpoint(message: string): Checkpoint {
    console.log(`ShadowGit.createCheckpoint: Creating checkpoint with message "${message}"`);
    
    // Force detection of changes in all tracked files
    this.detectChangesInAllTrackedFiles();
    
    // Get a list of all tracked files
    const trackedFiles = this.getTrackedFiles();
    console.log(`ShadowGit.createCheckpoint: Current tracked files: ${trackedFiles.length}`);
    
    // Initialize change tracking
    const approvedChanges: Record<string, Change[]> = {};
    let totalApprovedChanges = 0;
    let filesWithChanges = 0;
    
    // Explicitly create changes for ALL tracked files
    for (const relativePath of trackedFiles) {
      // Get the full path
      const filePath = path.join(this.workspaceRoot, relativePath);
      
      try {
        // Make sure the file exists
        if (!fs.existsSync(filePath)) {
          console.log(`ShadowGit.createCheckpoint: File ${filePath} no longer exists, skipping`);
          continue;
        }
        
        // Check if there are existing changes
        let changes: Change[] = [];
        if (this.changes.has(relativePath)) {
          changes = this.changes.get(relativePath) || [];
          console.log(`ShadowGit.createCheckpoint: File ${relativePath} already has ${changes.length} existing changes`);
        } 
        
        // If no changes, create a full file change
        if (changes.length === 0) {
          console.log(`ShadowGit.createCheckpoint: No changes for ${relativePath}, creating a full file change`);
          
          try {
            // Create a full file change
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            const fullFileChange: Change = {
              id: 0,
              type: 'modification',
              startLine: 0,
              endLine: lines.length - 1,
              content: content,
              approved: true
            };
            
            changes = [fullFileChange];
            this.changes.set(relativePath, changes);
            this.saveChanges(relativePath, changes);
          } catch (error) {
            console.error(`ShadowGit.createCheckpoint: Failed to create full file change for ${relativePath}:`, error);
            continue;
          }
        }
        
        // Ensure all changes are approved
        for (const change of changes) {
          change.approved = true;
        }
        
        // Save the updated changes
        this.saveChanges(relativePath, changes);
        
        // Add to the approvedChanges record for the checkpoint
        approvedChanges[relativePath] = changes.map(change => ({
          id: change.id,
          type: change.type,
          startLine: change.startLine,
          endLine: change.endLine,
          content: change.content,
          approved: true
        }));
        
        // Update counts
        totalApprovedChanges += changes.length;
        filesWithChanges++;
        
      } catch (error) {
        console.error(`ShadowGit.createCheckpoint: Error processing ${relativePath}:`, error);
      }
    }
    
    console.log(`ShadowGit.createCheckpoint: Prepared ${totalApprovedChanges} approved changes across ${filesWithChanges} files`);
    
    // Create the checkpoint
    const checkpoint: Checkpoint = {
      id: crypto.randomUUID(),
      message,
      timestamp: Date.now(),
      changes: approvedChanges,
      type: this.type
    };
    
    // Add the checkpoint to the list and save
    this.checkpoints.push(checkpoint);
    this.saveCheckpoint(checkpoint);
    
    console.log(`ShadowGit.createCheckpoint: Created checkpoint ${checkpoint.id} with ${Object.keys(approvedChanges).length} files`);
    
    // Clear all changes since they've been added to the checkpoint
    for (const relativePath of trackedFiles) {
      this.changes.set(relativePath, []);
      this.saveChanges(relativePath, []);
    }
    
    return checkpoint;
  }
  
  /**
   * Detect changes in all tracked files
   */
  private detectChangesInAllTrackedFiles(): void {
    console.log(`ShadowGit.detectChangesInAllTrackedFiles: Detecting changes in all ${this.snapshots.size} tracked files`);
    
    // Log what files have changes before detection
    const filesWithChangesBeforeCount = this.changes.size;
    console.log(`ShadowGit.detectChangesInAllTrackedFiles: Files with changes before detection: ${filesWithChangesBeforeCount}`);
    if (filesWithChangesBeforeCount > 0) {
      console.log(`ShadowGit.detectChangesInAllTrackedFiles: Files with changes: ${Array.from(this.changes.keys()).join(', ')}`);
    }
    
    // Iterate through all snapshots and detect changes
    let processedFiles = 0;
    
    for (const [relativePath, snapshot] of this.snapshots.entries()) {
      try {
        const filePath = path.join(this.workspaceRoot, relativePath);
        
        // Check if file exists
        if (fs.existsSync(filePath)) {
          console.log(`ShadowGit.detectChangesInAllTrackedFiles: Detecting changes in ${filePath}`);
          const changes = this.detectChanges(filePath);
          if (changes.length > 0) {
            console.log(`ShadowGit.detectChangesInAllTrackedFiles: Found ${changes.length} changes in ${filePath}`);
          }
          processedFiles++;
        } else {
          console.log(`ShadowGit.detectChangesInAllTrackedFiles: File ${filePath} no longer exists, skipping`);
        }
      } catch (error) {
        console.error(`ShadowGit.detectChangesInAllTrackedFiles: Error detecting changes for ${relativePath}:`, error);
      }
    }
    
    // Log what files have changes after detection
    const filesWithChangesAfterCount = this.changes.size;
    console.log(`ShadowGit.detectChangesInAllTrackedFiles: Processed ${processedFiles} files`);
    console.log(`ShadowGit.detectChangesInAllTrackedFiles: Files with changes after detection: ${filesWithChangesAfterCount}`);
    if (filesWithChangesAfterCount > 0) {
      console.log(`ShadowGit.detectChangesInAllTrackedFiles: Files with changes: ${Array.from(this.changes.keys()).join(', ')}`);
    }
  }

  /**
   * Apply a checkpoint's changes to the actual files
   * @param checkpointId - ID of the checkpoint to apply
   */
  public applyCheckpoint(checkpointId: string): void {
    console.log(`ShadowGit.applyCheckpoint: Starting to apply checkpoint ${checkpointId}`);
    
    const checkpoint = this.checkpoints.find(cp => cp.id === checkpointId);
    if (!checkpoint) {
      console.error(`ShadowGit.applyCheckpoint: Checkpoint ${checkpointId} not found`);
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }
    
    console.log(`ShadowGit.applyCheckpoint: Found checkpoint "${checkpoint.message}" with ${Object.keys(checkpoint.changes).length} files to restore`);
    
    // Apply changes from the checkpoint
    const restoredFiles = [];
    
    // COMPLETELY NEW APPROACH: Go back to original snapshot and re-apply specific changes
    for (const [relativePath, changes] of Object.entries(checkpoint.changes)) {
      const filePath = path.join(this.workspaceRoot, relativePath);
      
      console.log(`ShadowGit.applyCheckpoint: Processing file ${relativePath} with ${changes.length} changes`);
      
      try {
        // Find a snapshot for this file
        // We might have a snapshot from before this checkpoint was created
        const snapshot = this.findSnapshotForFile(relativePath);
        
        if (!snapshot) {
          console.warn(`ShadowGit.applyCheckpoint: No snapshot found for ${relativePath}, skipping`);
          continue;
        }
        
        // Instead of trying to apply changes, just write the state at checkpoint time
        console.log(`ShadowGit.applyCheckpoint: Restoring ${filePath} to state at checkpoint time`);
        
        // Get the file content at checkpoint time by working backwards from the changes
        const checkpointContent = this.getFileContentAtCheckpoint(relativePath, snapshot, changes);
        
        // Check if file exists and create directory if needed
        const fileDir = path.dirname(filePath);
        if (!fs.existsSync(fileDir)) {
          console.log(`ShadowGit.applyCheckpoint: Creating directory ${fileDir}`);
          fs.mkdirSync(fileDir, { recursive: true });
        }
        
        // Write the content back to the file
        console.log(`ShadowGit.applyCheckpoint: Writing ${checkpointContent.length} bytes to ${filePath}`);
        fs.writeFileSync(filePath, checkpointContent);
        
        // Update the snapshot after applying changes
        console.log(`ShadowGit.applyCheckpoint: Taking new snapshot of ${filePath}`);
        this.takeSnapshot(filePath);
        
        restoredFiles.push(relativePath);
        console.log(`ShadowGit.applyCheckpoint: Successfully restored ${filePath}`);
      } catch (error) {
        console.error(`ShadowGit.applyCheckpoint: Failed to apply checkpoint to ${filePath}:`, error);
      }
    }
    
    console.log(`ShadowGit.applyCheckpoint: Completed restore of checkpoint ${checkpointId}, restored ${restoredFiles.length} files: ${restoredFiles.join(', ')}`);
  }
  
  /**
   * Find a snapshot for a file, either the current one or any available one
   * @param relativePath - Relative path of the file
   * @returns The snapshot, or null if none found
   */
  private findSnapshotForFile(relativePath: string): Snapshot | null {
    // First check if we have a current snapshot
    if (this.snapshots.has(relativePath)) {
      return this.snapshots.get(relativePath)!;
    }
    
    // If no snapshot is found, try to read one from disk
    try {
      const snapshotPath = path.join(this.shadowDir, 'snapshots', `${relativePath}.json`);
      if (fs.existsSync(snapshotPath)) {
        const content = fs.readFileSync(snapshotPath, 'utf8');
        return JSON.parse(content) as Snapshot;
      }
    } catch (error) {
      console.error(`ShadowGit.findSnapshotForFile: Error reading snapshot for ${relativePath}:`, error);
    }
    
    return null;
  }
  
  /**
   * Get file content at checkpoint time by working backwards from snapshot + changes
   * @param relativePath - Relative path of the file 
   * @param snapshot - Snapshot to use as base
   * @param changes - Changes to apply to the snapshot
   * @returns The content of the file at checkpoint time
   */
  private getFileContentAtCheckpoint(relativePath: string, snapshot: Snapshot, changes: Change[]): string {
    console.log(`ShadowGit.getFileContentAtCheckpoint: Reconstructing content for ${relativePath} at checkpoint time`);
    
    // Start with the snapshot content
    const contentLines = [...snapshot.lines];
    
    // Apply the changes in order
    for (const change of changes) {
      console.log(`ShadowGit.getFileContentAtCheckpoint: Applying ${change.type} at lines ${change.startLine}-${change.endLine}`);
      
      if (change.type === 'addition' || change.type === 'modification') {
        const changeLines = change.content.split('\n');
        contentLines.splice(change.startLine, change.endLine - change.startLine + 1, ...changeLines);
      } else if (change.type === 'deletion') {
        contentLines.splice(change.startLine, change.endLine - change.startLine + 1);
      }
    }
    
    // Join the lines and return the content
    const content = contentLines.join('\n');
    console.log(`ShadowGit.getFileContentAtCheckpoint: Reconstructed ${content.length} bytes of content`);
    return content;
  }

  /**
   * Generate a hash for content
   * @param content - Content to hash
   * @returns Hash string
   */
  private hashContent(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Load snapshots from disk
   */
  private loadSnapshots(): void {
    try {
      const snapshotsDir = path.join(this.shadowDir, 'snapshots');
      if (!fs.existsSync(snapshotsDir)) {
        return;
      }
      
      const files = fs.readdirSync(snapshotsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(snapshotsDir, file);
          const relativePath = file.slice(0, -5); // Remove .json extension
          
          const content = fs.readFileSync(filePath, 'utf8');
          const snapshot = JSON.parse(content) as Snapshot;
          
          this.snapshots.set(relativePath, snapshot);
        }
      }
    } catch (error) {
      console.error('Failed to load snapshots:', error);
    }
  }

  /**
   * Save a snapshot to disk
   * @param relativePath - Relative path of the file
   * @param snapshot - Snapshot object
   */
  private saveSnapshot(relativePath: string, snapshot: Snapshot): void {
    try {
      const snapshotPath = path.join(this.shadowDir, 'snapshots', `${relativePath}.json`);
      
      // Ensure directory exists
      const dir = path.dirname(snapshotPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
    } catch (error) {
      console.error(`Failed to save snapshot for ${relativePath}:`, error);
    }
  }

  /**
   * Save changes to disk
   * @param relativePath - Relative path of the file
   * @param changes - Array of change objects
   */
  private saveChanges(relativePath: string, changes: Change[]): void {
    try {
      const changesPath = path.join(this.shadowDir, 'changes', `${relativePath}.json`);
      
      // Ensure directory exists
      const dir = path.dirname(changesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(changesPath, JSON.stringify(changes, null, 2));
    } catch (error) {
      console.error(`Failed to save changes for ${relativePath}:`, error);
    }
  }

  /**
   * Load checkpoints from disk
   */
  private loadCheckpoints(): void {
    try {
      const checkpointsDir = path.join(this.shadowDir, 'checkpoints');
      if (!fs.existsSync(checkpointsDir)) {
        return;
      }
      
      const files = fs.readdirSync(checkpointsDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(checkpointsDir, file);
          
          const content = fs.readFileSync(filePath, 'utf8');
          const checkpoint = JSON.parse(content) as Checkpoint;
          
          this.checkpoints.push(checkpoint);
        }
      }
      
      // Sort checkpoints by timestamp
      this.checkpoints.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('Failed to load checkpoints:', error);
    }
  }

  /**
   * Save a checkpoint to disk
   * @param checkpoint - Checkpoint object
   */
  private saveCheckpoint(checkpoint: Checkpoint): void {
    try {
      // First check if the checkpoint has any files
      const fileCount = Object.keys(checkpoint.changes).length;
      console.log(`ShadowGit.saveCheckpoint: Saving checkpoint ${checkpoint.id} with ${fileCount} files`);
      
      // If no files, add in all current changes for debugging
      if (fileCount === 0) {
        console.log(`ShadowGit.saveCheckpoint: WARNING - No files in checkpoint! Adding all current changes for debugging`);
        
        // Add all detected changes to the checkpoint - properly create deep copies
        for (const [relativePath, changes] of this.changes.entries()) {
          if (changes.length > 0) {
            console.log(`ShadowGit.saveCheckpoint: Force adding file ${relativePath} with ${changes.length} changes to checkpoint`);
            
            // Create proper deep copies of each change object
            checkpoint.changes[relativePath] = changes.map(change => ({
              id: change.id,
              type: change.type,
              startLine: change.startLine,
              endLine: change.endLine,
              content: change.content,
              approved: true // Force all changes to be approved
            }));
          }
        }
      }
      
      // Double-check
      const updatedFileCount = Object.keys(checkpoint.changes).length;
      console.log(`ShadowGit.saveCheckpoint: Saving checkpoint with ${updatedFileCount} files`);
      
      // Log some details of what we're saving
      for (const [relativePath, changes] of Object.entries(checkpoint.changes)) {
        console.log(`ShadowGit.saveCheckpoint: File ${relativePath} has ${changes.length} changes in checkpoint`);
      }
      
      const checkpointPath = path.join(this.shadowDir, 'checkpoints', `${checkpoint.id}.json`);
      fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
      console.log(`ShadowGit.saveCheckpoint: Successfully saved checkpoint to ${checkpointPath}`);
    } catch (error) {
      console.error(`Failed to save checkpoint ${checkpoint.id}:`, error);
    }
  }

  /**
   * Get all tracked files
   * @returns Array of tracked file paths
   */
  public getTrackedFiles(): string[] {
    return Array.from(this.snapshots.keys());
  }

  /**
   * Get all checkpoints
   * @returns Array of checkpoint objects
   */
  public getCheckpoints(): Checkpoint[] {
    return [...this.checkpoints];
  }
  
  /**
   * Delete a checkpoint
   * @param checkpointId - ID of the checkpoint to delete
   * @returns Whether the operation was successful
   */
  public deleteCheckpoint(checkpointId: string): boolean {
    console.log(`ShadowGit.deleteCheckpoint: Deleting checkpoint ${checkpointId}`);
    
    // Find the checkpoint index
    const checkpointIndex = this.checkpoints.findIndex(cp => cp.id === checkpointId);
    
    if (checkpointIndex === -1) {
      console.error(`ShadowGit.deleteCheckpoint: Checkpoint ${checkpointId} not found`);
      return false;
    }
    
    try {
      // Remove from in-memory array
      this.checkpoints.splice(checkpointIndex, 1);
      
      // Delete the checkpoint file
      const checkpointPath = path.join(this.shadowDir, 'checkpoints', `${checkpointId}.json`);
      if (fs.existsSync(checkpointPath)) {
        fs.unlinkSync(checkpointPath);
        console.log(`ShadowGit.deleteCheckpoint: Deleted checkpoint file ${checkpointPath}`);
      } else {
        console.warn(`ShadowGit.deleteCheckpoint: Checkpoint file ${checkpointPath} not found on disk`);
      }
      
      console.log(`ShadowGit.deleteCheckpoint: Successfully deleted checkpoint ${checkpointId}`);
      return true;
    } catch (error) {
      console.error(`ShadowGit.deleteCheckpoint: Failed to delete checkpoint ${checkpointId}:`, error);
      return false;
    }
  }

  /**
   * Create a temporary file for a snapshot
   * @param relativePath - Relative path of the file
   * @returns Path to the temporary file
   */
  public createTempSnapshotFile(relativePath: string): string {
    const snapshot = this.snapshots.get(relativePath);
    if (!snapshot) {
      throw new Error(`No snapshot found for ${relativePath}`);
    }
    
    const fileName = path.basename(relativePath);
    const tempPath = path.join(this.shadowDir, 'temp', `${fileName}.snapshot`);
    
    fs.writeFileSync(tempPath, snapshot.content);
    
    return tempPath;
  }
}
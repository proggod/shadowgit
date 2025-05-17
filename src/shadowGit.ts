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
    
    // Check if we have a snapshot
    if (!this.snapshots.has(relativePath)) {
      return [];
    }
    
    try {
      // Read current file content
      const currentContent = fs.readFileSync(filePath, 'utf8');
      const currentLines = currentContent.split('\n');
      
      // Get snapshot content
      const snapshot = this.snapshots.get(relativePath)!;
      const snapshotLines = snapshot.lines;
      
      // Simple line-by-line diff
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
      
      // Update and save the changes
      this.changes.set(relativePath, changes);
      this.saveChanges(relativePath, changes);
      
      return changes;
    } catch (error) {
      console.error(`Failed to detect changes in ${filePath}:`, error);
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
    // Get all approved changes
    const approvedChanges: Record<string, Change[]> = {};
    
    for (const [relativePath, changes] of this.changes.entries()) {
      const fileApprovedChanges = changes.filter(change => change.approved);
      if (fileApprovedChanges.length > 0) {
        approvedChanges[relativePath] = fileApprovedChanges;
      }
    }
    
    // Create the checkpoint
    const checkpoint: Checkpoint = {
      id: crypto.randomUUID(),
      message,
      timestamp: Date.now(),
      changes: approvedChanges,
      type: this.type
    };
    
    // Save the checkpoint
    this.checkpoints.push(checkpoint);
    this.saveCheckpoint(checkpoint);
    
    // Remove approved changes from pending changes
    for (const [relativePath, changes] of this.changes.entries()) {
      const remainingChanges = changes.filter(change => !change.approved);
      this.changes.set(relativePath, remainingChanges);
      this.saveChanges(relativePath, remainingChanges);
    }
    
    return checkpoint;
  }

  /**
   * Apply a checkpoint's changes to the actual files
   * @param checkpointId - ID of the checkpoint to apply
   */
  public applyCheckpoint(checkpointId: string): void {
    const checkpoint = this.checkpoints.find(cp => cp.id === checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }
    
    // Apply changes from the checkpoint
    for (const [relativePath, changes] of Object.entries(checkpoint.changes)) {
      const filePath = path.join(this.workspaceRoot, relativePath);
      const snapshot = this.snapshots.get(relativePath);
      
      if (!snapshot) {
        console.warn(`No snapshot found for ${relativePath}, skipping`);
        continue;
      }
      
      try {
        // Read current content
        const currentContent = fs.readFileSync(filePath, 'utf8');
        const currentLines = currentContent.split('\n');
        
        // Apply approved changes
        let newLines = [...currentLines];
        
        // Sort changes by line number in reverse to avoid offset issues
        const sortedChanges = [...changes].sort((a, b) => b.startLine - a.startLine);
        
        for (const change of sortedChanges) {
          if (change.type === 'addition' || change.type === 'modification') {
            const changeLines = change.content.split('\n');
            newLines.splice(change.startLine, change.endLine - change.startLine + 1, ...changeLines);
          } else if (change.type === 'deletion') {
            newLines.splice(change.startLine, change.endLine - change.startLine + 1);
          }
        }
        
        // Write the modified content back to the file
        fs.writeFileSync(filePath, newLines.join('\n'));
        
        // Update the snapshot
        this.takeSnapshot(filePath);
      } catch (error) {
        console.error(`Failed to apply checkpoint to ${filePath}:`, error);
      }
    }
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
      const checkpointPath = path.join(this.shadowDir, 'checkpoints', `${checkpoint.id}.json`);
      fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
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
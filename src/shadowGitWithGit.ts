import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Change, Checkpoint, ShadowGitType, Snapshot } from './types';
import { GitUtils } from './gitUtils';

/**
 * ShadowGitWithGit - Enhanced ShadowGit with actual Git integration
 * This class extends the functionality of ShadowGit by using an actual Git repository
 * for the working shadow git, providing proper staging and diff functionality.
 */
export class ShadowGitWithGit {
  public readonly workspaceRoot: string;
  public readonly type: ShadowGitType;
  public readonly shadowDir: string;
  public readonly gitRepoDir: string;
  public readonly snapshots: Map<string, Snapshot>;
  public readonly changes: Map<string, Change[]>;
  public readonly checkpoints: Checkpoint[];
  private baseCommitId: string | null = null;

  /**
   * Creates a new ShadowGitWithGit instance
   * @param workspaceRoot - Root path of the workspace
   * @param type - Type of ShadowGit ('main' or 'working')
   */
  constructor(workspaceRoot: string, type: ShadowGitType = 'working') {
    this.workspaceRoot = workspaceRoot;
    this.type = type;
    this.shadowDir = path.join(workspaceRoot, '.vscode', `.shadowgit-${type}`);
    this.gitRepoDir = path.join(this.shadowDir, 'git-repo');
    this.snapshots = new Map(); // Map of file paths to their snapshots
    this.changes = new Map();   // Map of file paths to their pending changes
    this.checkpoints = [];      // List of checkpoints (virtual commits)
  }

  /**
   * Initialize ShadowGit system with Git repository
   */
  public async initialize(): Promise<void> {
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
    
    // Initialize Git repository
    try {
      await GitUtils.initializeRepo(this.gitRepoDir);
    } catch (error) {
      console.error('Failed to initialize Git repository:', error);
    }
    
    // Load existing snapshots and checkpoints
    this.loadSnapshots();
    this.loadCheckpoints();
  }

  /**
   * Take a snapshot of the current file state and add it to the Git repository
   * @param filePath - Absolute path to the file
   * @returns The snapshot object
   */
  public async takeSnapshot(filePath: string): Promise<Snapshot> {
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
      
      // Save to Git repository
      const gitFilePath = this.getGitFilePath(relativePath);
      await GitUtils.createFile(this.gitRepoDir, gitFilePath, content);
      
      // If this is the first snapshot, create a base commit
      if (!this.baseCommitId) {
        await this.createBaseCommit();
      }
      
      return snapshot;
    } catch (error) {
      console.error(`Failed to take snapshot of ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Create a base commit to use as the reference point
   */
  private async createBaseCommit(): Promise<void> {
    try {
      // Check if we have any files
      const hasFiles = await GitUtils.hasStagedChanges(this.gitRepoDir);
      
      if (hasFiles) {
        // Create a commit for the base state
        const commitId = await GitUtils.commit(this.gitRepoDir, 'Base state');
        this.baseCommitId = commitId;
        console.log("Created base commit: ${commitId}");
      }
    } catch (error) {
      console.error('Failed to create base commit:', error);
    }
  }

  /**
   * Detect changes between current file and its snapshot using Git diff
   * @param filePath - Absolute path to the file
   * @returns Array of change objects
   */
  public async detectChanges(filePath: string): Promise<Change[]> {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    
    // Check if we have a snapshot
    if (!this.snapshots.has(relativePath)) {
      return [];
    }
    
    try {
      // Read current file content
      const currentContent = fs.readFileSync(filePath, 'utf8');
      
      // Update the file in the Git repository
      const gitFilePath = this.getGitFilePath(relativePath);
      await GitUtils.createFile(this.gitRepoDir, gitFilePath, currentContent);
      
      // Get the changes using Git's diff system
      // First, let's get a simplified diff output that we can parse
      const diffOutput = await GitUtils.createDiff(this.gitRepoDir, gitFilePath);
      
      // Parse the diff output to generate change objects
      const changes = this.parseDiffOutput(diffOutput, relativePath);
      
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
   * Parse the Git diff output to create change objects
   * @param diffOutput - Output from git diff command
   * @param relativePath - Relative path of the file
   * @returns Array of change objects
   */
  private parseDiffOutput(diffOutput: string, relativePath: string): Change[] {
    // This is a simplified parser that converts Git diff format into our Change objects
    const changes: Change[] = [];
    let changeId = 0;
    
    // Get the current snapshot content
    const snapshot = this.snapshots.get(relativePath);
    if (!snapshot) {
      throw new Error(`No snapshot found for ${relativePath}`);
    }
    const snapshotLines = snapshot.lines;
    
    // Read the current content from the Git repo
    const gitFilePath = path.join(this.gitRepoDir, this.getGitFilePath(relativePath));
    const currentContent = fs.readFileSync(gitFilePath, 'utf8');
    const currentLines = currentContent.split('\n');
    
    // Parse the diff output
    // This is a simplified version that looks for diff hunks
    const diffLines = diffOutput.split('\n');
    let currentHunk: { startLine: number, endLine: number, type: 'addition' | 'modification' | 'deletion' } | null = null;
    
    for (let i = 0; i < diffLines.length; i++) {
      const line = diffLines[i];
      
      // Look for hunk headers: @@ -a,b +c,d @@
      if (line.startsWith('@@')) {
        // Finish the previous hunk if there was one
        if (currentHunk) {
          const content = currentHunk.type === 'deletion' 
            ? snapshotLines.slice(currentHunk.startLine, currentHunk.endLine + 1).join('\n')
            : currentLines.slice(currentHunk.startLine, currentHunk.endLine + 1).join('\n');
          
          changes.push({
            id: changeId++,
            type: currentHunk.type,
            startLine: currentHunk.startLine,
            endLine: currentHunk.endLine,
            content,
            approved: false
          });
        }
        
        // Parse the hunk header
        const match = line.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
        if (match) {
          const oldStart = parseInt(match[1]) - 1; // 0-based
          const oldCount = parseInt(match[2]) || 1;
          const newStart = parseInt(match[3]) - 1; // 0-based
          const newCount = parseInt(match[4]) || 1;
          
          // Determine the type of change
          if (oldCount === 0) {
            // Pure addition
            currentHunk = {
              type: 'addition',
              startLine: newStart,
              endLine: newStart + newCount - 1
            };
          } else if (newCount === 0) {
            // Pure deletion
            currentHunk = {
              type: 'deletion',
              startLine: oldStart,
              endLine: oldStart + oldCount - 1
            };
          } else {
            // Modification
            currentHunk = {
              type: 'modification',
              startLine: newStart,
              endLine: newStart + newCount - 1
            };
          }
        }
      }
    }
    
    // Add the last hunk if there is one
    if (currentHunk) {
      const content = currentHunk.type === 'deletion' 
        ? snapshotLines.slice(currentHunk.startLine, currentHunk.endLine + 1).join('\n')
        : currentLines.slice(currentHunk.startLine, currentHunk.endLine + 1).join('\n');
      
      changes.push({
        id: changeId++,
        type: currentHunk.type,
        startLine: currentHunk.startLine,
        endLine: currentHunk.endLine,
        content,
        approved: false
      });
    }
    
    return changes;
  }

  /**
   * Get Git repository path for a file
   * @param relativePath - Relative path of the file in the workspace
   * @returns The corresponding path in the Git repository
   */
  private getGitFilePath(relativePath: string): string {
    // We'll use the same relative path within the Git repo
    return relativePath;
  }

  /**
   * Approve a specific change by staging it in Git
   * @param filePath - Absolute path to the file
   * @param changeId - ID of the change to approve
   * @returns Whether the operation was successful
   */
  public async approveChange(filePath: string, changeId: number): Promise<boolean> {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    const changes = this.changes.get(relativePath) || [];
    
    const change = changes.find(c => c.id === changeId);
    if (change) {
      // Mark the change as approved in our system
      change.approved = true;
      this.saveChanges(relativePath, changes);
      
      // Stage the change in Git
      const gitFilePath = this.getGitFilePath(relativePath);
      await GitUtils.stageFile(this.gitRepoDir, gitFilePath);
      
      return true;
    }
    
    return false;
  }

  /**
   * Disapprove a specific change by unstaging it in Git
   * @param filePath - Absolute path to the file
   * @param changeId - ID of the change to disapprove
   * @returns Whether the operation was successful
   */
  public async disapproveChange(filePath: string, changeId: number): Promise<boolean> {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    const changes = this.changes.get(relativePath) || [];
    
    const change = changes.find(c => c.id === changeId);
    if (change) {
      // Mark the change as disapproved in our system
      change.approved = false;
      this.saveChanges(relativePath, changes);
      
      // Unstage the change in Git
      const gitFilePath = this.getGitFilePath(relativePath);
      await GitUtils.unstageFile(this.gitRepoDir, gitFilePath);
      
      return true;
    }
    
    return false;
  }

  /**
   * Approve all changes in a file by staging it in Git
   * @param filePath - Absolute path to the file
   * @returns Number of changes approved
   */
  public async approveAllChanges(filePath: string): Promise<number> {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    const changes = this.changes.get(relativePath) || [];
    
    // Mark all changes as approved in our system
    changes.forEach(change => {
      change.approved = true;
    });
    
    this.saveChanges(relativePath, changes);
    
    // Stage the file in Git
    const gitFilePath = this.getGitFilePath(relativePath);
    await GitUtils.stageFile(this.gitRepoDir, gitFilePath);
    
    return changes.length;
  }

  /**
   * Disapprove all changes in a file by unstaging it in Git
   * @param filePath - Absolute path to the file
   * @returns Number of changes disapproved
   */
  public async disapproveAllChanges(filePath: string): Promise<number> {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    const changes = this.changes.get(relativePath) || [];
    
    // Mark all changes as disapproved in our system
    changes.forEach(change => {
      change.approved = false;
    });
    
    this.saveChanges(relativePath, changes);
    
    // Unstage the file in Git
    const gitFilePath = this.getGitFilePath(relativePath);
    await GitUtils.unstageFile(this.gitRepoDir, gitFilePath);
    
    return changes.length;
  }

  /**
   * Create a checkpoint (virtual commit) by committing in Git
   * @param message - Checkpoint message
   * @returns The checkpoint object
   */
  public async createCheckpoint(message: string): Promise<Checkpoint> {
    // Get all approved changes
    const approvedChanges: Record<string, Change[]> = {};
    
    for (const [relativePath, changes] of this.changes.entries()) {
      const fileApprovedChanges = changes.filter(change => change.approved);
      if (fileApprovedChanges.length > 0) {
        approvedChanges[relativePath] = fileApprovedChanges;
      }
    }
    
    // Create a Git commit
    const commitHash = await GitUtils.commit(this.gitRepoDir, message);
    
    // Create the checkpoint
    const checkpoint: Checkpoint = {
      id: commitHash || crypto.randomUUID(),
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
  public async applyCheckpoint(checkpointId: string): Promise<void> {
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
        const newLines = [...currentLines];
        
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
        await this.takeSnapshot(filePath);
      } catch (error) {
        console.error(`Failed to apply checkpoint to ${filePath}:`, error);
      }
    }
  }

  /**
   * Set a specific commit as the base reference
   * @param commitId - ID of the commit to use as base
   */
  public setBaseCommit(commitId: string): void {
    this.baseCommitId = commitId;
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
import * as vscode from 'vscode';
import { ShadowGit } from './shadowGit';
import { ShadowGitWithGit } from './shadowGitWithGit';
import * as fs from 'fs';
import * as path from 'path';

/**
 * File system provider for ShadowGit URIs
 * This allows VS Code to access file contents from ShadowGit snapshots
 * through a custom URI scheme (shadowgit:)
 */
export class ShadowGitFileSystemProvider implements vscode.FileSystemProvider {
  private readonly mainShadowGit: ShadowGit;
  private readonly workingShadowGit: ShadowGitWithGit | null;
  private readonly outputChannel: vscode.OutputChannel;

  constructor(
    mainShadowGit: ShadowGit, 
    workingShadowGit: ShadowGitWithGit | null, 
    outputChannel: vscode.OutputChannel
  ) {
    this.mainShadowGit = mainShadowGit;
    this.workingShadowGit = workingShadowGit;
    this.outputChannel = outputChannel;
  }

  // FileSystemProvider implementation
  
  /**
   * Read a file from a ShadowGit URI
   * @param uri - URI of the file to read
   * @returns Uint8Array of file content
   */
  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    this.outputChannel.appendLine(`ShadowGitFileSystemProvider.readFile: ${uri.toString()}`);
    
    try {
      // Parse the URI query to get information about the snapshot
      const query = JSON.parse(uri.query || '{}');
      const filePath = query.path || uri.fsPath;
      const snapshotId = query.snapshot || 'latest';
      const shadowGitType = query.type || 'main';
      
      this.outputChannel.appendLine(`Reading file: ${filePath}, snapshot: ${snapshotId}, type: ${shadowGitType}`);

      // Choose the correct ShadowGit instance
      const shadowGit = shadowGitType === 'main' ? this.mainShadowGit : this.workingShadowGit;
      
      if (!shadowGit) {
        throw new Error(`ShadowGit instance '${shadowGitType}' not available`);
      }
      
      // Get the relative path in the workspace
      const workspaceRoot = shadowGit.workspaceRoot;
      const relativePath = path.relative(workspaceRoot, filePath);
      
      if (!relativePath) {
        throw new Error(`File ${filePath} is not in workspace ${workspaceRoot}`);
      }
      
      // Return the snapshot content
      this.outputChannel.appendLine(`Retrieving snapshot for: ${relativePath}`);

      // Create a temporary file for the snapshot
      // This is a workaround as we don't have direct access to snapshot contents
      const tempFilePath = shadowGit.createTempSnapshotFile(relativePath);
      
      // Read the temporary file
      return fs.promises.readFile(tempFilePath);

    } catch (error) {
      this.outputChannel.appendLine(`Error reading file: ${error}`);
      throw error;
    }
  }

  /**
   * Write a file with a ShadowGit URI (not implemented - read-only)
   */
  writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): void {
    // ShadowGit files should be read-only for the FileSystemProvider, 
    // as we handle modifications through our own systems
    throw vscode.FileSystemError.NoPermissions('ShadowGit files are read-only');
  }

  /**
   * Check if a file exists with a ShadowGit URI
   */
  async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
    try {
      // Parse the URI query
      const query = JSON.parse(uri.query || '{}');
      const filePath = query.path || uri.fsPath;
      
      // Get file stats from the real filesystem
      const stats = await fs.promises.stat(filePath);
      
      return {
        type: vscode.FileType.File,
        ctime: stats.ctime.getTime(),
        mtime: stats.mtime.getTime(),
        size: stats.size
      };
    } catch (error) {
      throw vscode.FileSystemError.FileNotFound(uri);
    }
  }

  // --- manage files/folders

  /**
   * Create a directory (not implemented - read-only)
   */
  createDirectory(uri: vscode.Uri): void {
    throw vscode.FileSystemError.NoPermissions('ShadowGit filesystem is read-only');
  }

  /**
   * Delete a file (not implemented - read-only)
   */
  delete(uri: vscode.Uri, options: { recursive: boolean }): void {
    throw vscode.FileSystemError.NoPermissions('ShadowGit filesystem is read-only');
  }

  /**
   * Rename a file (not implemented - read-only)
   */
  rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {
    throw vscode.FileSystemError.NoPermissions('ShadowGit filesystem is read-only');
  }

  /**
   * Read a directory (list files) from a ShadowGit URI
   */
  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    // We don't support directory listing in ShadowGit
    throw vscode.FileSystemError.FileNotFound(uri);
  }

  // --- manage file events

  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

  /**
   * Watch a file or directory for changes (no-op)
   */
  watch(_resource: vscode.Uri): vscode.Disposable {
    // We don't need to watch for changes - we'll manage them ourselves
    return { dispose: () => {} };
  }
}
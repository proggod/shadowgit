import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Utility class to integrate with VS Code's Git extension
 */
export class GitIntegration {
  /**
   * Get the Git extension API
   * @returns VS Code Git extension API
   */
  public static async getGitAPI(): Promise<any> {
    const gitExtension = vscode.extensions.getExtension('vscode.git');
    if (!gitExtension) {
      throw new Error('Git extension not found');
    }
    
    if (!gitExtension.isActive) {
      await gitExtension.activate();
    }
    
    const git = gitExtension.exports.getAPI(1);
    if (!git) {
      throw new Error('Git API not available');
    }
    
    return git;
  }
  
  /**
   * Get the Git repository for a file path
   * @param filePath - Path to a file
   * @returns Git repository containing the file
   */
  public static async getRepositoryForFile(filePath: string): Promise<any> {
    const git = await this.getGitAPI();
    const repositories = git.repositories;
    
    if (repositories.length === 0) {
      throw new Error('No Git repositories found');
    }
    
    // Find the repository that contains this file
    let repo = repositories[0]; // Default to first repo
    
    // Try to find a better match if there are multiple repositories
    if (repositories.length > 1) {
      for (const r of repositories) {
        if (filePath.startsWith(r.rootUri.fsPath)) {
          repo = r;
          break;
        }
      }
    }
    
    return repo;
  }
  
  /**
   * Get the repository for the current workspace
   * @returns Git repository for the workspace
   */
  public static async getWorkspaceRepository(): Promise<any> {
    // Get the Git API
    const git = await this.getGitAPI();
    const repositories = git.repositories;
    
    if (repositories.length === 0) {
      throw new Error('No Git repositories found');
    }
    
    // If we have workspaceFolders, find the repository that matches the first one
    if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
      const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
      
      for (const repo of repositories) {
        if (repo.rootUri.fsPath === workspaceRoot) {
          return repo;
        }
      }
    }
    
    // Default to first repository
    return repositories[0];
  }
  
  /**
   * Get all changed files in Git with extended metadata - SIMPLIFIED VERSION
   * Only returns working tree and index changes (against the latest commit)
   * @returns Array of file paths with status and metadata
   */
  public static async getChangedFiles(): Promise<Array<{
    filePath: string, 
    status: string, 
    type: 'working' | 'index', 
    originalUri: string,
    uri: vscode.Uri
  }>> {
    try {
      const repo = await this.getWorkspaceRepository();
      const workingChanges = repo.state.workingTreeChanges || [];
      const indexChanges = repo.state.indexChanges || [];
      
      // Prepare result array
      const result = [];
      
      // Process working tree changes
      for (const change of workingChanges) {
        result.push({
          filePath: change.uri.fsPath,
          status: this.getGitStatusLabel(change.status),
          type: 'working',
          originalUri: change.uri.toString(),
          uri: change.uri
        });
      }
      
      // Process index changes
      for (const change of indexChanges) {
        result.push({
          filePath: change.uri.fsPath,
          status: this.getGitStatusLabel(change.status),
          type: 'index',
          originalUri: change.uri.toString(),
          uri: change.uri
        });
      }
      
      // Remove duplicates by file path (prioritize index over working tree)
      const uniqueChanges = new Map();
      for (const change of result) {
        // If we already have this file, only override if the new one is index
        if (uniqueChanges.has(change.filePath)) {
          const existing = uniqueChanges.get(change.filePath);
          if (change.type === 'index' && existing.type === 'working') {
            uniqueChanges.set(change.filePath, change);
          }
        } else {
          uniqueChanges.set(change.filePath, change);
        }
      }
      
      return Array.from(uniqueChanges.values());
    } catch (error) {
      console.error('Failed to get Git changed files:', error);
      return [];
    }
  }
  
  /**
   * Get the human-readable status label for a Git status code
   * @param status - Git status code
   * @returns Human-readable status label
   */
  private static getGitStatusLabel(status: number): string {
    // These are based on VS Code's FileStatus constants
    // See: https://github.com/microsoft/vscode/blob/main/extensions/git/src/api/git.d.ts
    switch (status) {
      case 0: return 'INDEX_MODIFIED';
      case 1: return 'INDEX_ADDED';
      case 2: return 'INDEX_DELETED';
      case 3: return 'INDEX_RENAMED';
      case 4: return 'INDEX_COPIED';
      case 5: return 'MODIFIED';
      case 6: return 'DELETED';
      case 7: return 'UNTRACKED';
      case 8: return 'IGNORED';
      case 9: return 'INTENT_TO_ADD';
      case 10: return 'ADDED_BY_US';
      case 11: return 'ADDED_BY_THEM';
      case 12: return 'DELETED_BY_US';
      case 13: return 'DELETED_BY_THEM';
      case 14: return 'BOTH_ADDED';
      case 15: return 'BOTH_DELETED';
      case 16: return 'BOTH_MODIFIED';
      default: return 'UNKNOWN';
    }
  }
  
  /**
   * Create a Git URI for a file 
   * @param uri - Original file URI
   * @returns URI with git scheme
   */
  public static async createGitDiffUri(uri: vscode.Uri): Promise<vscode.Uri> {
    // Get the Git repo
    const repo = await this.getRepositoryForFile(uri.fsPath);
    
    // We need to match exactly how the native Git extension creates URIs
    // The authority should be empty - repo info is in the query
    const rootUri = repo.rootUri.toString();
    
    // Construct the URI specifically matching VS Code's format
    const gitUri = uri.with({
      scheme: 'git',
      authority: '',  // VS Code actually uses empty authority
      path: uri.path,
      query: JSON.stringify({
        path: uri.fsPath,
        ref: 'HEAD',
        rootUri: rootUri,             // Add the rootUri
        indexStatus: '?',             // Include index status indicator
        workingTreeStatus: 'M',       // Include working tree status indicator
        originalUri: uri.toString(),  // Include original URI
        treeish: 'HEAD',              // Include treeish reference
        staged: false                 // Indicate whether changes are staged
      })
    });
    
    // Log the constructed URI for debugging
    console.log("SHADOW_GIT_DEBUG: Created Git URI: ${gitUri.toString()}");
    console.log("SHADOW_GIT_DEBUG: Git URI query: ${gitUri.query}");
    
    return gitUri;
  }
  
  /**
   * Stage a file in Git
   * @param filePath - Path to the file to stage
   */
  public static async stageFile(filePath: string): Promise<void> {
    try {
      const repo = await this.getRepositoryForFile(filePath);
      const uri = vscode.Uri.file(filePath);
      await repo.add([uri]);
    } catch (error) {
      console.error(`Failed to stage file in Git: ${error}`);
      throw error;
    }
  }
  
  /**
   * Unstage a file in Git
   * @param filePath - Path to the file to unstage
   */
  public static async unstageFile(filePath: string): Promise<void> {
    try {
      const repo = await this.getRepositoryForFile(filePath);
      const uri = vscode.Uri.file(filePath);
      await repo.revert([uri]);
    } catch (error) {
      console.error(`Failed to unstage file in Git: ${error}`);
      throw error;
    }
  }
}
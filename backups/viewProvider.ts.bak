import * as vscode from 'vscode';
import * as path from 'path';
import { ShadowGit } from './shadowGit';

/**
 * TreeDataProvider for Shadow Git files and checkpoints
 */
export class ShadowGitFilesProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly shadowGit: ShadowGit;
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null>;
  public readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null>;

  /**
   * Creates a new ShadowGitFilesProvider
   * @param shadowGit - ShadowGit instance
   */
  constructor(shadowGit: ShadowGit) {
    this.shadowGit = shadowGit;
    this._onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }
  
  /**
   * Refresh the tree view
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }
  
  /**
   * Get tree item for element
   * @param element - Tree element
   * @returns Tree item
   */
  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }
  
  /**
   * Get children of element
   * @param element - Tree element
   * @returns Promise with children elements
   */
  public getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (!this.shadowGit) {
      return Promise.resolve([]);
    }
    
    if (!element) {
      // Root level - return tracked files
      const trackedFiles = this.shadowGit.getTrackedFiles();
      
      if (trackedFiles.length === 0) {
        return Promise.resolve([new vscode.TreeItem('No tracked files')]);
      }
      
      return Promise.resolve(
        trackedFiles.map(filePath => {
          const fileName = path.basename(filePath);
          const treeItem = new vscode.TreeItem(fileName);
          
          // Set description to relative path
          treeItem.description = filePath;
          
          // Set contextValue for context menu filtering
          treeItem.contextValue = 'shadowGitFile';
          
          // Set command to open file
          treeItem.command = {
            command: 'vscode.open',
            arguments: [vscode.Uri.file(path.join(this.shadowGit.workspaceRoot, filePath))],
            title: 'Open File'
          };
          
          return treeItem;
        })
      );
    }
    
    return Promise.resolve([]);
  }
}

/**
 * TreeDataProvider for Shadow Git checkpoints
 */
export class ShadowGitCheckpointsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly shadowGit: ShadowGit;
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null>;
  public readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null>;

  /**
   * Creates a new ShadowGitCheckpointsProvider
   * @param shadowGit - ShadowGit instance 
   */
  constructor(shadowGit: ShadowGit) {
    this.shadowGit = shadowGit;
    this._onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined | null>();
    this.onDidChangeTreeData = this._onDidChangeTreeData.event;
  }
  
  /**
   * Refresh the tree view
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire(null);
  }
  
  /**
   * Get tree item for element
   * @param element - Tree element
   * @returns Tree item
   */
  public getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }
  
  /**
   * Get children of element
   * @param element - Tree element
   * @returns Promise with children elements
   */
  public getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
    if (!this.shadowGit) {
      return Promise.resolve([]);
    }
    
    if (!element) {
      // Root level - return checkpoints
      const checkpoints = this.shadowGit.getCheckpoints();
      
      if (checkpoints.length === 0) {
        return Promise.resolve([new vscode.TreeItem('No checkpoints')]);
      }
      
      return Promise.resolve(
        checkpoints.map(checkpoint => {
          const date = new Date(checkpoint.timestamp);
          const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
          
          // Create tree item with checkpoint ID and timestamp
          const treeItem = new vscode.TreeItem(`${checkpoint.message}`);
          treeItem.description = `${dateStr}`;
          treeItem.tooltip = `ID: ${checkpoint.id}\nCreated: ${dateStr}\nMessage: ${checkpoint.message}`;
          
          // Set contextValue for context menu filtering
          treeItem.contextValue = 'shadowGitCheckpoint';
          
          // Set command to apply checkpoint
          treeItem.command = {
            command: 'shadowGit.applyCheckpoint',
            arguments: [checkpoint.id],
            title: 'Apply Checkpoint'
          };
          
          return treeItem;
        })
      );
    }
    
    return Promise.resolve([]);
  }
}
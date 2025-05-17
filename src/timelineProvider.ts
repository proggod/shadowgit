import * as vscode from 'vscode';
import * as path from 'path';
import { ShadowGit } from './shadowGit';

// Define interfaces for Timeline API
interface TimelineItem {
  id?: string;
  timestamp: number;
  label: string;
  iconPath?: vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon;
  description?: string;
  detail?: string;
  command?: vscode.Command;
  contextValue?: string;
  accessibilityInformation?: vscode.AccessibilityInformation;
}

interface Timeline {
  readonly items: TimelineItem[];
  readonly paging?: {
    readonly cursor: string;
    readonly more: boolean;
  };
}

interface TimelineOptions {
  cursor?: string;
  limit?: number;
}

/**
 * Timeline provider for Shadow Git checkpoints
 */
export class ShadowGitTimelineProvider {
  private readonly shadowGit: ShadowGit;
  private _onDidChange = new vscode.EventEmitter<any>();

  /**
   * Event emitted when the timeline changes
   */
  public readonly onDidChange = this._onDidChange.event;

  /**
   * Creates a new ShadowGitTimelineProvider
   * @param shadowGit - ShadowGit instance
   */
  constructor(shadowGit: ShadowGit) {
    this.shadowGit = shadowGit;
  }
  
  /**
   * Provide timeline items for a specific URI
   * @param uri - URI to provide timeline for
   * @param options - Timeline options
   * @param token - Cancellation token
   * @returns Timeline with items
   */
  public async provideTimeline(
    uri: vscode.Uri,
    options: TimelineOptions,
    token: vscode.CancellationToken
  ): Promise<Timeline> {
    if (!this.shadowGit) {
      return { items: [] };
    }
    
    const filePath = uri.fsPath;
    const relativePath = path.relative(this.shadowGit.workspaceRoot, filePath);
    
    // Get checkpoints that affect this file
    const checkpoints = this.shadowGit.getCheckpoints().filter(cp => {
      return cp.changes && Object.keys(cp.changes).includes(relativePath);
    });
    
    // Convert checkpoints to timeline items
    const items: TimelineItem[] = checkpoints.map(cp => {
      return {
        id: cp.id,
        timestamp: cp.timestamp,
        label: cp.message,
        iconPath: new vscode.ThemeIcon('git-commit'),
        description: `${this.shadowGit.type === 'main' ? 'Main' : 'Working'} Checkpoint`,
        command: {
          title: 'Compare with Current',
          command: 'shadowGit.compareWithCheckpoint',
          arguments: [uri, cp.id]
        }
      };
    });
    
    return { items };
  }
  
  /**
   * Refresh the timeline
   */
  public refresh(): void {
    this._onDidChange.fire(undefined);
  }
}
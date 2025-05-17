import * as vscode from 'vscode';
import * as path from 'path';
import { ShadowGit } from './shadowGit';
import { Change } from './types';

/**
 * Provider for custom diff decorations
 */
export class DiffDecorationProvider {
  private readonly context: vscode.ExtensionContext;
  private readonly shadowGit: ShadowGit;
  private readonly decorationTypes: Record<string, vscode.TextEditorDecorationType>;
  private readonly diffEditors: Map<string, Change[]>;

  /**
   * Creates a new DiffDecorationProvider instance
   * @param context - Extension context
   * @param shadowGit - ShadowGit instance
   */
  constructor(context: vscode.ExtensionContext, shadowGit: ShadowGit) {
    this.context = context;
    this.shadowGit = shadowGit;
    this.decorationTypes = {
      // Decoration for approved additions
      approvedAddition: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: 'rgba(0, 128, 0, 0.2)',
        gutterIconPath: this.getIconPath('approved.svg'),
        gutterIconSize: '60%',
        after: {
          contentText: '✓ Approved',
          color: 'green',
          margin: '0 0 0 20px'
        }
      }),
      
      // Decoration for approved modifications
      approvedModification: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: 'rgba(155, 185, 85, 0.2)',
        gutterIconPath: this.getIconPath('approved.svg'),
        gutterIconSize: '60%',
        after: {
          contentText: '✓ Approved',
          color: 'green',
          margin: '0 0 0 20px'
        }
      }),
      
      // Decoration for approved deletions
      approvedDeletion: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: 'rgba(128, 0, 0, 0.2)',
        gutterIconPath: this.getIconPath('approved.svg'),
        gutterIconSize: '60%',
        after: {
          contentText: '✓ Approved',
          color: 'green',
          margin: '0 0 0 20px'
        }
      }),
      
      // Decoration for disapproved additions
      disapprovedAddition: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: 'rgba(0, 128, 0, 0.1)',
        gutterIconPath: this.getIconPath('disapproved.svg'),
        gutterIconSize: '60%',
        after: {
          contentText: '✗ Disapproved',
          color: 'red',
          margin: '0 0 0 20px'
        }
      }),
      
      // Decoration for disapproved modifications
      disapprovedModification: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: 'rgba(100, 100, 255, 0.1)',
        gutterIconPath: this.getIconPath('disapproved.svg'),
        gutterIconSize: '60%',
        after: {
          contentText: '✗ Disapproved',
          color: 'red',
          margin: '0 0 0 20px'
        }
      }),
      
      // Decoration for disapproved deletions
      disapprovedDeletion: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: 'rgba(255, 0, 0, 0.1)',
        gutterIconPath: this.getIconPath('disapproved.svg'),
        gutterIconSize: '60%',
        after: {
          contentText: '✗ Disapproved',
          color: 'red',
          margin: '0 0 0 20px'
        }
      }),
      
      // Decoration for pending additions
      pendingAddition: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: 'rgba(0, 128, 0, 0.1)',
        gutterIconPath: this.getIconPath('pending.svg'),
        gutterIconSize: '60%',
        after: {
          contentText: '? Pending [Approve] [Disapprove]',
          color: 'blue',
          margin: '0 0 0 20px'
        }
      }),
      
      // Decoration for pending modifications
      pendingModification: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: 'rgba(100, 100, 255, 0.1)',
        gutterIconPath: this.getIconPath('pending.svg'),
        gutterIconSize: '60%',
        after: {
          contentText: '? Pending [Approve] [Disapprove]',
          color: 'blue',
          margin: '0 0 0 20px'
        }
      }),
      
      // Decoration for pending deletions
      pendingDeletion: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: 'rgba(255, 0, 0, 0.1)',
        gutterIconPath: this.getIconPath('pending.svg'),
        gutterIconSize: '60%',
        after: {
          contentText: '? Pending [Approve] [Disapprove]',
          color: 'blue',
          margin: '0 0 0 20px'
        }
      }),
      
      // Approve gutter decoration
      approveGutter: vscode.window.createTextEditorDecorationType({
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        gutterIconPath: this.getIconPath('approve-icon.svg'),
        gutterIconSize: '60%'
      }),
      
      // Disapprove gutter decoration
      disapproveGutter: vscode.window.createTextEditorDecorationType({
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        gutterIconPath: this.getIconPath('disapprove-icon.svg'),
        gutterIconSize: '60%'
      }),
      
      // Decoration for the entire change block
      changeBlock: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        before: {
          backgroundColor: 'rgba(120, 120, 120, 0.1)',
          contentText: ' ',
          margin: '0'
        }
      })
    };
    
    // Map of file URIs to their changes
    this.diffEditors = new Map();
    
    // Register event listeners
    this.registerEventListeners();
  }
  
  /**
   * Get the absolute path to an icon
   * @param iconName - Name of the icon file
   * @returns URI to the icon
   */
  private getIconPath(iconName: string): vscode.Uri {
    return vscode.Uri.file(path.join(this.context.extensionPath, 'resources', iconName));
  }
  
  /**
   * Create a gutter icon that executes a command when clicked
   * @param iconPath - Path to the icon
   * @param command - Command to execute
   * @param args - Command arguments
   * @returns GutterIcon decoration
   */
  private createCommandGutterIcon(iconPath: string, command: string, args: any[]): vscode.DecorationRenderOptions {
    return {
      gutterIconPath: this.getIconPath(iconPath),
      gutterIconSize: '60%',
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      gutterCommand: {
        command: command,
        arguments: args,
        title: command === 'shadowGit.approveChange' ? 'Approve Change' : 'Disapprove Change'
      }
    };
  }
  
  /**
   * Register event listeners
   */
  private registerEventListeners(): void {
    // Listen for active editor changes
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && this.diffEditors.has(editor.document.uri.toString())) {
        this.applyDecorations(editor);
      }
    }, null, this.context.subscriptions);
    
    // Listen for text document changes
    vscode.workspace.onDidChangeTextDocument(event => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document &&
          this.diffEditors.has(editor.document.uri.toString())) {
        // Re-detect changes
        const filePath = editor.document.uri.fsPath;
        const changes = this.shadowGit.detectChanges(filePath);
        this.diffEditors.set(editor.document.uri.toString(), changes);
        
        // Apply decorations
        this.applyDecorations(editor);
      }
    }, null, this.context.subscriptions);
    
    // Listen for mouse hover in diff view
    vscode.languages.registerHoverProvider({ scheme: 'file' }, {
      provideHover: (document, position, token) => {
        // Check if this document has changes registered
        const uri = document.uri.toString();
        if (!this.diffEditors.has(uri)) {
          return null;
        }

        const changes = this.diffEditors.get(uri);
        if (!changes) {
          return null;
        }

        // Find the change that contains this position
        const change = changes.find(c => 
          position.line >= c.startLine && 
          position.line <= c.endLine
        );

        if (!change) {
          return null;
        }

        // Create hover message with action buttons
        const hoverMessage = new vscode.MarkdownString();
        hoverMessage.appendMarkdown(`**Change ID:** ${change.id}\n\n`);
        hoverMessage.appendMarkdown(`**Type:** ${change.type}\n\n`);
        hoverMessage.appendMarkdown(`**Status:** ${change.approved ? 'Approved' : (change.approved === false ? 'Disapproved' : 'Pending')}\n\n`);
        
        // Add approve/disapprove buttons
        hoverMessage.appendMarkdown(`---\n\n`);
        hoverMessage.appendMarkdown(`[Approve](command:shadowGit.approveChange?${encodeURIComponent(JSON.stringify([document.uri, change.id]))})`);
        hoverMessage.appendMarkdown(` | `);
        hoverMessage.appendMarkdown(`[Disapprove](command:shadowGit.disapproveChange?${encodeURIComponent(JSON.stringify([document.uri, change.id]))})`);
        
        // Make sure command URIs are enabled
        hoverMessage.isTrusted = true;

        return new vscode.Hover(hoverMessage);
      }
    });
  }
  
  /**
   * Handle change context menu
   * @param uri - URI of the document
   * @param line - Line number
   */
  public async handleChangeContextMenu(uri: vscode.Uri, line: number): Promise<void> {
    if (!this.diffEditors.has(uri.toString())) {
      return;
    }
    
    const changes = this.diffEditors.get(uri.toString());
    if (!changes) {
      return;
    }
    
    // Find the change that contains this line
    const change = changes.find(c => 
      line >= c.startLine && 
      line <= c.endLine
    );
    
    if (!change) {
      return;
    }
    
    // Show context menu
    const action = await vscode.window.showQuickPick(
      [
        { label: 'Approve Change', value: 'approve' },
        { label: 'Disapprove Change', value: 'disapprove' }
      ],
      { placeHolder: 'Select action for change' }
    );
    
    if (!action) {
      return;
    }
    
    if (action.value === 'approve') {
      vscode.commands.executeCommand('shadowGit.approveChange', uri, change.id);
    } else if (action.value === 'disapprove') {
      vscode.commands.executeCommand('shadowGit.disapproveChange', uri, change.id);
    }
  }
  
  /**
   * Register a diff editor for decoration
   * @param uri - URI of the document
   * @param changes - Array of changes
   */
  public registerDiffEditor(uri: vscode.Uri, changes: Change[]): void {
    this.diffEditors.set(uri.toString(), changes);
    
    // Apply decorations if this is the active editor
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.toString() === uri.toString()) {
      this.applyDecorations(editor);
    }
  }
  
  /**
   * Apply decorations to an editor
   * @param editor - Text editor
   */
  public applyDecorations(editor: vscode.TextEditor): void {
    const uri = editor.document.uri.toString();
    const changes = this.diffEditors.get(uri);
    
    if (!changes) {
      return;
    }
    
    // Create decoration collections for each type
    const approvedAdditions: vscode.DecorationOptions[] = [];
    const approvedModifications: vscode.DecorationOptions[] = [];
    const approvedDeletions: vscode.DecorationOptions[] = [];
    const disapprovedAdditions: vscode.DecorationOptions[] = [];
    const disapprovedModifications: vscode.DecorationOptions[] = [];
    const disapprovedDeletions: vscode.DecorationOptions[] = [];
    const pendingAdditions: vscode.DecorationOptions[] = [];
    const pendingModifications: vscode.DecorationOptions[] = [];
    const pendingDeletions: vscode.DecorationOptions[] = [];
    const approveGutter: vscode.DecorationOptions[] = [];
    const disapproveGutter: vscode.DecorationOptions[] = [];
    const blockDecorations: vscode.DecorationOptions[] = [];
    
    changes.forEach(change => {
      const startLine = change.startLine;
      const endLine = change.endLine;
      
      // Create range for decoration
      const range = new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(endLine, editor.document.lineAt(endLine).text.length)
      );
      
      // Create a smaller range for gutter icons (just the first line)
      const gutterRange = new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(startLine, 0)
      );
      
      // Create hover message
      const hoverMessage = new vscode.MarkdownString();
      hoverMessage.appendMarkdown(`**Change ID:** ${change.id}\n\n`);
      hoverMessage.appendMarkdown(`**Type:** ${change.type}\n\n`);
      hoverMessage.appendMarkdown(`**Status:** ${change.approved ? 'Approved' : (change.approved === false ? 'Disapproved' : 'Pending')}\n\n`);
      
      // Add approve/disapprove buttons (only one set)
      hoverMessage.appendMarkdown(`---\n\n`);
      hoverMessage.appendMarkdown(`[Approve](command:shadowGit.approveChange?${encodeURIComponent(JSON.stringify([editor.document.uri, change.id]))})`);
      hoverMessage.appendMarkdown(` | `);
      hoverMessage.appendMarkdown(`[Disapprove](command:shadowGit.disapproveChange?${encodeURIComponent(JSON.stringify([editor.document.uri, change.id]))})`);
      
      // Make sure command URIs are enabled
      hoverMessage.isTrusted = true;
      
      // Create decoration options
      const decorationOptions: vscode.DecorationOptions = { 
        range,
        hoverMessage
      };
      
      // Create block decoration
      const blockDecoration: vscode.DecorationOptions = {
        range,
        hoverMessage
      };
      
      // Create approve gutter decoration
      const approveGutterDecoration: vscode.DecorationOptions = {
        range: gutterRange,
        hoverMessage: new vscode.MarkdownString(
          `[Approve Change](command:shadowGit.approveChange?${encodeURIComponent(JSON.stringify([editor.document.uri, change.id]))})`
        )
      };
      approveGutterDecoration.hoverMessage!.isTrusted = true;
      
      // Create disapprove gutter decoration
      const disapproveGutterDecoration: vscode.DecorationOptions = {
        range: new vscode.Range(
          new vscode.Position(startLine + 1, 0),
          new vscode.Position(startLine + 1, 0)
        ),
        hoverMessage: new vscode.MarkdownString(
          `[Disapprove Change](command:shadowGit.disapproveChange?${encodeURIComponent(JSON.stringify([editor.document.uri, change.id]))})`
        )
      };
      disapproveGutterDecoration.hoverMessage!.isTrusted = true;
      
      // Add to the appropriate arrays based on change type and approval status
      if (change.approved === true) {
        // Approved changes
        if (change.type === 'addition') {
          approvedAdditions.push(decorationOptions);
        } else if (change.type === 'modification') {
          approvedModifications.push(decorationOptions);
        } else if (change.type === 'deletion') {
          approvedDeletions.push(decorationOptions);
        }
      } else if (change.approved === false) {
        // Disapproved changes
        if (change.type === 'addition') {
          disapprovedAdditions.push(decorationOptions);
        } else if (change.type === 'modification') {
          disapprovedModifications.push(decorationOptions);
        } else if (change.type === 'deletion') {
          disapprovedDeletions.push(decorationOptions);
        }
      } else {
        // Pending changes
        if (change.type === 'addition') {
          pendingAdditions.push(decorationOptions);
        } else if (change.type === 'modification') {
          pendingModifications.push(decorationOptions);
        } else if (change.type === 'deletion') {
          pendingDeletions.push(decorationOptions);
        }
        
        // Add approve/disapprove gutter icons for pending changes
        approveGutter.push(approveGutterDecoration);
        disapproveGutter.push(disapproveGutterDecoration);
      }
      
      blockDecorations.push(blockDecoration);
    });
    
    // Apply decorations for each type
    editor.setDecorations(this.decorationTypes.approvedAddition, approvedAdditions);
    editor.setDecorations(this.decorationTypes.approvedModification, approvedModifications);
    editor.setDecorations(this.decorationTypes.approvedDeletion, approvedDeletions);
    editor.setDecorations(this.decorationTypes.disapprovedAddition, disapprovedAdditions);
    editor.setDecorations(this.decorationTypes.disapprovedModification, disapprovedModifications);
    editor.setDecorations(this.decorationTypes.disapprovedDeletion, disapprovedDeletions);
    editor.setDecorations(this.decorationTypes.pendingAddition, pendingAdditions);
    editor.setDecorations(this.decorationTypes.pendingModification, pendingModifications);
    editor.setDecorations(this.decorationTypes.pendingDeletion, pendingDeletions);
    editor.setDecorations(this.decorationTypes.approveGutter, approveGutter);
    editor.setDecorations(this.decorationTypes.disapproveGutter, disapproveGutter);
    editor.setDecorations(this.decorationTypes.changeBlock, blockDecorations);
  }
  
  /**
   * Refresh decorations for a specific document
   * @param uri - Document URI
   */
  public refreshDecorations(uri: vscode.Uri): void {
    const filePath = uri.fsPath;
    const changes = this.shadowGit.detectChanges(filePath);
    this.diffEditors.set(uri.toString(), changes);
    
    // Find and decorate editor if open
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.toString() === uri.toString()) {
        this.applyDecorations(editor);
        break;
      }
    }
  }
}
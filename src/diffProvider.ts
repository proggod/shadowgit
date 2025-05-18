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
    console.log('Creating DiffDecorationProvider with custom decorations DISABLED');
    
    // Create empty decoration types - we don't want to use custom decorations anymore
    // This will allow VS Code's native Git icons to appear
    this.decorationTypes = {
      approvedAddition: vscode.window.createTextEditorDecorationType({}),
      approvedModification: vscode.window.createTextEditorDecorationType({}),
      approvedDeletion: vscode.window.createTextEditorDecorationType({}),
      disapprovedAddition: vscode.window.createTextEditorDecorationType({}),
      disapprovedModification: vscode.window.createTextEditorDecorationType({}),
      disapprovedDeletion: vscode.window.createTextEditorDecorationType({}),
      pendingAddition: vscode.window.createTextEditorDecorationType({}),
      pendingModification: vscode.window.createTextEditorDecorationType({}),
      pendingDeletion: vscode.window.createTextEditorDecorationType({}),
      stageGutter: vscode.window.createTextEditorDecorationType({}),
      disapproveGutter: vscode.window.createTextEditorDecorationType({}),
      changeBlock: vscode.window.createTextEditorDecorationType({})
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
    const iconPath = path.join(this.context.extensionPath, 'resources', iconName);
    console.log("Resolving icon path for ${iconName}: ${iconPath}");
    return vscode.Uri.file(iconPath);
  }
  
  /**
   * Create a gutter icon that executes a command when clicked
   * @param iconPath - Path to the icon
   * @param command - Command to execute
   * @param args - Command arguments
   * @returns GutterIcon decoration
   */
  private createCommandGutterIcon(iconPath: string): vscode.DecorationRenderOptions {
    // Note: VS Code API doesn't support gutterCommand directly
    // instead we use hover commands or context menu actions
    return {
      gutterIconPath: this.getIconPath(iconPath),
      gutterIconSize: '60%',
      overviewRulerLane: vscode.OverviewRulerLane.Right
    };
  }
  
  /**
   * Register event listeners
   */
  private registerEventListeners(): void {
    // Listen for active editor changes
    vscode.window.onDidChangeActiveTextEditor(editor => {
      console.log("Active editor changed: ${editor ? editor.document.fileName : 'none'}");
      if (editor) {
        console.log("Checking if ${editor.document.uri.toString()} is a registered diff editor");
        
        // Check our main editor registry
        let found = false;
        let changesForEditor: Change[] | undefined;
        
        // Try to find the editor in our registry with different URI formats
        const uriVariations = [
          editor.document.uri.toString(),
          editor.document.uri.fsPath,
          path.normalize(editor.document.uri.fsPath),
          editor.document.uri.toString().replace('file://', ''),
          editor.document.uri.path,
          editor.document.uri.with({ scheme: 'vscode-diff' }).toString()
        ];
        
        for (const uri of uriVariations) {
          if (this.diffEditors.has(uri)) {
            found = true;
            changesForEditor = this.diffEditors.get(uri);
            console.log("Found registered diff editor at URI variation: ${uri}");
            break;
          }
        }
        
        // Special handling for diff editors - detect if this is part of a diff view
        if (!found && editor.document.fileName.endsWith('.snapshot')) {
          // Try to find the corresponding right side editor (if this is the left side)
          console.log('This appears to be the left side of a diff editor');
          
          // Check all open editors to see if any match our criteria
          for (const openEditor of vscode.window.visibleTextEditors) {
            console.log("Checking editor: ${openEditor.document.uri.toString()}");
            
            // Skip the current editor (the snapshot)
            if (openEditor.document.uri.toString() === editor.document.uri.toString()) {
              continue;
            }
            
            // If we find another editor, it's likely the right side of the diff
            for (const uri of uriVariations) {
              if (this.diffEditors.has(uri)) {
                found = true;
                changesForEditor = this.diffEditors.get(uri);
                console.log("Found registered diff editor for the right side: ${uri}");
                break;
              }
            }
            
            if (found) {break;}
          }
        }
        
        if (found && changesForEditor) {
          console.log("Found registered diff editor, applying decorations");
          this.applyDecorations(editor);
        } else {
          // Try to check based on the filename without the full path
          const filename = path.basename(editor.document.fileName);
          let foundByFilename = false;
          
          this.diffEditors.forEach((localChanges, uri) => {
            if (uri.endsWith(filename)) {
              console.log("Found editor by filename match: ${uri}");
              this.diffEditors.set(editor.document.uri.toString(), localChanges);
              this.applyDecorations(editor);
              foundByFilename = true;
            }
          });
          
          if (!foundByFilename) {
            // Log all registered diff editors
            console.log("Current editor is not in registered diff editors. Registered editors:");
          }
        }
      }
    }, null, this.context.subscriptions);
    
    // Listen for text document changes
    vscode.workspace.onDidChangeTextDocument(event => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document) {
        // Check if we have this document registered in any form
        let found = false;
        const uriVariations = [
          editor.document.uri.toString(),
          editor.document.uri.fsPath,
          path.normalize(editor.document.uri.fsPath),
          editor.document.uri.toString().replace('file://', ''),
          editor.document.uri.path,
          editor.document.uri.with({ scheme: 'vscode-diff' }).toString()
        ];
        
        for (const uri of uriVariations) {
          if (this.diffEditors.has(uri)) {
            found = true;
            break;
          }
        }
        
        if (found) {
          // Re-detect changes
          const filePath = editor.document.uri.fsPath;
          const changes = this.shadowGit.detectChanges(filePath);
          
          // Update all URI variations
          for (const uri of uriVariations) {
            this.diffEditors.set(uri, changes);
          }
          
          // Apply decorations
          this.applyDecorations(editor);
        }
      }
    }, null, this.context.subscriptions);
    
    // Listen for newly opened documents
    vscode.workspace.onDidOpenTextDocument(document => {
      console.log("Document opened: ${document.uri.toString()}");
      
      // Special handling for diff documents
      if (document.uri.scheme === 'diff') {
        console.log('This is a diff document, we should catch this');
        
        // Get all visible editors and try to match them with our registered changes
        setTimeout(() => {
          for (const editor of vscode.window.visibleTextEditors) {
            console.log("Checking visible editor after diff opened: ${editor.document.uri.toString()}");
            
            // Check all of our registered editors to see if any match
            for (const [registeredUri, localChanges] of this.diffEditors.entries()) {
              // Check if the filename matches
              if (path.basename(registeredUri) === path.basename(editor.document.fileName)) {
                console.log("Found matching file by basename: ${registeredUri} → ${editor.document.fileName}");
                
                // Register this new editor with those changes
                this.diffEditors.set(editor.document.uri.toString(), localChanges);
                this.applyDecorations(editor);
              }
            }
          }
        }, 1000); // Delay a bit to let VS Code fully set up the diff editor
      }
    }, null, this.context.subscriptions);
    
    // Listen for mouse hover in diff view
    vscode.languages.registerHoverProvider([{ scheme: 'file' }, { scheme: 'vscode-diff' }, { scheme: 'diff' }], {
      provideHover: (document, position) => {
        console.log("Hover detected at line ${position.line}, character ${position.character} in ${document.uri.toString()}");
        
        // Check if this document has changes registered
        const uri = document.uri.toString();
        
        // Check multiple URI variations
        const uriVariations = [
          uri,
          document.uri.fsPath,
          path.normalize(document.uri.fsPath),
          uri.replace('file://', ''),
          document.uri.path,
          document.uri.with({ scheme: 'vscode-diff' }).toString(),
          document.uri.with({ scheme: 'file' }).toString()
        ];
        
        let foundUri = '';
        let changesForUri: Change[] | undefined;
        
        for (const testUri of uriVariations) {
          if (this.diffEditors.has(testUri)) {
            foundUri = testUri;
            changesForUri = this.diffEditors.get(testUri);
            console.log("Found registered changes for URI variation: ${testUri}");
            break;
          }
        }
        
        if (!foundUri || !changesForUri) {
          // Also try to match by filename
          const filename = path.basename(document.fileName);
          for (const [registeredUri, changes] of this.diffEditors.entries()) {
            if (registeredUri.endsWith(filename)) {
              foundUri = registeredUri;
              changesForUri = changes;
              console.log("Found registered changes by filename match: ${registeredUri}");
              
              // Register this new URI format for future lookups
              this.diffEditors.set(uri, changes);
              break;
            }
          }
        }
        
        if (!foundUri || !changesForUri) {
          console.log("No changes registered for ${uri}");
          return null;
        }
        
        // Use the found changes
        if (!changesForUri) {
          console.log("Changes array is null/undefined for ${uri}");
          return null;
        }
        
        console.log("Found ${changesForUri.length} changes for ${uri}");

        // Find the change that contains this position
        const change = changesForUri.find(c => 
          position.line >= c.startLine && 
          position.line <= c.endLine
        );

        if (!change) {
          console.log("No change found at line ${position.line}");
          return null;
        }
        
        console.log("Found change ${change.id} at lines ${change.startLine}-${change.endLine}");

        // Create hover message with action buttons
        const hoverMessage = new vscode.MarkdownString();
        hoverMessage.appendMarkdown(`**Change ID:** ${change.id}\n\n`);
        hoverMessage.appendMarkdown(`**Type:** ${change.type}\n\n`);
        hoverMessage.appendMarkdown(`**Status:** ${change.approved ? 'Approved' : (change.approved === false ? 'Disapproved' : 'Pending')}\n\n`);
        
        // Add approve/disapprove buttons
        hoverMessage.appendMarkdown(`---\n\n`);
        // Important: VS Code expects a specific format for command URIs in hover
        // We need to manually create the correct URI format
        const approveArgs = JSON.stringify([document.uri, change.id]);
        const disapproveArgs = JSON.stringify([document.uri, change.id]);
        console.log("Approve args: ${approveArgs}");
        
        hoverMessage.appendMarkdown(`[Approve](command:shadowGit.approveChange?${encodeURIComponent(approveArgs)})`);
        hoverMessage.appendMarkdown(` | `);
        hoverMessage.appendMarkdown(`[Disapprove](command:shadowGit.disapproveChange?${encodeURIComponent(disapproveArgs)})`);
        
        // Make sure command URIs are enabled
        hoverMessage.isTrusted = true;
        
        // Also add the direct command text for debugging
        hoverMessage.appendMarkdown(`\n\n---\n\nDebug info: \`shadowGit.approveChange(${document.uri.toString()}, ${change.id})\``);
        
        
        console.log("Returning hover with commands for change ${change.id}");

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
    console.log("Registering diff editor for ${uri.toString()}");
    console.log("Found ${changes.length} changes to decorate");
    
    // Register with more variations of the URI to ensure we catch all possible forms
    this.diffEditors.set(uri.toString(), changes);
    this.diffEditors.set(uri.fsPath, changes);
    this.diffEditors.set(path.normalize(uri.fsPath), changes);
    
    // Also try to register with potential alternative forms of the URI
    const alternateUri = uri.toString().replace('file://', '');
    this.diffEditors.set(alternateUri, changes);
    
    // Register with URI variations that VS Code might use in diff views
    if (uri.scheme === 'file') {
      // Try without the scheme
      this.diffEditors.set(uri.path, changes);
      
      // Try with a different scheme that VS Code might use for diffs
      const diffUri = uri.with({ scheme: 'vscode-diff' }).toString();
      this.diffEditors.set(diffUri, changes);
    }
    
    // Register a watcher for this file
    const watcher = vscode.workspace.createFileSystemWatcher(uri.fsPath);
    watcher.onDidChange(() => {
      console.log("File changed: ${uri.fsPath}");
      try {
        const currentChanges = this.shadowGit.detectChanges(uri.fsPath);
        this.diffEditors.set(uri.toString(), currentChanges);
        this.diffEditors.set(uri.fsPath, currentChanges);
        
        // Apply to any matching editors
        vscode.window.visibleTextEditors.forEach(visibleEditor => {
          if (visibleEditor.document.uri.toString() === uri.toString() ||
              visibleEditor.document.fileName === uri.fsPath) {
            this.applyDecorations(visibleEditor);
          }
        });
      } catch (error) {
        console.log("Error updating decorations: ${error}");
      }
    });
    
    // Find all editors, not just the active one
    const visibleEditors = vscode.window.visibleTextEditors;
    console.log("Total visible editors: ${visibleEditors.length}");
    
    // Log all visible editors for debugging
    visibleEditors.forEach(() => {
      console.log("Editor found");
    });
    
    // Try to find and decorate any matching editors (by URI or path)
    let decorated = false;
    visibleEditors.forEach(ed => {
      if (ed.document.uri.toString() === uri.toString() || 
          ed.document.fileName === uri.fsPath) {
        console.log("Decorating editor: ${ed.document.uri.toString()}");
        this.applyDecorations(ed);
        decorated = true;
      }
    });
    
    // Schedule multiple decoration attempts with increasing delays
    if (!decorated) {
      console.log('No matching editor found immediately, will try with delays');
      
      // Try multiple times with increasing delays
      [500, 1000, 2000, 3000].forEach(delay => {
        setTimeout(() => {
          console.log("Attempting to find and decorate editor after ${delay}ms delay");
          const currentEditors = vscode.window.visibleTextEditors;
          
          // Try to find by looking at all visible editors
          for (const ed of currentEditors) {
            // Try various forms of matching
            const editorUri = ed.document.uri.toString();
            const editorPath = ed.document.fileName;
            
            // Check all possible variations for a match
            if (editorUri === uri.toString() || 
                editorPath === uri.fsPath ||
                editorUri.includes(path.basename(uri.fsPath))) {
              console.log("Found matching editor after delay: ${editorUri}");
              this.applyDecorations(ed);
              break;
            }
          }
        }, delay);
      });
    }
  }
  
  /**
   * Apply decorations to an editor
   * @param editor - Text editor
   */
  public applyDecorations(editor: vscode.TextEditor): void {
    const uri = editor.document.uri.toString();
    const changes = this.diffEditors.get(uri);
    
    // Add logging to debug
    console.log("Applying decorations to ${uri}");
    console.log("Found ${changes ? changes.length : 0} changes");
    console.log("Editor is ${editor.document.fileName}");
    console.log("Context path is ${this.context.extensionPath}");
    
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
    const stageGutter: vscode.DecorationOptions[] = [];
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
      
      // Create separate ranges for stage and disapprove icons 
      // For better visibility, we'll put the stage button on every line of the change block
      const stageLines: vscode.DecorationOptions[] = [];
      const disapproveLines: vscode.DecorationOptions[] = [];

      // Create stage and disapprove buttons for each line of the change
      for (let lineNum = startLine; lineNum <= endLine; lineNum++) {
        // Create range for this line
        const lineRange = new vscode.Range(
          new vscode.Position(lineNum, 0),
          new vscode.Position(lineNum, editor.document.lineAt(lineNum).text.length)
        );

        // Create stage hover message
        const stageHoverMessage = new vscode.MarkdownString(
          `**Stage (Approve)**: Mark this change as approved\n\n` +
          `[Approve Change](command:shadowGit.approveChange?${encodeURIComponent(JSON.stringify([editor.document.uri, change.id]))})` 
        );
        stageHoverMessage.isTrusted = true;

        // Create disapprove hover message
        const disapproveHoverMessage = new vscode.MarkdownString(
          `**Disapprove**: Mark this change as disapproved\n\n` +
          `[Disapprove Change](command:shadowGit.disapproveChange?${encodeURIComponent(JSON.stringify([editor.document.uri, change.id]))})` 
        );
        disapproveHoverMessage.isTrusted = true;

        // Add to the appropriate arrays
        stageLines.push({ range: lineRange, hoverMessage: stageHoverMessage });
        disapproveLines.push({ range: lineRange, hoverMessage: disapproveHoverMessage });
      }

      // Add all stage and disapprove lines to our main arrays
      stageGutter.push(...stageLines);
      disapproveGutter.push(...disapproveLines);

      // Also keep single ranges for backward compatibility
      const stageGutterRange = new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(startLine, editor.document.lineAt(startLine).text.length)
      );
      
      // Disapprove goes on the last line of the change if it's different from the first
      const disapproveLineNum = startLine === endLine ? startLine : endLine;
      const disapproveGutterRange = new vscode.Range(
        new vscode.Position(disapproveLineNum, 0),
        new vscode.Position(disapproveLineNum, editor.document.lineAt(disapproveLineNum).text.length)
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
      
      // We've already created the stage and disapprove decorations above in the stageLines array
      // This section is kept for compatibility with older versions
      const stageGutterDecoration = stageLines[0] || {
        range: stageGutterRange,
        hoverMessage: new vscode.MarkdownString(
          `**Stage (Approve)**: Mark this change as approved\n\n` +
          `[Approve Change](command:shadowGit.approveChange?${encodeURIComponent(JSON.stringify([editor.document.uri, change.id]))})`
        )
      };
      
      const disapproveGutterDecoration = disapproveLines[disapproveLines.length - 1] || {
        range: disapproveGutterRange,
        hoverMessage: new vscode.MarkdownString(
          `**Disapprove**: Mark this change as disapproved\n\n` +
          `[Disapprove Change](command:shadowGit.disapproveChange?${encodeURIComponent(JSON.stringify([editor.document.uri, change.id]))})`
        )
      };
      
      // Make sure hover messages are trusted
      if (stageGutterDecoration.hoverMessage instanceof vscode.MarkdownString) {
        stageGutterDecoration.hoverMessage.isTrusted = true;
      }
      if (disapproveGutterDecoration.hoverMessage instanceof vscode.MarkdownString) {
        disapproveGutterDecoration.hoverMessage.isTrusted = true;
      }
      
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
      }
      
      // We've already added these decorations to the stageGutter and disapproveGutter arrays
      // Let's add some logging to make sure we know what's happening
      console.log("Added ${stageLines.length} stage decorators for lines ${startLine}-${endLine}");
      console.log("Added ${disapproveLines.length} disapprove decorators for lines ${startLine}-${endLine}");

      // Also add the single decorations for backward compatibility
      stageGutter.push(stageGutterDecoration);
      disapproveGutter.push(disapproveGutterDecoration);
      
      blockDecorations.push(blockDecoration);
    });
    
    // Apply decorations for each type
    try {
      console.log("Applying regular decorations");
      editor.setDecorations(this.decorationTypes.approvedAddition, approvedAdditions);
      editor.setDecorations(this.decorationTypes.approvedModification, approvedModifications);
      editor.setDecorations(this.decorationTypes.approvedDeletion, approvedDeletions);
      editor.setDecorations(this.decorationTypes.disapprovedAddition, disapprovedAdditions);
      editor.setDecorations(this.decorationTypes.disapprovedModification, disapprovedModifications);
      editor.setDecorations(this.decorationTypes.disapprovedDeletion, disapprovedDeletions);
      editor.setDecorations(this.decorationTypes.pendingAddition, pendingAdditions);
      editor.setDecorations(this.decorationTypes.pendingModification, pendingModifications);
      editor.setDecorations(this.decorationTypes.pendingDeletion, pendingDeletions);
      
      // Gutter decorations
      console.log(`Applying ${stageGutter.length} stage gutter decorations`);
      console.log(`Applying ${disapproveGutter.length} disapprove gutter decorations`);
      
      // Log sample ranges
      if (stageGutter.length > 0) {
        console.log(`Sample stage gutter range: ${JSON.stringify({
          start: {line: stageGutter[0].range.start.line, character: stageGutter[0].range.start.character},
          end: {line: stageGutter[0].range.end.line, character: stageGutter[0].range.end.character}
        })}`);
      }
      
      editor.setDecorations(this.decorationTypes.stageGutter, stageGutter);
      editor.setDecorations(this.decorationTypes.disapproveGutter, disapproveGutter);
      editor.setDecorations(this.decorationTypes.changeBlock, blockDecorations);
      
      console.log(`All decorations applied successfully`);
    } catch (error) {
      console.log(`Error applying decorations: ${error}`);
    }
    
    console.log('Decorations applied');
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
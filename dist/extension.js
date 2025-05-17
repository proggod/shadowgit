"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode5 = __toESM(require("vscode"));
var path6 = __toESM(require("path"));

// src/shadowGit.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var crypto = __toESM(require("crypto"));
var ShadowGit = class {
  /**
   * Creates a new ShadowGit instance
   * @param workspaceRoot - Root path of the workspace
   * @param type - Type of ShadowGit ('main' or 'working')
   */
  constructor(workspaceRoot, type = "main") {
    this.workspaceRoot = workspaceRoot;
    this.type = type;
    this.shadowDir = path.join(workspaceRoot, ".vscode", `.shadowgit-${type}`);
    this.snapshots = /* @__PURE__ */ new Map();
    this.changes = /* @__PURE__ */ new Map();
    this.checkpoints = [];
    this.initialize();
  }
  /**
   * Initialize ShadowGit system
   */
  initialize() {
    if (!fs.existsSync(this.shadowDir)) {
      fs.mkdirSync(this.shadowDir, { recursive: true });
    }
    const dirs = ["snapshots", "changes", "checkpoints", "temp"];
    dirs.forEach((dir) => {
      const dirPath = path.join(this.shadowDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
    this.loadSnapshots();
    this.loadCheckpoints();
  }
  /**
   * Take a snapshot of the current file state
   * @param filePath - Absolute path to the file
   * @returns The snapshot object
   */
  takeSnapshot(filePath) {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const hash = this.hashContent(content);
      const snapshot = {
        hash,
        content,
        timestamp: Date.now(),
        lines: content.split("\n")
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
  detectChanges(filePath) {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    if (!this.snapshots.has(relativePath)) {
      return [];
    }
    try {
      const currentContent = fs.readFileSync(filePath, "utf8");
      const currentLines = currentContent.split("\n");
      const snapshot = this.snapshots.get(relativePath);
      const snapshotLines = snapshot.lines;
      const changes = [];
      let changeId = 0;
      for (let i = 0; i < currentLines.length; i++) {
        if (i >= snapshotLines.length || currentLines[i] !== snapshotLines[i]) {
          let endLine = i;
          while (endLine < currentLines.length && (endLine >= snapshotLines.length || currentLines[endLine] !== snapshotLines[endLine])) {
            endLine++;
          }
          changes.push({
            id: changeId++,
            type: i >= snapshotLines.length ? "addition" : "modification",
            startLine: i,
            endLine: endLine - 1,
            content: currentLines.slice(i, endLine).join("\n"),
            approved: false
          });
          i = endLine - 1;
        }
      }
      for (let i = 0; i < snapshotLines.length; i++) {
        if (i >= currentLines.length || currentLines[i] !== snapshotLines[i]) {
          let endLine = i;
          while (endLine < snapshotLines.length && (endLine >= currentLines.length || currentLines[endLine] !== snapshotLines[endLine])) {
            endLine++;
          }
          const isModification = changes.some(
            (change) => change.type === "modification" && change.startLine <= i && change.endLine >= i
          );
          if (!isModification) {
            changes.push({
              id: changeId++,
              type: "deletion",
              startLine: i,
              endLine: endLine - 1,
              content: snapshotLines.slice(i, endLine).join("\n"),
              approved: false
            });
          }
          i = endLine - 1;
        }
      }
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
  trackChanges(filePath, changes) {
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
  approveChange(filePath, changeId) {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    const changes = this.changes.get(relativePath) || [];
    const change = changes.find((c) => c.id === changeId);
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
  disapproveChange(filePath, changeId) {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    const changes = this.changes.get(relativePath) || [];
    const change = changes.find((c) => c.id === changeId);
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
  approveAllChanges(filePath) {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    const changes = this.changes.get(relativePath) || [];
    changes.forEach((change) => {
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
  disapproveAllChanges(filePath) {
    const relativePath = path.relative(this.workspaceRoot, filePath);
    const changes = this.changes.get(relativePath) || [];
    changes.forEach((change) => {
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
  createCheckpoint(message) {
    const approvedChanges = {};
    for (const [relativePath, changes] of this.changes.entries()) {
      const fileApprovedChanges = changes.filter((change) => change.approved);
      if (fileApprovedChanges.length > 0) {
        approvedChanges[relativePath] = fileApprovedChanges;
      }
    }
    const checkpoint = {
      id: crypto.randomUUID(),
      message,
      timestamp: Date.now(),
      changes: approvedChanges,
      type: this.type
    };
    this.checkpoints.push(checkpoint);
    this.saveCheckpoint(checkpoint);
    for (const [relativePath, changes] of this.changes.entries()) {
      const remainingChanges = changes.filter((change) => !change.approved);
      this.changes.set(relativePath, remainingChanges);
      this.saveChanges(relativePath, remainingChanges);
    }
    return checkpoint;
  }
  /**
   * Apply a checkpoint's changes to the actual files
   * @param checkpointId - ID of the checkpoint to apply
   */
  applyCheckpoint(checkpointId) {
    const checkpoint = this.checkpoints.find((cp) => cp.id === checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }
    for (const [relativePath, changes] of Object.entries(checkpoint.changes)) {
      const filePath = path.join(this.workspaceRoot, relativePath);
      const snapshot = this.snapshots.get(relativePath);
      if (!snapshot) {
        console.warn(`No snapshot found for ${relativePath}, skipping`);
        continue;
      }
      try {
        const currentContent = fs.readFileSync(filePath, "utf8");
        const currentLines = currentContent.split("\n");
        let newLines = [...currentLines];
        const sortedChanges = [...changes].sort((a, b) => b.startLine - a.startLine);
        for (const change of sortedChanges) {
          if (change.type === "addition" || change.type === "modification") {
            const changeLines = change.content.split("\n");
            newLines.splice(change.startLine, change.endLine - change.startLine + 1, ...changeLines);
          } else if (change.type === "deletion") {
            newLines.splice(change.startLine, change.endLine - change.startLine + 1);
          }
        }
        fs.writeFileSync(filePath, newLines.join("\n"));
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
  hashContent(content) {
    return crypto.createHash("sha256").update(content).digest("hex");
  }
  /**
   * Load snapshots from disk
   */
  loadSnapshots() {
    try {
      const snapshotsDir = path.join(this.shadowDir, "snapshots");
      if (!fs.existsSync(snapshotsDir)) {
        return;
      }
      const files = fs.readdirSync(snapshotsDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path.join(snapshotsDir, file);
          const relativePath = file.slice(0, -5);
          const content = fs.readFileSync(filePath, "utf8");
          const snapshot = JSON.parse(content);
          this.snapshots.set(relativePath, snapshot);
        }
      }
    } catch (error) {
      console.error("Failed to load snapshots:", error);
    }
  }
  /**
   * Save a snapshot to disk
   * @param relativePath - Relative path of the file
   * @param snapshot - Snapshot object
   */
  saveSnapshot(relativePath, snapshot) {
    try {
      const snapshotPath = path.join(this.shadowDir, "snapshots", `${relativePath}.json`);
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
  saveChanges(relativePath, changes) {
    try {
      const changesPath = path.join(this.shadowDir, "changes", `${relativePath}.json`);
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
  loadCheckpoints() {
    try {
      const checkpointsDir = path.join(this.shadowDir, "checkpoints");
      if (!fs.existsSync(checkpointsDir)) {
        return;
      }
      const files = fs.readdirSync(checkpointsDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path.join(checkpointsDir, file);
          const content = fs.readFileSync(filePath, "utf8");
          const checkpoint = JSON.parse(content);
          this.checkpoints.push(checkpoint);
        }
      }
      this.checkpoints.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error("Failed to load checkpoints:", error);
    }
  }
  /**
   * Save a checkpoint to disk
   * @param checkpoint - Checkpoint object
   */
  saveCheckpoint(checkpoint) {
    try {
      const checkpointPath = path.join(this.shadowDir, "checkpoints", `${checkpoint.id}.json`);
      fs.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
    } catch (error) {
      console.error(`Failed to save checkpoint ${checkpoint.id}:`, error);
    }
  }
  /**
   * Get all tracked files
   * @returns Array of tracked file paths
   */
  getTrackedFiles() {
    return Array.from(this.snapshots.keys());
  }
  /**
   * Get all checkpoints
   * @returns Array of checkpoint objects
   */
  getCheckpoints() {
    return [...this.checkpoints];
  }
  /**
   * Create a temporary file for a snapshot
   * @param relativePath - Relative path of the file
   * @returns Path to the temporary file
   */
  createTempSnapshotFile(relativePath) {
    const snapshot = this.snapshots.get(relativePath);
    if (!snapshot) {
      throw new Error(`No snapshot found for ${relativePath}`);
    }
    const fileName = path.basename(relativePath);
    const tempPath = path.join(this.shadowDir, "temp", `${fileName}.snapshot`);
    fs.writeFileSync(tempPath, snapshot.content);
    return tempPath;
  }
};

// src/diffProvider.ts
var vscode = __toESM(require("vscode"));
var path2 = __toESM(require("path"));
var DiffDecorationProvider = class {
  /**
   * Creates a new DiffDecorationProvider instance
   * @param context - Extension context
   * @param shadowGit - ShadowGit instance
   */
  constructor(context, shadowGit) {
    this.context = context;
    this.shadowGit = shadowGit;
    this.decorationTypes = {
      // Decoration for approved additions
      approvedAddition: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: "rgba(0, 128, 0, 0.2)",
        gutterIconPath: this.getIconPath("approved.svg"),
        gutterIconSize: "60%",
        after: {
          contentText: "\u2713 Approved",
          color: "green",
          margin: "0 0 0 20px"
        }
      }),
      // Decoration for approved modifications
      approvedModification: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: "rgba(155, 185, 85, 0.2)",
        gutterIconPath: this.getIconPath("approved.svg"),
        gutterIconSize: "60%",
        after: {
          contentText: "\u2713 Approved",
          color: "green",
          margin: "0 0 0 20px"
        }
      }),
      // Decoration for approved deletions
      approvedDeletion: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: "rgba(128, 0, 0, 0.2)",
        gutterIconPath: this.getIconPath("approved.svg"),
        gutterIconSize: "60%",
        after: {
          contentText: "\u2713 Approved",
          color: "green",
          margin: "0 0 0 20px"
        }
      }),
      // Decoration for disapproved additions
      disapprovedAddition: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: "rgba(0, 128, 0, 0.1)",
        gutterIconPath: this.getIconPath("disapproved.svg"),
        gutterIconSize: "60%",
        after: {
          contentText: "\u2717 Disapproved",
          color: "red",
          margin: "0 0 0 20px"
        }
      }),
      // Decoration for disapproved modifications
      disapprovedModification: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: "rgba(100, 100, 255, 0.1)",
        gutterIconPath: this.getIconPath("disapproved.svg"),
        gutterIconSize: "60%",
        after: {
          contentText: "\u2717 Disapproved",
          color: "red",
          margin: "0 0 0 20px"
        }
      }),
      // Decoration for disapproved deletions
      disapprovedDeletion: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: "rgba(255, 0, 0, 0.1)",
        gutterIconPath: this.getIconPath("disapproved.svg"),
        gutterIconSize: "60%",
        after: {
          contentText: "\u2717 Disapproved",
          color: "red",
          margin: "0 0 0 20px"
        }
      }),
      // Decoration for pending additions
      pendingAddition: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: "rgba(0, 128, 0, 0.1)",
        gutterIconPath: this.getIconPath("pending.svg"),
        gutterIconSize: "60%",
        after: {
          contentText: "? Pending [Approve] [Disapprove]",
          color: "blue",
          margin: "0 0 0 20px"
        }
      }),
      // Decoration for pending modifications
      pendingModification: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: "rgba(100, 100, 255, 0.1)",
        gutterIconPath: this.getIconPath("pending.svg"),
        gutterIconSize: "60%",
        after: {
          contentText: "? Pending [Approve] [Disapprove]",
          color: "blue",
          margin: "0 0 0 20px"
        }
      }),
      // Decoration for pending deletions
      pendingDeletion: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        backgroundColor: "rgba(255, 0, 0, 0.1)",
        gutterIconPath: this.getIconPath("pending.svg"),
        gutterIconSize: "60%",
        after: {
          contentText: "? Pending [Approve] [Disapprove]",
          color: "blue",
          margin: "0 0 0 20px"
        }
      }),
      // Approve gutter decoration
      approveGutter: vscode.window.createTextEditorDecorationType({
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        gutterIconPath: this.getIconPath("approve-icon.svg"),
        gutterIconSize: "60%"
      }),
      // Disapprove gutter decoration
      disapproveGutter: vscode.window.createTextEditorDecorationType({
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
        gutterIconPath: this.getIconPath("disapprove-icon.svg"),
        gutterIconSize: "60%"
      }),
      // Decoration for the entire change block
      changeBlock: vscode.window.createTextEditorDecorationType({
        isWholeLine: true,
        before: {
          backgroundColor: "rgba(120, 120, 120, 0.1)",
          contentText: " ",
          margin: "0"
        }
      })
    };
    this.diffEditors = /* @__PURE__ */ new Map();
    this.registerEventListeners();
  }
  /**
   * Get the absolute path to an icon
   * @param iconName - Name of the icon file
   * @returns URI to the icon
   */
  getIconPath(iconName) {
    return vscode.Uri.file(path2.join(this.context.extensionPath, "resources", iconName));
  }
  /**
   * Create a gutter icon that executes a command when clicked
   * @param iconPath - Path to the icon
   * @param command - Command to execute
   * @param args - Command arguments
   * @returns GutterIcon decoration
   */
  createCommandGutterIcon(iconPath, command, args) {
    return {
      gutterIconPath: this.getIconPath(iconPath),
      gutterIconSize: "60%",
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      gutterCommand: {
        command,
        arguments: args,
        title: command === "shadowGit.approveChange" ? "Approve Change" : "Disapprove Change"
      }
    };
  }
  /**
   * Register event listeners
   */
  registerEventListeners() {
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && this.diffEditors.has(editor.document.uri.toString())) {
        this.applyDecorations(editor);
      }
    }, null, this.context.subscriptions);
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && event.document === editor.document && this.diffEditors.has(editor.document.uri.toString())) {
        const filePath = editor.document.uri.fsPath;
        const changes = this.shadowGit.detectChanges(filePath);
        this.diffEditors.set(editor.document.uri.toString(), changes);
        this.applyDecorations(editor);
      }
    }, null, this.context.subscriptions);
    vscode.languages.registerHoverProvider({ scheme: "file" }, {
      provideHover: (document, position, token) => {
        const uri = document.uri.toString();
        if (!this.diffEditors.has(uri)) {
          return null;
        }
        const changes = this.diffEditors.get(uri);
        if (!changes) {
          return null;
        }
        const change = changes.find(
          (c) => position.line >= c.startLine && position.line <= c.endLine
        );
        if (!change) {
          return null;
        }
        const hoverMessage = new vscode.MarkdownString();
        hoverMessage.appendMarkdown(`**Change ID:** ${change.id}

`);
        hoverMessage.appendMarkdown(`**Type:** ${change.type}

`);
        hoverMessage.appendMarkdown(`**Status:** ${change.approved ? "Approved" : change.approved === false ? "Disapproved" : "Pending"}

`);
        hoverMessage.appendMarkdown(`---

`);
        hoverMessage.appendMarkdown(`[Approve](command:shadowGit.approveChange?${encodeURIComponent(JSON.stringify([document.uri, change.id]))})`);
        hoverMessage.appendMarkdown(` | `);
        hoverMessage.appendMarkdown(`[Disapprove](command:shadowGit.disapproveChange?${encodeURIComponent(JSON.stringify([document.uri, change.id]))})`);
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
  async handleChangeContextMenu(uri, line) {
    if (!this.diffEditors.has(uri.toString())) {
      return;
    }
    const changes = this.diffEditors.get(uri.toString());
    if (!changes) {
      return;
    }
    const change = changes.find(
      (c) => line >= c.startLine && line <= c.endLine
    );
    if (!change) {
      return;
    }
    const action = await vscode.window.showQuickPick(
      [
        { label: "Approve Change", value: "approve" },
        { label: "Disapprove Change", value: "disapprove" }
      ],
      { placeHolder: "Select action for change" }
    );
    if (!action) {
      return;
    }
    if (action.value === "approve") {
      vscode.commands.executeCommand("shadowGit.approveChange", uri, change.id);
    } else if (action.value === "disapprove") {
      vscode.commands.executeCommand("shadowGit.disapproveChange", uri, change.id);
    }
  }
  /**
   * Register a diff editor for decoration
   * @param uri - URI of the document
   * @param changes - Array of changes
   */
  registerDiffEditor(uri, changes) {
    this.diffEditors.set(uri.toString(), changes);
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.toString() === uri.toString()) {
      this.applyDecorations(editor);
    }
  }
  /**
   * Apply decorations to an editor
   * @param editor - Text editor
   */
  applyDecorations(editor) {
    const uri = editor.document.uri.toString();
    const changes = this.diffEditors.get(uri);
    if (!changes) {
      return;
    }
    const approvedAdditions = [];
    const approvedModifications = [];
    const approvedDeletions = [];
    const disapprovedAdditions = [];
    const disapprovedModifications = [];
    const disapprovedDeletions = [];
    const pendingAdditions = [];
    const pendingModifications = [];
    const pendingDeletions = [];
    const approveGutter = [];
    const disapproveGutter = [];
    const blockDecorations = [];
    changes.forEach((change) => {
      const startLine = change.startLine;
      const endLine = change.endLine;
      const range = new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(endLine, editor.document.lineAt(endLine).text.length)
      );
      const gutterRange = new vscode.Range(
        new vscode.Position(startLine, 0),
        new vscode.Position(startLine, 0)
      );
      const hoverMessage = new vscode.MarkdownString();
      hoverMessage.appendMarkdown(`**Change ID:** ${change.id}

`);
      hoverMessage.appendMarkdown(`**Type:** ${change.type}

`);
      hoverMessage.appendMarkdown(`**Status:** ${change.approved ? "Approved" : change.approved === false ? "Disapproved" : "Pending"}

`);
      hoverMessage.appendMarkdown(`---

`);
      hoverMessage.appendMarkdown(`[Approve](command:shadowGit.approveChange?${encodeURIComponent(JSON.stringify([editor.document.uri, change.id]))})`);
      hoverMessage.appendMarkdown(` | `);
      hoverMessage.appendMarkdown(`[Disapprove](command:shadowGit.disapproveChange?${encodeURIComponent(JSON.stringify([editor.document.uri, change.id]))})`);
      hoverMessage.isTrusted = true;
      const decorationOptions = {
        range,
        hoverMessage
      };
      const blockDecoration = {
        range,
        hoverMessage
      };
      const approveGutterDecoration = {
        range: gutterRange,
        hoverMessage: new vscode.MarkdownString(
          `[Approve Change](command:shadowGit.approveChange?${encodeURIComponent(JSON.stringify([editor.document.uri, change.id]))})`
        )
      };
      approveGutterDecoration.hoverMessage.isTrusted = true;
      const disapproveGutterDecoration = {
        range: new vscode.Range(
          new vscode.Position(startLine + 1, 0),
          new vscode.Position(startLine + 1, 0)
        ),
        hoverMessage: new vscode.MarkdownString(
          `[Disapprove Change](command:shadowGit.disapproveChange?${encodeURIComponent(JSON.stringify([editor.document.uri, change.id]))})`
        )
      };
      disapproveGutterDecoration.hoverMessage.isTrusted = true;
      if (change.approved === true) {
        if (change.type === "addition") {
          approvedAdditions.push(decorationOptions);
        } else if (change.type === "modification") {
          approvedModifications.push(decorationOptions);
        } else if (change.type === "deletion") {
          approvedDeletions.push(decorationOptions);
        }
      } else if (change.approved === false) {
        if (change.type === "addition") {
          disapprovedAdditions.push(decorationOptions);
        } else if (change.type === "modification") {
          disapprovedModifications.push(decorationOptions);
        } else if (change.type === "deletion") {
          disapprovedDeletions.push(decorationOptions);
        }
      } else {
        if (change.type === "addition") {
          pendingAdditions.push(decorationOptions);
        } else if (change.type === "modification") {
          pendingModifications.push(decorationOptions);
        } else if (change.type === "deletion") {
          pendingDeletions.push(decorationOptions);
        }
        approveGutter.push(approveGutterDecoration);
        disapproveGutter.push(disapproveGutterDecoration);
      }
      blockDecorations.push(blockDecoration);
    });
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
  refreshDecorations(uri) {
    const filePath = uri.fsPath;
    const changes = this.shadowGit.detectChanges(filePath);
    this.diffEditors.set(uri.toString(), changes);
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.toString() === uri.toString()) {
        this.applyDecorations(editor);
        break;
      }
    }
  }
};

// src/scmProvider.ts
var vscode2 = __toESM(require("vscode"));
var path3 = __toESM(require("path"));
var ShadowGitSCMProvider = class {
  /**
   * Creates a new ShadowGitSCMProvider
   * @param context - Extension context
   * @param shadowGit - ShadowGit instance
   */
  constructor(context, shadowGit) {
    this.context = context;
    this.shadowGit = shadowGit;
    const scmId = `shadowgit-${shadowGit.type}`;
    const scmLabel = `Shadow Git (${shadowGit.type === "main" ? "Main" : "Working"})`;
    this.scm = vscode2.scm.createSourceControl(scmId, scmLabel);
    this.changeGroup = this.scm.createResourceGroup("changes", "Changes");
    this.scm.inputBox.placeholder = `Message for new ${shadowGit.type} checkpoint...`;
    context.subscriptions.push(
      vscode2.commands.registerCommand(
        `shadowGit.createCheckpointFrom${shadowGit.type === "main" ? "Main" : "Working"}SCM`,
        () => this.createCheckpointFromSCM()
      )
    );
    this.update();
    this.registerEventListeners();
  }
  /**
   * Register event listeners
   */
  registerEventListeners() {
    vscode2.workspace.onDidChangeTextDocument((event) => {
      const filePath = event.document.uri.fsPath;
      const relativePath = path3.relative(this.shadowGit.workspaceRoot, filePath);
      if (filePath.includes(".vscode/.shadowgit-")) {
        return;
      }
      if (this.shadowGit.snapshots.has(relativePath)) {
        this.shadowGit.detectChanges(filePath);
        this.update();
      }
    });
  }
  /**
   * Update SCM resources
   */
  update() {
    const resources = [];
    for (const [relativePath, changes] of this.shadowGit.changes.entries()) {
      if (changes.length > 0) {
        const fileUri = vscode2.Uri.file(path3.join(this.shadowGit.workspaceRoot, relativePath));
        const approvedCount = changes.filter((c) => c.approved).length;
        const pendingCount = changes.length - approvedCount;
        const decorations = {
          strikeThrough: false,
          tooltip: `${approvedCount} approved, ${pendingCount} pending changes`,
          faded: false
        };
        resources.push({
          resourceUri: fileUri,
          decorations,
          command: {
            title: "Open Diff",
            command: "vscode.diff",
            arguments: [
              this.createTempDiffUri(relativePath),
              fileUri,
              `Shadow Diff: ${path3.basename(relativePath)} (${this.shadowGit.type})`
            ]
          }
        });
      }
    }
    this.changeGroup.resourceStates = resources;
  }
  /**
   * Create a URI for the temporary diff file
   * @param relativePath - Relative path to the file
   * @returns URI for the temp file
   */
  createTempDiffUri(relativePath) {
    const tempPath = this.shadowGit.createTempSnapshotFile(relativePath);
    return vscode2.Uri.file(tempPath);
  }
  /**
   * Create a checkpoint from SCM input
   */
  async createCheckpointFromSCM() {
    const message = this.scm.inputBox.value;
    if (!message) {
      vscode2.window.showErrorMessage("Please enter a checkpoint message");
      return;
    }
    try {
      const checkpoint = this.shadowGit.createCheckpoint(message);
      vscode2.window.showInformationMessage(`${this.shadowGit.type} checkpoint created: ${checkpoint.id.substring(0, 8)}`);
      this.scm.inputBox.value = "";
      this.update();
    } catch (error) {
      vscode2.window.showErrorMessage(`Failed to create checkpoint: ${error.message}`);
    }
  }
  /**
   * Dispose of the SCM provider
   */
  dispose() {
    this.scm.dispose();
  }
};

// src/shadowGitView.ts
var vscode3 = __toESM(require("vscode"));
var path4 = __toESM(require("path"));
var ShadowGitViewProvider = class {
  /**
   * Creates a new ShadowGitViewProvider instance
   * @param context - Extension context
   * @param shadowGit - ShadowGit instance
   */
  constructor(context, shadowGit) {
    this.context = context;
    this.shadowGit = shadowGit;
  }
  /**
   * Resolve the WebView
   * @param webviewView - WebView to resolve
   */
  resolveWebviewView(webviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode3.Uri.file(path4.join(this.context.extensionPath, "resources"))
      ]
    };
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "takeSnapshot":
          vscode3.commands.executeCommand("shadowGit.takeSnapshot");
          break;
        case "openDiff":
          this.openDiff(message.path);
          break;
        case "createCheckpoint":
          vscode3.commands.executeCommand(this.shadowGit.type === "main" ? "shadowGit.createCheckpoint" : "shadowGit.createWorkingCheckpoint");
          break;
        case "applyCheckpoint":
          vscode3.commands.executeCommand("shadowGit.applyCheckpoint", message.id);
          break;
        case "refresh":
          this.refresh();
          break;
        case "openFile":
          this.openFile(message.path);
          break;
      }
    });
    this.refresh();
  }
  /**
   * Get the HTML for the WebView
   * @param webview - WebView
   * @returns HTML content
   */
  getHtmlForWebview(webview) {
    const mainStyleUri = webview.asWebviewUri(
      vscode3.Uri.file(path4.join(this.context.extensionPath, "resources", "view.css"))
    );
    const codiconsUri = webview.asWebviewUri(
      vscode3.Uri.file(path4.join(this.context.extensionPath, "node_modules", "@vscode/codicons", "dist", "codicon.css"))
    );
    const titleCase = (str) => str.charAt(0).toUpperCase() + str.slice(1);
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Shadow Git</title>
      <link rel="stylesheet" href="${mainStyleUri}">
      <link rel="stylesheet" href="${codiconsUri}">
      <style>
        :root {
          --container-padding: 10px;
          --input-padding-vertical: 6px;
          --input-padding-horizontal: 10px;
        }
        
        body {
          padding: 0;
          font-family: var(--vscode-font-family);
          font-size: var(--vscode-font-size);
          color: var(--vscode-foreground);
        }
        
        .container {
          padding: var(--container-padding);
        }
        
        button {
          border: none;
          padding: var(--input-padding-vertical) var(--input-padding-horizontal);
          width: 100%;
          text-align: center;
          outline: none;
          color: var(--vscode-button-foreground);
          background: var(--vscode-button-background);
          cursor: pointer;
          margin-bottom: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        button:hover {
          background: var(--vscode-button-hoverBackground);
        }
        
        button i {
          margin-right: 5px;
        }
        
        .actions {
          display: flex;
          flex-direction: column;
          margin-bottom: 16px;
        }
        
        h2, h3 {
          font-weight: 400;
          margin-top: 16px;
          margin-bottom: 8px;
        }
        
        .files-list, .checkpoints-list {
          margin-top: 8px;
        }
        
        .file-item {
          padding: 8px;
          margin-bottom: 8px;
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 2px;
        }
        
        .file-name {
          font-weight: bold;
        }
        
        .file-path {
          font-size: 0.8em;
          color: var(--vscode-descriptionForeground);
          margin-bottom: 8px;
        }
        
        .file-actions {
          display: flex;
          justify-content: space-between;
        }
        
        .file-actions button {
          width: 48%;
        }
        
        .checkpoint-item {
          padding: 8px;
          margin-bottom: 8px;
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 2px;
        }
        
        .checkpoint-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        
        .checkpoint-id {
          font-weight: bold;
        }
        
        .checkpoint-date {
          font-size: 0.8em;
          color: var(--vscode-descriptionForeground);
        }
        
        .checkpoint-message {
          margin-bottom: 8px;
        }
        
        .empty-message {
          font-style: italic;
          color: var(--vscode-descriptionForeground);
          text-align: center;
          padding: 10px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Shadow Git (${titleCase(this.shadowGit.type)})</h2>
        
        <div class="actions">
          <button id="takeSnapshot"><i class="codicon codicon-device-camera"></i> Take Snapshot</button>
          <button id="createCheckpoint"><i class="codicon codicon-git-commit"></i> Create Checkpoint</button>
          <button id="refresh"><i class="codicon codicon-refresh"></i> Refresh</button>
        </div>
        
        <h3>Tracked Files</h3>
        <div class="files-list" id="filesList">
          <div class="empty-message">No tracked files</div>
        </div>
        
        <h3>Checkpoints</h3>
        <div class="checkpoints-list" id="checkpointsList">
          <div class="empty-message">No checkpoints</div>
        </div>
      </div>
      
      <script>
        // Get vscode API
        const vscode = acquireVsCodeApi();
        
        // DOM elements
        const takeSnapshotBtn = document.getElementById('takeSnapshot');
        const createCheckpointBtn = document.getElementById('createCheckpoint');
        const refreshBtn = document.getElementById('refresh');
        const filesList = document.getElementById('filesList');
        const checkpointsList = document.getElementById('checkpointsList');
        
        // Event listeners
        takeSnapshotBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'takeSnapshot' });
        });
        
        createCheckpointBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'createCheckpoint' });
        });
        
        refreshBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'refresh' });
        });
        
        // Handle messages from the extension
        window.addEventListener('message', event => {
          const message = event.data;
          
          switch (message.command) {
            case 'update':
              updateUI(message.trackedFiles, message.checkpoints);
              break;
          }
        });
        
        /**
         * Update the UI with files and checkpoints
         * @param {Array} trackedFiles - Array of tracked file paths
         * @param {Array} checkpoints - Array of checkpoint objects
         */
        function updateUI(trackedFiles, checkpoints) {
          // Update files list
          if (trackedFiles.length === 0) {
            filesList.innerHTML = '<div class="empty-message">No tracked files</div>';
          } else {
            filesList.innerHTML = '';
            
            trackedFiles.forEach(filePath => {
              const fileItem = document.createElement('div');
              fileItem.className = 'file-item';
              
              const fileName = filePath.split('/').pop();
              
              fileItem.innerHTML = \`
                <div class="file-name">\${fileName}</div>
                <div class="file-path">\${filePath}</div>
                <div class="file-actions">
                  <button class="open-btn"><i class="codicon codicon-file-code"></i> Open</button>
                  <button class="diff-btn"><i class="codicon codicon-diff"></i> Diff</button>
                </div>
              \`;
              
              // Open file button
              fileItem.querySelector('.open-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'openFile',
                  path: filePath
                });
              });
              
              // Open diff button
              fileItem.querySelector('.diff-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'openDiff',
                  path: filePath
                });
              });
              
              filesList.appendChild(fileItem);
            });
          }
          
          // Update checkpoints list
          if (checkpoints.length === 0) {
            checkpointsList.innerHTML = '<div class="empty-message">No checkpoints</div>';
          } else {
            checkpointsList.innerHTML = '';
            
            checkpoints.forEach(checkpoint => {
              const checkpointItem = document.createElement('div');
              checkpointItem.className = 'checkpoint-item';
              
              const date = new Date(checkpoint.timestamp);
              const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
              
              checkpointItem.innerHTML = \`
                <div class="checkpoint-header">
                  <div class="checkpoint-id">\${checkpoint.id.substring(0, 8)}</div>
                  <div class="checkpoint-date">\${dateStr}</div>
                </div>
                <div class="checkpoint-message">\${checkpoint.message}</div>
                <button class="apply-btn"><i class="codicon codicon-run"></i> Apply Checkpoint</button>
              \`;
              
              // Apply checkpoint button
              checkpointItem.querySelector('.apply-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'applyCheckpoint',
                  id: checkpoint.id
                });
              });
              
              checkpointsList.appendChild(checkpointItem);
            });
          }
        }
        
        // Initial refresh request
        vscode.postMessage({ command: 'refresh' });
      </script>
    </body>
    </html>`;
  }
  /**
   * Refresh the view with updated data
   */
  refresh() {
    if (!this._view) {
      return;
    }
    if (!this.shadowGit) {
      this._view.webview.postMessage({
        command: "update",
        trackedFiles: [],
        checkpoints: []
      });
      return;
    }
    const trackedFiles = this.shadowGit.getTrackedFiles();
    const checkpoints = this.shadowGit.getCheckpoints();
    this._view.webview.postMessage({
      command: "update",
      trackedFiles,
      checkpoints
    });
  }
  /**
   * Open a file in the editor
   * @param filePath - Relative path to the file
   */
  async openFile(filePath) {
    try {
      const fullPath = path4.join(this.shadowGit.workspaceRoot, filePath);
      const document = await vscode3.workspace.openTextDocument(fullPath);
      await vscode3.window.showTextDocument(document);
    } catch (error) {
      vscode3.window.showErrorMessage(`Failed to open file: ${error.message}`);
    }
  }
  /**
   * Open diff view for a file
   * @param filePath - Relative path to the file
   */
  async openDiff(filePath) {
    try {
      const fullPath = path4.join(this.shadowGit.workspaceRoot, filePath);
      if (!this.shadowGit.snapshots.has(filePath)) {
        this.shadowGit.takeSnapshot(fullPath);
      }
      this.shadowGit.detectChanges(fullPath);
      const tempPath = this.shadowGit.createTempSnapshotFile(filePath);
      const leftUri = vscode3.Uri.file(tempPath);
      const rightUri = vscode3.Uri.file(fullPath);
      await vscode3.commands.executeCommand(
        "vscode.diff",
        leftUri,
        rightUri,
        `Shadow Diff: ${path4.basename(filePath)} (${this.shadowGit.type})`
      );
    } catch (error) {
      vscode3.window.showErrorMessage(`Failed to open diff: ${error.message}`);
    }
  }
};

// src/timelineProvider.ts
var vscode4 = __toESM(require("vscode"));
var path5 = __toESM(require("path"));
var ShadowGitTimelineProvider = class {
  /**
   * Creates a new ShadowGitTimelineProvider
   * @param shadowGit - ShadowGit instance
   */
  constructor(shadowGit) {
    this._onDidChange = new vscode4.EventEmitter();
    /**
     * Event emitted when the timeline changes
     */
    this.onDidChange = this._onDidChange.event;
    this.shadowGit = shadowGit;
  }
  /**
   * Provide timeline items for a specific URI
   * @param uri - URI to provide timeline for
   * @param options - Timeline options
   * @param token - Cancellation token
   * @returns Timeline with items
   */
  async provideTimeline(uri, options, token) {
    if (!this.shadowGit) {
      return { items: [] };
    }
    const filePath = uri.fsPath;
    const relativePath = path5.relative(this.shadowGit.workspaceRoot, filePath);
    const checkpoints = this.shadowGit.getCheckpoints().filter((cp) => {
      return cp.changes && Object.keys(cp.changes).includes(relativePath);
    });
    const items = checkpoints.map((cp) => {
      return {
        id: cp.id,
        timestamp: cp.timestamp,
        label: cp.message,
        iconPath: new vscode4.ThemeIcon("git-commit"),
        description: `${this.shadowGit.type === "main" ? "Main" : "Working"} Checkpoint`,
        command: {
          title: "Compare with Current",
          command: "shadowGit.compareWithCheckpoint",
          arguments: [uri, cp.id]
        }
      };
    });
    return { items };
  }
  /**
   * Refresh the timeline
   */
  refresh() {
    this._onDidChange.fire(void 0);
  }
};

// src/extension.ts
function activate(context) {
  console.log("Shadow Git extension is now active");
  let mainShadowGit = null;
  let workingShadowGit = null;
  let mainDiffDecorationProvider = null;
  let workingDiffDecorationProvider = null;
  let mainSCMProvider = null;
  let workingSCMProvider = null;
  let mainTimelineProvider = null;
  let workingTimelineProvider = null;
  if (vscode5.workspace.workspaceFolders && vscode5.workspace.workspaceFolders.length > 0) {
    const workspaceRoot = vscode5.workspace.workspaceFolders[0].uri.fsPath;
    mainShadowGit = new ShadowGit(workspaceRoot, "main");
    workingShadowGit = new ShadowGit(workspaceRoot, "working");
    mainDiffDecorationProvider = new DiffDecorationProvider(context, mainShadowGit);
    workingDiffDecorationProvider = new DiffDecorationProvider(context, workingShadowGit);
    mainSCMProvider = new ShadowGitSCMProvider(context, mainShadowGit);
    workingSCMProvider = new ShadowGitSCMProvider(context, workingShadowGit);
    mainTimelineProvider = new ShadowGitTimelineProvider(mainShadowGit);
    workingTimelineProvider = new ShadowGitTimelineProvider(workingShadowGit);
    if (vscode5.workspace.getConfiguration("shadowGit").get("showCheckpointsInTimeline")) {
      try {
        if (vscode5.timeline && typeof vscode5.timeline.registerTimelineProvider === "function") {
          context.subscriptions.push(
            // @ts-ignore - using the timeline API dynamically
            vscode5.timeline.registerTimelineProvider(["file", "git"], mainTimelineProvider, {
              scheme: "file",
              enableForWorkspace: true
            }),
            // @ts-ignore - using the timeline API dynamically
            vscode5.timeline.registerTimelineProvider(["file", "git"], workingTimelineProvider, {
              scheme: "file",
              enableForWorkspace: true
            })
          );
        } else {
          console.log("Timeline API not found, skipping timeline integration");
        }
      } catch (error) {
        console.log("Timeline API not available, skipping timeline integration");
      }
    }
  }
  const mainViewProvider = new ShadowGitViewProvider(context, mainShadowGit);
  const workingViewProvider = new ShadowGitViewProvider(context, workingShadowGit);
  context.subscriptions.push(
    vscode5.window.registerWebviewViewProvider("shadowGitMain", mainViewProvider),
    vscode5.window.registerWebviewViewProvider("shadowGitWorking", workingViewProvider)
  );
  const takeSnapshotCommand = vscode5.commands.registerCommand("shadowGit.takeSnapshot", async () => {
    if (!mainShadowGit || !workingShadowGit) {
      vscode5.window.showErrorMessage("No workspace folder open");
      return;
    }
    const editor = vscode5.window.activeTextEditor;
    if (!editor) {
      vscode5.window.showErrorMessage("No active editor");
      return;
    }
    try {
      const filePath = editor.document.uri.fsPath;
      await editor.document.save();
      const mainSnapshot = mainShadowGit.takeSnapshot(filePath);
      const workingSnapshot = workingShadowGit.takeSnapshot(filePath);
      const fileName = path6.basename(filePath);
      vscode5.window.showInformationMessage(`Snapshots taken in both Main and Working systems: ${fileName}`);
      mainViewProvider.refresh();
      workingViewProvider.refresh();
      mainSCMProvider?.update();
      workingSCMProvider?.update();
    } catch (error) {
      vscode5.window.showErrorMessage(`Failed to take snapshot: ${error.message}`);
    }
  });
  const takeMainSnapshotCommand = vscode5.commands.registerCommand("shadowGit.takeMainSnapshot", async () => {
    if (!mainShadowGit) {
      vscode5.window.showErrorMessage("No workspace folder open");
      return;
    }
    const editor = vscode5.window.activeTextEditor;
    if (!editor) {
      vscode5.window.showErrorMessage("No active editor");
      return;
    }
    try {
      const filePath = editor.document.uri.fsPath;
      await editor.document.save();
      const mainSnapshot = mainShadowGit.takeSnapshot(filePath);
      const fileName = path6.basename(filePath);
      vscode5.window.showInformationMessage(`Snapshot taken in Main system: ${fileName}`);
      mainViewProvider.refresh();
      mainSCMProvider?.update();
    } catch (error) {
      vscode5.window.showErrorMessage(`Failed to take snapshot: ${error.message}`);
    }
  });
  const takeWorkingSnapshotCommand = vscode5.commands.registerCommand("shadowGit.takeWorkingSnapshot", async () => {
    if (!workingShadowGit) {
      vscode5.window.showErrorMessage("No workspace folder open");
      return;
    }
    const editor = vscode5.window.activeTextEditor;
    if (!editor) {
      vscode5.window.showErrorMessage("No active editor");
      return;
    }
    try {
      const filePath = editor.document.uri.fsPath;
      await editor.document.save();
      const workingSnapshot = workingShadowGit.takeSnapshot(filePath);
      const fileName = path6.basename(filePath);
      vscode5.window.showInformationMessage(`Snapshot taken in Working system: ${fileName}`);
      workingViewProvider.refresh();
      workingSCMProvider?.update();
    } catch (error) {
      vscode5.window.showErrorMessage(`Failed to take snapshot: ${error.message}`);
    }
  });
  const openShadowDiffCommand = vscode5.commands.registerCommand("shadowGit.openDiff", async () => {
    if (!mainShadowGit || !workingShadowGit) {
      vscode5.window.showErrorMessage("No workspace folder open");
      return;
    }
    const editor = vscode5.window.activeTextEditor;
    if (!editor) {
      vscode5.window.showErrorMessage("No active editor");
      return;
    }
    try {
      const filePath = editor.document.uri.fsPath;
      const relativePath = path6.relative(mainShadowGit.workspaceRoot, filePath);
      if (!mainShadowGit.snapshots.has(relativePath)) {
        mainShadowGit.takeSnapshot(filePath);
      }
      if (!workingShadowGit.snapshots.has(relativePath)) {
        workingShadowGit.takeSnapshot(filePath);
      }
      const mainChanges = mainShadowGit.detectChanges(filePath);
      const workingChanges = workingShadowGit.detectChanges(filePath);
      const tempPath = mainShadowGit.createTempSnapshotFile(relativePath);
      const leftUri = vscode5.Uri.file(tempPath);
      const rightUri = editor.document.uri;
      await vscode5.commands.executeCommand(
        "vscode.diff",
        leftUri,
        rightUri,
        `Shadow Diff: ${path6.basename(filePath)}`
      );
      mainDiffDecorationProvider.registerDiffEditor(rightUri, mainChanges);
      workingDiffDecorationProvider.registerDiffEditor(rightUri, workingChanges);
    } catch (error) {
      vscode5.window.showErrorMessage(`Failed to open diff: ${error.message}`);
    }
  });
  const compareWithCheckpointCommand = vscode5.commands.registerCommand("shadowGit.compareWithCheckpoint", async (uri, checkpointId) => {
    let targetShadowGit = null;
    if (mainShadowGit && mainShadowGit.checkpoints.find((cp) => cp.id === checkpointId)) {
      targetShadowGit = mainShadowGit;
    } else if (workingShadowGit && workingShadowGit.checkpoints.find((cp) => cp.id === checkpointId)) {
      targetShadowGit = workingShadowGit;
    }
    if (!targetShadowGit) {
      vscode5.window.showErrorMessage(`Checkpoint ${checkpointId} not found`);
      return;
    }
    try {
      const filePath = uri.fsPath;
      const relativePath = path6.relative(targetShadowGit.workspaceRoot, filePath);
      const checkpoint = targetShadowGit.checkpoints.find((cp) => cp.id === checkpointId);
      if (!checkpoint.changes[relativePath]) {
        vscode5.window.showInformationMessage(`Checkpoint ${checkpointId.substring(0, 8)} does not affect this file`);
        return;
      }
      const tempPath = targetShadowGit.createTempSnapshotFile(relativePath);
      const leftUri = vscode5.Uri.file(tempPath);
      await vscode5.commands.executeCommand(
        "vscode.diff",
        leftUri,
        uri,
        `Compare with ${targetShadowGit.type} Checkpoint: ${checkpoint.message}`
      );
    } catch (error) {
      vscode5.window.showErrorMessage(`Failed to compare with checkpoint: ${error.message}`);
    }
  });
  const compareWithHeadCommand = vscode5.commands.registerCommand("shadowGit.compareWithHead", async (shadowGitType) => {
    const targetShadowGit = shadowGitType === "main" ? mainShadowGit : workingShadowGit;
    if (!targetShadowGit) {
      vscode5.window.showErrorMessage("No workspace folder open");
      return;
    }
    const editor = vscode5.window.activeTextEditor;
    if (!editor) {
      vscode5.window.showErrorMessage("No active editor");
      return;
    }
    try {
      const filePath = editor.document.uri.fsPath;
      const relativePath = path6.relative(targetShadowGit.workspaceRoot, filePath);
      const checkpoints = targetShadowGit.getCheckpoints().filter((cp) => cp.changes[relativePath]).sort((a, b) => b.timestamp - a.timestamp);
      if (checkpoints.length === 0) {
        vscode5.window.showInformationMessage(`No checkpoints found for this file in ${shadowGitType} Shadow Git`);
        return;
      }
      const latestCheckpoint = checkpoints[0];
      const tempPath = targetShadowGit.createTempSnapshotFile(relativePath);
      const leftUri = vscode5.Uri.file(tempPath);
      const rightUri = editor.document.uri;
      await vscode5.commands.executeCommand(
        "vscode.diff",
        leftUri,
        rightUri,
        `Compare with ${shadowGitType} HEAD: ${latestCheckpoint.message}`
      );
    } catch (error) {
      vscode5.window.showErrorMessage(`Failed to compare with HEAD: ${error.message}`);
    }
  });
  const compareWithShadowGitCommand = vscode5.commands.registerCommand("shadowGit.compareWithShadowGit", async () => {
    if (!mainShadowGit || !workingShadowGit) {
      vscode5.window.showErrorMessage("No workspace folder open");
      return;
    }
    const editor = vscode5.window.activeTextEditor;
    if (!editor) {
      vscode5.window.showErrorMessage("No active editor");
      return;
    }
    try {
      const filePath = editor.document.uri.fsPath;
      const relativePath = path6.relative(mainShadowGit.workspaceRoot, filePath);
      const hasMainSnapshot = mainShadowGit.snapshots.has(relativePath);
      const hasWorkingSnapshot = workingShadowGit.snapshots.has(relativePath);
      if (!hasMainSnapshot && !hasWorkingSnapshot) {
        vscode5.window.showWarningMessage("No snapshots found for this file. Take a snapshot first.");
        return;
      }
      const options = [];
      if (hasMainSnapshot) {
        options.push({ label: "Main Shadow Git", value: "main", description: "Compare with Main snapshot" });
      }
      if (hasWorkingSnapshot) {
        options.push({ label: "Working Shadow Git", value: "working", description: "Compare with Working snapshot" });
      }
      const choice = await vscode5.window.showQuickPick(
        options,
        { placeHolder: "Select Shadow Git to compare with" }
      );
      if (!choice) {
        return;
      }
      const targetShadowGit = choice.value === "main" ? mainShadowGit : workingShadowGit;
      const tempPath = targetShadowGit.createTempSnapshotFile(relativePath);
      const leftUri = vscode5.Uri.file(tempPath);
      const rightUri = editor.document.uri;
      await vscode5.commands.executeCommand(
        "vscode.diff",
        leftUri,
        rightUri,
        `Compare with ${choice.value} Shadow Git: ${path6.basename(filePath)}`
      );
      const changes = targetShadowGit.detectChanges(filePath);
      const diffDecorationProvider = choice.value === "main" ? mainDiffDecorationProvider : workingDiffDecorationProvider;
      diffDecorationProvider.registerDiffEditor(rightUri, changes);
    } catch (error) {
      vscode5.window.showErrorMessage(`Error: ${error.message}`);
    }
  });
  const approveChangeCommand = vscode5.commands.registerCommand("shadowGit.approveChange", async (uri, changeId) => {
    if (!mainShadowGit) {
      vscode5.window.showErrorMessage("No workspace folder open");
      return;
    }
    try {
      const filePath = uri.fsPath;
      const success = mainShadowGit.approveChange(filePath, changeId);
      if (success) {
        mainDiffDecorationProvider.refreshDecorations(uri);
        mainSCMProvider?.update();
        vscode5.window.showInformationMessage(`Change approved`);
      } else {
        vscode5.window.showErrorMessage(`Change not found: ${changeId}`);
      }
    } catch (error) {
      vscode5.window.showErrorMessage(`Failed to approve change: ${error.message}`);
    }
  });
  const disapproveChangeCommand = vscode5.commands.registerCommand("shadowGit.disapproveChange", async (uri, changeId) => {
    if (!mainShadowGit) {
      vscode5.window.showErrorMessage("No workspace folder open");
      return;
    }
    try {
      const filePath = uri.fsPath;
      const success = mainShadowGit.disapproveChange(filePath, changeId);
      if (success) {
        mainDiffDecorationProvider.refreshDecorations(uri);
        mainSCMProvider?.update();
        vscode5.window.showInformationMessage(`Change disapproved`);
      } else {
        vscode5.window.showErrorMessage(`Change not found: ${changeId}`);
      }
    } catch (error) {
      vscode5.window.showErrorMessage(`Failed to disapprove change: ${error.message}`);
    }
  });
  const approveAllChangesCommand = vscode5.commands.registerCommand("shadowGit.approveAllChanges", async () => {
    if (!mainShadowGit) {
      vscode5.window.showErrorMessage("No workspace folder open");
      return;
    }
    const editor = vscode5.window.activeTextEditor;
    if (!editor) {
      vscode5.window.showErrorMessage("No active editor");
      return;
    }
    try {
      const filePath = editor.document.uri.fsPath;
      const count = mainShadowGit.approveAllChanges(filePath);
      mainDiffDecorationProvider.refreshDecorations(editor.document.uri);
      mainSCMProvider?.update();
      vscode5.window.showInformationMessage(`Approved ${count} changes`);
    } catch (error) {
      vscode5.window.showErrorMessage(`Failed to approve changes: ${error.message}`);
    }
  });
  const disapproveAllChangesCommand = vscode5.commands.registerCommand("shadowGit.disapproveAllChanges", async () => {
    if (!mainShadowGit) {
      vscode5.window.showErrorMessage("No workspace folder open");
      return;
    }
    const editor = vscode5.window.activeTextEditor;
    if (!editor) {
      vscode5.window.showErrorMessage("No active editor");
      return;
    }
    try {
      const filePath = editor.document.uri.fsPath;
      const count = mainShadowGit.disapproveAllChanges(filePath);
      mainDiffDecorationProvider.refreshDecorations(editor.document.uri);
      mainSCMProvider?.update();
      vscode5.window.showInformationMessage(`Disapproved ${count} changes`);
    } catch (error) {
      vscode5.window.showErrorMessage(`Failed to disapprove changes: ${error.message}`);
    }
  });
  const createCheckpointCommand = vscode5.commands.registerCommand("shadowGit.createCheckpoint", async () => {
    if (!mainShadowGit) {
      vscode5.window.showErrorMessage("No workspace folder open");
      return;
    }
    try {
      const message = await vscode5.window.showInputBox({
        prompt: "Enter a checkpoint message",
        placeHolder: "What changes does this checkpoint include?"
      });
      if (!message) {
        return;
      }
      const checkpoint = mainShadowGit.createCheckpoint(message);
      vscode5.window.showInformationMessage(`Checkpoint created: ${checkpoint.id.substring(0, 8)}`);
      mainViewProvider.refresh();
      mainSCMProvider?.update();
      if (mainTimelineProvider) {
        mainTimelineProvider.refresh();
      }
    } catch (error) {
      vscode5.window.showErrorMessage(`Failed to create checkpoint: ${error.message}`);
    }
  });
  const createWorkingCheckpointCommand = vscode5.commands.registerCommand("shadowGit.createWorkingCheckpoint", async () => {
    if (!workingShadowGit) {
      vscode5.window.showErrorMessage("No workspace folder open");
      return;
    }
    try {
      const message = await vscode5.window.showInputBox({
        prompt: "Enter a working checkpoint message",
        placeHolder: "What changes does this working checkpoint include?"
      });
      if (!message) {
        return;
      }
      const checkpoint = workingShadowGit.createCheckpoint(message);
      vscode5.window.showInformationMessage(`Working checkpoint created: ${checkpoint.id.substring(0, 8)}`);
      workingViewProvider.refresh();
      workingSCMProvider?.update();
      if (workingTimelineProvider) {
        workingTimelineProvider.refresh();
      }
    } catch (error) {
      vscode5.window.showErrorMessage(`Failed to create working checkpoint: ${error.message}`);
    }
  });
  const applyCheckpointCommand = vscode5.commands.registerCommand("shadowGit.applyCheckpoint", async (checkpointId) => {
    let targetShadowGit = null;
    if (mainShadowGit && mainShadowGit.checkpoints.find((cp) => cp.id === checkpointId)) {
      targetShadowGit = mainShadowGit;
    } else if (workingShadowGit && workingShadowGit.checkpoints.find((cp) => cp.id === checkpointId)) {
      targetShadowGit = workingShadowGit;
    }
    if (!targetShadowGit) {
      vscode5.window.showErrorMessage(`Checkpoint ${checkpointId} not found`);
      return;
    }
    try {
      const confirmApply = await vscode5.window.showWarningMessage(
        `Are you sure you want to apply checkpoint ${checkpointId.substring(0, 8)}? This will modify your files.`,
        { modal: true },
        "Apply"
      );
      if (confirmApply !== "Apply") {
        return;
      }
      targetShadowGit.applyCheckpoint(checkpointId);
      vscode5.window.showInformationMessage(`Checkpoint applied: ${checkpointId.substring(0, 8)}`);
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
      vscode5.window.showErrorMessage(`Failed to apply checkpoint: ${error.message}`);
    }
  });
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
  const showChangeContextMenuCommand = vscode5.commands.registerCommand("shadowGit.showChangeContextMenu", async (uri, line) => {
    if (mainDiffDecorationProvider) {
      await mainDiffDecorationProvider.handleChangeContextMenu(uri, line);
    }
  });
  context.subscriptions.push(showChangeContextMenuCommand);
  const fileWatcher = vscode5.workspace.createFileSystemWatcher("**/*");
  fileWatcher.onDidChange(async (uri) => {
    if (uri.fsPath.includes(".vscode/.shadowgit-")) {
      return;
    }
    if (mainShadowGit) {
      const relativePath = path6.relative(mainShadowGit.workspaceRoot, uri.fsPath);
      if (mainShadowGit.snapshots.has(relativePath)) {
        mainShadowGit.detectChanges(uri.fsPath);
        workingShadowGit.detectChanges(uri.fsPath);
        mainSCMProvider?.update();
        workingSCMProvider?.update();
      }
    }
  });
  context.subscriptions.push(fileWatcher);
  if (vscode5.workspace.getConfiguration("shadowGit").get("autoSnapshot")) {
    vscode5.workspace.onDidOpenTextDocument(async (document) => {
      if (document.uri.scheme === "file" && !document.uri.fsPath.includes(".vscode/.shadowgit-") && mainShadowGit && workingShadowGit) {
        try {
          mainShadowGit.takeSnapshot(document.uri.fsPath);
          workingShadowGit.takeSnapshot(document.uri.fsPath);
          mainViewProvider.refresh();
          workingViewProvider.refresh();
          mainSCMProvider?.update();
          workingSCMProvider?.update();
        } catch (error) {
          console.error("Auto-snapshot failed:", error);
        }
      }
    });
  }
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map

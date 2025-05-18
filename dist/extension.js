"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
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

// src/gitIntegration.ts
var gitIntegration_exports = {};
__export(gitIntegration_exports, {
  GitIntegration: () => GitIntegration
});
var vscode2, GitIntegration;
var init_gitIntegration = __esm({
  "src/gitIntegration.ts"() {
    "use strict";
    vscode2 = __toESM(require("vscode"));
    GitIntegration = class {
      /**
       * Get the Git extension API
       * @returns VS Code Git extension API
       */
      static async getGitAPI() {
        const gitExtension = vscode2.extensions.getExtension("vscode.git");
        if (!gitExtension) {
          throw new Error("Git extension not found");
        }
        if (!gitExtension.isActive) {
          await gitExtension.activate();
        }
        const git = gitExtension.exports.getAPI(1);
        if (!git) {
          throw new Error("Git API not available");
        }
        return git;
      }
      /**
       * Get the Git repository for a file path
       * @param filePath - Path to a file
       * @returns Git repository containing the file
       */
      static async getRepositoryForFile(filePath) {
        const git = await this.getGitAPI();
        const repositories = git.repositories;
        if (repositories.length === 0) {
          throw new Error("No Git repositories found");
        }
        let repo = repositories[0];
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
      static async getWorkspaceRepository() {
        const git = await this.getGitAPI();
        const repositories = git.repositories;
        if (repositories.length === 0) {
          throw new Error("No Git repositories found");
        }
        if (vscode2.workspace.workspaceFolders && vscode2.workspace.workspaceFolders.length > 0) {
          const workspaceRoot = vscode2.workspace.workspaceFolders[0].uri.fsPath;
          for (const repo of repositories) {
            if (repo.rootUri.fsPath === workspaceRoot) {
              return repo;
            }
          }
        }
        return repositories[0];
      }
      /**
       * Get all changed files in Git with extended metadata - SIMPLIFIED VERSION
       * Only returns working tree and index changes (against the latest commit)
       * @returns Array of file paths with status and metadata
       */
      static async getChangedFiles() {
        try {
          const repo = await this.getWorkspaceRepository();
          const workingChanges = repo.state.workingTreeChanges || [];
          const indexChanges = repo.state.indexChanges || [];
          const result = [];
          for (const change of workingChanges) {
            result.push({
              filePath: change.uri.fsPath,
              status: this.getGitStatusLabel(change.status),
              type: "working",
              originalUri: change.uri.toString(),
              uri: change.uri
            });
          }
          for (const change of indexChanges) {
            result.push({
              filePath: change.uri.fsPath,
              status: this.getGitStatusLabel(change.status),
              type: "index",
              originalUri: change.uri.toString(),
              uri: change.uri
            });
          }
          const uniqueChanges = /* @__PURE__ */ new Map();
          for (const change of result) {
            if (uniqueChanges.has(change.filePath)) {
              const existing = uniqueChanges.get(change.filePath);
              if (change.type === "index" && existing.type === "working") {
                uniqueChanges.set(change.filePath, change);
              }
            } else {
              uniqueChanges.set(change.filePath, change);
            }
          }
          return Array.from(uniqueChanges.values());
        } catch (error) {
          console.error("Failed to get Git changed files:", error);
          return [];
        }
      }
      /**
       * Get the human-readable status label for a Git status code
       * @param status - Git status code
       * @returns Human-readable status label
       */
      static getGitStatusLabel(status) {
        switch (status) {
          case 0:
            return "INDEX_MODIFIED";
          case 1:
            return "INDEX_ADDED";
          case 2:
            return "INDEX_DELETED";
          case 3:
            return "INDEX_RENAMED";
          case 4:
            return "INDEX_COPIED";
          case 5:
            return "MODIFIED";
          case 6:
            return "DELETED";
          case 7:
            return "UNTRACKED";
          case 8:
            return "IGNORED";
          case 9:
            return "INTENT_TO_ADD";
          case 10:
            return "ADDED_BY_US";
          case 11:
            return "ADDED_BY_THEM";
          case 12:
            return "DELETED_BY_US";
          case 13:
            return "DELETED_BY_THEM";
          case 14:
            return "BOTH_ADDED";
          case 15:
            return "BOTH_DELETED";
          case 16:
            return "BOTH_MODIFIED";
          default:
            return "UNKNOWN";
        }
      }
      /**
       * Create a Git URI for a file 
       * @param uri - Original file URI
       * @returns URI with git scheme
       */
      static async createGitDiffUri(uri) {
        const repo = await this.getRepositoryForFile(uri.fsPath);
        const rootUri = repo.rootUri.toString();
        const gitUri = uri.with({
          scheme: "git",
          authority: "",
          // VS Code actually uses empty authority
          path: uri.path,
          query: JSON.stringify({
            path: uri.fsPath,
            ref: "HEAD",
            rootUri,
            // Add the rootUri
            indexStatus: "?",
            // Include index status indicator
            workingTreeStatus: "M",
            // Include working tree status indicator
            originalUri: uri.toString(),
            // Include original URI
            treeish: "HEAD",
            // Include treeish reference
            staged: false
            // Indicate whether changes are staged
          })
        });
        console.log("SHADOW_GIT_DEBUG: Created Git URI: ${gitUri.toString()}");
        console.log("SHADOW_GIT_DEBUG: Git URI query: ${gitUri.query}");
        return gitUri;
      }
      /**
       * Stage a file in Git
       * @param filePath - Path to the file to stage
       */
      static async stageFile(filePath) {
        try {
          const repo = await this.getRepositoryForFile(filePath);
          const uri = vscode2.Uri.file(filePath);
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
      static async unstageFile(filePath) {
        try {
          const repo = await this.getRepositoryForFile(filePath);
          const uri = vscode2.Uri.file(filePath);
          await repo.revert([uri]);
        } catch (error) {
          console.error(`Failed to unstage file in Git: ${error}`);
          throw error;
        }
      }
    };
  }
});

// package.json
var require_package = __commonJS({
  "package.json"(exports2, module2) {
    module2.exports = {
      name: "shadow-git",
      displayName: "Shadow Git",
      description: "Virtual git layer for managing diffs without affecting the real repository",
      version: "0.2.0",
      engines: {
        vscode: "^1.60.0"
      },
      categories: [
        "SCM Providers",
        "Other"
      ],
      activationEvents: [
        "onStartupFinished"
      ],
      main: "./dist/extension.js",
      extensionKind: ["workspace"],
      contributes: {
        commands: [
          {
            command: "shadowGit.test",
            title: "Shadow Git: Test Command"
          },
          {
            command: "shadowGit.takeMainSnapshot",
            title: "Shadow Git: Take Checkpoint Snapshot"
          },
          {
            command: "shadowGit.takeWorkingSnapshot",
            title: "Shadow Git: Take Comparison Snapshot"
          },
          {
            command: "shadowGit.openMainDiff",
            title: "Shadow Git: Open Checkpoint Diff"
          },
          {
            command: "shadowGit.openWorkingDiff",
            title: "Shadow Git: Open Comparison Diff with Staging"
          },
          {
            command: "shadowGit.approveChange",
            title: "Shadow Git: Approve Change"
          },
          {
            command: "shadowGit.disapproveChange",
            title: "Shadow Git: Disapprove Change"
          },
          {
            command: "shadowGit.createCheckpoint",
            title: "Shadow Git: Create Checkpoint"
          },
          {
            command: "shadowGit.createWorkingCheckpoint",
            title: "Shadow Git: Create Comparison Commit"
          },
          {
            command: "shadowGit.approveAllChanges",
            title: "Shadow Git: Approve All Changes"
          },
          {
            command: "shadowGit.disapproveAllChanges",
            title: "Shadow Git: Disapprove All Changes"
          },
          {
            command: "shadowGit.stageAll",
            title: "Shadow Git: Stage All Changes"
          },
          {
            command: "shadowGit.unstageAll",
            title: "Shadow Git: Unstage All Changes"
          },
          {
            command: "shadowGit.setBaseCommit",
            title: "Shadow Git: Set Base Commit for Comparisons"
          },
          {
            command: "shadowGit.compareWithCheckpoint",
            title: "Shadow Git: Compare with Checkpoint"
          },
          {
            command: "shadowGit.compareWithHead",
            title: "Shadow Git: Compare with HEAD"
          },
          {
            command: "shadowGit.compareWithShadowGit",
            title: "Shadow Git: Compare with Specific Shadow Git"
          }
        ],
        viewsContainers: {
          activitybar: [
            {
              id: "shadow-git",
              title: "Shadow Git",
              icon: "resources/shadow-git-icon.svg"
            }
          ]
        },
        views: {
          "shadow-git": [
            {
              id: "shadowGitView",
              name: "Shadow Git",
              type: "webview"
            }
          ],
          scm: [
            {
              id: "shadowGitSCM",
              name: "Shadow Git Checkpoints"
            }
          ]
        },
        menus: {
          "editor/title": [],
          "view/title": [
            {
              command: "shadowGit.createCheckpoint",
              when: "view == shadowGitView",
              group: "navigation"
            },
            {
              command: "shadowGit.createWorkingCheckpoint",
              when: "view == shadowGitView",
              group: "navigation"
            }
          ],
          "scm/resourceState/context": [
            {
              command: "shadowGit.openMainDiff",
              when: "scmProvider =~ /shadowgit.*/",
              group: "inline"
            },
            {
              command: "shadowGit.approveAllChanges",
              when: "scmProvider =~ /shadowgit.*/",
              group: "1_modification"
            },
            {
              command: "shadowGit.disapproveAllChanges",
              when: "scmProvider =~ /shadowgit.*/",
              group: "1_modification"
            }
          ],
          "editor/context": [
            {
              command: "shadowGit.approveChange",
              when: "editorHasSelection",
              group: "1_modification"
            },
            {
              command: "shadowGit.disapproveChange",
              when: "editorHasSelection",
              group: "1_modification"
            }
          ]
        },
        configuration: {
          title: "Shadow Git",
          properties: {
            "shadowGit.autoSnapshot": {
              type: "boolean",
              default: false,
              description: "Automatically take snapshots of files when they are opened"
            },
            "shadowGit.customIconsInDiff": {
              type: "boolean",
              default: true,
              description: "Use custom icons in diff view"
            },
            "shadowGit.showCheckpointsInTimeline": {
              type: "boolean",
              default: true,
              description: "Show checkpoints in VS Code timeline view"
            }
          }
        },
        keybindings: [
          {
            command: "shadowGit.takeMainSnapshot",
            key: "ctrl+alt+s",
            mac: "cmd+alt+s"
          },
          {
            command: "shadowGit.openMainDiff",
            key: "ctrl+alt+d",
            mac: "cmd+alt+d"
          },
          {
            command: "shadowGit.openWorkingDiff",
            key: "ctrl+alt+shift+d",
            mac: "cmd+alt+shift+d"
          },
          {
            command: "shadowGit.createCheckpoint",
            key: "ctrl+alt+c",
            mac: "cmd+alt+c"
          }
        ]
      },
      scripts: {
        "vscode:prepublish": "npm run package",
        compile: "npm-run-all -s check-types esbuild",
        esbuild: "node esbuild.js",
        watch: "npm-run-all -p watch:*",
        "watch:esbuild": "node esbuild.js --watch",
        "watch:tsc": "tsc --noEmit --watch",
        package: 'npm-run-all -s check-types "esbuild -- --production"',
        lint: "eslint src --ext ts",
        test: "node ./test/runTest.js",
        "check-types": "tsc --noEmit"
      },
      devDependencies: {
        "@types/glob": "^7.1.3",
        "@types/mocha": "^8.2.2",
        "@types/node": "^14.15.0",
        "@types/vscode": "^1.60.0",
        "@typescript-eslint/eslint-plugin": "^4.26.0",
        "@typescript-eslint/parser": "^4.26.0",
        "@vscode/codicons": "^0.0.29",
        esbuild: "^0.25.4",
        eslint: "^7.27.0",
        glob: "^7.1.7",
        mocha: "^8.4.0",
        "npm-run-all": "^4.1.5",
        "ts-loader": "^9.2.2",
        typescript: "^4.3.2",
        "vscode-test": "^1.5.2",
        webpack: "^5.38.1",
        "webpack-cli": "^4.7.0"
      }
    };
  }
});

// src/extension.ts
var extension_exports = {};
__export(extension_exports, {
  activate: () => activate,
  deactivate: () => deactivate
});
module.exports = __toCommonJS(extension_exports);
var vscode11 = __toESM(require("vscode"));
var path12 = __toESM(require("path"));
var fs5 = __toESM(require("fs"));

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
    console.log("ShadowGit.detectChanges: Detecting changes in ${filePath} (${relativePath})");
    if (!this.snapshots.has(relativePath)) {
      console.log("ShadowGit.detectChanges: No snapshot found for ${relativePath}, taking one now");
      try {
        this.takeSnapshot(filePath);
        return [];
      } catch (error) {
        console.error(`ShadowGit.detectChanges: Failed to take initial snapshot of ${relativePath}:`, error);
        return [];
      }
    }
    try {
      if (!fs.existsSync(filePath)) {
        console.log("ShadowGit.detectChanges: File ${filePath} no longer exists");
        const snapshot2 = this.snapshots.get(relativePath);
        const deletionChange = {
          id: 0,
          type: "deletion",
          startLine: 0,
          endLine: snapshot2.lines.length - 1,
          content: snapshot2.content,
          approved: false
        };
        const changes2 = [deletionChange];
        this.changes.set(relativePath, changes2);
        this.saveChanges(relativePath, changes2);
        return changes2;
      }
      const currentContent = fs.readFileSync(filePath, "utf8");
      const currentLines = currentContent.split("\n");
      const snapshot = this.snapshots.get(relativePath);
      const snapshotLines = snapshot.lines;
      if (currentContent === snapshot.content) {
        console.log("ShadowGit.detectChanges: No changes in ${relativePath}");
        this.changes.set(relativePath, []);
        this.saveChanges(relativePath, []);
        return [];
      }
      console.log("ShadowGit.detectChanges: Content changed in ${relativePath}, performing diff");
      const changes = [];
      let changeId = 0;
      for (let i = 0; i < currentLines.length; i++) {
        if (i >= snapshotLines.length || currentLines[i] !== snapshotLines[i]) {
          let endLine = i;
          while (endLine < currentLines.length && (endLine >= snapshotLines.length || currentLines[endLine] !== snapshotLines[endLine])) {
            endLine++;
          }
          console.log("ShadowGit.detectChanges: Found ${i >= snapshotLines.length ? 'addition' : 'modification'} at lines ${i}-${endLine - 1}");
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
            console.log("ShadowGit.detectChanges: Found deletion at lines ${i}-${endLine - 1}");
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
      if (changes.length > 0 && changes.length === 1 && changes[0].startLine === 0 && changes[0].endLine === currentLines.length - 1 && changes[0].type === "modification") {
        console.log("ShadowGit.detectChanges: File ${relativePath} was completely changed");
        changes[0].approved = true;
      }
      console.log("ShadowGit.detectChanges: Found ${changes.length} changes in ${relativePath}");
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
    console.log(`ShadowGit.createCheckpoint: Creating checkpoint with message "${message}"`);
    this.detectChangesInAllTrackedFiles();
    const approvedChanges = {};
    let totalApprovedChanges = 0;
    console.log("ShadowGit.createCheckpoint: Checking ${this.changes.size} files for approved changes");
    for (const [relativePath, changes] of this.changes.entries()) {
      console.log("ShadowGit.createCheckpoint: File ${relativePath} has ${changes.length} changes, checking for approved ones");
      let fileApprovedChanges = changes.filter((change) => change.approved);
      if (fileApprovedChanges.length === 0 && changes.length > 0) {
        console.log("ShadowGit.createCheckpoint: No approved changes found for ${relativePath}, auto-approving all ${changes.length} changes");
        changes.forEach((change) => {
          change.approved = true;
        });
        fileApprovedChanges = [...changes];
        this.saveChanges(relativePath, changes);
      }
      if (fileApprovedChanges.length > 0) {
        console.log("ShadowGit.createCheckpoint: Adding ${fileApprovedChanges.length} approved changes for ${relativePath} to checkpoint");
        approvedChanges[relativePath] = fileApprovedChanges;
        totalApprovedChanges += fileApprovedChanges.length;
      }
    }
    console.log("ShadowGit.createCheckpoint: Total approved changes: ${totalApprovedChanges} across ${Object.keys(approvedChanges).length} files");
    const checkpoint = {
      id: crypto.randomUUID(),
      message,
      timestamp: Date.now(),
      changes: approvedChanges,
      type: this.type
    };
    this.checkpoints.push(checkpoint);
    this.saveCheckpoint(checkpoint);
    console.log("ShadowGit.createCheckpoint: Created checkpoint ${checkpoint.id} with ${Object.keys(approvedChanges).length} files");
    for (const [relativePath, changes] of this.changes.entries()) {
      const remainingChanges = changes.filter((change) => !change.approved);
      console.log("ShadowGit.createCheckpoint: Removing ${changes.length - remainingChanges.length} approved changes from ${relativePath}");
      this.changes.set(relativePath, remainingChanges);
      this.saveChanges(relativePath, remainingChanges);
    }
    return checkpoint;
  }
  /**
   * Detect changes in all tracked files
   */
  detectChangesInAllTrackedFiles() {
    console.log("ShadowGit.detectChangesInAllTrackedFiles: Detecting changes in all ${this.snapshots.size} tracked files");
    for (const [relativePath, snapshot] of this.snapshots.entries()) {
      try {
        const filePath = path.join(this.workspaceRoot, relativePath);
        if (fs.existsSync(filePath)) {
          console.log("ShadowGit.detectChangesInAllTrackedFiles: Detecting changes in ${filePath}");
          this.detectChanges(filePath);
        } else {
          console.log("ShadowGit.detectChangesInAllTrackedFiles: File ${filePath} no longer exists, skipping");
        }
      } catch (error) {
        console.error(`ShadowGit.detectChangesInAllTrackedFiles: Error detecting changes for ${relativePath}:`, error);
      }
    }
  }
  /**
   * Apply a checkpoint's changes to the actual files
   * @param checkpointId - ID of the checkpoint to apply
   */
  applyCheckpoint(checkpointId) {
    console.log("ShadowGit.applyCheckpoint: Starting to apply checkpoint ${checkpointId}");
    const checkpoint = this.checkpoints.find((cp) => cp.id === checkpointId);
    if (!checkpoint) {
      console.error(`ShadowGit.applyCheckpoint: Checkpoint ${checkpointId} not found`);
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }
    console.log(`ShadowGit.applyCheckpoint: Found checkpoint "${checkpoint.message}" with ${Object.keys(checkpoint.changes).length} files to restore`);
    const restoredFiles = [];
    for (const [relativePath, changes] of Object.entries(checkpoint.changes)) {
      const filePath = path.join(this.workspaceRoot, relativePath);
      console.log("ShadowGit.applyCheckpoint: Processing file ${relativePath} with ${changes.length} changes");
      try {
        const snapshot = this.findSnapshotForFile(relativePath);
        if (!snapshot) {
          console.warn(`ShadowGit.applyCheckpoint: No snapshot found for ${relativePath}, skipping`);
          continue;
        }
        console.log("ShadowGit.applyCheckpoint: Restoring ${filePath} to state at checkpoint time");
        const checkpointContent = this.getFileContentAtCheckpoint(relativePath, snapshot, changes);
        const fileDir = path.dirname(filePath);
        if (!fs.existsSync(fileDir)) {
          console.log("ShadowGit.applyCheckpoint: Creating directory ${fileDir}");
          fs.mkdirSync(fileDir, { recursive: true });
        }
        console.log("ShadowGit.applyCheckpoint: Writing ${checkpointContent.length} bytes to ${filePath}");
        fs.writeFileSync(filePath, checkpointContent);
        console.log("ShadowGit.applyCheckpoint: Taking new snapshot of ${filePath}");
        this.takeSnapshot(filePath);
        restoredFiles.push(relativePath);
        console.log("ShadowGit.applyCheckpoint: Successfully restored ${filePath}");
      } catch (error) {
        console.error(`ShadowGit.applyCheckpoint: Failed to apply checkpoint to ${filePath}:`, error);
      }
    }
    console.log("ShadowGit.applyCheckpoint: Completed restore of checkpoint ${checkpointId}, restored ${restoredFiles.length} files: ${restoredFiles.join(', ')}");
  }
  /**
   * Find a snapshot for a file, either the current one or any available one
   * @param relativePath - Relative path of the file
   * @returns The snapshot, or null if none found
   */
  findSnapshotForFile(relativePath) {
    if (this.snapshots.has(relativePath)) {
      return this.snapshots.get(relativePath);
    }
    try {
      const snapshotPath = path.join(this.shadowDir, "snapshots", `${relativePath}.json`);
      if (fs.existsSync(snapshotPath)) {
        const content = fs.readFileSync(snapshotPath, "utf8");
        return JSON.parse(content);
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
  getFileContentAtCheckpoint(relativePath, snapshot, changes) {
    console.log("ShadowGit.getFileContentAtCheckpoint: Reconstructing content for ${relativePath} at checkpoint time");
    const contentLines = [...snapshot.lines];
    for (const change of changes) {
      console.log("ShadowGit.getFileContentAtCheckpoint: Applying ${change.type} at lines ${change.startLine}-${change.endLine}");
      if (change.type === "addition" || change.type === "modification") {
        const changeLines = change.content.split("\n");
        contentLines.splice(change.startLine, change.endLine - change.startLine + 1, ...changeLines);
      } else if (change.type === "deletion") {
        contentLines.splice(change.startLine, change.endLine - change.startLine + 1);
      }
    }
    const content = contentLines.join("\n");
    console.log("ShadowGit.getFileContentAtCheckpoint: Reconstructed ${content.length} bytes of content");
    return content;
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
   * Delete a checkpoint
   * @param checkpointId - ID of the checkpoint to delete
   * @returns Whether the operation was successful
   */
  deleteCheckpoint(checkpointId) {
    console.log("ShadowGit.deleteCheckpoint: Deleting checkpoint ${checkpointId}");
    const checkpointIndex = this.checkpoints.findIndex((cp) => cp.id === checkpointId);
    if (checkpointIndex === -1) {
      console.error(`ShadowGit.deleteCheckpoint: Checkpoint ${checkpointId} not found`);
      return false;
    }
    try {
      this.checkpoints.splice(checkpointIndex, 1);
      const checkpointPath = path.join(this.shadowDir, "checkpoints", `${checkpointId}.json`);
      if (fs.existsSync(checkpointPath)) {
        fs.unlinkSync(checkpointPath);
        console.log("ShadowGit.deleteCheckpoint: Deleted checkpoint file ${checkpointPath}");
      } else {
        console.warn(`ShadowGit.deleteCheckpoint: Checkpoint file ${checkpointPath} not found on disk`);
      }
      console.log("ShadowGit.deleteCheckpoint: Successfully deleted checkpoint ${checkpointId}");
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

// src/shadowGitWithGit.ts
var fs3 = __toESM(require("fs"));
var path3 = __toESM(require("path"));
var crypto2 = __toESM(require("crypto"));

// src/gitUtils.ts
var path2 = __toESM(require("path"));
var fs2 = __toESM(require("fs"));
var util = __toESM(require("util"));
var childProcess = __toESM(require("child_process"));
var exec2 = util.promisify(childProcess.exec);
var GitUtils = class {
  /**
   * Initialize a Git repository in the specified directory
   * @param repoPath - Path to initialize the Git repository
   */
  static async initializeRepo(repoPath) {
    try {
      if (!fs2.existsSync(repoPath)) {
        fs2.mkdirSync(repoPath, { recursive: true });
      }
      if (fs2.existsSync(path2.join(repoPath, ".git"))) {
        console.log("Git repository already exists at ${repoPath}");
        return;
      }
      await this.runGitCommand(repoPath, "init");
      await this.runGitCommand(repoPath, "config", ["user.name", '"ShadowGit"']);
      await this.runGitCommand(repoPath, "config", ["user.email", '"shadowgit@example.com"']);
      await this.createEmptyCommit(repoPath, "Initial commit");
      console.log("Git repository initialized at ${repoPath}");
    } catch (error) {
      console.error(`Failed to initialize Git repository: ${error}`);
      throw error;
    }
  }
  /**
   * Create a file in the Git repository
   * @param repoPath - Path to the Git repository
   * @param filePath - Relative path to the file within the repository
   * @param content - Content to write to the file
   */
  static async createFile(repoPath, filePath, content) {
    try {
      const fullPath = path2.join(repoPath, filePath);
      const dirPath = path2.dirname(fullPath);
      if (!fs2.existsSync(dirPath)) {
        fs2.mkdirSync(dirPath, { recursive: true });
      }
      fs2.writeFileSync(fullPath, content);
      await this.runGitCommand(repoPath, "add", [filePath]);
      console.log("File created and staged: ${filePath}");
    } catch (error) {
      console.error(`Failed to create file in Git repository: ${error}`);
      throw error;
    }
  }
  /**
   * Commit changes in the Git repository
   * @param repoPath - Path to the Git repository
   * @param message - Commit message
   */
  static async commit(repoPath, message) {
    try {
      const result = await this.runGitCommand(repoPath, "commit", ["-m", `"${message}"`]);
      const match = result.stdout.match(/\[.*\s([a-f0-9]+)\]/);
      const commitHash = match ? match[1] : "";
      console.log("Changes committed: ${commitHash} - ${message}");
      return commitHash;
    } catch (error) {
      console.error(`Failed to commit changes: ${error}`);
      if (error.stderr && error.stderr.includes("nothing to commit")) {
        console.log("Nothing to commit - all changes already committed");
        return "";
      }
      throw error;
    }
  }
  /**
   * Create an empty commit
   * @param repoPath - Path to the Git repository
   * @param message - Commit message
   */
  static async createEmptyCommit(repoPath, message) {
    try {
      const result = await this.runGitCommand(repoPath, "commit", ["--allow-empty", "-m", `"${message}"`]);
      const match = result.stdout.match(/\[.*\s([a-f0-9]+)\]/);
      const commitHash = match ? match[1] : "";
      console.log("Empty commit created: ${commitHash} - ${message}");
      return commitHash;
    } catch (error) {
      console.error(`Failed to create empty commit: ${error}`);
      throw error;
    }
  }
  /**
   * Get the current commit hash
   * @param repoPath - Path to the Git repository
   * @returns The current commit hash
   */
  static async getCurrentCommit(repoPath) {
    try {
      const result = await this.runGitCommand(repoPath, "rev-parse", ["HEAD"]);
      return result.stdout.trim();
    } catch (error) {
      console.error(`Failed to get current commit: ${error}`);
      throw error;
    }
  }
  /**
   * Check if there are any staged changes
   * @param repoPath - Path to the Git repository
   * @returns True if there are staged changes, false otherwise
   */
  static async hasStagedChanges(repoPath) {
    try {
      const result = await this.runGitCommand(repoPath, "diff", ["--cached", "--name-only"]);
      return result.stdout.trim() !== "";
    } catch (error) {
      console.error(`Failed to check for staged changes: ${error}`);
      throw error;
    }
  }
  /**
   * Stage a file or changes in a file
   * @param repoPath - Path to the Git repository
   * @param filePath - Path to the file to stage
   */
  static async stageFile(repoPath, filePath) {
    try {
      await this.runGitCommand(repoPath, "add", [filePath]);
      console.log("File staged: ${filePath}");
    } catch (error) {
      console.error(`Failed to stage file: ${error}`);
      throw error;
    }
  }
  /**
   * Unstage a file or changes in a file
   * @param repoPath - Path to the Git repository
   * @param filePath - Path to the file to unstage
   */
  static async unstageFile(repoPath, filePath) {
    try {
      await this.runGitCommand(repoPath, "reset", ["HEAD", filePath]);
      console.log("File unstaged: ${filePath}");
    } catch (error) {
      console.error(`Failed to unstage file: ${error}`);
      throw error;
    }
  }
  /**
   * Get a file's content from a specific Git ref
   * @param repoPath - Path to the Git repository
   * @param filePath - Path to the file
   * @param ref - Git ref (commit, branch, etc.)
   * @returns The file content
   */
  static async getFileFromRef(repoPath, filePath, ref) {
    try {
      const result = await this.runGitCommand(repoPath, "show", [`${ref}:${filePath}`]);
      return result.stdout;
    } catch (error) {
      console.error(`Failed to get file from ref: ${error}`);
      throw error;
    }
  }
  /**
   * Get the list of files in the Git repository
   * @param repoPath - Path to the Git repository
   * @returns Array of file paths
   */
  static async getFiles(repoPath) {
    try {
      const result = await this.runGitCommand(repoPath, "ls-files");
      return result.stdout.split("\n").filter((line) => line.trim() !== "");
    } catch (error) {
      console.error(`Failed to get files list: ${error}`);
      throw error;
    }
  }
  /**
   * Create a diff for a specific file
   * @param repoPath - Path to the Git repository
   * @param filePath - Path to the file to diff
   * @returns Diff output as a string
   */
  static async createDiff(repoPath, filePath) {
    try {
      const result = await this.runGitCommand(repoPath, "diff", ["--unified=3", "HEAD", "--", filePath]);
      return result.stdout;
    } catch (error) {
      console.error(`Failed to create diff for ${filePath}: ${error}`);
      if (error.stderr && error.stderr.includes("fatal: bad revision")) {
        try {
          const fullPath = path2.join(repoPath, filePath);
          if (fs2.existsSync(fullPath)) {
            const content = fs2.readFileSync(fullPath, "utf8");
            const lines = content.split("\n");
            let diff = `diff --git a/${filePath} b/${filePath}
`;
            diff += `new file mode 100644
`;
            diff += `--- /dev/null
`;
            diff += `+++ b/${filePath}
`;
            diff += `@@ -0,0 +1,${lines.length} @@
`;
            for (const line of lines) {
              diff += `+${line}
`;
            }
            return diff;
          }
        } catch (fallbackError) {
          console.error(`Fallback diff creation failed: ${fallbackError}`);
        }
      }
      return "";
    }
  }
  /**
   * Get the list of commits in the Git repository
   * @param repoPath - Path to the Git repository
   * @returns Array of commit objects (hash, message, date)
   */
  static async getCommits(repoPath) {
    try {
      const result = await this.runGitCommand(
        repoPath,
        "log",
        ["--pretty=format:%H|%s|%ad", "--date=iso"]
      );
      if (!result.stdout.trim()) {
        return [];
      }
      return result.stdout.split("\n").filter((line) => line.trim() !== "").map((line) => {
        const parts = line.split("|");
        const hash = parts[0] || "";
        const message = parts[1] || "";
        const date = parts[2] || "";
        return { hash, message, date };
      });
    } catch (error) {
      console.error(`Failed to get commits list: ${error}`);
      return [];
    }
  }
  /**
   * Run a Git command in the specified directory
   * @param cwd - Working directory for the command
   * @param command - Git command (without 'git' prefix)
   * @param args - Command arguments
   * @returns Promise with stdout and stderr
   */
  static async runGitCommand(cwd, command, args = []) {
    try {
      const processedArgs = args.map((arg) => {
        if (arg.startsWith('"') && arg.endsWith('"')) {
          return arg;
        }
        if (/\s/.test(arg)) {
          return `"${arg}"`;
        }
        return arg;
      });
      const gitCommand = `git ${command} ${processedArgs.join(" ")}`;
      console.log("Running Git command in ${cwd}: ${gitCommand}");
      return await exec2(gitCommand, { cwd });
    } catch (error) {
      console.error(`Git command failed: ${error}`);
      throw error;
    }
  }
};

// src/shadowGitWithGit.ts
var ShadowGitWithGit = class {
  /**
   * Creates a new ShadowGitWithGit instance
   * @param workspaceRoot - Root path of the workspace
   * @param type - Type of ShadowGit ('main' or 'working')
   */
  constructor(workspaceRoot, type = "working") {
    this.baseCommitId = null;
    this.workspaceRoot = workspaceRoot;
    this.type = type;
    this.shadowDir = path3.join(workspaceRoot, ".vscode", `.shadowgit-${type}`);
    this.gitRepoDir = path3.join(this.shadowDir, "git-repo");
    this.snapshots = /* @__PURE__ */ new Map();
    this.changes = /* @__PURE__ */ new Map();
    this.checkpoints = [];
  }
  /**
   * Initialize ShadowGit system with Git repository
   */
  async initialize() {
    if (!fs3.existsSync(this.shadowDir)) {
      fs3.mkdirSync(this.shadowDir, { recursive: true });
    }
    const dirs = ["snapshots", "changes", "checkpoints", "temp"];
    dirs.forEach((dir) => {
      const dirPath = path3.join(this.shadowDir, dir);
      if (!fs3.existsSync(dirPath)) {
        fs3.mkdirSync(dirPath, { recursive: true });
      }
    });
    try {
      await GitUtils.initializeRepo(this.gitRepoDir);
    } catch (error) {
      console.error("Failed to initialize Git repository:", error);
    }
    this.loadSnapshots();
    this.loadCheckpoints();
  }
  /**
   * Take a snapshot of the current file state and add it to the Git repository
   * @param filePath - Absolute path to the file
   * @returns The snapshot object
   */
  async takeSnapshot(filePath) {
    const relativePath = path3.relative(this.workspaceRoot, filePath);
    try {
      const content = fs3.readFileSync(filePath, "utf8");
      const hash = this.hashContent(content);
      const snapshot = {
        hash,
        content,
        timestamp: Date.now(),
        lines: content.split("\n")
      };
      this.snapshots.set(relativePath, snapshot);
      this.saveSnapshot(relativePath, snapshot);
      const gitFilePath = this.getGitFilePath(relativePath);
      await GitUtils.createFile(this.gitRepoDir, gitFilePath, content);
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
  async createBaseCommit() {
    try {
      const hasFiles = await GitUtils.hasStagedChanges(this.gitRepoDir);
      if (hasFiles) {
        const commitId = await GitUtils.commit(this.gitRepoDir, "Base state");
        this.baseCommitId = commitId;
        console.log("Created base commit: ${commitId}");
      }
    } catch (error) {
      console.error("Failed to create base commit:", error);
    }
  }
  /**
   * Detect changes between current file and its snapshot using Git diff
   * @param filePath - Absolute path to the file
   * @returns Array of change objects
   */
  async detectChanges(filePath) {
    const relativePath = path3.relative(this.workspaceRoot, filePath);
    if (!this.snapshots.has(relativePath)) {
      return [];
    }
    try {
      const currentContent = fs3.readFileSync(filePath, "utf8");
      const gitFilePath = this.getGitFilePath(relativePath);
      await GitUtils.createFile(this.gitRepoDir, gitFilePath, currentContent);
      const diffOutput = await GitUtils.createDiff(this.gitRepoDir, gitFilePath);
      const changes = this.parseDiffOutput(diffOutput, relativePath);
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
  parseDiffOutput(diffOutput, relativePath) {
    const changes = [];
    let changeId = 0;
    const snapshot = this.snapshots.get(relativePath);
    const snapshotLines = snapshot.lines;
    const gitFilePath = path3.join(this.gitRepoDir, this.getGitFilePath(relativePath));
    const currentContent = fs3.readFileSync(gitFilePath, "utf8");
    const currentLines = currentContent.split("\n");
    const diffLines = diffOutput.split("\n");
    let currentHunk = null;
    for (let i = 0; i < diffLines.length; i++) {
      const line = diffLines[i];
      if (line.startsWith("@@")) {
        if (currentHunk) {
          const content = currentHunk.type === "deletion" ? snapshotLines.slice(currentHunk.startLine, currentHunk.endLine + 1).join("\n") : currentLines.slice(currentHunk.startLine, currentHunk.endLine + 1).join("\n");
          changes.push({
            id: changeId++,
            type: currentHunk.type,
            startLine: currentHunk.startLine,
            endLine: currentHunk.endLine,
            content,
            approved: false
          });
        }
        const match = line.match(/@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/);
        if (match) {
          const oldStart = parseInt(match[1]) - 1;
          const oldCount = parseInt(match[2]) || 1;
          const newStart = parseInt(match[3]) - 1;
          const newCount = parseInt(match[4]) || 1;
          if (oldCount === 0) {
            currentHunk = {
              type: "addition",
              startLine: newStart,
              endLine: newStart + newCount - 1
            };
          } else if (newCount === 0) {
            currentHunk = {
              type: "deletion",
              startLine: oldStart,
              endLine: oldStart + oldCount - 1
            };
          } else {
            currentHunk = {
              type: "modification",
              startLine: newStart,
              endLine: newStart + newCount - 1
            };
          }
        }
      }
    }
    if (currentHunk) {
      const content = currentHunk.type === "deletion" ? snapshotLines.slice(currentHunk.startLine, currentHunk.endLine + 1).join("\n") : currentLines.slice(currentHunk.startLine, currentHunk.endLine + 1).join("\n");
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
  getGitFilePath(relativePath) {
    return relativePath;
  }
  /**
   * Approve a specific change by staging it in Git
   * @param filePath - Absolute path to the file
   * @param changeId - ID of the change to approve
   * @returns Whether the operation was successful
   */
  async approveChange(filePath, changeId) {
    const relativePath = path3.relative(this.workspaceRoot, filePath);
    const changes = this.changes.get(relativePath) || [];
    const change = changes.find((c) => c.id === changeId);
    if (change) {
      change.approved = true;
      this.saveChanges(relativePath, changes);
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
  async disapproveChange(filePath, changeId) {
    const relativePath = path3.relative(this.workspaceRoot, filePath);
    const changes = this.changes.get(relativePath) || [];
    const change = changes.find((c) => c.id === changeId);
    if (change) {
      change.approved = false;
      this.saveChanges(relativePath, changes);
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
  async approveAllChanges(filePath) {
    const relativePath = path3.relative(this.workspaceRoot, filePath);
    const changes = this.changes.get(relativePath) || [];
    changes.forEach((change) => {
      change.approved = true;
    });
    this.saveChanges(relativePath, changes);
    const gitFilePath = this.getGitFilePath(relativePath);
    await GitUtils.stageFile(this.gitRepoDir, gitFilePath);
    return changes.length;
  }
  /**
   * Disapprove all changes in a file by unstaging it in Git
   * @param filePath - Absolute path to the file
   * @returns Number of changes disapproved
   */
  async disapproveAllChanges(filePath) {
    const relativePath = path3.relative(this.workspaceRoot, filePath);
    const changes = this.changes.get(relativePath) || [];
    changes.forEach((change) => {
      change.approved = false;
    });
    this.saveChanges(relativePath, changes);
    const gitFilePath = this.getGitFilePath(relativePath);
    await GitUtils.unstageFile(this.gitRepoDir, gitFilePath);
    return changes.length;
  }
  /**
   * Create a checkpoint (virtual commit) by committing in Git
   * @param message - Checkpoint message
   * @returns The checkpoint object
   */
  async createCheckpoint(message) {
    const approvedChanges = {};
    for (const [relativePath, changes] of this.changes.entries()) {
      const fileApprovedChanges = changes.filter((change) => change.approved);
      if (fileApprovedChanges.length > 0) {
        approvedChanges[relativePath] = fileApprovedChanges;
      }
    }
    const commitHash = await GitUtils.commit(this.gitRepoDir, message);
    const checkpoint = {
      id: commitHash || crypto2.randomUUID(),
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
  async applyCheckpoint(checkpointId) {
    const checkpoint = this.checkpoints.find((cp) => cp.id === checkpointId);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${checkpointId} not found`);
    }
    for (const [relativePath, changes] of Object.entries(checkpoint.changes)) {
      const filePath = path3.join(this.workspaceRoot, relativePath);
      const snapshot = this.snapshots.get(relativePath);
      if (!snapshot) {
        console.warn(`No snapshot found for ${relativePath}, skipping`);
        continue;
      }
      try {
        const currentContent = fs3.readFileSync(filePath, "utf8");
        const currentLines = currentContent.split("\n");
        const newLines = [...currentLines];
        const sortedChanges = [...changes].sort((a, b) => b.startLine - a.startLine);
        for (const change of sortedChanges) {
          if (change.type === "addition" || change.type === "modification") {
            const changeLines = change.content.split("\n");
            newLines.splice(change.startLine, change.endLine - change.startLine + 1, ...changeLines);
          } else if (change.type === "deletion") {
            newLines.splice(change.startLine, change.endLine - change.startLine + 1);
          }
        }
        fs3.writeFileSync(filePath, newLines.join("\n"));
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
  setBaseCommit(commitId) {
    this.baseCommitId = commitId;
  }
  /**
   * Generate a hash for content
   * @param content - Content to hash
   * @returns Hash string
   */
  hashContent(content) {
    return crypto2.createHash("sha256").update(content).digest("hex");
  }
  /**
   * Load snapshots from disk
   */
  loadSnapshots() {
    try {
      const snapshotsDir = path3.join(this.shadowDir, "snapshots");
      if (!fs3.existsSync(snapshotsDir)) {
        return;
      }
      const files = fs3.readdirSync(snapshotsDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path3.join(snapshotsDir, file);
          const relativePath = file.slice(0, -5);
          const content = fs3.readFileSync(filePath, "utf8");
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
      const snapshotPath = path3.join(this.shadowDir, "snapshots", `${relativePath}.json`);
      const dir = path3.dirname(snapshotPath);
      if (!fs3.existsSync(dir)) {
        fs3.mkdirSync(dir, { recursive: true });
      }
      fs3.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
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
      const changesPath = path3.join(this.shadowDir, "changes", `${relativePath}.json`);
      const dir = path3.dirname(changesPath);
      if (!fs3.existsSync(dir)) {
        fs3.mkdirSync(dir, { recursive: true });
      }
      fs3.writeFileSync(changesPath, JSON.stringify(changes, null, 2));
    } catch (error) {
      console.error(`Failed to save changes for ${relativePath}:`, error);
    }
  }
  /**
   * Load checkpoints from disk
   */
  loadCheckpoints() {
    try {
      const checkpointsDir = path3.join(this.shadowDir, "checkpoints");
      if (!fs3.existsSync(checkpointsDir)) {
        return;
      }
      const files = fs3.readdirSync(checkpointsDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const filePath = path3.join(checkpointsDir, file);
          const content = fs3.readFileSync(filePath, "utf8");
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
      const checkpointPath = path3.join(this.shadowDir, "checkpoints", `${checkpoint.id}.json`);
      fs3.writeFileSync(checkpointPath, JSON.stringify(checkpoint, null, 2));
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
    const fileName = path3.basename(relativePath);
    const tempPath = path3.join(this.shadowDir, "temp", `${fileName}.snapshot`);
    fs3.writeFileSync(tempPath, snapshot.content);
    return tempPath;
  }
};

// src/shadowGitView.ts
var vscode = __toESM(require("vscode"));
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
        vscode.Uri.file(path4.join(this.context.extensionPath, "resources"))
      ]
    };
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "takeSnapshot":
          vscode.commands.executeCommand("shadowGit.takeSnapshot");
          break;
        case "openDiff":
          this.openDiff(message.path);
          break;
        case "createCheckpoint":
          vscode.commands.executeCommand(this.shadowGit.type === "main" ? "shadowGit.createCheckpoint" : "shadowGit.createWorkingCheckpoint");
          break;
        case "applyCheckpoint":
          vscode.commands.executeCommand("shadowGit.applyCheckpoint", message.id);
          break;
        case "deleteCheckpoint":
          this.deleteCheckpoint(message.id);
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
      vscode.Uri.file(path4.join(this.context.extensionPath, "resources", "view.css"))
    );
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.file(path4.join(this.context.extensionPath, "node_modules", "@vscode/codicons", "dist", "codicon.css"))
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
        
        .checkpoint-actions {
          display: flex;
          justify-content: space-between;
        }
        
        .checkpoint-actions button {
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
                <div class="checkpoint-actions">
                  <button class="apply-btn"><i class="codicon codicon-run"></i> Apply Checkpoint</button>
                  <button class="delete-btn"><i class="codicon codicon-trash"></i> Delete</button>
                </div>
              \`;
              
              // Apply checkpoint button
              checkpointItem.querySelector('.apply-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'applyCheckpoint',
                  id: checkpoint.id
                });
              });
              
              // Delete checkpoint button
              checkpointItem.querySelector('.delete-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'deleteCheckpoint',
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
      const document = await vscode.workspace.openTextDocument(fullPath);
      await vscode.window.showTextDocument(document);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file: ${error.message}`);
    }
  }
  /**
   * Delete a checkpoint
   * @param checkpointId - ID of the checkpoint to delete
   */
  async deleteCheckpoint(checkpointId) {
    try {
      const confirmation = await vscode.window.showWarningMessage(
        `Are you sure you want to delete checkpoint ${checkpointId.substring(0, 8)}?`,
        { modal: true },
        "Delete"
      );
      if (confirmation === "Delete") {
        const result = this.shadowGit.deleteCheckpoint(checkpointId);
        if (result) {
          vscode.window.showInformationMessage(`Checkpoint ${checkpointId.substring(0, 8)} deleted successfully`);
          this.refresh();
        } else {
          vscode.window.showErrorMessage(`Failed to delete checkpoint ${checkpointId.substring(0, 8)}`);
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to delete checkpoint: ${error.message}`);
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
      const leftUri = vscode.Uri.file(tempPath);
      const rightUri = vscode.Uri.file(fullPath);
      await vscode.commands.executeCommand(
        "vscode.diff",
        leftUri,
        rightUri,
        `Shadow Diff: ${path4.basename(filePath)} (${this.shadowGit.type})`
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open diff: ${error.message}`);
    }
  }
};

// src/enhancedShadowGitView.ts
var vscode3 = __toESM(require("vscode"));
var path5 = __toESM(require("path"));
init_gitIntegration();
var EnhancedShadowGitViewProvider = class {
  /**
   * Creates a new EnhancedShadowGitViewProvider instance
   * @param context - Extension context
   * @param mainShadowGit - Main ShadowGit instance for checkpoints
   * @param workingShadowGit - Working ShadowGit instance with Git integration
   */
  constructor(context, mainShadowGit, workingShadowGit) {
    this.context = context;
    this.mainShadowGit = mainShadowGit;
    this.workingShadowGit = workingShadowGit;
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
        vscode3.Uri.file(path5.join(this.context.extensionPath, "resources"))
      ]
    };
    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage((message) => {
      console.log("Received message from WebView:", message);
      switch (message.command) {
        case "takeSnapshot":
          if (message.type === "main") {
            vscode3.commands.executeCommand("shadowGit.takeMainSnapshot").then(() => this.refresh());
          } else {
            vscode3.commands.executeCommand("shadowGit.takeWorkingSnapshot").then(() => this.refresh());
          }
          break;
        case "openDiff":
          this.openDiff(message.path, message.type, message.gitUri, message.gitType);
          break;
        case "createCheckpoint":
          if (message.type === "main") {
            vscode3.commands.executeCommand("shadowGit.createCheckpoint").then(() => {
              console.log("Refreshing WebView after createCheckpoint command");
              setTimeout(() => this.refresh(), 500);
            });
          } else {
            vscode3.commands.executeCommand("shadowGit.createWorkingCheckpoint").then(() => {
              console.log("Refreshing WebView after createWorkingCheckpoint command");
              setTimeout(() => this.refresh(), 500);
            });
          }
          break;
        case "applyCheckpoint":
          vscode3.commands.executeCommand("shadowGit.applyCheckpoint", message.id).then(() => {
            console.log("Refreshing WebView after applyCheckpoint command");
            setTimeout(() => this.refresh(), 500);
          });
          break;
        case "deleteCheckpoint":
          console.log("WebView requested deleteCheckpoint for ID:", message.id);
          vscode3.commands.executeCommand("shadowGit.deleteCheckpoint", message.id).then(() => {
            console.log("Refreshing WebView after deleteCheckpoint command");
            setTimeout(() => this.refresh(), 500);
          });
          break;
        case "refresh":
          this.refresh();
          break;
        case "openFile":
          this.openFile(message.path);
          break;
        case "setBaseCommit":
          this.setBaseCommit(message.id);
          break;
        case "stageFile":
          this.stageFile(message.path);
          break;
        case "unstageFile":
          this.unstageFile(message.path);
          break;
        case "setActiveTab":
          this.refresh();
          break;
        default:
          console.log("Unknown command received from WebView:", message.command);
          break;
      }
    });
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        console.log("Shadow Git view became visible, refreshing");
        this.refresh();
      }
    });
    const refreshInterval = setInterval(() => {
      if (this._view && this._view.visible) {
        console.log("Auto-refreshing Shadow Git view");
        this.refresh();
      }
    }, 5e3);
    webviewView.onDidDispose(() => {
      clearInterval(refreshInterval);
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
      vscode3.Uri.file(path5.join(this.context.extensionPath, "resources", "view.css"))
    );
    const codiconsUri = webview.asWebviewUri(
      vscode3.Uri.file(path5.join(this.context.extensionPath, "node_modules", "@vscode/codicons", "dist", "codicon.css"))
    );
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
          margin-bottom: 4px;
        }
        
        .checkpoint-files {
          font-size: 0.8em;
          color: var(--vscode-descriptionForeground);
          margin-bottom: 8px;
        }
        
        .checkpoint-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-bottom: 8px;
        }
        
        .checkpoint-buttons button {
          flex: 1;
          min-width: 100px;
          margin-bottom: 0;
        }
        
        .delete-btn {
          background-color: var(--vscode-errorForeground, #F44336);
          color: white;
        }
        
        .checkpoint-files-list {
          margin-top: 8px;
          margin-bottom: 8px;
          max-height: 150px;
          overflow-y: auto;
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 2px;
          padding: 8px;
          display: none;
        }
        
        .checkpoint-files-list ul {
          margin: 0;
          padding-left: 16px;
        }
        
        .checkpoint-files-list li {
          font-size: 0.85em;
          margin-bottom: 4px;
          word-break: break-all;
        }
        
        .files-header {
          font-weight: bold;
          margin-bottom: 4px;
          font-size: 0.9em;
        }
        
        .empty-message {
          font-style: italic;
          color: var(--vscode-descriptionForeground);
          text-align: center;
          padding: 10px;
        }
        
        .info-message {
          color: var(--vscode-infoForeground, #2196F3);
          text-align: center;
          padding: 10px;
          font-weight: 500;
        }
        
        /* Tabs styling */
        .tabs {
          display: flex;
          margin-bottom: 16px;
          border-bottom: 1px solid var(--vscode-panel-border);
        }
        
        .tab {
          padding: 8px 16px;
          cursor: pointer;
          background: none;
          margin: 0;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--vscode-foreground);
          opacity: 0.7;
        }
        
        .tab.active {
          border-bottom: 2px solid var(--vscode-button-background);
          opacity: 1;
        }
        
        .tab-content {
          display: none;
        }
        
        .tab-content.active {
          display: block;
        }
        
        /* Badge for checkpoints/comparisons count */
        .badge {
          display: inline-block;
          background-color: var(--vscode-badge-background);
          color: var(--vscode-badge-foreground);
          border-radius: 50%;
          padding: 2px 6px;
          font-size: 0.8em;
          margin-left: 5px;
        }
        
        /* Working Git specific styles */
        .working-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
          margin-top: 8px;
          margin-bottom: 8px;
        }
        
        .working-actions button {
          flex: 1;
          min-width: 100px;
          margin-bottom: 0;
        }
        
        .set-base-btn {
          background-color: var(--vscode-statusBarItem-warningBackground);
          color: var(--vscode-statusBarItem-warningForeground);
        }
        
        .stage-btn {
          background-color: #4CAF50;
        }
        
        .unstage-btn {
          background-color: #F44336;
        }
        
        .base-commit-info {
          margin: 10px 0;
          padding: 8px;
          background-color: var(--vscode-editor-background);
          border: 1px solid var(--vscode-panel-border);
          border-radius: 2px;
        }
        
        /* Git status styling */
        .git-status {
          display: inline-block;
          margin-left: 5px;
          padding: 2px 4px;
          font-size: 0.7em;
          color: var(--vscode-badge-foreground);
          background-color: var(--vscode-badge-background);
          border-radius: 3px;
        }
        
        .git-modified .file-name {
          color: #FFAB00;
        }
        
        .git-untracked .file-name {
          color: #26A69A;
        }
        
        .git-index-modified .file-name,
        .git-index-added .file-name {
          color: #66BB6A;
        }
        
        .git-type {
          display: inline-block;
          margin-left: 5px;
          padding: 2px 4px;
          font-size: 0.7em;
          background-color: #424242;
          border-radius: 3px;
        }
        
        .git-status.working {
          background-color: #03A9F4;
        }
        
        .git-status.index {
          background-color: #4CAF50;
        }
        
        .git-status.commit {
          background-color: #7B1FA2;
        }
        
        .git-type-working .stage-btn {
          display: block;
        }
        
        .git-type-index .unstage-btn {
          display: block;
        }
        
        .git-type-working .unstage-btn,
        .git-type-index .stage-btn {
          display: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Shadow Git</h2>
        <div class="info-message" style="margin-bottom: 10px;">
          <strong>Checkpoints Tab:</strong> Create and manage checkpoints to save and restore file states. Checkpoints track files in your workspace and allow you to revert to previous states.<br>
          <strong>Git Changes Tab:</strong> View and manage actual Git changes (with staging buttons)
        </div>
        
        <div class="tabs">
          <button class="tab active" data-tab="checkpoints">
            Checkpoints <span class="badge" id="checkpointsBadge">0</span>
          </button>
          <button class="tab" data-tab="comparisons">
            Git Changes <span class="badge" id="comparisonsBadge">0</span>
          </button>
        </div>
        
        <!-- Checkpoints Tab -->
        <div class="tab-content active" id="checkpointsTab">
          <div class="actions">
            <button id="takeMainSnapshot">
              <i class="codicon codicon-device-camera"></i> Update File Tracking
            </button>
            <button id="createMainCheckpoint">
              <i class="codicon codicon-git-commit"></i> Save Checkpoint
            </button>
            <button id="refreshMain">
              <i class="codicon codicon-refresh"></i> Refresh
            </button>
          </div>
          
          <h3>Files with Changes</h3>
          <div class="info-message" style="margin-bottom: 10px;">
            Files below have been tracked and contain changes that have not yet been included in a checkpoint.
            Click "Save Checkpoint" to preserve the current state of these files.
          </div>
          <div class="files-list" id="mainFilesList">
            <div class="empty-message">No changed files detected</div>
          </div>
          
          <h3>Checkpoints</h3>
          <div class="checkpoints-list" id="mainCheckpointsList">
            <div class="empty-message">No checkpoints saved yet. Click "Save Checkpoint" above to preserve the current state of your workspace files.</div>
          </div>
        </div>
        
        <!-- Comparisons Tab -->
        <div class="tab-content" id="comparisonsTab">
          <div class="actions">
            <button id="refreshWorking">
              <i class="codicon codicon-refresh"></i> Refresh Git Changes
            </button>
          </div>
          
          <div id="baseCommitInfo" class="base-commit-info">
            <div class="info-message">Showing changes against latest commit (HEAD)</div>
          </div>
          
          <h3>Changed Files</h3>
          <div class="files-list" id="workingFilesList">
            <div class="empty-message">No changed files in Git</div>
          </div>
        </div>
      </div>
      
      <script>
        // Get vscode API
        const vscode = acquireVsCodeApi();
        
        // Tabs functionality
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
          tab.addEventListener('click', () => {
            // Remove active class from all tabs and contents
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            document.getElementById(tabId + 'Tab').classList.add('active');
            
            // Notify extension about tab change
            vscode.postMessage({
              command: 'setActiveTab',
              tab: tabId
            });
          });
        });
        
        // DOM elements
        const takeMainSnapshotBtn = document.getElementById('takeMainSnapshot');
        const createMainCheckpointBtn = document.getElementById('createMainCheckpoint');
        const refreshMainBtn = document.getElementById('refreshMain');
        const mainFilesList = document.getElementById('mainFilesList');
        const mainCheckpointsList = document.getElementById('mainCheckpointsList');
        
        const refreshWorkingBtn = document.getElementById('refreshWorking');
        const workingFilesList = document.getElementById('workingFilesList');
        const baseCommitInfo = document.getElementById('baseCommitInfo');
        
        // Badges
        const checkpointsBadge = document.getElementById('checkpointsBadge');
        const comparisonsBadge = document.getElementById('comparisonsBadge');
        
        // Event listeners - Main tab
        takeMainSnapshotBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'takeSnapshot', type: 'main' });
        });
        
        createMainCheckpointBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'createCheckpoint', type: 'main' });
        });
        
        refreshMainBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'refresh' });
        });
        
        // Event listeners - Working tab
        refreshWorkingBtn.addEventListener('click', () => {
          vscode.postMessage({ command: 'refresh' });
        });
        
        // Handle messages from the extension
        window.addEventListener('message', event => {
          const message = event.data;
          
          switch (message.command) {
            case 'update':
              updateMainUI(message.mainFiles, message.mainCheckpoints);
              updateWorkingUI(
                message.workingFiles, 
                message.workingCheckpoints, 
                message.baseCommit, 
                message.gitStatus, 
                message.gitType,
                message.gitUriMap
              );
              break;
          }
        });
        
        /**
         * Update the main tab UI with files and checkpoints
         * @param {Array} trackedFiles - Array of tracked file paths
         * @param {Array} checkpoints - Array of checkpoint objects
         */
        function updateMainUI(trackedFiles, checkpoints) {
          // Update badge count
          checkpointsBadge.textContent = checkpoints.length;
          
          // Update files list
          if (trackedFiles.length === 0) {
            mainFilesList.innerHTML = '<div class="empty-message">No tracked files</div>';
          } else {
            mainFilesList.innerHTML = '';
            
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
                  path: filePath,
                  type: 'main'
                });
              });
              
              mainFilesList.appendChild(fileItem);
            });
          }
          
          // Update checkpoints list
          if (checkpoints.length === 0) {
            mainCheckpointsList.innerHTML = '<div class="empty-message">No checkpoints</div>';
          } else {
            mainCheckpointsList.innerHTML = '';
            
            checkpoints.forEach(checkpoint => {
              const checkpointItem = document.createElement('div');
              checkpointItem.className = 'checkpoint-item';
              checkpointItem.setAttribute('data-checkpoint-id', checkpoint.id);
              
              const date = new Date(checkpoint.timestamp);
              const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
              
              checkpointItem.innerHTML = \`
                <div class="checkpoint-header">
                  <div class="checkpoint-id">\${checkpoint.id.substring(0, 8)}</div>
                  <div class="checkpoint-date">\${dateStr}</div>
                </div>
                <div class="checkpoint-message">\${checkpoint.message}</div>
                <div class="checkpoint-files">Files: \${Object.keys(checkpoint.changes).length}</div>
                <div class="checkpoint-buttons">
                  <button class="view-files-btn"><i class="codicon codicon-list-tree"></i> View Files</button>
                  <button class="apply-btn"><i class="codicon codicon-run"></i> Restore Checkpoint</button>
                  <button class="delete-btn"><i class="codicon codicon-trash"></i> Delete</button>
                </div>
              \`;
              
              // View files button
              checkpointItem.querySelector('.view-files-btn').addEventListener('click', () => {
                const filesInCheckpoint = Object.keys(checkpoint.changes);
                
                // Create or update files list element
                let filesList = checkpointItem.querySelector('.checkpoint-files-list');
                if (!filesList) {
                  filesList = document.createElement('div');
                  filesList.className = 'checkpoint-files-list';
                  checkpointItem.appendChild(filesList);
                }
                
                // Toggle visibility
                if (filesList.style.display === 'block') {
                  filesList.style.display = 'none';
                } else {
                  if (filesInCheckpoint.length === 0) {
                    filesList.innerHTML = '<div class="empty-message">No files in this checkpoint</div>';
                  } else {
                    filesList.innerHTML = '<div class="files-header">Files in this checkpoint:</div>';
                    
                    const fileItems = document.createElement('ul');
                    filesInCheckpoint.forEach(file => {
                      const item = document.createElement('li');
                      item.textContent = file;
                      fileItems.appendChild(item);
                    });
                    
                    filesList.appendChild(fileItems);
                  }
                  
                  filesList.style.display = 'block';
                }
              });
              
              // Restore checkpoint button
              checkpointItem.querySelector('.apply-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'applyCheckpoint',
                  id: checkpoint.id
                });
              });
              
              // Delete checkpoint button
              checkpointItem.querySelector('.delete-btn').addEventListener('click', () => {
                console.log("Delete button clicked for checkpoint " + checkpoint.id);
                vscode.postMessage({
                  command: 'deleteCheckpoint',
                  id: checkpoint.id
                });
                
                // Log for debugging
                try {
                  // This will show up in the JS console of the webview
                  console.log('Delete message sent:', {
                    command: 'deleteCheckpoint',
                    id: checkpoint.id
                  });
                } catch (error) {
                  console.error('Error logging:', error);
                }
              });
              
              mainCheckpointsList.appendChild(checkpointItem);
            });
          }
        }
        
        /**
         * Update the working tab UI with Git changed files
         * @param {Array} trackedFiles - Array of tracked file paths
         * @param {Array} checkpoints - Array of checkpoint/commit objects (not used)
         * @param {Object} baseCommit - The current base commit info (not used)
         * @param {Object} gitStatus - Map of file paths to Git status
         * @param {Object} gitType - Map of file paths to Git change type (working/index)
         * @param {Object} gitUriMap - Map of file paths to their Git URIs for diffing
         */
        function updateWorkingUI(trackedFiles, checkpoints, baseCommit, gitStatus = {}, gitType = {}, gitUriMap = {}) {
          // Update badge count with number of changed files
          comparisonsBadge.textContent = trackedFiles.length;
          
          // Always show the same base commit info message
          baseCommitInfo.innerHTML = '<div class="info-message">Showing changes against latest commit (HEAD)</div>';
          
          // Update files list
          if (trackedFiles.length === 0) {
            workingFilesList.innerHTML = '<div class="empty-message">No changed files in Git</div>';
          } else {
            workingFilesList.innerHTML = '';
            
            trackedFiles.forEach(filePath => {
              const fileItem = document.createElement('div');
              fileItem.className = 'file-item';
              
              const fileName = filePath.split('/').pop();
              const status = gitStatus[filePath] || '';
              const type = gitType[filePath] || '';
              
              // Create status label that includes both status and type
              let statusLabel = '';
              if (status) {
                statusLabel = \` <span class="git-status \${type}">\${status}</span>\`;
                if (type) {
                  statusLabel += \` <span class="git-type">\${type}</span>\`;
                }
              }
              
              // Add Git status-specific class
              if (status) {
                fileItem.classList.add('git-' + status.toLowerCase().replace('_', '-'));
                if (type) {
                  fileItem.classList.add('git-type-' + type);
                }
              }
              
              fileItem.innerHTML = \`
                <div class="file-name">\${fileName}\${statusLabel}</div>
                <div class="file-path">\${filePath}</div>
                <div class="file-actions">
                  <button class="open-btn"><i class="codicon codicon-file-code"></i> Open</button>
                  <button class="diff-btn"><i class="codicon codicon-diff"></i> Diff</button>
                </div>
                <div class="working-actions">
                  <button class="stage-btn"><i class="codicon codicon-add"></i> Stage All Changes</button>
                  <button class="unstage-btn"><i class="codicon codicon-remove"></i> Unstage All Changes</button>
                </div>
              \`;
              
              // Open file button
              fileItem.querySelector('.open-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'openFile',
                  path: filePath
                });
              });
              
              // Open diff button with Git URI info if available
              fileItem.querySelector('.diff-btn').addEventListener('click', () => {
                // Include Git URI information if available
                const gitUri = gitUriMap[filePath];
                const type = gitType[filePath] || 'working';
                
                vscode.postMessage({
                  command: 'openDiff',
                  path: filePath,
                  type: 'working',
                  gitUri: gitUri,
                  gitType: type
                });
              });
              
              // Stage file button
              fileItem.querySelector('.stage-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'stageFile',
                  path: filePath
                });
              });
              
              // Unstage file button
              fileItem.querySelector('.unstage-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'unstageFile',
                  path: filePath
                });
              });
              
              workingFilesList.appendChild(fileItem);
            });
          }
          
          // Update checkpoints/commits list
          if (checkpoints.length === 0) {
            workingCheckpointsList.innerHTML = '<div class="empty-message">No comparison commits</div>';
          } else {
            workingCheckpointsList.innerHTML = '';
            
            checkpoints.forEach(checkpoint => {
              const checkpointItem = document.createElement('div');
              checkpointItem.className = 'checkpoint-item';
              checkpointItem.setAttribute('data-checkpoint-id', checkpoint.id);
              
              const date = new Date(checkpoint.timestamp);
              const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
              const isBase = baseCommit && checkpoint.id === baseCommit.id;
              
              checkpointItem.innerHTML = \`
                <div class="checkpoint-header">
                  <div class="checkpoint-id">\${checkpoint.id.substring(0, 8)}</div>
                  <div class="checkpoint-date">\${dateStr}</div>
                </div>
                <div class="checkpoint-message">\${checkpoint.message}</div>
                <div class="checkpoint-files">Files: \${Object.keys(checkpoint.changes).length}</div>
                <div class="working-actions">
                  <button class="view-files-btn"><i class="codicon codicon-list-tree"></i> View Files</button>
                  <button class="apply-btn"><i class="codicon codicon-run"></i> Restore Commit</button>
                  <button class="set-base-btn" \${isBase ? 'disabled' : ''}>\${isBase ? 'Current Base' : 'Set as Base'}</button>
                  <button class="delete-btn"><i class="codicon codicon-trash"></i> Delete</button>
                </div>
              \`;
              
              // View files button
              checkpointItem.querySelector('.view-files-btn').addEventListener('click', () => {
                const filesInCheckpoint = Object.keys(checkpoint.changes);
                
                // Create or update files list element
                let filesList = checkpointItem.querySelector('.checkpoint-files-list');
                if (!filesList) {
                  filesList = document.createElement('div');
                  filesList.className = 'checkpoint-files-list';
                  checkpointItem.appendChild(filesList);
                }
                
                // Toggle visibility
                if (filesList.style.display === 'block') {
                  filesList.style.display = 'none';
                } else {
                  if (filesInCheckpoint.length === 0) {
                    filesList.innerHTML = '<div class="empty-message">No files in this checkpoint</div>';
                  } else {
                    filesList.innerHTML = '<div class="files-header">Files in this checkpoint:</div>';
                    
                    const fileItems = document.createElement('ul');
                    filesInCheckpoint.forEach(file => {
                      const item = document.createElement('li');
                      item.textContent = file;
                      fileItems.appendChild(item);
                    });
                    
                    filesList.appendChild(fileItems);
                  }
                  
                  filesList.style.display = 'block';
                }
              });
              
              // Restore checkpoint button
              checkpointItem.querySelector('.apply-btn').addEventListener('click', () => {
                vscode.postMessage({
                  command: 'applyCheckpoint',
                  id: checkpoint.id
                });
              });
              
              // Set as base button
              if (!isBase) {
                checkpointItem.querySelector('.set-base-btn').addEventListener('click', () => {
                  vscode.postMessage({
                    command: 'setBaseCommit',
                    id: checkpoint.id
                  });
                });
              }
              
              // Delete checkpoint button
              checkpointItem.querySelector('.delete-btn').addEventListener('click', () => {
                console.log("Delete button clicked for checkpoint " + checkpoint.id);
                vscode.postMessage({
                  command: 'deleteCheckpoint',
                  id: checkpoint.id
                });
                
                // Log for debugging
                try {
                  // This will show up in the JS console of the webview
                  console.log('Delete message sent:', {
                    command: 'deleteCheckpoint',
                    id: checkpoint.id
                  });
                } catch (error) {
                  console.error('Error logging:', error);
                }
              });
              
              workingCheckpointsList.appendChild(checkpointItem);
            });
          }
        }
        
        // Add direct event delegation for checkpoint actions
        document.addEventListener('click', (event) => {
          // Find closest button if any
          const button = event.target.closest('button');
          if (!button) return;
          
          // Handle delete buttons directly
          if (button.classList.contains('delete-btn')) {
            // Find the parent checkpoint item
            const checkpointItem = button.closest('.checkpoint-item');
            if (checkpointItem) {
              // Extract checkpoint ID from the header
              const idElement = checkpointItem.querySelector('.checkpoint-id');
              if (idElement && idElement.textContent) {
                const checkpointId = idElement.textContent.trim();
                console.log("Delete button clicked directly for " + checkpointId);
                
                // Find a more reliable way to get the checkpoint ID if possible
                const dataId = checkpointItem.getAttribute('data-checkpoint-id');
                const finalId = dataId || checkpointId;
                
                console.log("Using checkpoint ID: " + finalId);
                
                // Send message to extension
                vscode.postMessage({
                  command: 'deleteCheckpoint',
                  id: finalId
                });
                
                // Prevent the event from going to other handlers
                event.preventDefault();
                event.stopPropagation();
                
                // Provide visual feedback
                button.innerHTML = '<i class="codicon codicon-loading codicon-modifier-spin"></i> Deleting...';
                button.disabled = true;
                
                // Disable all buttons in the checkpoint item
                checkpointItem.querySelectorAll('button').forEach(btn => {
                  if (btn !== button) {
                    btn.disabled = true;
                  }
                });
                
                // Immediately refresh
                setTimeout(() => {
                  vscode.postMessage({ command: 'refresh' });
                }, 500);
              }
            }
          }
        });
        
        // Initial refresh request
        vscode.postMessage({ command: 'refresh' });
      </script>
    </body>
    </html>`;
  }
  /**
   * Refresh the view with updated data
   */
  async refresh() {
    if (!this._view) {
      return;
    }
    const mainFiles = this.mainShadowGit.getTrackedFiles();
    const mainCheckpoints = this.mainShadowGit.getCheckpoints();
    try {
      const gitChanges = await GitIntegration.getChangedFiles();
      const workspaceRoot = this.mainShadowGit.workspaceRoot;
      const gitFiles = gitChanges.map(
        (change) => path5.relative(workspaceRoot, change.filePath)
      );
      const gitStatusMap = {};
      const gitTypeMap = {};
      const gitUriMap = {};
      for (const change of gitChanges) {
        const relativePath = path5.relative(workspaceRoot, change.filePath);
        gitStatusMap[relativePath] = change.status;
        gitTypeMap[relativePath] = change.type;
        gitUriMap[relativePath] = change.uri.toString();
      }
      this._view.webview.postMessage({
        command: "update",
        mainFiles,
        mainCheckpoints,
        workingFiles: gitFiles,
        // Only show actual Git changed files
        workingCheckpoints: [],
        // No need for checkpoints in Git Changes tab
        baseCommit: null,
        // No concept of base commit anymore
        gitStatus: gitStatusMap,
        gitType: gitTypeMap,
        gitUriMap
      });
    } catch (error) {
      console.error("Failed to get Git changes:", error);
      this._view.webview.postMessage({
        command: "update",
        mainFiles,
        mainCheckpoints,
        workingFiles: [],
        workingCheckpoints: [],
        baseCommit: null,
        gitStatus: {},
        gitType: {},
        gitUriMap: {}
      });
    }
  }
  /**
   * Open a file in the editor
   * @param filePath - Relative path to the file
   */
  async openFile(filePath) {
    try {
      const fullPath = path5.join(this.mainShadowGit.workspaceRoot, filePath);
      const document = await vscode3.workspace.openTextDocument(fullPath);
      await vscode3.window.showTextDocument(document);
    } catch (error) {
      vscode3.window.showErrorMessage(`Failed to open file: ${error.message}`);
    }
  }
  /**
   * Open diff view for a file
   * @param filePath - Relative path to the file
   * @param type - Type of ShadowGit ('main' or 'working')
   * @param gitUri - Optional Git URI string for direct diffing (ignored)
   * @param gitType - Optional Git change type (working/index) (ignored)
   */
  async openDiff(filePath, type, gitUri, gitType) {
    try {
      const fullPath = path5.join(this.mainShadowGit.workspaceRoot, filePath);
      if (type === "main") {
        if (!this.mainShadowGit.snapshots.has(filePath)) {
          this.mainShadowGit.takeSnapshot(fullPath);
        }
        this.mainShadowGit.detectChanges(fullPath);
        await vscode3.commands.executeCommand("shadowGit.openMainDiff", vscode3.Uri.file(fullPath));
      } else {
        try {
          await vscode3.window.withProgress({
            location: vscode3.ProgressLocation.Notification,
            title: "Opening Git Diff",
            cancellable: false
          }, async (progress) => {
            progress.report({ message: "Opening Git diff..." });
            const fileUri = vscode3.Uri.file(fullPath);
            await vscode3.commands.executeCommand("shadowGit.openDirectGitDiff", fileUri);
            progress.report({ message: "Done" });
          });
        } catch (error) {
          console.error("Error opening Git diff:", error);
          vscode3.window.showErrorMessage("Failed to open Git diff: ${(error as Error).message}");
        }
      }
    } catch (error) {
      vscode3.window.showErrorMessage("Failed to open diff: ${(error as Error).message}");
    }
  }
  /**
   * Set a commit as the base reference
   * @param commitId - ID of the commit to use as base
   */
  setBaseCommit(commitId) {
    this.context.workspaceState.update("shadowgit.baseCommit", commitId);
    this.workingShadowGit.setBaseCommit(commitId);
    vscode3.window.showInformationMessage("Set commit ${commitId.substring(0, 8)} as the new base reference");
    this.refresh();
  }
  /**
   * Stage all changes in a file
   * @param filePath - Relative path to the file
   */
  async stageFile(filePath) {
    try {
      const fullPath = path5.join(this.mainShadowGit.workspaceRoot, filePath);
      await this.workingShadowGit.approveAllChanges(fullPath);
      await GitIntegration.stageFile(fullPath);
      vscode3.window.showInformationMessage(`Staged all changes in ${path5.basename(filePath)}`);
      this.refresh();
    } catch (error) {
      vscode3.window.showErrorMessage(`Failed to stage file: ${error.message}`);
    }
  }
  /**
   * Unstage all changes in a file
   * @param filePath - Relative path to the file
   */
  async unstageFile(filePath) {
    try {
      const fullPath = path5.join(this.mainShadowGit.workspaceRoot, filePath);
      await this.workingShadowGit.disapproveAllChanges(fullPath);
      await GitIntegration.unstageFile(fullPath);
      vscode3.window.showInformationMessage(`Unstaged all changes in ${path5.basename(filePath)}`);
      this.refresh();
    } catch (error) {
      vscode3.window.showErrorMessage(`Failed to unstage file: ${error.message}`);
    }
  }
};

// src/timelineProvider.ts
var vscode4 = __toESM(require("vscode"));
var path6 = __toESM(require("path"));
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
    const relativePath = path6.relative(this.shadowGit.workspaceRoot, filePath);
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

// src/simpleDiffCommand.ts
var vscode5 = __toESM(require("vscode"));
var path7 = __toESM(require("path"));
function createSimpleDiffCommand(context, mainShadowGit, workingShadowGit) {
  const commands9 = [];
  commands9.push(vscode5.commands.registerCommand("shadowGit.openMainDiff", async (uri) => {
    console.log("shadowGit.openMainDiff command invoked");
    if (!mainShadowGit) {
      vscode5.window.showErrorMessage("Main Shadow Git not initialized");
      return;
    }
    await openSimpleDiff(uri, mainShadowGit, "main");
  }));
  commands9.push(vscode5.commands.registerCommand("shadowGit.openSimpleWorkingDiff", async (uri) => {
    console.log("shadowGit.openSimpleWorkingDiff command invoked");
    if (!workingShadowGit) {
      vscode5.window.showErrorMessage("Working Shadow Git not initialized");
      return;
    }
    await openSimpleDiff(uri, workingShadowGit, "working");
  }));
  return commands9;
}
async function openSimpleDiff(uri, shadowGit, type) {
  await vscode5.window.withProgress({
    location: vscode5.ProgressLocation.Notification,
    title: `Opening ${type === "main" ? "Checkpoint" : "Comparison"} Diff`,
    cancellable: false
  }, async (progress) => {
    try {
      const filePath = uri.fsPath;
      const relativePath = path7.relative(shadowGit.workspaceRoot, filePath);
      progress.report({ message: "Creating snapshot..." });
      if (!shadowGit.snapshots.has(relativePath)) {
        if (shadowGit instanceof ShadowGitWithGit) {
          await shadowGit.takeSnapshot(filePath);
        } else {
          shadowGit.takeSnapshot(filePath);
        }
      }
      if (shadowGit instanceof ShadowGitWithGit) {
        await shadowGit.detectChanges(filePath);
      } else {
        shadowGit.detectChanges(filePath);
      }
      const tempPath = shadowGit.createTempSnapshotFile(relativePath);
      progress.report({ message: "Opening diff view..." });
      const shadowGitUri = uri.with({
        scheme: "shadowgit",
        path: uri.path,
        query: JSON.stringify({
          path: uri.fsPath,
          snapshot: "latest",
          type
        })
      });
      await vscode5.commands.executeCommand(
        "vscode.diff",
        shadowGitUri,
        // Snapshot version via our custom URI scheme
        uri,
        // Current file
        `Shadow Git ${type === "main" ? "Checkpoint" : "Comparison"} Diff: ${path7.basename(filePath)}`
      );
      progress.report({ message: "Opened diff with ShadowGit URI scheme" });
      try {
        const gitExtension = vscode5.extensions.getExtension("vscode.git");
        if (gitExtension && gitExtension.isActive) {
          const git = gitExtension.exports.getAPI(1);
          if (git && git.repositories && git.repositories.length > 0) {
            const repo = git.repositories[0];
            if (repo.state.workingTreeChanges) {
              const gitChange = repo.state.workingTreeChanges.find(
                (change) => change.uri.fsPath === uri.fsPath
              );
              if (gitChange) {
                console.log("Found corresponding Git change, staging buttons should appear");
              } else {
                console.log("No corresponding Git change found");
              }
            }
          }
        }
      } catch (gitError) {
        console.error("Git extension integration error:", gitError);
      }
      progress.report({ message: "Diff view opened successfully" });
    } catch (error) {
      console.error(`Failed to open diff: ${error}`);
      vscode5.window.showErrorMessage(`Failed to open diff: ${error.message}`);
    }
  });
}

// src/shadowGitFileSystemProvider.ts
var vscode6 = __toESM(require("vscode"));
var fs4 = __toESM(require("fs"));
var path8 = __toESM(require("path"));
var ShadowGitFileSystemProvider = class {
  constructor(mainShadowGit, workingShadowGit, outputChannel) {
    // --- manage file events
    this._emitter = new vscode6.EventEmitter();
    this.onDidChangeFile = this._emitter.event;
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
  async readFile(uri) {
    this.outputChannel.appendLine(`ShadowGitFileSystemProvider.readFile: ${uri.toString()}`);
    try {
      const query = JSON.parse(uri.query || "{}");
      const filePath = query.path || uri.fsPath;
      const snapshotId = query.snapshot || "latest";
      const shadowGitType = query.type || "main";
      this.outputChannel.appendLine(`Reading file: ${filePath}, snapshot: ${snapshotId}, type: ${shadowGitType}`);
      const shadowGit = shadowGitType === "main" ? this.mainShadowGit : this.workingShadowGit;
      if (!shadowGit) {
        throw new Error(`ShadowGit instance '${shadowGitType}' not available`);
      }
      const workspaceRoot = shadowGit.workspaceRoot;
      const relativePath = path8.relative(workspaceRoot, filePath);
      if (!relativePath) {
        throw new Error(`File ${filePath} is not in workspace ${workspaceRoot}`);
      }
      this.outputChannel.appendLine(`Retrieving snapshot for: ${relativePath}`);
      const tempFilePath = shadowGit.createTempSnapshotFile(relativePath);
      return fs4.promises.readFile(tempFilePath);
    } catch (error) {
      this.outputChannel.appendLine(`Error reading file: ${error}`);
      throw error;
    }
  }
  /**
   * Write a file with a ShadowGit URI (not implemented - read-only)
   */
  writeFile(uri, content, options) {
    throw vscode6.FileSystemError.NoPermissions("ShadowGit files are read-only");
  }
  /**
   * Check if a file exists with a ShadowGit URI
   */
  async stat(uri) {
    try {
      const query = JSON.parse(uri.query || "{}");
      const filePath = query.path || uri.fsPath;
      const stats = await fs4.promises.stat(filePath);
      return {
        type: vscode6.FileType.File,
        ctime: stats.ctime.getTime(),
        mtime: stats.mtime.getTime(),
        size: stats.size
      };
    } catch (error) {
      throw vscode6.FileSystemError.FileNotFound(uri);
    }
  }
  // --- manage files/folders
  /**
   * Create a directory (not implemented - read-only)
   */
  createDirectory(uri) {
    throw vscode6.FileSystemError.NoPermissions("ShadowGit filesystem is read-only");
  }
  /**
   * Delete a file (not implemented - read-only)
   */
  delete(uri, options) {
    throw vscode6.FileSystemError.NoPermissions("ShadowGit filesystem is read-only");
  }
  /**
   * Rename a file (not implemented - read-only)
   */
  rename(oldUri, newUri, options) {
    throw vscode6.FileSystemError.NoPermissions("ShadowGit filesystem is read-only");
  }
  /**
   * Read a directory (list files) from a ShadowGit URI
   */
  async readDirectory(uri) {
    throw vscode6.FileSystemError.FileNotFound(uri);
  }
  /**
   * Watch a file or directory for changes (no-op)
   */
  watch(_resource) {
    return { dispose: () => {
    } };
  }
};

// src/gitDiffCommand.ts
var vscode7 = __toESM(require("vscode"));
var path9 = __toESM(require("path"));
function createGitDiffCommand() {
  return vscode7.commands.registerCommand("shadowGit.openGitDiff", async (uri) => {
    await vscode7.window.withProgress({
      location: vscode7.ProgressLocation.Notification,
      title: "Opening Git Diff",
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ message: "Checking Git extension..." });
        const gitExtension = vscode7.extensions.getExtension("vscode.git");
        if (!gitExtension) {
          vscode7.window.showErrorMessage("Git extension not found");
          return;
        }
        if (!gitExtension.isActive) {
          await gitExtension.activate();
        }
        progress.report({ message: "Accessing Git API..." });
        const git = gitExtension.exports.getAPI(1);
        if (!git) {
          vscode7.window.showErrorMessage("Git API not available");
          return;
        }
        const repositories = git.repositories;
        if (repositories.length === 0) {
          vscode7.window.showErrorMessage("No Git repositories found");
          return;
        }
        const filePath = uri.fsPath;
        let repo = repositories[0];
        if (repositories.length > 1) {
          for (const r of repositories) {
            if (filePath.startsWith(r.rootUri.fsPath)) {
              repo = r;
              break;
            }
          }
        }
        progress.report({ message: "Creating Git URI..." });
        const relativePath = path9.relative(repo.rootUri.fsPath, filePath);
        const gitUri = uri.with({
          scheme: "git",
          authority: "",
          // Need to clear authority
          path: uri.path,
          query: JSON.stringify({
            path: uri.fsPath,
            ref: "HEAD"
            // Use HEAD as reference
          })
        });
        progress.report({ message: "Opening diff..." });
        await vscode7.commands.executeCommand(
          "vscode.diff",
          gitUri,
          // Original (HEAD) version using git: scheme
          uri,
          // Current file
          `Git Diff: ${path9.basename(filePath)}`
        );
        progress.report({ message: "Diff opened successfully" });
      } catch (error) {
        console.error("Error opening Git diff:", error);
        vscode7.window.showErrorMessage(`Failed to open Git diff: ${error.message}`);
      }
    });
  });
}

// src/hybridGitCommand.ts
var vscode8 = __toESM(require("vscode"));
var path10 = __toESM(require("path"));
function createHybridGitCommand(context, mainShadowGit, workingShadowGit) {
  const outputChannel = vscode8.window.createOutputChannel("Shadow Git Hybrid");
  return vscode8.commands.registerCommand("shadowGit.openHybridDiff", async (uri) => {
    await vscode8.window.withProgress({
      location: vscode8.ProgressLocation.Notification,
      title: "Opening Hybrid Git Diff",
      cancellable: false
    }, async (progress) => {
      try {
        progress.report({ message: "Checking Git extension..." });
        if (mainShadowGit) {
          const filePath2 = uri.fsPath;
          const relativePath = path10.relative(mainShadowGit.workspaceRoot, filePath2);
          if (!mainShadowGit.snapshots.has(relativePath)) {
            outputChannel.appendLine(`Taking ShadowGit snapshot of ${filePath2}`);
            mainShadowGit.takeSnapshot(filePath2);
          }
        }
        progress.report({ message: "Accessing Git extension..." });
        const gitExtension = vscode8.extensions.getExtension("vscode.git");
        if (!gitExtension) {
          vscode8.window.showErrorMessage("Git extension not found");
          return;
        }
        if (!gitExtension.isActive) {
          await gitExtension.activate();
        }
        const git = gitExtension.exports.getAPI(1);
        if (!git) {
          vscode8.window.showErrorMessage("Git API not available");
          return;
        }
        const repositories = git.repositories;
        if (repositories.length === 0) {
          vscode8.window.showErrorMessage("No Git repositories found");
          return;
        }
        const filePath = uri.fsPath;
        let repo = repositories[0];
        if (repositories.length > 1) {
          for (const r of repositories) {
            if (filePath.startsWith(r.rootUri.fsPath)) {
              repo = r;
              break;
            }
          }
        }
        const { GitIntegration: GitIntegration2 } = (init_gitIntegration(), __toCommonJS(gitIntegration_exports));
        const gitUri = await GitIntegration2.createGitDiffUri(uri);
        progress.report({ message: "Opening Git diff (with staging buttons)..." });
        await vscode8.commands.executeCommand(
          "vscode.diff",
          gitUri,
          // Original (HEAD) version using git: scheme
          uri,
          // Current file
          `Git Diff: ${path10.basename(filePath)} (Working Tree)`
        );
        if (!context.subscriptions.find((d) => d._commandId === "shadowGit.createCheckpointFromStaged")) {
          const createCheckpointCommand = vscode8.commands.registerCommand(
            "shadowGit.createCheckpointFromStaged",
            async () => {
              const stagedChanges = repo.state.indexChanges;
              if (stagedChanges.length === 0) {
                vscode8.window.showInformationMessage("No staged changes to create checkpoint from");
                return;
              }
              try {
                const message = await vscode8.window.showInputBox({
                  prompt: "Enter checkpoint message",
                  placeHolder: "Describe the changes in this checkpoint"
                });
                if (!message) {
                  return;
                }
                if (mainShadowGit) {
                  for (const change of stagedChanges) {
                    const filePath2 = change.uri.fsPath;
                    mainShadowGit.takeSnapshot(filePath2);
                  }
                  const checkpoint = mainShadowGit.createCheckpoint(message);
                  vscode8.window.showInformationMessage(
                    `Created ShadowGit checkpoint: ${checkpoint.id.substring(0, 8)} - ${message}`
                  );
                }
              } catch (error) {
                vscode8.window.showErrorMessage(`Failed to create checkpoint: ${error.message}`);
              }
            }
          );
          context.subscriptions.push(createCheckpointCommand);
        }
        vscode8.window.showInformationMessage(
          "Stage changes using the buttons in the gutter, then create a ShadowGit checkpoint",
          "Create Checkpoint"
        ).then((selection) => {
          if (selection === "Create Checkpoint") {
            vscode8.commands.executeCommand("shadowGit.createCheckpointFromStaged");
          }
        });
        progress.report({ message: "Done" });
      } catch (error) {
        outputChannel.appendLine(`Error in hybrid diff: ${error}`);
        vscode8.window.showErrorMessage(`Failed to open hybrid diff: ${error.message}`);
      }
    });
  });
}

// src/debugDiffCommand.ts
var vscode9 = __toESM(require("vscode"));
init_gitIntegration();
function createDebugDiffCommand(context) {
  const outputChannel = vscode9.window.createOutputChannel("Shadow Git Debug");
  outputChannel.show(true);
  return vscode9.commands.registerCommand("shadowGit.debugDiff", async (uri) => {
    try {
      outputChannel.appendLine("\n--- DEBUG DIFF COMMAND EXECUTED ---");
      outputChannel.appendLine(`File: ${uri.fsPath}`);
      outputChannel.appendLine(`Original URI: ${uri.toString()}`);
      outputChannel.appendLine("\nAttempting to get Git extension...");
      const gitExtension = vscode9.extensions.getExtension("vscode.git");
      if (!gitExtension) {
        outputChannel.appendLine("Git extension not found!");
        vscode9.window.showErrorMessage("Git extension not found");
        return;
      }
      if (!gitExtension.isActive) {
        outputChannel.appendLine("Git extension not active, activating...");
        await gitExtension.activate();
      }
      const git = gitExtension.exports.getAPI(1);
      if (!git) {
        outputChannel.appendLine("Git API not available!");
        vscode9.window.showErrorMessage("Git API not available");
        return;
      }
      outputChannel.appendLine("\nSearching for Git repository...");
      const repositories = git.repositories;
      if (repositories.length === 0) {
        outputChannel.appendLine("No Git repositories found!");
        vscode9.window.showErrorMessage("No Git repositories found");
        return;
      }
      let repo = repositories[0];
      outputChannel.appendLine(`Default repo: ${repo.rootUri.fsPath}`);
      if (repositories.length > 1) {
        outputChannel.appendLine(`Found ${repositories.length} repositories, looking for best match...`);
        for (const r of repositories) {
          outputChannel.appendLine(`Checking repo: ${r.rootUri.fsPath}`);
          if (uri.fsPath.startsWith(r.rootUri.fsPath)) {
            repo = r;
            outputChannel.appendLine(`Found better match: ${r.rootUri.fsPath}`);
            break;
          }
        }
      }
      outputChannel.appendLine("\nGit file state:");
      const state = repo.state;
      const workingChange = state.workingTreeChanges.find(
        (c) => c.uri.fsPath === uri.fsPath
      );
      if (workingChange) {
        outputChannel.appendLine(`Working tree status: ${workingChange.status}`);
      } else {
        outputChannel.appendLine("Not in working tree changes");
      }
      const indexChange = state.indexChanges.find(
        (c) => c.uri.fsPath === uri.fsPath
      );
      if (indexChange) {
        outputChannel.appendLine(`Index status: ${indexChange.status}`);
      } else {
        outputChannel.appendLine("Not in index changes");
      }
      outputChannel.appendLine("\nURI Constructions:");
      const ourUri = await GitIntegration.createGitDiffUri(uri);
      outputChannel.appendLine(`
Our constructed URI: ${ourUri.toString()}`);
      outputChannel.appendLine(`Scheme: ${ourUri.scheme}`);
      outputChannel.appendLine(`Authority: ${ourUri.authority}`);
      outputChannel.appendLine(`Path: ${ourUri.path}`);
      outputChannel.appendLine(`Query: ${ourUri.query}`);
      try {
        const filePath = uri.fsPath;
        outputChannel.appendLine("\nWatching for VS Code Git URIs...");
        outputChannel.appendLine("Please open the diff from the VS Code Git panel now");
        const disposable = vscode9.workspace.onDidOpenTextDocument((doc) => {
          if (doc.uri.scheme === "git" && doc.uri.query.includes(filePath)) {
            outputChannel.appendLine(`
Captured Git URI from VS Code: ${doc.uri.toString()}`);
            outputChannel.appendLine(`Scheme: ${doc.uri.scheme}`);
            outputChannel.appendLine(`Authority: ${doc.uri.authority}`);
            outputChannel.appendLine(`Path: ${doc.uri.path}`);
            outputChannel.appendLine(`Query: ${doc.uri.query}`);
            outputChannel.appendLine("\nDifferences:");
            if (ourUri.authority !== doc.uri.authority) {
              outputChannel.appendLine(`Authority different: "${ourUri.authority}" vs "${doc.uri.authority}"`);
            }
            if (ourUri.path !== doc.uri.path) {
              outputChannel.appendLine(`Path different: "${ourUri.path}" vs "${doc.uri.path}"`);
            }
            if (ourUri.query !== doc.uri.query) {
              outputChannel.appendLine(`Query different: "${ourUri.query}" vs "${doc.uri.query}"`);
              try {
                const ourQuery = JSON.parse(ourUri.query);
                const vsQuery = JSON.parse(doc.uri.query);
                outputChannel.appendLine("\nParsed query objects:");
                outputChannel.appendLine("Our query: " + JSON.stringify(ourQuery, null, 2));
                outputChannel.appendLine("VS Code query: " + JSON.stringify(vsQuery, null, 2));
                const allKeys = /* @__PURE__ */ new Set([...Object.keys(ourQuery), ...Object.keys(vsQuery)]);
                outputChannel.appendLine("\nQuery key differences:");
                for (const key of allKeys) {
                  if (!(key in ourQuery)) {
                    outputChannel.appendLine(`Missing in our query: "${key}": ${JSON.stringify(vsQuery[key])}`);
                  } else if (!(key in vsQuery)) {
                    outputChannel.appendLine(`Missing in VS Code query: "${key}": ${JSON.stringify(ourQuery[key])}`);
                  } else if (JSON.stringify(ourQuery[key]) !== JSON.stringify(vsQuery[key])) {
                    outputChannel.appendLine(`Different value for "${key}": ${JSON.stringify(ourQuery[key])} vs ${JSON.stringify(vsQuery[key])}`);
                  }
                }
              } catch (e) {
                outputChannel.appendLine(`Error parsing queries: ${e}`);
              }
            }
            disposable.dispose();
          }
        });
        context.subscriptions.push(disposable);
      } catch (error) {
        outputChannel.appendLine(`
Error watching for VS Code Git URIs: ${error}`);
      }
      outputChannel.appendLine("\nOpening our debug diff view...");
      await vscode9.commands.executeCommand(
        "vscode.diff",
        ourUri,
        uri,
        `DEBUG DIFF: ${uri.fsPath}`
      );
      vscode9.window.showInformationMessage("Debug diff opened. Please now open the diff from the Git panel for comparison.");
    } catch (error) {
      const errorMsg = `Error in debug diff: ${error}`;
      outputChannel.appendLine(errorMsg);
      vscode9.window.showErrorMessage(errorMsg);
    }
  });
}

// src/directGitDiffCommand.ts
var vscode10 = __toESM(require("vscode"));
var path11 = __toESM(require("path"));
function createDirectGitDiffCommand(context, mainShadowGit, workingShadowGit) {
  const outputChannel = vscode10.window.createOutputChannel("Shadow Git Direct Git");
  return vscode10.commands.registerCommand("shadowGit.openDirectGitDiff", async (uri, commit) => {
    try {
      outputChannel.appendLine(`Opening direct Git diff for ${uri.fsPath}`);
      if (workingShadowGit) {
        const filePath = uri.fsPath;
        const relativePath = path11.relative(workingShadowGit.workspaceRoot, filePath);
        if (!workingShadowGit.snapshots.has(relativePath)) {
          await workingShadowGit.takeSnapshot(filePath);
          outputChannel.appendLine(`Took snapshot of ${filePath} for ShadowGit tracking`);
        }
      }
      if (commit) {
        outputChannel.appendLine(`Opening specific commit comparison: ${commit}`);
        try {
          const result2 = await vscode10.commands.executeCommand("git.openChange", uri, commit);
          outputChannel.appendLine(`git.openChange with commit result: ${result2 ? "success" : "no result"}`);
          return result2;
        } catch (error) {
          outputChannel.appendLine(`Error opening git diff with commit: ${error}`);
          throw error;
        }
      }
      const isSpecificCommit = uri.query && uri.query.includes("commit=");
      if (isSpecificCommit) {
        try {
          outputChannel.appendLine("This appears to be a specific commit comparison from URI");
          const params = new URLSearchParams(uri.query);
          const commitFromQuery = params.get("commit");
          if (commitFromQuery) {
            outputChannel.appendLine(`Calling git.openChange with commit from URI: ${commitFromQuery}`);
            return await vscode10.commands.executeCommand("git.openChange", uri, commitFromQuery);
          }
        } catch (error) {
          outputChannel.appendLine(`Error parsing commit info: ${error}`);
        }
      }
      outputChannel.appendLine("Calling standard git.openChange command...");
      const result = await vscode10.commands.executeCommand("git.openChange", uri);
      outputChannel.appendLine(`git.openChange result: ${result ? "success" : "no result"}`);
      return result;
    } catch (error) {
      outputChannel.appendLine(`Error opening Git diff: ${error}`);
      vscode10.window.showErrorMessage(`Failed to open Git diff: ${error.message}`);
      try {
        outputChannel.appendLine("Falling back to regular diff...");
        if (workingShadowGit && mainShadowGit) {
          const filePath = uri.fsPath;
          const relativePath = path11.relative(workingShadowGit.workspaceRoot, filePath);
          const tempPath = workingShadowGit.createTempSnapshotFile(relativePath);
          const leftUri = vscode10.Uri.file(tempPath);
          return vscode10.commands.executeCommand(
            "vscode.diff",
            leftUri,
            uri,
            `Git Diff Fallback: ${path11.basename(filePath)} (Working Tree)`
          );
        }
      } catch (fallbackError) {
        outputChannel.appendLine(`Fallback also failed: ${fallbackError}`);
      }
      return null;
    }
  });
}

// src/extension.ts
async function activate(context) {
  const outputChannel = vscode11.window.createOutputChannel("Shadow Git");
  outputChannel.clear();
  outputChannel.show(true);
  outputChannel.appendLine("Shadow Git extension activated - START");
  console.log("SHADOW_GIT_DEBUG: Extension activation starting");
  try {
    const packageJson = require_package();
    outputChannel.appendLine("Shadow Git version: " + packageJson.version);
    console.log("SHADOW_GIT_DEBUG: Extension version " + packageJson.version);
    outputChannel.appendLine("VS Code version: " + vscode11.version);
    outputChannel.appendLine("Platform: " + process.platform);
    console.log("SHADOW_GIT_DEBUG: Running on " + process.platform + ", VS Code " + vscode11.version);
  } catch (error) {
    outputChannel.appendLine("Error loading package info: " + error);
    console.error("SHADOW_GIT_DEBUG: Error loading package info:", error);
  }
  const originalConsoleLog = console.log;
  console.log = function(...args) {
    originalConsoleLog(...args);
    const message = args.map(
      (arg) => typeof arg === "object" ? JSON.stringify(arg) : String(arg)
    ).join(" ");
    outputChannel.appendLine(message);
  };
  console.log("Shadow Git extension is now active");
  console.log("Console logging redirected to output channel");
  outputChannel.appendLine("Initializing ShadowGit instances...");
  console.log("SHADOW_GIT_DEBUG: Initializing ShadowGit instances");
  let mainShadowGit = null;
  let workingShadowGit = null;
  let mainDiffDecorationProvider = null;
  let workingDiffDecorationProvider = null;
  let mainSCMProvider = null;
  let workingSCMProvider = null;
  let mainTimelineProvider = null;
  let workingTimelineProvider = null;
  if (vscode11.workspace.workspaceFolders && vscode11.workspace.workspaceFolders.length > 0) {
    const workspaceRoot = vscode11.workspace.workspaceFolders[0].uri.fsPath;
    outputChannel.appendLine(`Workspace root: ${workspaceRoot}`);
    console.log("SHADOW_GIT_DEBUG: Workspace root: ${workspaceRoot}");
    try {
      outputChannel.appendLine("Creating main ShadowGit instance");
      console.log("SHADOW_GIT_DEBUG: Creating main ShadowGit instance");
      mainShadowGit = new ShadowGit(workspaceRoot, "main");
      outputChannel.appendLine("Main ShadowGit created successfully");
      try {
        outputChannel.appendLine("Creating working ShadowGit with Git integration");
        console.log("SHADOW_GIT_DEBUG: Creating ShadowGitWithGit");
        workingShadowGit = new ShadowGitWithGit(workspaceRoot, "working");
        outputChannel.appendLine("Initializing working ShadowGit with Git");
        await workingShadowGit.initialize();
        outputChannel.appendLine("Working Shadow Git initialized successfully");
        console.log("SHADOW_GIT_DEBUG: Working ShadowGit initialized successfully");
      } catch (error) {
        outputChannel.appendLine(`Failed to initialize Working Shadow Git: ${error}`);
        console.error("SHADOW_GIT_DEBUG: Failed to initialize Working Shadow Git:", error);
        vscode11.window.showErrorMessage(`Failed to initialize Working Shadow Git: ${error.message}`);
        workingShadowGit = null;
      }
    } catch (error) {
      outputChannel.appendLine(`Error creating ShadowGit instances: ${error}`);
      console.error("SHADOW_GIT_DEBUG: Error creating ShadowGit instances:", error);
      vscode11.window.showErrorMessage(`Failed to initialize Shadow Git: ${error.message}`);
    }
    try {
      if (mainShadowGit) {
        try {
          outputChannel.appendLine("Registering ShadowGit file system provider");
          console.log("SHADOW_GIT_DEBUG: Registering file system provider");
          const fileSystemProvider = new ShadowGitFileSystemProvider(
            mainShadowGit,
            workingShadowGit,
            outputChannel
          );
          const fsRegistration = vscode11.workspace.registerFileSystemProvider(
            "shadowgit",
            fileSystemProvider,
            { isCaseSensitive: true }
          );
          context.subscriptions.push(fsRegistration);
          outputChannel.appendLine("ShadowGit file system provider registered successfully");
          console.log("SHADOW_GIT_DEBUG: File system provider registered successfully");
        } catch (error) {
          outputChannel.appendLine(`Error registering file system provider: ${error}`);
          console.error("SHADOW_GIT_DEBUG: Error registering file system provider:", error);
        }
      }
    } catch (error) {
      outputChannel.appendLine(`Error creating providers: ${error}`);
      console.error("SHADOW_GIT_DEBUG: Error creating providers:", error);
      vscode11.window.showErrorMessage(`Failed to initialize providers: ${error.message}`);
    }
    try {
      outputChannel.appendLine("Checking timeline API availability");
      console.log("SHADOW_GIT_DEBUG: Checking timeline API availability");
      if (mainShadowGit && vscode11.workspace.getConfiguration("shadowGit").get("showCheckpointsInTimeline")) {
        try {
          outputChannel.appendLine("Timeline integration enabled in settings");
          mainTimelineProvider = new ShadowGitTimelineProvider(mainShadowGit);
          outputChannel.appendLine("Created ShadowGitTimelineProvider instance");
          if (vscode11.timeline) {
            outputChannel.appendLine("Timeline API found, attempting to register provider");
            const disposable = vscode11.timeline.registerTimelineProvider(
              ["file", "git"],
              {
                id: "shadowgit",
                label: "Shadow Git",
                // @ts-ignore - Using the timeline API dynamically with proper types
                provideTimeline: (uri, options, token) => {
                  return mainTimelineProvider.provideTimeline(uri, options, token);
                },
                onDidChange: mainTimelineProvider.onDidChange
              }
            );
            context.subscriptions.push(disposable);
            outputChannel.appendLine("Timeline provider registered successfully");
            console.log("SHADOW_GIT_DEBUG: Timeline provider registered successfully");
          } else {
            outputChannel.appendLine("Timeline API not found, skipping");
            console.log("SHADOW_GIT_DEBUG: Timeline API not found, skipping timeline integration");
          }
        } catch (error) {
          outputChannel.appendLine(`Timeline API error: ${error}`);
          console.log("SHADOW_GIT_DEBUG: Timeline API error:", error);
        }
      } else {
        outputChannel.appendLine("Timeline integration disabled in settings or no mainShadowGit, skipping");
        console.log("SHADOW_GIT_DEBUG: Timeline integration disabled in settings or no mainShadowGit");
      }
    } catch (error) {
      outputChannel.appendLine(`Error in timeline setup: ${error}`);
      console.error("SHADOW_GIT_DEBUG: Error in timeline setup:", error);
    }
  }
  try {
    outputChannel.appendLine("Setting up WebView provider");
    console.log("SHADOW_GIT_DEBUG: Setting up WebView provider");
    if (mainShadowGit) {
      if (!workingShadowGit) {
        try {
          outputChannel.appendLine("Creating working ShadowGit for enhanced WebView");
          console.log("SHADOW_GIT_DEBUG: Creating working ShadowGit for enhanced WebView");
          workingShadowGit = new ShadowGitWithGit(mainShadowGit.workspaceRoot, "working");
          await workingShadowGit.initialize();
          outputChannel.appendLine("Working ShadowGit initialized successfully");
          console.log("SHADOW_GIT_DEBUG: Working ShadowGit initialized successfully");
        } catch (error) {
          outputChannel.appendLine(`Failed to initialize Working ShadowGit: ${error}`);
          console.error("SHADOW_GIT_DEBUG: Failed to initialize Working ShadowGit:", error);
        }
      }
      if (workingShadowGit) {
        outputChannel.appendLine("Creating WebView provider with EnhancedShadowGitViewProvider");
        console.log("SHADOW_GIT_DEBUG: Creating EnhancedShadowGitViewProvider");
        const enhancedViewProvider = new EnhancedShadowGitViewProvider(
          context,
          mainShadowGit,
          workingShadowGit
        );
        outputChannel.appendLine("Registering Enhanced WebView provider");
        console.log("SHADOW_GIT_DEBUG: Registering Enhanced WebView provider");
        context.subscriptions.push(
          vscode11.window.registerWebviewViewProvider("shadowGitView", enhancedViewProvider)
        );
      } else {
        outputChannel.appendLine("Creating WebView provider with ShadowGitViewProvider (fallback)");
        console.log("SHADOW_GIT_DEBUG: Creating ShadowGitViewProvider (fallback)");
        const shadowGitViewProvider = new ShadowGitViewProvider(context, mainShadowGit);
        outputChannel.appendLine("Registering WebView provider");
        console.log("SHADOW_GIT_DEBUG: Registering WebView provider");
        context.subscriptions.push(
          vscode11.window.registerWebviewViewProvider("shadowGitView", shadowGitViewProvider)
        );
      }
      outputChannel.appendLine("WebView provider registered successfully");
      console.log("SHADOW_GIT_DEBUG: WebView provider registered successfully");
    } else {
      outputChannel.appendLine("Skipping WebView registration - no mainShadowGit available");
      console.log("SHADOW_GIT_DEBUG: Skipping WebView registration - no mainShadowGit");
    }
  } catch (error) {
    outputChannel.appendLine(`Error setting up WebView: ${error}`);
    console.error("SHADOW_GIT_DEBUG: Error setting up WebView:", error);
    vscode11.window.showErrorMessage(`Failed to initialize WebView: ${error.message}`);
  }
  outputChannel.appendLine("Registering extension commands");
  console.log("SHADOW_GIT_DEBUG: Registering commands");
  const takeSnapshotCommand = vscode11.commands.registerCommand("shadowGit.takeSnapshot", async () => {
    outputChannel.appendLine("takeSnapshot command invoked");
    if (!mainShadowGit) {
      vscode11.window.showErrorMessage("No workspace folder open");
      return;
    }
    const editor = vscode11.window.activeTextEditor;
    if (!editor) {
      vscode11.window.showErrorMessage("No active editor");
      return;
    }
    try {
      const filePath = editor.document.uri.fsPath;
      await editor.document.save();
      outputChannel.appendLine(`Taking snapshot of ${filePath}`);
      const mainSnapshot = mainShadowGit.takeSnapshot(filePath);
      const fileName = path12.basename(filePath);
      outputChannel.appendLine(`Snapshot taken successfully: ${fileName}`);
      vscode11.window.showInformationMessage(`Snapshot taken in Main Shadow Git: ${fileName}`);
      outputChannel.appendLine("Skipping UI refresh (providers are disabled)");
      console.log("SHADOW_GIT_DEBUG: Skipping UI refresh");
    } catch (error) {
      vscode11.window.showErrorMessage(`Failed to take snapshot: ${error.message}`);
    }
  });
  const takeMainSnapshotCommand = vscode11.commands.registerCommand("shadowGit.takeMainSnapshot", async () => {
    if (!mainShadowGit) {
      vscode11.window.showErrorMessage("No workspace folder open");
      return;
    }
    const allOpenEditors = vscode11.window.visibleTextEditors;
    if (allOpenEditors.length === 0) {
      vscode11.window.showErrorMessage("No open editors to snapshot");
      return;
    }
    try {
      await vscode11.window.withProgress({
        location: vscode11.ProgressLocation.Notification,
        title: "Taking Checkpoint Snapshots",
        cancellable: false
      }, async (progress) => {
        let fileCount = 0;
        for (const editor of allOpenEditors) {
          if (editor.document.uri.scheme !== "file" || editor.document.uri.fsPath.includes(".vscode/.shadowgit-")) {
            continue;
          }
          try {
            progress.report({
              message: `Processing ${path12.basename(editor.document.uri.fsPath)}`,
              increment: 100 / allOpenEditors.length
            });
            await editor.document.save();
            const filePath = editor.document.uri.fsPath;
            if (mainShadowGit) {
              mainShadowGit.takeSnapshot(filePath);
            }
            fileCount++;
          } catch (error) {
            console.error(`Failed to take snapshot of ${editor.document.uri.fsPath}:`, error);
          }
        }
        if (fileCount > 0) {
          vscode11.window.showInformationMessage(`Snapshots taken of ${fileCount} files`);
        } else {
          vscode11.window.showInformationMessage("No new snapshots taken");
        }
        mainSCMProvider?.update();
      });
    } catch (error) {
      vscode11.window.showErrorMessage(`Failed to take snapshots: ${error.message}`);
    }
  });
  const takeWorkingSnapshotCommand = vscode11.commands.registerCommand("shadowGit.takeWorkingSnapshot", async () => {
    if (!workingShadowGit) {
      vscode11.window.showErrorMessage("No workspace folder open");
      return;
    }
    const editor = vscode11.window.activeTextEditor;
    if (!editor) {
      vscode11.window.showErrorMessage("No active editor");
      return;
    }
    try {
      const filePath = editor.document.uri.fsPath;
      await editor.document.save();
      await workingShadowGit.takeSnapshot(filePath);
      const fileName = path12.basename(filePath);
      vscode11.window.showInformationMessage(`Snapshot taken in Working system: ${fileName}`);
    } catch (error) {
      vscode11.window.showErrorMessage(`Failed to take snapshot: ${error.message}`);
    }
  });
  outputChannel.appendLine("Registering diff commands");
  console.log("SHADOW_GIT_DEBUG: Registering diff commands");
  let mainDiffCommands = [];
  if (mainShadowGit) {
    try {
      outputChannel.appendLine("Creating simple diff command");
      console.log("SHADOW_GIT_DEBUG: Creating simple diff command");
      mainDiffCommands = createSimpleDiffCommand(context, mainShadowGit, workingShadowGit);
      outputChannel.appendLine(`Created ${mainDiffCommands.length} diff commands`);
      console.log("SHADOW_GIT_DEBUG: Created ${mainDiffCommands.length} diff commands");
    } catch (error) {
      outputChannel.appendLine(`Error creating diff commands: ${error}`);
      console.error("SHADOW_GIT_DEBUG: Error creating diff commands:", error);
    }
  }
  let workingDiffCommand = vscode11.commands.registerCommand("shadowGit.openWorkingDiff", async (uri, commit) => {
    outputChannel.appendLine("Opening working diff with direct Git command integration");
    console.log("SHADOW_GIT_DEBUG: Opening diff using git.openChange for staging buttons");
    try {
      await vscode11.commands.executeCommand("shadowGit.openDirectGitDiff", uri, commit);
    } catch (error) {
      outputChannel.appendLine(`Error in openWorkingDiff: ${error}`);
      console.error("Error in openWorkingDiff:", error);
      try {
        outputChannel.appendLine("Falling back to hybrid Git/ShadowGit approach");
        await vscode11.commands.executeCommand("shadowGit.openHybridDiff", uri);
      } catch (hybridError) {
        outputChannel.appendLine("Falling back to simple diff");
        vscode11.commands.executeCommand("shadowGit.openSimpleWorkingDiff", uri);
      }
    }
  });
  const compareWithCheckpointCommand = vscode11.commands.registerCommand("shadowGit.compareWithCheckpoint", async (uri, checkpointId) => {
    let targetShadowGit = null;
    if (mainShadowGit && mainShadowGit.checkpoints.find((cp) => cp.id === checkpointId)) {
      targetShadowGit = mainShadowGit;
    } else if (workingShadowGit && workingShadowGit.checkpoints.find((cp) => cp.id === checkpointId)) {
      targetShadowGit = workingShadowGit;
    }
    if (!targetShadowGit) {
      vscode11.window.showErrorMessage(`Checkpoint ${checkpointId} not found`);
      return;
    }
    try {
      const filePath = uri.fsPath;
      const relativePath = path12.relative(targetShadowGit.workspaceRoot, filePath);
      const checkpoint = targetShadowGit.checkpoints.find((cp) => cp.id === checkpointId);
      if (!checkpoint.changes[relativePath]) {
        vscode11.window.showInformationMessage(`Checkpoint ${checkpointId.substring(0, 8)} does not affect this file`);
        return;
      }
      const tempPath = targetShadowGit.createTempSnapshotFile(relativePath);
      const leftUri = vscode11.Uri.file(tempPath);
      await vscode11.commands.executeCommand(
        "vscode.diff",
        leftUri,
        uri,
        `Compare with ${targetShadowGit.type} Checkpoint: ${checkpoint.message}`
      );
    } catch (error) {
      vscode11.window.showErrorMessage(`Failed to compare with checkpoint: ${error.message}`);
    }
  });
  const compareWithHeadCommand = vscode11.commands.registerCommand("shadowGit.compareWithHead", async (shadowGitType) => {
    const targetShadowGit = shadowGitType === "main" ? mainShadowGit : workingShadowGit;
    if (!targetShadowGit) {
      vscode11.window.showErrorMessage("No workspace folder open");
      return;
    }
    const editor = vscode11.window.activeTextEditor;
    if (!editor) {
      vscode11.window.showErrorMessage("No active editor");
      return;
    }
    try {
      const filePath = editor.document.uri.fsPath;
      const relativePath = path12.relative(targetShadowGit.workspaceRoot, filePath);
      const checkpoints = targetShadowGit.getCheckpoints().filter((cp) => cp.changes[relativePath]).sort((a, b) => b.timestamp - a.timestamp);
      if (checkpoints.length === 0) {
        vscode11.window.showInformationMessage(`No checkpoints found for this file in ${shadowGitType} Shadow Git`);
        return;
      }
      const latestCheckpoint = checkpoints[0];
      const tempPath = targetShadowGit.createTempSnapshotFile(relativePath);
      const leftUri = vscode11.Uri.file(tempPath);
      const rightUri = editor.document.uri;
      await vscode11.commands.executeCommand(
        "vscode.diff",
        leftUri,
        rightUri,
        `Compare with ${shadowGitType} HEAD: ${latestCheckpoint.message}`
      );
    } catch (error) {
      vscode11.window.showErrorMessage(`Failed to compare with HEAD: ${error.message}`);
    }
  });
  const compareWithShadowGitCommand = vscode11.commands.registerCommand("shadowGit.compareWithShadowGit", async () => {
    if (!mainShadowGit || !workingShadowGit) {
      vscode11.window.showErrorMessage("No workspace folder open");
      return;
    }
    const editor = vscode11.window.activeTextEditor;
    if (!editor) {
      vscode11.window.showErrorMessage("No active editor");
      return;
    }
    try {
      const filePath = editor.document.uri.fsPath;
      const relativePath = path12.relative(mainShadowGit.workspaceRoot, filePath);
      const hasMainSnapshot = mainShadowGit.snapshots.has(relativePath);
      const hasWorkingSnapshot = workingShadowGit.snapshots.has(relativePath);
      if (!hasMainSnapshot && !hasWorkingSnapshot) {
        vscode11.window.showWarningMessage("No snapshots found for this file. Take a snapshot first.");
        return;
      }
      const options = [];
      if (hasMainSnapshot) {
        options.push({ label: "Main Shadow Git", value: "main", description: "Compare with Main snapshot" });
      }
      if (hasWorkingSnapshot) {
        options.push({ label: "Working Shadow Git", value: "working", description: "Compare with Working snapshot" });
      }
      const choice = await vscode11.window.showQuickPick(
        options,
        { placeHolder: "Select Shadow Git to compare with" }
      );
      if (!choice) {
        return;
      }
      const targetShadowGit = choice.value === "main" ? mainShadowGit : workingShadowGit;
      const tempPath = targetShadowGit.createTempSnapshotFile(relativePath);
      const leftUri = vscode11.Uri.file(tempPath);
      const rightUri = editor.document.uri;
      await vscode11.commands.executeCommand(
        "vscode.diff",
        leftUri,
        rightUri,
        `Compare with ${choice.value} Shadow Git: ${path12.basename(filePath)}`
      );
    } catch (error) {
      vscode11.window.showErrorMessage(`Error: ${error.message}`);
    }
  });
  const approveChangeCommand = vscode11.commands.registerCommand("shadowGit.approveChange", async (uri, changeId) => {
    console.log("shadowGit.approveChange command invoked with URI: ${uri}, changeId: ${changeId}");
    if (!mainShadowGit) {
      vscode11.window.showErrorMessage("No workspace folder open");
      console.log("No workspace folder open");
      return;
    }
    try {
      const filePath = uri.fsPath;
      console.log("Approving change ${changeId} in file ${filePath}");
      const success = mainShadowGit.approveChange(filePath, changeId);
      if (success) {
        console.log("Change approved successfully, refreshing decorations");
        mainDiffDecorationProvider.refreshDecorations(uri);
        mainSCMProvider?.update();
        vscode11.window.showInformationMessage(`Change approved`);
      } else {
        console.log(`Change not found: ${changeId}`);
        vscode11.window.showErrorMessage(`Change not found: ${changeId}`);
      }
    } catch (error) {
      console.log(`Failed to approve change: ${error.message}`);
      vscode11.window.showErrorMessage(`Failed to approve change: ${error.message}`);
    }
  });
  const disapproveChangeCommand = vscode11.commands.registerCommand("shadowGit.disapproveChange", async (uri, changeId) => {
    if (!mainShadowGit) {
      vscode11.window.showErrorMessage("No workspace folder open");
      return;
    }
    try {
      const filePath = uri.fsPath;
      const success = mainShadowGit.disapproveChange(filePath, changeId);
      if (success) {
        mainDiffDecorationProvider.refreshDecorations(uri);
        mainSCMProvider?.update();
        vscode11.window.showInformationMessage(`Change disapproved`);
      } else {
        vscode11.window.showErrorMessage(`Change not found: ${changeId}`);
      }
    } catch (error) {
      vscode11.window.showErrorMessage(`Failed to disapprove change: ${error.message}`);
    }
  });
  const approveAllChangesCommand = vscode11.commands.registerCommand("shadowGit.approveAllChanges", async () => {
    if (!mainShadowGit) {
      vscode11.window.showErrorMessage("No workspace folder open");
      return;
    }
    const editor = vscode11.window.activeTextEditor;
    if (!editor) {
      vscode11.window.showErrorMessage("No active editor");
      return;
    }
    try {
      const filePath = editor.document.uri.fsPath;
      const count = mainShadowGit.approveAllChanges(filePath);
      mainDiffDecorationProvider.refreshDecorations(editor.document.uri);
      mainSCMProvider?.update();
      vscode11.window.showInformationMessage(`Approved ${count} changes`);
    } catch (error) {
      vscode11.window.showErrorMessage(`Failed to approve changes: ${error.message}`);
    }
  });
  const disapproveAllChangesCommand = vscode11.commands.registerCommand("shadowGit.disapproveAllChanges", async () => {
    if (!mainShadowGit) {
      vscode11.window.showErrorMessage("No workspace folder open");
      return;
    }
    const editor = vscode11.window.activeTextEditor;
    if (!editor) {
      vscode11.window.showErrorMessage("No active editor");
      return;
    }
    try {
      const filePath = editor.document.uri.fsPath;
      const count = mainShadowGit.disapproveAllChanges(filePath);
      mainDiffDecorationProvider.refreshDecorations(editor.document.uri);
      mainSCMProvider?.update();
      vscode11.window.showInformationMessage(`Disapproved ${count} changes`);
    } catch (error) {
      vscode11.window.showErrorMessage(`Failed to disapprove changes: ${error.message}`);
    }
  });
  const createCheckpointCommand = vscode11.commands.registerCommand("shadowGit.createCheckpoint", async () => {
    if (!mainShadowGit) {
      vscode11.window.showErrorMessage("No workspace folder open");
      return;
    }
    try {
      await vscode11.window.withProgress({
        location: vscode11.ProgressLocation.Notification,
        title: "Preparing Checkpoint",
        cancellable: false
      }, async (progress) => {
        progress.report({ message: "Taking snapshots of all project files..." });
        outputChannel.appendLine("Finding all files in project for checkpoint");
        console.log("SHADOW_GIT_DEBUG: Finding all files in project for checkpoint");
        const files = await vscode11.workspace.findFiles(
          "**/*.*",
          // Include all files
          "**/{node_modules,.git,.vscode,.vscode-insiders,dist,build}/**"
          // Exclude common directories
        );
        outputChannel.appendLine(`Found ${files.length} files in project`);
        console.log("SHADOW_GIT_DEBUG: Found ${files.length} files in project");
        let processedCount = 0;
        for (const file of files) {
          try {
            const stats = fs5.statSync(file.fsPath);
            if (stats.size > 1024 * 1024) {
              continue;
            }
            if (mainShadowGit) {
              mainShadowGit.takeSnapshot(file.fsPath);
              processedCount++;
            }
            if (processedCount % 10 === 0) {
              progress.report({
                message: `Processing files... ${processedCount}/${files.length}`,
                increment: 10 / files.length * 100
              });
            }
          } catch (error) {
            console.error(`Failed to take snapshot of ${file.fsPath}:`, error);
          }
        }
        outputChannel.appendLine(`Processed ${processedCount} files for checkpoint`);
        console.log("SHADOW_GIT_DEBUG: Processed ${processedCount} files for checkpoint");
      });
      const message = await vscode11.window.showInputBox({
        prompt: "Enter a checkpoint message",
        placeHolder: "What changes does this checkpoint include?"
      });
      if (!message) {
        return;
      }
      outputChannel.appendLine(`Creating checkpoint with message: ${message}`);
      console.log("SHADOW_GIT_DEBUG: Creating checkpoint with message: ${message}");
      const checkpoint = mainShadowGit.createCheckpoint(message);
      const filesCount = Object.keys(checkpoint.changes).length;
      const filesList = Object.keys(checkpoint.changes).join(", ");
      outputChannel.appendLine(`Created checkpoint ${checkpoint.id} with message "${message}"`);
      outputChannel.appendLine(`Checkpoint contains ${filesCount} files: ${filesList}`);
      console.log("SHADOW_GIT_DEBUG: Created checkpoint with ${filesCount} files: ${filesList}");
      vscode11.window.showInformationMessage(
        `Checkpoint created: ${checkpoint.id.substring(0, 8)} with ${filesCount} files`
      );
      try {
        outputChannel.appendLine(`Refreshing WebView after checkpoint creation`);
        await vscode11.commands.executeCommand("workbench.view.extension.shadowGitView");
        await vscode11.commands.executeCommand("shadowGit.refresh");
      } catch (refreshError) {
        outputChannel.appendLine(`Error refreshing view: ${refreshError}`);
      }
      mainSCMProvider?.update();
      if (mainTimelineProvider) {
        mainTimelineProvider.refresh();
      }
    } catch (error) {
      vscode11.window.showErrorMessage(`Failed to create checkpoint: ${error.message}`);
    }
  });
  const createWorkingCheckpointCommand = vscode11.commands.registerCommand("shadowGit.createWorkingCheckpoint", async () => {
    if (!workingShadowGit) {
      vscode11.window.showErrorMessage("No workspace folder open");
      return;
    }
    try {
      const message = await vscode11.window.showInputBox({
        prompt: "Enter a working checkpoint message",
        placeHolder: "What changes does this working checkpoint include?"
      });
      if (!message) {
        return;
      }
      const checkpoint = await workingShadowGit.createCheckpoint(message);
      vscode11.window.showInformationMessage(`Working checkpoint created: ${checkpoint.id.substring(0, 8)}`);
    } catch (error) {
      vscode11.window.showErrorMessage(`Failed to create working checkpoint: ${error.message}`);
    }
  });
  const deleteCheckpointCommand = vscode11.commands.registerCommand("shadowGit.deleteCheckpoint", async (checkpointId) => {
    outputChannel.appendLine(`deleteCheckpoint command invoked for checkpoint ${checkpointId}`);
    console.log(`SHADOW_GIT_DEBUG: deleteCheckpoint command invoked for checkpoint ${checkpointId}`);
    console.log(`SHADOW_GIT_DEBUG: Checkpoint ID type: ${typeof checkpointId}, value: "${checkpointId}"`);
    if (!checkpointId || typeof checkpointId !== "string") {
      const errorMsg = `Invalid checkpoint ID: ${checkpointId}`;
      outputChannel.appendLine(errorMsg);
      console.error(`SHADOW_GIT_DEBUG: ${errorMsg}`);
      vscode11.window.showErrorMessage(errorMsg);
      return;
    }
    const cleanCheckpointId = checkpointId.trim();
    let targetShadowGit = null;
    let foundCheckpoint = null;
    if (mainShadowGit) {
      const mainCheckpoints = mainShadowGit.getCheckpoints();
      console.log("SHADOW_GIT_DEBUG: Available main checkpoints: ${mainCheckpoints.map(cp => cp.id).join(', ')}");
      foundCheckpoint = mainCheckpoints.find(
        (cp) => cp.id === cleanCheckpointId || cp.id.startsWith(cleanCheckpointId) || cleanCheckpointId.startsWith(cp.id)
      );
      if (foundCheckpoint) {
        targetShadowGit = mainShadowGit;
        outputChannel.appendLine(`Found checkpoint in main ShadowGit instance: ${foundCheckpoint.id}`);
        console.log("SHADOW_GIT_DEBUG: Found checkpoint in main ShadowGit instance: ${foundCheckpoint.id}");
      }
    }
    if (!foundCheckpoint && workingShadowGit) {
      const workingCheckpoints = workingShadowGit.getCheckpoints();
      console.log("SHADOW_GIT_DEBUG: Available working checkpoints: ${workingCheckpoints.map(cp => cp.id).join(', ')}");
      foundCheckpoint = workingCheckpoints.find(
        (cp) => cp.id === cleanCheckpointId || cp.id.startsWith(cleanCheckpointId) || cleanCheckpointId.startsWith(cp.id)
      );
      if (foundCheckpoint) {
        targetShadowGit = workingShadowGit;
        outputChannel.appendLine(`Found checkpoint in working ShadowGit instance: ${foundCheckpoint.id}`);
        console.log("SHADOW_GIT_DEBUG: Found checkpoint in working ShadowGit instance: ${foundCheckpoint.id}");
      }
    }
    if (!targetShadowGit || !foundCheckpoint) {
      const errorMsg = `Checkpoint ${cleanCheckpointId} not found`;
      outputChannel.appendLine(errorMsg);
      console.error(`SHADOW_GIT_DEBUG: ${errorMsg}`);
      vscode11.window.showErrorMessage(errorMsg);
      return;
    }
    try {
      const actualCheckpointId = foundCheckpoint.id;
      const message = foundCheckpoint.message;
      const confirmDelete = await vscode11.window.showWarningMessage(
        `Are you sure you want to delete checkpoint "${message}" (${actualCheckpointId.substring(0, 8)})? This action cannot be undone.`,
        { modal: true },
        "Delete"
      );
      if (confirmDelete !== "Delete") {
        outputChannel.appendLine(`User cancelled checkpoint deletion`);
        console.log("SHADOW_GIT_DEBUG: User cancelled checkpoint deletion");
        return;
      }
      console.log("SHADOW_GIT_DEBUG: Deleting checkpoint with full ID: ${actualCheckpointId}");
      const success = targetShadowGit.deleteCheckpoint(actualCheckpointId);
      if (success) {
        vscode11.window.showInformationMessage(`Checkpoint "${message}" (${actualCheckpointId.substring(0, 8)}) was deleted successfully.`);
        outputChannel.appendLine(`Checkpoint deleted successfully`);
        console.log("SHADOW_GIT_DEBUG: Checkpoint deleted successfully");
        mainSCMProvider?.update();
        if (mainTimelineProvider) {
          mainTimelineProvider.refresh();
        }
        try {
          await vscode11.commands.executeCommand("shadowGit.refresh");
          try {
            const views = vscode11.window.visibleWebviewPanels;
            if (views && views.length > 0) {
              console.log("SHADOW_GIT_DEBUG: Found ${views.length} visible WebView panels");
            }
          } catch (error) {
          }
        } catch (error) {
          console.error(`SHADOW_GIT_DEBUG: Error refreshing view:`, error);
        }
      } else {
        const errorMsg = `Failed to delete checkpoint "${message}" (${actualCheckpointId.substring(0, 8)})`;
        outputChannel.appendLine(errorMsg);
        console.error(`SHADOW_GIT_DEBUG: ${errorMsg}`);
        vscode11.window.showErrorMessage(errorMsg);
      }
    } catch (error) {
      const errorMsg = `Failed to delete checkpoint: ${error.message}`;
      outputChannel.appendLine(errorMsg);
      console.error(`SHADOW_GIT_DEBUG: ${errorMsg}`);
      vscode11.window.showErrorMessage(errorMsg);
    }
  });
  const applyCheckpointCommand = vscode11.commands.registerCommand("shadowGit.applyCheckpoint", async (checkpointId) => {
    outputChannel.appendLine(`applyCheckpoint command invoked for checkpoint ${checkpointId}`);
    console.log("SHADOW_GIT_DEBUG: applyCheckpoint command invoked for checkpoint ${checkpointId}");
    let targetShadowGit = null;
    if (mainShadowGit && mainShadowGit.checkpoints.find((cp) => cp.id === checkpointId)) {
      targetShadowGit = mainShadowGit;
      outputChannel.appendLine(`Found checkpoint in main ShadowGit instance`);
      console.log("SHADOW_GIT_DEBUG: Found checkpoint in main ShadowGit instance");
    } else if (workingShadowGit && workingShadowGit.checkpoints.find((cp) => cp.id === checkpointId)) {
      targetShadowGit = workingShadowGit;
      outputChannel.appendLine(`Found checkpoint in working ShadowGit instance`);
      console.log("SHADOW_GIT_DEBUG: Found checkpoint in working ShadowGit instance");
    }
    if (!targetShadowGit) {
      const errorMsg = `Checkpoint ${checkpointId} not found`;
      outputChannel.appendLine(errorMsg);
      console.log("SHADOW_GIT_DEBUG: ${errorMsg}");
      vscode11.window.showErrorMessage(errorMsg);
      return;
    }
    try {
      const checkpoint = targetShadowGit.checkpoints.find((cp) => cp.id === checkpointId);
      const affectedFiles = Object.keys(checkpoint.changes);
      outputChannel.appendLine(`Checkpoint will restore ${affectedFiles.length} files: ${affectedFiles.join(", ")}`);
      console.log("SHADOW_GIT_DEBUG: Checkpoint will restore ${affectedFiles.length} files: ${affectedFiles.join(', ')}");
      const confirmApply = await vscode11.window.showWarningMessage(
        `Are you sure you want to restore checkpoint "${checkpoint.message}" (${checkpointId.substring(0, 8)})? This will restore ${affectedFiles.length} files to their state at checkpoint creation.`,
        { modal: true },
        "Restore"
      );
      if (confirmApply !== "Restore") {
        outputChannel.appendLine(`User cancelled checkpoint restore`);
        console.log("SHADOW_GIT_DEBUG: User cancelled checkpoint restore");
        return;
      }
      outputChannel.appendLine(`Applying checkpoint ${checkpointId}`);
      console.log("SHADOW_GIT_DEBUG: Applying checkpoint ${checkpointId}");
      await vscode11.window.withProgress({
        location: vscode11.ProgressLocation.Notification,
        title: `Restoring checkpoint: ${checkpoint.message}`,
        cancellable: false
      }, async (progress) => {
        targetShadowGit.applyCheckpoint(checkpointId);
        progress.report({ message: `Restored ${affectedFiles.length} files` });
      });
      vscode11.window.showInformationMessage(
        `Checkpoint "${checkpoint.message}" (${checkpointId.substring(0, 8)}) successfully restored. ${affectedFiles.length} files were restored.`
      );
      outputChannel.appendLine(`Checkpoint applied successfully, restored ${affectedFiles.length} files`);
      console.log("SHADOW_GIT_DEBUG: Checkpoint applied successfully, restored ${affectedFiles.length} files");
      if (affectedFiles.length > 0) {
        try {
          const firstFile = path12.join(targetShadowGit.workspaceRoot, affectedFiles[0]);
          outputChannel.appendLine(`Opening restored file for confirmation: ${firstFile}`);
          const document = await vscode11.workspace.openTextDocument(firstFile);
          await vscode11.window.showTextDocument(document);
          outputChannel.appendLine(`Successfully opened restored file: ${firstFile}`);
        } catch (err) {
          outputChannel.appendLine(`Failed to open restored file for confirmation: ${err}`);
        }
      }
      mainSCMProvider?.update();
      if (mainTimelineProvider) {
        mainTimelineProvider.refresh();
      }
    } catch (error) {
      const errorMsg = `Failed to apply checkpoint: ${error.message}`;
      outputChannel.appendLine(errorMsg);
      console.log("SHADOW_GIT_DEBUG: ${errorMsg}");
      vscode11.window.showErrorMessage(errorMsg);
    }
  });
  const testCommand = vscode11.commands.registerCommand("shadowGit.test", () => {
    outputChannel.appendLine("Test command executed!");
    console.log("SHADOW_GIT_DEBUG: Test command executed");
    vscode11.window.showInformationMessage("Shadow Git Test Command Works!");
  });
  const testDeleteCommand = vscode11.commands.registerCommand("shadowGit.testDelete", async () => {
    outputChannel.appendLine("Test delete command executed!");
    console.log("SHADOW_GIT_DEBUG: Test delete command executed");
    try {
      if (!vscode11.workspace.workspaceFolders || vscode11.workspace.workspaceFolders.length === 0) {
        vscode11.window.showErrorMessage("No workspace folder open");
        return;
      }
      const workspaceRoot = vscode11.workspace.workspaceFolders[0].uri.fsPath;
      console.log("Workspace root:", workspaceRoot);
      const checkpointsDir = path12.join(workspaceRoot, ".vscode", ".shadowgit-main", "checkpoints");
      console.log("Looking for checkpoints in:", checkpointsDir);
      if (!fs5.existsSync(checkpointsDir)) {
        console.log("Checkpoints directory not found");
        vscode11.window.showErrorMessage("Checkpoints directory not found");
        return;
      }
      const checkpointFiles = fs5.readdirSync(checkpointsDir).filter((file) => file.endsWith(".json"));
      console.log("Found checkpoints:", checkpointFiles);
      if (checkpointFiles.length === 0) {
        console.log("No checkpoints found");
        vscode11.window.showErrorMessage("No checkpoints found");
        return;
      }
      const checkpointId = checkpointFiles[0].replace(".json", "");
      console.log("Selected checkpoint for deletion:", checkpointId);
      const confirmDelete = await vscode11.window.showWarningMessage(
        `Are you sure you want to delete checkpoint ${checkpointId.substring(0, 8)}?`,
        { modal: true },
        "Delete"
      );
      if (confirmDelete !== "Delete") {
        console.log("Deletion cancelled by user");
        return;
      }
      const checkpointPath = path12.join(checkpointsDir, `${checkpointId}.json`);
      fs5.unlinkSync(checkpointPath);
      console.log("Deleted checkpoint file:", checkpointPath);
      vscode11.window.showInformationMessage(`Manually deleted checkpoint: ${checkpointId.substring(0, 8)}`);
      mainSCMProvider?.update();
      if (mainTimelineProvider) {
        mainTimelineProvider.refresh();
      }
      vscode11.commands.executeCommand("shadowGit.refresh");
    } catch (error) {
      console.error("Error deleting checkpoint:", error);
      vscode11.window.showErrorMessage(`Manual deletion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  });
  const gitDiffCommand = createGitDiffCommand();
  const hybridDiffCommand = createHybridGitCommand(context, mainShadowGit, workingShadowGit);
  const debugDiffCommand = createDebugDiffCommand(context);
  const directGitDiffCommand = createDirectGitDiffCommand(context, mainShadowGit, workingShadowGit);
  const refreshCommand = vscode11.commands.registerCommand("shadowGit.refresh", async () => {
    try {
      outputChannel.appendLine("Manually refreshing ShadowGit views");
      console.log("SHADOW_GIT_DEBUG: Refreshing ShadowGit views");
      const extensions7 = vscode11.extensions.all.filter(
        (ext) => ext.id === "shadowgit.shadowgit" || ext.id.includes("shadowgit")
      );
      for (const view of vscode11.window.visibleTextEditors) {
        if (view.document.uri.scheme === "file") {
          try {
            mainShadowGit?.detectChanges(view.document.uri.fsPath);
          } catch (error) {
          }
        }
      }
      try {
        await vscode11.commands.executeCommand("workbench.view.extension.shadowGitView");
      } catch (error) {
      }
      mainSCMProvider?.update();
      if (mainTimelineProvider) {
        mainTimelineProvider.refresh();
      }
      vscode11.window.showInformationMessage("ShadowGit refreshed");
    } catch (error) {
      outputChannel.appendLine(`Error during refresh: ${error}`);
      console.error("SHADOW_GIT_DEBUG: Error during refresh", error);
    }
  });
  context.subscriptions.push(
    testCommand,
    // Add the test command first
    testDeleteCommand,
    // Add the test delete command
    takeSnapshotCommand,
    takeMainSnapshotCommand,
    takeWorkingSnapshotCommand,
    workingDiffCommand,
    gitDiffCommand,
    // Add the Git diff command
    hybridDiffCommand,
    // Add the hybrid Git/ShadowGit command
    directGitDiffCommand,
    // Add the direct Git diff command
    compareWithCheckpointCommand,
    compareWithHeadCommand,
    compareWithShadowGitCommand,
    approveChangeCommand,
    disapproveChangeCommand,
    approveAllChangesCommand,
    disapproveAllChangesCommand,
    createCheckpointCommand,
    createWorkingCheckpointCommand,
    deleteCheckpointCommand,
    applyCheckpointCommand,
    refreshCommand,
    // Add the refresh command
    debugDiffCommand,
    ...mainDiffCommands
    // Add all commands from mainDiffCommands
  );
  const showChangeContextMenuCommand = vscode11.commands.registerCommand("shadowGit.showChangeContextMenu", async (uri, line) => {
    if (mainDiffDecorationProvider) {
      await mainDiffDecorationProvider.handleChangeContextMenu(uri, line);
    }
  });
  context.subscriptions.push(showChangeContextMenuCommand);
  const fileWatcher = vscode11.workspace.createFileSystemWatcher("**/*");
  fileWatcher.onDidChange(async (uri) => {
    if (uri.fsPath.includes(".vscode/.shadowgit-")) {
      return;
    }
    if (mainShadowGit) {
      const relativePath = path12.relative(mainShadowGit.workspaceRoot, uri.fsPath);
      if (mainShadowGit.snapshots.has(relativePath)) {
        mainShadowGit.detectChanges(uri.fsPath);
        workingShadowGit.detectChanges(uri.fsPath);
        mainSCMProvider?.update();
        workingSCMProvider?.update();
      }
    }
  });
  context.subscriptions.push(fileWatcher);
  vscode11.workspace.onDidOpenTextDocument(async (document) => {
    if (document.uri.scheme === "file" && !document.uri.fsPath.includes(".vscode/.shadowgit-") && mainShadowGit) {
      try {
        console.log("Taking auto-snapshot of ${document.uri.fsPath}");
        mainShadowGit.takeSnapshot(document.uri.fsPath);
        if (workingShadowGit) {
          workingShadowGit.takeSnapshot(document.uri.fsPath);
        }
        mainSCMProvider?.update();
        console.log("Successfully took snapshot of ${document.fileName}");
      } catch (error) {
        console.error(`Auto-snapshot failed for ${document.fileName}:`, error);
      }
    }
  });
  vscode11.workspace.onDidSaveTextDocument((document) => {
    if (document.uri.scheme === "file" && !document.uri.fsPath.includes(".vscode/.shadowgit-") && mainShadowGit) {
      try {
        console.log("Taking snapshot of saved file ${document.uri.fsPath}");
        mainShadowGit.takeSnapshot(document.uri.fsPath);
        if (workingShadowGit) {
          workingShadowGit.takeSnapshot(document.uri.fsPath);
        }
        mainSCMProvider?.update();
      } catch (error) {
        console.error(`Save-snapshot failed for ${document.fileName}:`, error);
      }
    }
  });
}
function deactivate() {
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate,
  deactivate
});
//# sourceMappingURL=extension.js.map

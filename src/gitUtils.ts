// import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as util from 'util';
import * as childProcess from 'child_process';

const exec = util.promisify(childProcess.exec);

/**
 * Utility class for Git operations used by the working shadow git
 */
export class GitUtils {
  /**
   * Initialize a Git repository in the specified directory
   * @param repoPath - Path to initialize the Git repository
   */
  public static async initializeRepo(repoPath: string): Promise<void> {
    try {
      // Ensure the directory exists
      if (!fs.existsSync(repoPath)) {
        fs.mkdirSync(repoPath, { recursive: true });
      }

      // Check if git is already initialized
      if (fs.existsSync(path.join(repoPath, '.git'))) {
        console.log("Git repository already exists at ${repoPath}");
        return;
      }

      // Initialize git repository
      await this.runGitCommand(repoPath, 'init');
      
      // Set up Git config
      await this.runGitCommand(repoPath, 'config', ['user.name', '"ShadowGit"']);
      await this.runGitCommand(repoPath, 'config', ['user.email', '"shadowgit@example.com"']);
      
      // Create initial commit
      await this.createEmptyCommit(repoPath, 'Initial commit');

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
  public static async createFile(repoPath: string, filePath: string, content: string): Promise<void> {
    try {
      const fullPath = path.join(repoPath, filePath);
      const dirPath = path.dirname(fullPath);
      
      // Ensure directory exists
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Write file
      fs.writeFileSync(fullPath, content);
      
      // Stage file
      await this.runGitCommand(repoPath, 'add', [filePath]);
      
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
  public static async commit(repoPath: string, message: string): Promise<string> {
    try {
      const result = await this.runGitCommand(repoPath, 'commit', ['-m', `"${message}"`]);
      
      // Extract commit hash
      const match = result.stdout.match(/\[.*\s([a-f0-9]+)\]/);
      const commitHash = match ? match[1] : '';
      
      console.log("Changes committed: ${commitHash} - ${message}");
      
      return commitHash;
    } catch (error) {
      console.error(`Failed to commit changes: ${error}`);
      // Check if there's nothing to commit
      if ((error as Error & { stderr?: string }).stderr && (error as Error & { stderr?: string }).stderr?.includes('nothing to commit')) {
        console.log('Nothing to commit - all changes already committed');
        return '';
      }
      throw error;
    }
  }

  /**
   * Create an empty commit
   * @param repoPath - Path to the Git repository
   * @param message - Commit message
   */
  public static async createEmptyCommit(repoPath: string, message: string): Promise<string> {
    try {
      const result = await this.runGitCommand(repoPath, 'commit', ['--allow-empty', '-m', `"${message}"`]);
      
      // Extract commit hash
      const match = result.stdout.match(/\[.*\s([a-f0-9]+)\]/);
      const commitHash = match ? match[1] : '';
      
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
  public static async getCurrentCommit(repoPath: string): Promise<string> {
    try {
      const result = await this.runGitCommand(repoPath, 'rev-parse', ['HEAD']);
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
  public static async hasStagedChanges(repoPath: string): Promise<boolean> {
    try {
      const result = await this.runGitCommand(repoPath, 'diff', ['--cached', '--name-only']);
      return result.stdout.trim() !== '';
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
  public static async stageFile(repoPath: string, filePath: string): Promise<void> {
    try {
      await this.runGitCommand(repoPath, 'add', [filePath]);
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
  public static async unstageFile(repoPath: string, filePath: string): Promise<void> {
    try {
      await this.runGitCommand(repoPath, 'reset', ['HEAD', filePath]);
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
  public static async getFileFromRef(repoPath: string, filePath: string, ref: string): Promise<string> {
    try {
      const result = await this.runGitCommand(repoPath, 'show', [`${ref}:${filePath}`]);
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
  public static async getFiles(repoPath: string): Promise<string[]> {
    try {
      const result = await this.runGitCommand(repoPath, 'ls-files');
      return result.stdout.split('\n').filter(line => line.trim() !== '');
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
  public static async createDiff(repoPath: string, filePath: string): Promise<string> {
    try {
      // We'll use git diff HEAD to get changes between the staged/committed version and the working copy
      const result = await this.runGitCommand(repoPath, 'diff', ['--unified=3', 'HEAD', '--', filePath]);
      return result.stdout;
    } catch (error) {
      console.error(`Failed to create diff for ${filePath}: ${error}`);
      
      // Check if error is related to new file (no HEAD yet)
      if ((error as Error & { stderr?: string }).stderr && (error as Error & { stderr?: string }).stderr?.includes('fatal: bad revision')) {
        // Fall back to showing the entire file as an addition
        try {
          // Get the file content
          const fullPath = path.join(repoPath, filePath);
          if (fs.existsSync(fullPath)) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split('\n');
            
            // Create a simplified diff output manually
            let diff = `diff --git a/${filePath} b/${filePath}\n`;
            diff += `new file mode 100644\n`;
            diff += `--- /dev/null\n`;
            diff += `+++ b/${filePath}\n`;
            diff += `@@ -0,0 +1,${lines.length} @@\n`;
            
            // Add each line as an addition
            for (const line of lines) {
              diff += `+${line}\n`;
            }
            
            return diff;
          }
        } catch (fallbackError) {
          console.error(`Fallback diff creation failed: ${fallbackError}`);
        }
      }
      
      // If we got here, return an empty diff
      return '';
    }
  }

  /**
   * Get the list of commits in the Git repository
   * @param repoPath - Path to the Git repository
   * @returns Array of commit objects (hash, message, date)
   */
  public static async getCommits(repoPath: string): Promise<Array<{hash: string, message: string, date: string}>> {
    try {
      const result = await this.runGitCommand(
        repoPath, 
        'log', 
        ['--pretty=format:%H|%s|%ad', '--date=iso']
      );
      
      if (!result.stdout.trim()) {
        return [];
      }
      
      return result.stdout.split('\n')
        .filter(line => line.trim() !== '')
        .map(line => {
          const parts = line.split('|');
          const hash = parts[0] || '';
          const message = parts[1] || '';
          const date = parts[2] || '';
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
  private static async runGitCommand(
    cwd: string, 
    command: string, 
    args: string[] = []
  ): Promise<{stdout: string, stderr: string}> {
    try {
      // Process and quote arguments properly
      const processedArgs = args.map(arg => {
        // If already quoted, leave as is
        if (arg.startsWith('"') && arg.endsWith('"')) {
          return arg;
        }
        // If contains spaces, quote it
        if (/\s/.test(arg)) {
          return `"${arg}"`;
        }
        return arg;
      });
      
      const gitCommand = `git ${command} ${processedArgs.join(' ')}`;
      console.log("Running Git command in ${cwd}: ${gitCommand}");
      return await exec(gitCommand, { cwd });
    } catch (error) {
      console.error(`Git command failed: ${error}`);
      throw error;
    }
  }
}
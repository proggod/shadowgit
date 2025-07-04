import * as vscode from 'vscode';
import { GitIntegration } from './gitIntegration';

/**
 * Debug command to intercept and log diff operations
 */
export function createDebugDiffCommand(context: vscode.ExtensionContext): vscode.Disposable {
  // Create output channel for detailed logs
  const outputChannel = vscode.window.createOutputChannel('Shadow Git Debug');
  outputChannel.show(true);
  
  return vscode.commands.registerCommand('shadowGit.debugDiff', async (uri: vscode.Uri) => {
    try {
      outputChannel.appendLine('\n--- DEBUG DIFF COMMAND EXECUTED ---');
      outputChannel.appendLine(`File: ${uri.fsPath}`);
      outputChannel.appendLine(`Original URI: ${uri.toString()}`);
      
      // Get the Git extension
      outputChannel.appendLine('\nAttempting to get Git extension...');
      const gitExtension = vscode.extensions.getExtension('vscode.git');
      
      if (!gitExtension) {
        outputChannel.appendLine('Git extension not found!');
        vscode.window.showErrorMessage('Git extension not found');
        return;
      }
      
      if (!gitExtension.isActive) {
        outputChannel.appendLine('Git extension not active, activating...');
        await gitExtension.activate();
      }
      
      const git = gitExtension.exports.getAPI(1);
      
      if (!git) {
        outputChannel.appendLine('Git API not available!');
        vscode.window.showErrorMessage('Git API not available');
        return;
      }
      
      // Find the repository for this file
      outputChannel.appendLine('\nSearching for Git repository...');
      const repositories = git.repositories;
      
      if (repositories.length === 0) {
        outputChannel.appendLine('No Git repositories found!');
        vscode.window.showErrorMessage('No Git repositories found');
        return;
      }
      
      // Find the repository that contains this file
      let repo = repositories[0]; // Default to first repo
      outputChannel.appendLine(`Default repo: ${repo.rootUri.fsPath}`);
      
      // Try to find a better match if there are multiple repositories
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
      
      // Log file state from Git's perspective
      outputChannel.appendLine('\nGit file state:');
      const state = repo.state;
      
      // Check if file is in working tree changes
      const workingChange = state.workingTreeChanges.find((c: { uri: vscode.Uri }) => 
        c.uri.fsPath === uri.fsPath
      );
      
      if (workingChange) {
        outputChannel.appendLine(`Working tree status: ${workingChange.status}`);
      } else {
        outputChannel.appendLine('Not in working tree changes');
      }
      
      // Check if file is in index changes
      const indexChange = state.indexChanges.find((c: { uri: vscode.Uri }) => 
        c.uri.fsPath === uri.fsPath
      );
      
      if (indexChange) {
        outputChannel.appendLine(`Index status: ${indexChange.status}`);
      } else {
        outputChannel.appendLine('Not in index changes');
      }
      
      // Compare different URI constructions
      outputChannel.appendLine('\nURI Constructions:');
      
      // Our current construction
      const ourUri = await GitIntegration.createGitDiffUri(uri);
      outputChannel.appendLine(`\nOur constructed URI: ${ourUri.toString()}`);
      outputChannel.appendLine(`Scheme: ${ourUri.scheme}`);
      outputChannel.appendLine(`Authority: ${ourUri.authority}`);
      outputChannel.appendLine(`Path: ${ourUri.path}`);
      outputChannel.appendLine(`Query: ${ourUri.query}`);
      
      // Attempt to extract a URI from Git's history to see what VS Code constructs
      try {
        const filePath = uri.fsPath;
        outputChannel.appendLine('\nWatching for VS Code Git URIs...');
        outputChannel.appendLine('Please open the diff from the VS Code Git panel now');
        
        // Create a disposable for listening to document open events
        const disposable = vscode.workspace.onDidOpenTextDocument(doc => {
          if (doc.uri.scheme === 'git' && doc.uri.query.includes(filePath)) {
            outputChannel.appendLine(`\nCaptured Git URI from VS Code: ${doc.uri.toString()}`);
            outputChannel.appendLine(`Scheme: ${doc.uri.scheme}`);
            outputChannel.appendLine(`Authority: ${doc.uri.authority}`);
            outputChannel.appendLine(`Path: ${doc.uri.path}`);
            outputChannel.appendLine(`Query: ${doc.uri.query}`);
            
            // Compare the differences
            outputChannel.appendLine('\nDifferences:');
            if (ourUri.authority !== doc.uri.authority) {
              outputChannel.appendLine(`Authority different: "${ourUri.authority}" vs "${doc.uri.authority}"`);
            }
            if (ourUri.path !== doc.uri.path) {
              outputChannel.appendLine(`Path different: "${ourUri.path}" vs "${doc.uri.path}"`);
            }
            if (ourUri.query !== doc.uri.query) {
              outputChannel.appendLine(`Query different: "${ourUri.query}" vs "${doc.uri.query}"`);
              
              // Parse and compare query objects
              try {
                const ourQuery = JSON.parse(ourUri.query);
                const vsQuery = JSON.parse(doc.uri.query);
                
                outputChannel.appendLine('\nParsed query objects:');
                outputChannel.appendLine('Our query: ' + JSON.stringify(ourQuery, null, 2));
                outputChannel.appendLine('VS Code query: ' + JSON.stringify(vsQuery, null, 2));
                
                // Compare each key
                const allKeys = new Set([...Object.keys(ourQuery), ...Object.keys(vsQuery)]);
                outputChannel.appendLine('\nQuery key differences:');
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
            
            // We've captured what we need, dispose the listener
            disposable.dispose();
          }
        });
        
        // Add to context subscriptions to ensure it gets cleaned up
        context.subscriptions.push(disposable);
        
      } catch (error) {
        outputChannel.appendLine(`\nError watching for VS Code Git URIs: ${error}`);
      }
      
      // Open our custom diff for testing
      outputChannel.appendLine('\nOpening our debug diff view...');
      await vscode.commands.executeCommand('vscode.diff',
        ourUri,
        uri,
        `DEBUG DIFF: ${uri.fsPath}`
      );
      
      vscode.window.showInformationMessage('Debug diff opened. Please now open the diff from the Git panel for comparison.');
      
    } catch (error) {
      const errorMsg = `Error in debug diff: ${error}`;
      outputChannel.appendLine(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
    }
  });
}
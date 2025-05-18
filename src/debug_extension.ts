import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  console.log('Shadow Git is activating...');
  
  // Register a simple command for testing
  const testCommand = vscode.commands.registerCommand('shadowGit.test', () => {
    vscode.window.showInformationMessage('Shadow Git Test Command Works!');
  });
  
  context.subscriptions.push(testCommand);
  
  console.log('Shadow Git activated successfully!');
}

export function deactivate(): void {
  console.log('Shadow Git deactivated');
}
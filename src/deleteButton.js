// This is a standalone test script to validate the deletion functionality
// Run this in the VS Code debug console to test checkpoint deletion

const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

async function testDeleteCheckpoint() {
  try {
    // Get the workspace root
    const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
    console.log('Workspace root:', workspaceRoot);
    
    // Find checkpoints in the .vscode/.shadowgit-main directory
    const checkpointsDir = path.join(workspaceRoot, '.vscode', '.shadowgit-main', 'checkpoints');
    console.log('Looking for checkpoints in:', checkpointsDir);
    
    if (!fs.existsSync(checkpointsDir)) {
      console.log('Checkpoints directory not found');
      return;
    }
    
    // Get all checkpoint files
    const checkpointFiles = fs.readdirSync(checkpointsDir).filter(file => file.endsWith('.json'));
    console.log('Found checkpoints:', checkpointFiles);
    
    if (checkpointFiles.length === 0) {
      console.log('No checkpoints found');
      return;
    }
    
    // Get the first checkpoint ID
    const checkpointId = checkpointFiles[0].replace('.json', '');
    console.log('Selected checkpoint for deletion:', checkpointId);
    
    // Delete the checkpoint file
    const checkpointPath = path.join(checkpointsDir, `${checkpointId}.json`);
    fs.unlinkSync(checkpointPath);
    console.log('Deleted checkpoint file:', checkpointPath);
    
    // Show success message
    vscode.window.showInformationMessage(`Manually deleted checkpoint: ${checkpointId.substring(0, 8)}`);
    
  } catch (error) {
    console.error('Error deleting checkpoint:', error);
    vscode.window.showErrorMessage(`Manual deletion failed: ${error.message}`);
  }
}

module.exports = {
  testDeleteCheckpoint
};
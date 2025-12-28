const vscode = require('vscode');
const path = require('path');
const { TextEncoder, TextDecoder } = require('util');

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Check if a file exists (Web-compatible)
 * @param {string} fsPath 
 * @returns {Promise<boolean>}
 */
async function exists(fsPath) {
    try {
        await vscode.workspace.fs.stat(vscode.Uri.file(fsPath));
        return true;
    } catch {
        return false;
    }
}

/**
 * Read file content as string (Web-compatible)
 * @param {string} fsPath 
 * @returns {Promise<string>}
 */
async function readFile(fsPath) {
    const uint8Array = await vscode.workspace.fs.readFile(vscode.Uri.file(fsPath));
    return decoder.decode(uint8Array);
}

/**
 * Write content to file (Web-compatible)
 * @param {string} fsPath 
 * @param {string} content 
 */
async function writeFile(fsPath, content) {
    const uint8Array = encoder.encode(content);
    await vscode.workspace.fs.writeFile(vscode.Uri.file(fsPath), uint8Array);
}

/**
 * Create directory (Web-compatible)
 * @param {string} fsPath 
 */
async function mkdir(fsPath) {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(fsPath));
}

module.exports = {
    exists,
    readFile,
    writeFile,
    mkdir
};

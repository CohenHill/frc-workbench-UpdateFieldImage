const vscode = require('vscode');
const path = require('path');
const { exists, readFile } = require('../utils/fsUtils');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

    // Pre-Flight Checklist Command
    const preFlightChecklistCmd = vscode.commands.registerCommand('frc-workbench.preFlightChecklist', async () => {
        const panel = vscode.window.createWebviewPanel(
            'preFlightChecklist',
            '🚀 Pre-Flight Checklist',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const htmlPath = path.join(context.extensionPath, 'src', 'webviews', 'preFlightChecklist.html');
        panel.webview.html = await readFile(htmlPath);

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(async message => {
            if (message.command === 'getVersionInfo') {
                // Just send dummy data
                panel.webview.postMessage({
                    command: 'versionInfo',
                    buildNumber: '-',
                    lastDeploy: 'N/A'
                });
            } else if (message.command === 'deploy') {
                // Close checklist and run deploy
                panel.dispose();
                vscode.window.showInformationMessage('Starting deployment...');

                // Run the WPILib deploy command
                vscode.commands.executeCommand('wpilibcore.deployCode');
            }
        });
    });

    context.subscriptions.push(preFlightChecklistCmd);

    // Build Code Command
    const buildCodeCmd = vscode.commands.registerCommand('frc-workbench.buildCode', () => {
        vscode.window.showInformationMessage('Building robot code...');
        vscode.commands.executeCommand('wpilibcore.buildCode');
    });

    context.subscriptions.push(buildCodeCmd);

    // Simulate Code Command
    const simulateCodeCmd = vscode.commands.registerCommand('frc-workbench.simulateCode', () => {
        vscode.window.showInformationMessage('Starting robot simulation...');
        vscode.commands.executeCommand('wpilibcore.simulateCode');
    });

    context.subscriptions.push(simulateCodeCmd);


    const wrapInstantCommandCmd = vscode.commands.registerCommand('frc-workbench.wrapInstantCommand', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;

        const selection = editor.selection;
        const text = editor.document.getText(selection);

        // Heuristic: Try to find a variable name to use as requirement.
        // e.g. "intake.run()" -> requirement is "intake"
        let requirement = "";
        const dotIndex = text.indexOf('.');
        if (dotIndex > 0) {
            requirement = text.substring(0, dotIndex);
        }

        // WPILib 2023+ style: Commands.runOnce(() -> {}, req)
        // Or old style: new InstantCommand(() -> {}, req)
        // Let's go with Commands factory which is modern.
        const snippet = `Commands.runOnce(() -> { ${text}; }, ${requirement})`;

        editor.edit(editBuilder => {
            editBuilder.replace(selection, snippet);
        });
    });

    context.subscriptions.push(wrapInstantCommandCmd);


    const checkAndOpenYAMGCmd = vscode.commands.registerCommand('frc-workbench.checkAndOpenYAMG', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace open');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const vendorPath = path.join(rootPath, 'vendordeps');
        let hasYAMS = false;

        // Check for YAMS json
        if (await exists(vendorPath)) {
            // Basic check for any file containing "yams" (case insensitive)
            // Since we don't have glob easily here without more extension dependencies or 'findFiles',
            // we'll just read the dir.
            try {
                const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(vendorPath));
                hasYAMS = files.some(([name]) => name.toLowerCase().includes('yams') && name.endsWith('.json'));
            } catch (e) {
                console.error('Error reading vendordeps', e);
            }
        }

        if (!hasYAMS) {
            const selection = await vscode.window.showWarningMessage(
                'YAMS (Yet Another Mechanism System) library not found in vendordeps. You may need it to use YAMG generated code. Would you like to download it first?',
                'Download YAMS',
                'Continue to YAMG',
                'Cancel'
            );

            if (selection === 'Download YAMS') {
                vscode.env.openExternal(vscode.Uri.parse('https://yagsl.gitbook.io/yams/'));
                return;
            } else if (selection !== 'Continue to YAMG') {
                return;
            }
        }

        // Open YAMG
        vscode.env.openExternal(vscode.Uri.parse('https://yamgen.com/'));
    });
    context.subscriptions.push(checkAndOpenYAMGCmd);

}

module.exports = {
    activate
};

const vscode = require('vscode');
const path = require('path');
const { exists, readFile, writeFile, mkdir } = require('../utils/fsUtils');
const { generateSubsystemCode } = require('../generators/subsystem');
const { checkVendordeps } = require('../generators/hardware');

// Helper from extension.js (duplicated or shared? - duplicating for now to avoid circular dep or creating another shared file)
function getConstantsFileName() {
    const config = vscode.workspace.getConfiguration('frcPlugin');
    return config.get('constantsFileName', 'RobotMap.java');
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
    const createSubsystemCmd = vscode.commands.registerCommand('frc-workbench.createSubsystem', async () => {
        const panel = vscode.window.createWebviewPanel(
            'subsystemWizard',
            'Subsystem Creator',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // View Loader Helper
        const loadView = async (viewName) => {
            const fileName = viewName === 'hub' ? 'yamsHub.html' : 'subsystemWizard.html';
            const htmlPath = path.join(context.extensionPath, 'src', 'webviews', fileName);
            panel.webview.html = await readFile(htmlPath);
        };

        // Initial Load
        await loadView('wizard');

        // Check for installed vendordeps
        const checkVendors = async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) return [];

            const rootPath = workspaceFolders[0].uri.fsPath;
            const vendorPath = path.join(rootPath, 'vendordeps');
            const installedVendors = [];

            if (await exists(vendorPath)) {
                try {
                    const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(vendorPath));
                    for (const [file] of files) {
                        if (file.endsWith('.json')) {
                            const lowerFile = file.toLowerCase();
                            // Simple check
                            if (lowerFile.includes('phoenix6')) installedVendors.push('Phoenix6');
                            // Detect Phoenix 5 (legacy) - usually just "Phoenix.json" or similar, but NOT Phoenix6
                            if (lowerFile.includes('phoenix') && !lowerFile.includes('phoenix6')) installedVendors.push('Phoenix');
                            if (lowerFile.includes('revlib')) installedVendors.push('REVLib');
                            if (lowerFile.includes('navx') || lowerFile.includes('studica')) installedVendors.push('NavX');
                            if (lowerFile.includes('redux')) installedVendors.push('ReduxLib');
                            // Add more heuristics as needed
                        }
                    }
                } catch (e) {
                    console.error("Error reading vendordeps:", e);
                }
            }
            return [...new Set(installedVendors)]; // Unique
        };

        const vendors = await checkVendors();
        panel.webview.postMessage({ command: 'updateVendordeps', vendors: vendors });

        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'generate':
                        await generateSubsystem(message.data);
                        panel.dispose();
                        return;

                    case 'openYAMG':
                        // Check for YAMS library
                        const workspaceFolders = vscode.workspace.workspaceFolders;
                        if (workspaceFolders) {
                            const rootPath = workspaceFolders[0].uri.fsPath;
                            const vendorPath = path.join(rootPath, 'vendordeps');
                            let hasYAMS = false;
                            if (await exists(vendorPath)) {
                                try {
                                    const files = await vscode.workspace.fs.readDirectory(vscode.Uri.file(vendorPath));
                                    hasYAMS = files.some(([name]) => name.toLowerCase().includes('yams') && name.endsWith('.json'));
                                } catch (e) { console.error(e); }
                            }

                            if (!hasYAMS) {
                                const selection = await vscode.window.showWarningMessage(
                                    'YAMS library not found! You need it to use YAMG generated code.',
                                    'Download YAMS',
                                    'Ignore & Continue'
                                );
                                if (selection === 'Download YAMS') {
                                    vscode.env.openExternal(vscode.Uri.parse('https://yagsl.gitbook.io/yams/'));
                                    return;
                                } else if (selection !== 'Ignore & Continue') {
                                    return;
                                }
                            }
                        }
                        // Switch to Hub
                        await loadView('hub');
                        return;

                    case 'launchYamg':
                        vscode.env.openExternal(vscode.Uri.parse('https://yamgen.com/'));
                        return;

                    case 'generateYAMS':
                        // Imports for YAMS generation if needed, or pass logic?
                        // generateYAMSSubsystem was imported in extension.js. Needs to be imported here.
                        const { generateYAMSSubsystem } = require('../generators/yams');
                        const wf = vscode.workspace.workspaceFolders;
                        if (wf) {
                            await generateYAMSSubsystem(message.data, wf[0].uri.fsPath);
                        }
                        return;

                    case 'backToWizard':
                        await loadView('wizard');
                        const v = await checkVendors();
                        panel.webview.postMessage({ command: 'updateVendordeps', vendors: v });
                        return;

                    case 'openVendorUrl':
                        const url = message.url;
                        if (url) {
                            vscode.env.openExternal(vscode.Uri.parse(url));
                        }
                        return;

                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(createSubsystemCmd);
}

/**
 * @param {Object} data
 */
async function generateSubsystem(data) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        vscode.window.showErrorMessage('No workspace open');
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const subsystemsPath = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', 'subsystems');

    // Check Vendor Deps
    const missingDeps = await checkVendordeps(rootPath, data.hardware.map(h => h.import || ''));
    if (missingDeps.length > 0) {
        const action = await vscode.window.showWarningMessage(
            `Missing libraries: ${missingDeps.join(', ')}. Would you like to open the Vendor Library Manager to install them?`,
            'Open Manager', 'Ignore'
        );
        if (action === 'Open Manager') {
            vscode.commands.executeCommand('wpilibcore.manageVendorLibraries');
            return; // Abort generation so user can install
        }
    }

    // Create directory if it doesn't exist
    if (!(await exists(subsystemsPath))) {
        if (await exists(path.join(rootPath, 'src', 'main', 'java'))) {
            await mkdir(subsystemsPath);
        } else {
            vscode.window.showErrorMessage('Could not locate src/main/java. Is this a WPILib project?');
            return;
        }
    }

    // Custom PID Wrapper Check
    if (data.subsystemType === 'pid' && data.pidConfig?.useTuneable) {
        const type = data.pidConfig.isProfiled ? 'profiled' : 'standard';
        await vscode.commands.executeCommand('frc-workbench.installCustomPID', type);
    }

    // Generate Code
    const constantsFileName = getConstantsFileName();
    const constantsClassName = constantsFileName.replace(/\.java$/, '');
    data.constantsClassName = constantsClassName;

    const { code: fileContent, constants } = generateSubsystemCode(data);

    // Handle auto-append
    let className = data.subsystemName;
    if (data.autoAppend && !className.endsWith('Subsystem')) {
        className += 'Subsystem';
    }
    const fileName = `${className}.java`;
    const filePath = path.join(subsystemsPath, fileName);

    await writeFile(filePath, fileContent);

    // Save Constants if generated
    if (constants && constants.length > 0) {
        try {
            const fileName = getConstantsFileName();
            const constantsPath = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', fileName);
            const constantsClassName = fileName.replace(/\.java$/, '');

            let content = '';
            if (await exists(constantsPath)) {
                content = await readFile(constantsPath);
            } else {
                // Create skeleton if missing
                content = `package frc.robot;

/**
 * The ${constantsClassName} is a mapping from the ports sensors and actuators are wired into
 * to a variable name. This provides flexibility changing wiring.
 */
public final class ${constantsClassName} {
}
`;
            }

            // Simple check if class already exists to avoid duplication
            const constClassName = `${className}Constants`;
            if (!content.includes(`class ${constClassName}`)) {
                // Logic to insert the new class
                const newConstants = constants; // Array of { name, value, type }

                // Insert before the last brace of the outer class
                const lastBrace = content.lastIndexOf('}');
                if (lastBrace !== -1) {
                    const classBlock = `    public static final class ${constClassName} {\n` +
                        newConstants.map(c => `        public static final ${c.type} ${c.name} = ${c.value};`).join('\n') +
                        `\n    }\n\n`;
                    const newContent = content.slice(0, lastBrace) + classBlock + content.slice(lastBrace);
                    await writeFile(constantsPath, newContent);
                    vscode.window.showInformationMessage(`Added ${constClassName} to ${fileName}!`);
                }
            }
        } catch (e) {
            console.error('Failed to save to constants', e);
            vscode.window.showWarningMessage('Could not save constants to file: ' + e.message);
        }
    }

    vscode.window.showInformationMessage(`Subsystem ${className} generated successfully!`);

    // Open the file
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
}

module.exports = {
    activate
};

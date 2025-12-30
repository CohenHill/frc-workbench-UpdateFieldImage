const vscode = require('vscode');
const path = require('path');
const { exists, readFile, writeFile, mkdir } = require('../utils/fsUtils');

// Helper to get configured file name
function getConstantsFileName() {
    const config = vscode.workspace.getConfiguration('frcPlugin');
    return config.get('constantsFileName', 'RobotMap.java');
}

function parseConstants(content) {
    const modules = [];
    // Adjusted regex to handle arbitrary spacing better
    const classRegex = /public static final class (\w+)[\s]*\{([^}]*)\}/g;

    let match;
    while ((match = classRegex.exec(content)) !== null) {
        const className = match[1];
        const body = match[2];
        const constants = [];

        const fieldRegex = /public static final (\w+) (\w+) = ([^;]+);/g;
        let fieldMatch;
        while ((fieldMatch = fieldRegex.exec(body)) !== null) {
            constants.push({
                type: fieldMatch[1],
                name: fieldMatch[2],
                value: fieldMatch[3].trim()
            });
        }

        modules.push({ name: className, constants });
    }

    return { modules };
}

function generateConstantsCode(data) {
    const modulesStr = data.modules.map(m => {
        const consts = m.constants.map(c => `        public static final ${c.type} ${c.name} = ${c.value};`).join('\n');
        return `    public static final class ${m.name} {\n${consts}\n    }`;
    }).join('\n\n');

    const config = vscode.workspace.getConfiguration('frcPlugin');
    const fileName = config.get('constantsFileName', 'RobotMap.java');
    const className = fileName.replace('.java', '');

    const comment = fileName === 'RobotMap.java'
        ? '/**\n * The RobotMap is a mapping from the ports sensors and actuators are wired into\n * to a variable name. This provides flexibility changing wiring.\n */'
        : '/**\n * The Constants class provides a convenient place for teams to hold robot-wide\n * numerical or boolean constants.\n */';

    return `package frc.robot;

${comment}
public final class ${className} {
${modulesStr}
}
`;
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

    // 1. CodeLens Provider for Constants file
    const codeLensProvider = {
        provideCodeLenses(document) {
            const fileName = getConstantsFileName();
            if (document.fileName.endsWith(fileName)) {
                const topOfFile = new vscode.Range(0, 0, 0, 0);
                const title = "Open Constants Manager";
                const command = {
                    title: title,
                    command: "frc-workbench.manageConstants",
                    arguments: []
                };
                return [new vscode.CodeLens(topOfFile, command)];
            }
            return [];
        }
    };
    context.subscriptions.push(vscode.languages.registerCodeLensProvider({ language: 'java' }, codeLensProvider));

    // 2. Show notification when constants file is opened
    vscode.workspace.onDidOpenTextDocument(async (document) => {
        const fileName = getConstantsFileName();
        if (document.fileName.endsWith(fileName)) {
            const config = vscode.workspace.getConfiguration('frcPlugin');
            /** @type {string} */
            const autoOpenSetting = config.get('autoOpenManager', 'ask');

            if (autoOpenSetting === 'always') {
                // Auto-open manager
                vscode.commands.executeCommand('frc-workbench.manageConstants');
            } else if (autoOpenSetting === 'ask') {
                // Show notification
                const choice = await vscode.window.showInformationMessage(
                    `Open ${fileName} Manager?`,
                    'Open Manager',
                    'Just Code',
                    'Open Settings'
                );

                if (choice === 'Open Manager') {
                    vscode.commands.executeCommand('frc-workbench.manageConstants');
                } else if (choice === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'frcPlugin');
                }
            }
            // If 'never', do nothing
        }
    }, null, context.subscriptions);


    const manageConstantsCmd = vscode.commands.registerCommand('frc-workbench.manageConstants', async () => {
        const panel = vscode.window.createWebviewPanel(
            'constantsManager',
            'RobotMap Manager',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const htmlPath = path.join(context.extensionPath, 'src', 'webviews', 'constantsManager.html');
        panel.webview.html = await readFile(htmlPath);

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const rootPath = workspaceFolders[0].uri.fsPath;
            const fileName = getConstantsFileName();
            const constantsPath = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', fileName);

            // Load Init
            if (await exists(constantsPath)) {
                const content = await readFile(constantsPath);
                const parsedData = parseConstants(content);
                panel.webview.postMessage({ command: 'load', data: parsedData });
            }

            // Handle Messages
            panel.webview.onDidReceiveMessage(async message => {
                if (message.command === 'save') {
                    const javaCode = generateConstantsCode(message.data);
                    const dir = path.dirname(constantsPath);
                    if (!(await exists(dir))) await mkdir(dir);
                    await writeFile(constantsPath, javaCode);
                    vscode.window.showInformationMessage(`${fileName} updated!`);

                    // Reload the data from the file we just saved
                    const updatedContent = await readFile(constantsPath);
                    const updatedData = parseConstants(updatedContent);
                    panel.webview.postMessage({ command: 'load', data: updatedData });
                } else if (message.command === 'requestNewModule') {
                    // Native VS Code Input Box
                    const name = await vscode.window.showInputBox({
                        prompt: "Enter Module Name",
                        placeHolder: "e.g. SwerveModule"
                    });
                    if (name) {
                        panel.webview.postMessage({ command: 'newModuleCreated', name: name });
                    }
                }
            });
        }
    });


    context.subscriptions.push(manageConstantsCmd);

    // Command to open manager and close the text editor
    const openManagerFromEditor = vscode.commands.registerCommand('frc-workbench.openManagerFromEditor', async () => {
        // Close the active editor if it's the constants file
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const fileName = getConstantsFileName();
            if (activeEditor.document.fileName.endsWith(fileName)) {
                await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
            }
        }
        // Open the manager
        vscode.commands.executeCommand('frc-workbench.manageConstants');
    });

    context.subscriptions.push(openManagerFromEditor);
}

module.exports = {
    activate
};

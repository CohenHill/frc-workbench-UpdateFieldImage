const vscode = require('vscode');
const path = require('path');
const { exists, readFile, writeFile, mkdir } = require('../utils/fsUtils');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

    const createCommandGroupCmd = vscode.commands.registerCommand('frc-workbench.createCommandGroup', async () => {
        const panel = vscode.window.createWebviewPanel(
            'commandComposer',
            'Command Composer',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const htmlPath = path.join(context.extensionPath, 'src', 'webviews', 'commandComposer.html');
        panel.webview.html = await readFile(htmlPath);

        panel.webview.onDidReceiveMessage(
            async message => {
                if (message.command === 'generate') {
                    await generateCommandGroup(message.data);
                    panel.dispose();
                }
            },
            undefined,
            context.subscriptions
        );
    });

    context.subscriptions.push(createCommandGroupCmd);
}

async function generateCommandGroup(data) {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) return;

    const rootPath = workspaceFolders[0].uri.fsPath;
    const commandsPath = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', 'commands');

    if (!(await exists(commandsPath))) {
        if (await exists(path.join(rootPath, 'src', 'main', 'java'))) {
            await mkdir(commandsPath);
        }
    }

    const className = data.name;
    const fileName = `${className}.java`;
    const filePath = path.join(commandsPath, fileName);

    const commandsCode = data.commands.map(cmd => {
        if (cmd.includes('WaitSeconds')) return `          new WaitCommand(1.0)`; // simplified logic
        return `          new InstantCommand(() -> System.out.println("${cmd}"))`;
    }).join(',\n');

    const content = `package frc.robot.commands;

import edu.wpi.first.wpilibj2.command.SequentialCommandGroup;
import edu.wpi.first.wpilibj2.command.InstantCommand;
import edu.wpi.first.wpilibj2.command.WaitCommand;

public class ${className} extends SequentialCommandGroup {
  public ${className}() {
    addCommands(
${commandsCode}
    );
  }
}
`;

    await writeFile(filePath, content);
    vscode.window.showInformationMessage(`CommandGroup ${className} generated!`);
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
}

module.exports = {
    activate
};

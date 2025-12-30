const vscode = require('vscode');
const path = require('path');
const { Client } = require('wpilib-nt-client');
const { exists, readFile, writeFile, mkdir } = require('../utils/fsUtils');

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

    // PID Tuner Command
    const pidTunerCmd = vscode.commands.registerCommand('frc-workbench.pidTuner', async () => {
        const panel = vscode.window.createWebviewPanel(
            'pidTuner',
            'PID Tuner',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        const htmlPath = path.join(context.extensionPath, 'src', 'webviews', 'pidTuner.html');
        let htmlContent = await readFile(htmlPath);
        panel.webview.html = htmlContent;

        const client = new Client();
        const controllers = new Map(); // Name -> BasePath
        const ntData = new Map(); // Key -> Value (Global Cache)
        /** @type {Set<string>} */
        const announcedControllers = new Set();

        function pushControllers() {
            panel.webview.postMessage({
                command: 'controllers',
                controllers: Array.from(controllers.keys()).sort()
            });
        }

        /**
         * Try to register a controller path (base path that contains p/i/d entries).
         * @param {string} basePath
         */
        function registerControllerPath(basePath) {
            const name = basePath.split('/').pop();
            if (!name) return;
            if (!controllers.has(name)) {
                controllers.set(name, basePath);
            }
            if (!announcedControllers.has(name)) {
                announcedControllers.add(name);
                console.log(`[PID Tuner] Found controller '${name}' at '${basePath}'`);
                pushControllers();
            }
        }

        /**
         * Heuristic detection for WPILib PID sendables.
         * WPILib commonly publishes Sendables under:
         *  - /SmartDashboard/<Name>/.name
         *  - /Shuffleboard/<Tab>/<Widget>/.name
         *  - /SmartDashboard/PIDTuning/<Name>/.name (our hidden group)
         */
        function tryDetectFromKey(key, val) {
            // Primary: /.name value is typically the sendable name.
            if (key.endsWith('/.name') && typeof val === 'string') {
                // basePath is the table containing sendable properties
                const basePath = key.substring(0, key.length - '/.name'.length);
                // Only accept our hidden group or paths that look like Sendable tables
                if (
                    basePath.startsWith('/SmartDashboard/PIDTuning/') ||
                    basePath.startsWith('/SmartDashboard/') ||
                    basePath.startsWith('/Shuffleboard/')
                ) {
                    registerControllerPath(basePath);
                }
                return;
            }

            // Fallback: some setups may still provide /.type
            if (key.endsWith('/.type') && val === 'PIDController') {
                registerControllerPath(key.substring(0, key.length - '/.type'.length));
                return;
            }
        }

        // Listener for new entries
        client.addListener((key, val, valType) => {
            // Log all keys for debugging
            console.log(`NT Update: ${key} = ${val} (${valType})`);

            // Validate key
            if (!key) return;

            // Update cache
            ntData.set(key, val);

            // Check if this update belongs to a known controller and notify webview
            for (const [name, basePath] of controllers) {
                if (key.startsWith(basePath + '/')) {
                    const param = key.substring(basePath.length + 1);
                    // Filter out metadata if needed, though webview handles it
                    if (!param.startsWith('.')) {
                        panel.webview.postMessage({
                            command: 'pidValues',
                            controller: name,
                            values: { [param]: val }
                        });
                    }
                }
            }

            tryDetectFromKey(key, val);
        });

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'connect':
                        let address = message.address;
                        // If it's a team number (e.g. 1234), convert to 10.12.34.2
                        if (!address.includes('.') && !address.includes(':') && address !== 'localhost') {
                            const team = parseInt(address);
                            if (!isNaN(team)) {
                                const te = Math.floor(team / 100);
                                const am = team % 100;
                                address = `10.${te}.${am}.2`;
                            }
                        }

                        // Handle localhost explicitly
                        if (address === 'localhost') address = '127.0.0.1';

                        client.start((isConnected, err) => {
                            panel.webview.postMessage({ command: 'connectionStatus', connected: isConnected });
                            if (err) {
                                vscode.window.showErrorMessage(`Connection failed: ${err}`);
                            }
                            // After connecting, clear any stale list and wait for updates.
                            // Some NT servers won't replay retained values until after subscription.
                            // The listener will populate controllers as values arrive.
                        }, address);
                        break;

                    case 'refresh':
                        // Force UI to update with whatever we've already seen.
                        panel.webview.postMessage({
                            command: 'controllers',
                            controllers: Array.from(controllers.keys()).sort()
                        });
                        break;

                    case 'getValues':
                        const name = message.controller;
                        const basePath = controllers.get(name);
                        if (basePath) {
                            const values = {};
                            // Iterate over all known keys to find ones belonging to this controller
                            for (const [key, val] of ntData.entries()) {
                                if (key.startsWith(basePath + '/')) {
                                    const prop = key.substring(basePath.length + 1);
                                    // Filter out metadata or deep nested keys if desired
                                    if (!prop.startsWith('.')) {
                                        values[prop] = val;
                                    }
                                }
                            }

                            panel.webview.postMessage({
                                command: 'pidValues',
                                controller: name,
                                values: values
                            });
                        }
                        break;

                    case 'updatePID':
                        const controllerName = message.controller;
                        const param = message.param; // Generic param name (kP, kI, maxVel, etc)
                        const value = message.value;

                        const controllerPath = controllers.get(controllerName);
                        if (controllerPath) {
                            // Direct update to the key
                            const fullKey = controllerPath + '/' + param;
                            // Update local cache immediately for responsiveness
                            ntData.set(fullKey, value);
                            client.Assign(value, fullKey);
                        }
                        break;

                    case 'save':
                        try {
                            const workspaceFolders = vscode.workspace.workspaceFolders;
                            if (!workspaceFolders) {
                                vscode.window.showErrorMessage('No workspace open');
                                return;
                            }

                            const rootPath = workspaceFolders[0].uri.fsPath;
                            const config = vscode.workspace.getConfiguration('frcPlugin');
                            const fileName = config.get('constantsFileName', 'RobotMap.java');
                            const constantsPath = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', fileName);
                            const dir = path.dirname(constantsPath);
                            if (!(await exists(dir))) await mkdir(dir);

                            const controller = message.controller;
                            const values = message.values || {};
                            // values is now a dynamic object { kP: 0.1, kI: 0, ... }

                            let content = '';
                            if (await exists(constantsPath)) {
                                content = await readFile(constantsPath);
                            }

                            // If file doesn't exist or isn't a Java constants file yet, create a minimal skeleton.
                            if (!content.includes('class ') || !content.includes('package frc.robot')) {
                                content = `package frc.robot;\n\npublic final class ${fileName.replace(/\.java$/i, '')} {\n  private ${fileName.replace(/\.java$/i, '')}() {}\n}\n`;
                            }

                            // Ensure PIDConstants class exists.
                            if (!/public\s+static\s+final\s+class\s+PIDConstants\s*\{/.test(content)) {
                                // Insert before last closing brace of the outer class.
                                const idx = content.lastIndexOf('}');
                                if (idx !== -1) {
                                    const block =
                                        `\n\n  public static final class PIDConstants {\n` +
                                        `    private PIDConstants() {}\n` +
                                        `  }\n`;
                                    content = content.slice(0, idx) + block + content.slice(idx);
                                }
                            }

                            // Insert/update the controller inner class.
                            const safeName = String(controller || 'Controller').replace(/[^A-Za-z0-9_]/g, '_');
                            const innerClassName = `${safeName}PID`;

                            // Dynamic Generation for PIDConstants
                            const pidBlockLines = [
                                `\n    public static final class ${innerClassName} {`
                            ];

                            // Iterate over all values to generate constants
                            for (const [key, val] of Object.entries(values)) {
                                // Filter out non-numeric likely-metadata
                                if (typeof val === 'number') {
                                    // Ensure key is a valid Java identifier
                                    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)) {
                                        pidBlockLines.push(`      public static final double ${key} = ${val};`);
                                    }
                                }
                            }
                            pidBlockLines.push(`      private ${innerClassName}() {}`);
                            pidBlockLines.push(`    }\n`);

                            const pidBlock = pidBlockLines.join('\n');

                            // Replace existing block if present.
                            const pidConstantsStart = content.search(/public\s+static\s+final\s+class\s+PIDConstants\s*\{/);
                            if (pidConstantsStart !== -1) {
                                // Find scope of PIDConstants class (naive brace matching).
                                let i = content.indexOf('{', pidConstantsStart);
                                let depth = 0;
                                let end = -1;
                                for (; i < content.length; i++) {
                                    const ch = content[i];
                                    if (ch === '{') depth++;
                                    else if (ch === '}') {
                                        depth--;
                                        if (depth === 0) {
                                            end = i;
                                            break;
                                        }
                                    }
                                }

                                if (end !== -1) {
                                    const pidConstantsBody = content.slice(pidConstantsStart, end + 1);
                                    const existingClassRe = new RegExp(`public\\s+static\\s+final\\s+class\\s+${innerClassName}\\s*\\{[\\s\\S]*?\\n\\s*\\}`, 'm');
                                    let newPidConstantsBody;
                                    if (existingClassRe.test(pidConstantsBody)) {
                                        newPidConstantsBody = pidConstantsBody.replace(existingClassRe, pidBlock.trim());
                                    } else {
                                        // Insert before the closing brace of PIDConstants
                                        const insertAt = pidConstantsBody.lastIndexOf('}');
                                        newPidConstantsBody = pidConstantsBody.slice(0, insertAt) + pidBlock + pidConstantsBody.slice(insertAt);
                                    }

                                    content = content.slice(0, pidConstantsStart) + newPidConstantsBody + content.slice(end + 1);
                                }
                            }

                            await writeFile(constantsPath, content);
                            vscode.window.showInformationMessage(`Saved ${controller} PID values to ${fileName}`);
                            panel.webview.postMessage({ command: 'saveResult', ok: true });
                        } catch (e) {
                            vscode.window.showErrorMessage(`Failed to save PID constants: ${e?.message ?? e}`);
                            panel.webview.postMessage({ command: 'saveResult', ok: false, error: String(e?.message ?? e) });
                        }
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        panel.onDidDispose(() => {
            client.destroy();
        }, null, context.subscriptions);
    });
    context.subscriptions.push(pidTunerCmd);


    const installCustomPIDCmd = vscode.commands.registerCommand('frc-workbench.installCustomPID', async (type) => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('No workspace open');
            return;
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const libPath = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', 'lib');

        try {
            if (!(await exists(libPath))) {
                await mkdir(libPath);
            }

            const isProfiled = type === 'profiled';
            const controllerName = isProfiled ? 'TuneableProfiledPIDController' : 'TuneablePIDController';

            // List of files to copy
            // TuneablePIDSubsystem depends on TuneablePIDController, so we must ensure it's present.
            const filesToCopy = new Set(['TuneablePIDController', 'TuneablePIDSubsystem', 'StallDetector']);
            if (isProfiled) filesToCopy.add('TuneableProfiledPIDController');

            for (const className of filesToCopy) {
                const templatePath = path.join(context.extensionPath, 'src', 'templates', `${className}.java`);
                const destPath = path.join(libPath, `${className}.java`);

                // Overwrite existing files as requested
                // if (await exists(destPath)) { continue; }

                const content = await readFile(templatePath);
                await writeFile(destPath, content);
                vscode.window.showInformationMessage(`${className}.java created in ${libPath}.`);
            }

            // Open the controller file
            const destPath = path.join(libPath, `${controllerName}.java`);
            const doc = await vscode.workspace.openTextDocument(destPath);
            await vscode.window.showTextDocument(doc);

        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create PID wrapper: ${error.message}`);
        }
    });
    context.subscriptions.push(installCustomPIDCmd);
}

module.exports = {
    activate
};

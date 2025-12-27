const vscode = require('vscode');
const fs = require('fs');
const path = require('path');
const { Client } = require('wpilib-nt-client');
const PathPlannerPreviewProvider = require('./src/extension/pathPlannerPreviewProvider');
const AutoPreviewProvider = require('./src/extension/autoPreviewProvider');

// Persistent state key
const ALWAYS_OPEN_MANAGER_KEY = "frcplugin.alwaysOpenManager";

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('FRC Plugin Active');

	// Register PathPlanner Preview Provider
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider(
			'frc-vs-code-plugin.pathPlannerPreview',
			new PathPlannerPreviewProvider(context),
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
				supportsMultipleEditorsPerDocument: false,
			}
		)
	);

	// Register Auto Preview Provider
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider(
			'frc-vs-code-plugin.autoPreview',
			new AutoPreviewProvider(context),
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
				supportsMultipleEditorsPerDocument: false,
			}
		)
	);

	// Helper to get configured file name
	function getConstantsFileName() {
		const config = vscode.workspace.getConfiguration('frcPlugin');
		return config.get('constantsFileName', 'RobotMap.java');
	}

	// 1. CodeLens Provider for Constants file
	const codeLensProvider = {
		provideCodeLenses(document, token) {
			const fileName = getConstantsFileName();
			if (document.fileName.endsWith(fileName)) {
				const topOfFile = new vscode.Range(0, 0, 0, 0);
				const title = "Open Constants Manager";
				const command = {
					title: title,
					command: "frc-vs-code-plugin.manageConstants",
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
				vscode.commands.executeCommand('frc-vs-code-plugin.manageConstants');
			} else if (autoOpenSetting === 'ask') {
				// Show notification
				const choice = await vscode.window.showInformationMessage(
					`Open ${fileName} Manager?`,
					'Open Manager',
					'Just Code',
					'Open Settings'
				);

				if (choice === 'Open Manager') {
					vscode.commands.executeCommand('frc-vs-code-plugin.manageConstants');
				} else if (choice === 'Open Settings') {
					vscode.commands.executeCommand('workbench.action.openSettings', 'frcPlugin');
				}
			}
			// If 'never', do nothing
		}
	}, null, context.subscriptions);


	const createSubsystemCmd = vscode.commands.registerCommand('frc-vs-code-plugin.createSubsystem', () => {
		const panel = vscode.window.createWebviewPanel(
			'subsystemWizard',
			'Create Advanced Subsystem',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);

		const htmlPath = path.join(context.extensionPath, 'src', 'webviews', 'subsystemWizard.html');
		let htmlContent = fs.readFileSync(htmlPath, 'utf8');

		// Inject VS Code API if needed or rely on acquireVsCodeApi in the file
		panel.webview.html = htmlContent;

		panel.webview.onDidReceiveMessage(
			async message => {
				switch (message.command) {
					case 'generate':
						await generateSubsystem(message.data);
						panel.dispose();
						return;
				}
			},
			undefined,
			context.subscriptions
		);
	});

	context.subscriptions.push(createSubsystemCmd);

	const wrapInstantCommandCmd = vscode.commands.registerCommand('frc-vs-code-plugin.wrapInstantCommand', () => {
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

	const manageConstantsCmd = vscode.commands.registerCommand('frc-vs-code-plugin.manageConstants', () => {
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
		panel.webview.html = fs.readFileSync(htmlPath, 'utf8');

		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (workspaceFolders) {
			const rootPath = workspaceFolders[0].uri.fsPath;
			const fileName = getConstantsFileName();
			const constantsPath = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', fileName);

			// Load Init
			if (fs.existsSync(constantsPath)) {
				const content = fs.readFileSync(constantsPath, 'utf8');
				const parsedData = parseConstants(content);
				panel.webview.postMessage({ command: 'load', data: parsedData });
			}

			// Handle Messages
			panel.webview.onDidReceiveMessage(async message => {
				if (message.command === 'save') {
					const javaCode = generateConstantsCode(message.data);
					const dir = path.dirname(constantsPath);
					if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
					fs.writeFileSync(constantsPath, javaCode);
					vscode.window.showInformationMessage(`${fileName} updated!`);

					// Reload the data from the file we just saved
					const updatedContent = fs.readFileSync(constantsPath, 'utf8');
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
	const openManagerFromEditor = vscode.commands.registerCommand('frc-vs-code-plugin.openManagerFromEditor', async () => {
		// Close the active editor if it's the constants file
		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {
			const fileName = getConstantsFileName();
			if (activeEditor.document.fileName.endsWith(fileName)) {
				await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			}
		}
		// Open the manager
		vscode.commands.executeCommand('frc-vs-code-plugin.manageConstants');
	});

	context.subscriptions.push(openManagerFromEditor);

	// Pre-Flight Checklist Command
	const preFlightChecklistCmd = vscode.commands.registerCommand('frc-vs-code-plugin.preFlightChecklist', () => {
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
		panel.webview.html = fs.readFileSync(htmlPath, 'utf8');

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
	const buildCodeCmd = vscode.commands.registerCommand('frc-vs-code-plugin.buildCode', () => {
		vscode.window.showInformationMessage('Building robot code...');
		vscode.commands.executeCommand('wpilibcore.buildCode');
	});

	context.subscriptions.push(buildCodeCmd);

	// Simulate Code Command
	const simulateCodeCmd = vscode.commands.registerCommand('frc-vs-code-plugin.simulateCode', () => {
		vscode.window.showInformationMessage('Starting robot simulation...');
		vscode.commands.executeCommand('wpilibcore.simulateCode');
	});

	context.subscriptions.push(simulateCodeCmd);

	// PID Tuner Command
	const pidTunerCmd = vscode.commands.registerCommand('frc-vs-code-plugin.pidTuner', () => {
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
		let htmlContent = fs.readFileSync(htmlPath, 'utf8');
		panel.webview.html = htmlContent;

		const client = new Client();
		const controllers = new Map(); // Name -> Path
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
		client.addListener((key, val, valType, msgType, id, flags) => {
			// Log all keys for debugging
			// (leave enabled for now; can be gated behind a setting later)
			console.log(`NT Update: ${key} = ${val} (${valType})`);

			tryDetectFromKey(key, val);
		});

		// Handle messages from the webview
		panel.webview.onDidReceiveMessage(
			message => {
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
							// Helper to get value safely
							const getVal = (...subKeys) => {
								for (const subKey of subKeys) {
									const id = client.getKeyID(basePath + '/' + subKey);
									if (id) return client.getEntry(id).val;
								}
								return 0;
							};

							panel.webview.postMessage({
								command: 'pidValues',
								controller: name,
								values: {
									kP: getVal('p', 'kP'),
									kI: getVal('i', 'kI'),
									kD: getVal('d', 'kD'),
									kF: getVal('f', 'kF')
								}
							});
						}
						break;

					case 'updatePID':
						const controllerName = message.controller;
						const param = message.param; // kP, kI, kD, kF
						const value = message.value;

						const controllerPath = controllers.get(controllerName);
						if (controllerPath) {
							// Support both WPILib naming conventions.
							const keyMap = {
								kP: ['p', 'kP'],
								kI: ['i', 'kI'],
								kD: ['d', 'kD'],
								kF: ['f', 'kF']
							};
							const keys = keyMap[param];
							if (keys) {
								// Prefer the key that already exists, otherwise write the first option.
								let targetKey = keys[0];
								for (const k of keys) {
									const existingId = client.getKeyID(controllerPath + '/' + k);
									if (existingId) {
										targetKey = k;
										break;
									}
								}
								client.Assign(value, controllerPath + '/' + targetKey);
							}
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
							const fileName = getConstantsFileName();
							const constantsPath = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', fileName);
							const dir = path.dirname(constantsPath);
							if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

							const controller = message.controller;
							const values = message.values || {};
							const kP = Number(values.kP ?? 0);
							const kI = Number(values.kI ?? 0);
							const kD = Number(values.kD ?? 0);
							const kF = Number(values.kF ?? 0);

							let content = '';
							if (fs.existsSync(constantsPath)) {
								content = fs.readFileSync(constantsPath, 'utf8');
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

							const pidBlock =
								`\n    public static final class ${innerClassName} {\n` +
								`      public static final double kP = ${kP};\n` +
								`      public static final double kI = ${kI};\n` +
								`      public static final double kD = ${kD};\n` +
								`      public static final double kF = ${kF};\n` +
								`      private ${innerClassName}() {}\n` +
								`    }\n`;

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

							fs.writeFileSync(constantsPath, content);
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

	const installCustomPIDCmd = vscode.commands.registerCommand('frc-vs-code-plugin.installCustomPID', async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) {
			vscode.window.showErrorMessage('No workspace open');
			return;
		}

		const rootPath = workspaceFolders[0].uri.fsPath;
		// Try to locate the robot package
		const libPath = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', 'lib');

		try {
			if (!fs.existsSync(libPath)) {
				fs.mkdirSync(libPath, { recursive: true });
			}

			const templatePath = path.join(context.extensionPath, 'src', 'templates', 'TuneablePIDController.java');
			const destPath = path.join(libPath, 'TuneablePIDController.java');

			if (fs.existsSync(destPath)) {
				const overwrite = await vscode.window.showWarningMessage(
					'TuneablePIDController.java already exists. Overwrite?',
					'Yes',
					'No'
				);
				if (overwrite !== 'Yes') {
					return;
				}
			}

			const content = fs.readFileSync(templatePath, 'utf8');
			fs.writeFileSync(destPath, content);

			vscode.window.showInformationMessage(`TuneablePIDController.java created in ${libPath}. You can now use it in your code.`);

			// Open the file
			const doc = await vscode.workspace.openTextDocument(destPath);
			await vscode.window.showTextDocument(doc);

		} catch (error) {
			vscode.window.showErrorMessage(`Failed to create TuneablePIDController: ${error.message}`);
		}
	});
	context.subscriptions.push(installCustomPIDCmd);

	// ...existing code...
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

async function generateCommandGroup(data) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) return;

	const rootPath = workspaceFolders[0].uri.fsPath;
	const commandsPath = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', 'commands');

	if (!fs.existsSync(commandsPath)) {
		if (fs.existsSync(path.join(rootPath, 'src', 'main', 'java'))) {
			fs.mkdirSync(commandsPath, { recursive: true });
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

	fs.writeFileSync(filePath, content);
	vscode.window.showInformationMessage(`CommandGroup ${className} generated!`);
	const doc = await vscode.workspace.openTextDocument(filePath);
	await vscode.window.showTextDocument(doc);
}

/**
 * @param {Object} data
 * @param {string} data.subsystemName
 * @param {string} data.subsystemType - 'generic' or 'pid'
 * @param {boolean} data.autoAppend
 * @param {boolean} data.singleton
 * @param {string} data.baseClass
 * @param {Array} data.hardware
 * @param {Object} [data.pidConfig] - Optional PID configuration (kP, kI, kD, kF, maxVelocity, maxAcceleration)
 */
async function generateSubsystem(data) {
	const workspaceFolders = vscode.workspace.workspaceFolders;
	if (!workspaceFolders) {
		vscode.window.showErrorMessage('No workspace open');
		return;
	}

	const rootPath = workspaceFolders[0].uri.fsPath;
	const subsystemsPath = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', 'subsystems');

	// Create directory if it doesn't exist
	if (!fs.existsSync(subsystemsPath)) {
		if (fs.existsSync(path.join(rootPath, 'src', 'main', 'java'))) {
			fs.mkdirSync(subsystemsPath, { recursive: true });
		} else {
			vscode.window.showErrorMessage('Could not locate src/main/java. Is this a WPILib project?');
			return;
		}
	}

	// Handle auto-append
	let className = data.subsystemName;
	if (data.autoAppend && !className.endsWith('Subsystem')) {
		className += 'Subsystem';
	}

	const fileName = `${className}.java`;
	const filePath = path.join(subsystemsPath, fileName);

	const imports = new Set();
	const declarations = [];
	const initializers = [];

	// Determine base class and imports
	const isPidSubsystem = data.subsystemType === 'pid';
	if (isPidSubsystem) {
		imports.add('edu.wpi.first.wpilibj2.command.ProfiledPIDSubsystem');
		imports.add('edu.wpi.first.math.controller.ProfiledPIDController');
		imports.add('edu.wpi.first.math.trajectory.TrapezoidProfile');
	} else {
		imports.add(`edu.wpi.first.wpilibj2.command.${data.baseClass}`);
	}

	// Process hardware devices
	data.hardware.forEach(device => {
		const { type, name, id, bus } = device;

		// Add imports based on device type
		if (type === 'TalonFX') imports.add('com.ctre.phoenix6.hardware.TalonFX');
		else if (type === 'TalonSRX') imports.add('com.ctre.phoenix.motorcontrol.can.TalonSRX');
		else if (type === 'VictorSPX') imports.add('com.ctre.phoenix.motorcontrol.can.VictorSPX');
		else if (type === 'CANSparkMax') {
			imports.add('com.revrobotics.CANSparkMax');
			imports.add('com.revrobotics.CANSparkMaxLowLevel.MotorType');
		}
		else if (type === 'Pigeon2') imports.add('com.ctre.phoenix6.hardware.Pigeon2');
		else if (type === 'CANCoder') imports.add('com.ctre.phoenix6.hardware.CANcoder');
		else if (type === 'DoubleSolenoid') {
			imports.add('edu.wpi.first.wpilibj.DoubleSolenoid');
			imports.add('edu.wpi.first.wpilibj.PneumaticsModuleType');
		}
		else if (type === 'Solenoid') {
			imports.add('edu.wpi.first.wpilibj.Solenoid');
			imports.add('edu.wpi.first.wpilibj.PneumaticsModuleType');
		}
		else if (type === 'DigitalInput') imports.add('edu.wpi.first.wpilibj.DigitalInput');
		else if (type === 'DutyCycleEncoder') imports.add('edu.wpi.first.wpilibj.DutyCycleEncoder');

		// Declarations
		declarations.push(`  private final ${type} ${name};`);

		// Initializers
		if (type === 'TalonFX') {
			initializers.push(`    ${name} = new TalonFX(${id}, "${bus}");`);
		} else if (type === 'CANSparkMax') {
			initializers.push(`    ${name} = new CANSparkMax(${id}, MotorType.kBrushless);`);
		} else if (type === 'DoubleSolenoid') {
			initializers.push(`    ${name} = new DoubleSolenoid(PneumaticsModuleType.CTREPCM, ${id}, ${parseInt(id) + 1});`);
		} else if (type === 'Solenoid') {
			initializers.push(`    ${name} = new Solenoid(PneumaticsModuleType.CTREPCM, ${id});`);
		} else {
			initializers.push(`    ${name} = new ${type}(${id});`);
		}
	});

	// Generate code based on subsystem type
	let fileContent;

	if (isPidSubsystem) {
		// Get PID config values
		const pid = data.pidConfig || {};
		const kP = pid.kP || '0.0';
		const kI = pid.kI || '0.0';
		const kD = pid.kD || '0.0';
		const kF = pid.kF || '0.0';
		const maxVel = pid.maxVelocity || '0.0';
		const maxAccel = pid.maxAcceleration || '0.0';

		// Add feedforward import if kF is non-zero
		if (parseFloat(kF) !== 0) {
			imports.add('edu.wpi.first.math.controller.SimpleMotorFeedforward');
		}

		// Profiled PID Subsystem
		fileContent = `package frc.robot.subsystems;

${Array.from(imports).map(i => `import ${i};`).join('\n')}

public class ${className} extends ProfiledPIDSubsystem {
${declarations.join('\n')}
${parseFloat(kF) !== 0 ? `  private final SimpleMotorFeedforward feedforward = new SimpleMotorFeedforward(${kF}, 0.0, 0.0);\n` : ''}
  public ${className}() {
    super(
      new ProfiledPIDController(
        ${kP}, // kP
        ${kI}, // kI
        ${kD}, // kD
        new TrapezoidProfile.Constraints(${maxVel}, ${maxAccel}) // Max velocity, max acceleration
      )
    );
${initializers.join('\n')}
  }

  @Override
  protected double getMeasurement() {
    // Return the process variable measurement here
    return 0.0;
  }

  @Override
  protected void useOutput(double output, TrapezoidProfile.State setpoint) {
    // Use the output (and setpoint, if desired) here
${parseFloat(kF) !== 0 ? `    double feedforwardOutput = feedforward.calculate(setpoint.velocity);\n    // Apply output + feedforwardOutput to your motor` : `    // Apply output to your motor`}
  }
}
`;
	} else if (data.singleton) {
		// Singleton pattern
		fileContent = `package frc.robot.subsystems;

${Array.from(imports).map(i => `import ${i};`).join('\n')}

public class ${className} extends ${data.baseClass} {
  private static ${className} instance;

${declarations.join('\n')}

  private ${className}() {
${initializers.join('\n')}
  }

  public static ${className} getInstance() {
    if (instance == null) {
      instance = new ${className}();
    }
    return instance;
  }

  @Override
  public void periodic() {
    // This method will be called once per scheduler run
  }
}
`;
	} else {
		// Generic subsystem
		fileContent = `package frc.robot.subsystems;

${Array.from(imports).map(i => `import ${i};`).join('\n')}

public class ${className} extends ${data.baseClass} {
${declarations.join('\n')}

  public ${className}() {
${initializers.join('\n')}
  }

  @Override
  public void periodic() {
    // This method will be called once per scheduler run
  }
}
`;
	}

	fs.writeFileSync(filePath, fileContent);
	vscode.window.showInformationMessage(`Subsystem ${className} generated successfully!`);

	// Open the file
	const doc = await vscode.workspace.openTextDocument(filePath);
	await vscode.window.showTextDocument(doc);
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
}

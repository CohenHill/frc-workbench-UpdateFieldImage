const vscode = require('vscode');
const path = require('path');
const { Client } = require('wpilib-nt-client');
const PathPlannerPreviewProvider = require('./src/extension/pathPlannerPreviewProvider');
const AutoPreviewProvider = require('./src/extension/autoPreviewProvider');
const { generateSubsystemCode } = require('./src/generators/subsystem');
const { generateYAMSSubsystem } = require('./src/generators/yams');
const { checkVendordeps } = require('./src/generators/hardware');
const { exists, readFile, writeFile, mkdir } = require('./src/utils/fsUtils');



// Helper to get configured file name
function getConstantsFileName() {
	const config = vscode.workspace.getConfiguration('frcPlugin');
	return config.get('constantsFileName', 'RobotMap.java');
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('FRC Workbench: Activating...');

	// Register PathPlanner Preview Provider
	context.subscriptions.push(
		vscode.window.registerCustomEditorProvider(
			'frc-workbench.pathPlannerPreview',
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
			'frc-workbench.autoPreview',
			new AutoPreviewProvider(context),
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
				supportsMultipleEditorsPerDocument: false,
			}
		)
	);



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
							const fileName = getConstantsFileName();
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

	console.log('FRC Workbench: Activation Complete!');
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

function deactivate() { }

module.exports = {
	activate,
	deactivate
}

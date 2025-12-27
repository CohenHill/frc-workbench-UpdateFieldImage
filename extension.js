const vscode = require('vscode');
const fs = require('fs');
const path = require('path');

// Persistent state key
const ALWAYS_OPEN_MANAGER_KEY = "frcplugin.alwaysOpenManager";

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log('FRC Plugin Active');

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
			'🎛️ PID Tuner',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);

		const htmlPath = path.join(context.extensionPath, 'src', 'webviews', 'pidTuner.html');
		panel.webview.html = fs.readFileSync(htmlPath, 'utf8');

		let ntClient = null;
		let isConnected = false;
		let pidControllers = {};

		// Handle messages from webview
		panel.webview.onDidReceiveMessage(async message => {
			switch (message.command) {
				case 'connect':
					try {
						// Import NetworkTables client
						const Client = require('wpilib-nt-client').Client;

						// Ask user for connection type
						const connectionType = await vscode.window.showQuickPick(
							['Localhost (Simulation)', 'Robot (10.TE.AM.2)', 'Custom IP'],
							{ placeHolder: 'Select connection type' }
						);

						if (!connectionType) return;

						let host = 'localhost';
						if (connectionType.includes('Robot')) {
							const teamNumber = await vscode.window.showInputBox({
								prompt: 'Enter team number',
								placeHolder: '201'
							});
							if (!teamNumber) return;
							const team = parseInt(teamNumber);
							host = `10.${Math.floor(team / 100)}.${team % 100}.2`;
						} else if (connectionType.includes('Custom')) {
							const customHost = await vscode.window.showInputBox({
								prompt: 'Enter robot IP address',
								placeHolder: '10.2.1.2'
							});
							if (!customHost) return;
							host = customHost;
						}

						// Create NetworkTables client
						ntClient = new Client();

						ntClient.on('connected', () => {
							isConnected = true;
							panel.webview.postMessage({
								command: 'connectionStatus',
								connected: true
							});
							vscode.window.showInformationMessage(`Connected to robot at ${host}`);

							// Scan for PID controllers
							setTimeout(() => scanForPIDControllers(), 1000);
						});

						ntClient.on('disconnected', () => {
							isConnected = false;
							panel.webview.postMessage({
								command: 'connectionStatus',
								connected: false
							});
						});

						ntClient.on('error', (err) => {
							vscode.window.showErrorMessage(`NetworkTables error: ${err.message}`);
						});

						// Listen for NT updates
						ntClient.addListener((key, value, flags) => {
							// Check if it's a PID value
							if (key.includes('/PID/')) {
								updatePIDFromNT(key, value);
							}
						});

						// Start connection
						ntClient.start((err, status) => {
							if (err) {
								vscode.window.showErrorMessage(`Failed to connect: ${err.message}`);
								panel.webview.postMessage({
									command: 'connectionStatus',
									connected: false
								});
							}
						}, host);

					} catch (error) {
						vscode.window.showErrorMessage(`Failed to connect: ${error.message}`);
						panel.webview.postMessage({
							command: 'connectionStatus',
							connected: false
						});
					}
					break;

				case 'getValues':
					if (isConnected && pidControllers[message.controller]) {
						panel.webview.postMessage({
							command: 'pidValues',
							controller: message.controller,
							values: pidControllers[message.controller]
						});
					} else {
						// Send default values
						panel.webview.postMessage({
							command: 'pidValues',
							controller: message.controller,
							values: { kP: 0.0, kI: 0.0, kD: 0.0, kF: 0.0 }
						});
					}
					break;

				case 'updatePID':
					if (isConnected && ntClient) {
						// Send to NetworkTables
						const ntKey = `/SmartDashboard/${message.controller}/PID/${message.param}`;
						ntClient.updateValue(ntKey, message.value);

						// Update local cache
						if (!pidControllers[message.controller]) {
							pidControllers[message.controller] = {};
						}
						pidControllers[message.controller][message.param] = message.value;
					}
					break;

				case 'save':
					// Save PID values to Constants file
					await savePIDToConstants(message.controller, message.values);
					vscode.window.showInformationMessage(`PID values for ${message.controller} saved to Constants!`);
					break;

				case 'refresh':
					if (isConnected) {
						scanForPIDControllers();
					}
					break;
			}
		});

		function scanForPIDControllers() {
			if (!ntClient) return;

			// Get all keys from NetworkTables
			const keys = ntClient.getKeys();
			const controllers = new Set();

			// Look for PID-related keys
			keys.forEach(key => {
				if (key.includes('/PID/') || key.includes('PIDController')) {
					// Extract controller name
					const parts = key.split('/');
					const controllerName = parts.find(p => p && !p.includes('PID') && p !== 'SmartDashboard');
					if (controllerName) {
						controllers.add(controllerName);
					}
				}
			});

			// Send to webview
			panel.webview.postMessage({
				command: 'controllers',
				controllers: Array.from(controllers)
			});
		}

		function updatePIDFromNT(key, value) {
			// Parse key to get controller and parameter
			const parts = key.split('/');
			const controllerIndex = parts.findIndex(p => p === 'PID') - 1;
			if (controllerIndex < 0) return;

			const controller = parts[controllerIndex];
			const param = parts[parts.length - 1];

			if (!pidControllers[controller]) {
				pidControllers[controller] = {};
			}
			pidControllers[controller][param] = value;
		}

		// Cleanup on panel close
		panel.onDidDispose(() => {
			if (ntClient) {
				ntClient.stop();
			}
		});
	});

	context.subscriptions.push(pidTunerCmd);

	// Helper function to save PID values to Constants file
	async function savePIDToConstants(controller, values) {
		const workspaceFolders = vscode.workspace.workspaceFolders;
		if (!workspaceFolders) return;

		const rootPath = workspaceFolders[0].uri.fsPath;
		const fileName = getConstantsFileName();
		const constantsPath = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', fileName);

		if (!fs.existsSync(constantsPath)) {
			vscode.window.showErrorMessage('Constants file not found');
			return;
		}

		let content = fs.readFileSync(constantsPath, 'utf8');

		// Find or create PID constants class for this controller
		const className = `${controller}PID`;
		const pidClass = `
    public static final class ${className} {
        public static final double kP = ${values.kP};
        public static final double kI = ${values.kI};
        public static final double kD = ${values.kD};
        public static final double kF = ${values.kF || 0.0};
    }`;

		// Check if class already exists
		const classRegex = new RegExp(`public static final class ${className}[\\s]*\\{[^}]*\\}`, 'g');
		if (classRegex.test(content)) {
			// Update existing class
			content = content.replace(classRegex, pidClass.trim());
		} else {
			// Add new class before the last closing brace
			const lastBraceIndex = content.lastIndexOf('}');
			content = content.substring(0, lastBraceIndex) + '\n' + pidClass + '\n' + content.substring(lastBraceIndex);
		}

		fs.writeFileSync(constantsPath, content);
	}

	const createCommandGroupCmd = vscode.commands.registerCommand('frc-vs-code-plugin.createCommandGroup', () => {
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
		panel.webview.html = fs.readFileSync(htmlPath, 'utf8');

		panel.webview.onDidReceiveMessage(async message => {
			if (message.command === 'generate') {
				await generateCommandGroup(message.data);
				panel.dispose();
			}
		});
	});

	context.subscriptions.push(createCommandGroupCmd);
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

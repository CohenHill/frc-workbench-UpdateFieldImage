const vscode = require('vscode');
const PathPlannerPreviewProvider = require('./src/extension/pathPlannerPreviewProvider');
const AutoPreviewProvider = require('./src/extension/autoPreviewProvider');

// Import new modules
const subsystemWizard = require('./src/extension/subsystemWizard');
const pidTuner = require('./src/extension/pidTuner');
const constantsManager = require('./src/extension/constantsManager');
const commandComposer = require('./src/extension/commandComposer');
const utilityCommands = require('./src/extension/utilityCommands');

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

	// Activate modules
	subsystemWizard.activate(context);
	pidTuner.activate(context);
	constantsManager.activate(context);
	commandComposer.activate(context);
	utilityCommands.activate(context);

	console.log('FRC Workbench: Activation Complete!');
}

function deactivate() { }

module.exports = {
	activate,
	deactivate
}

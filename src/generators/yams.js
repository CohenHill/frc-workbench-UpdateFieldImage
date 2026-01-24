const vscode = require('vscode');
const path = require('path');
const Handlebars = require('handlebars');
const { readFile, writeFile, mkdir, exists } = require('../utils/fsUtils');

// Register the 'eq' helper for Handlebars conditionals
Handlebars.registerHelper('eq', function (a, b) {
    return a === b;
});

/**
 * Maps motor type dropdown values to DCMotor method suffixes
 */
const MOTOR_MODEL_MAP = {
    'Kraken X60': 'KrakenX60',
    'Talon FX': 'Falcon500',
    'Vortex': 'NeoVortex',
    'NEO': 'NEO',
    'NEO550': 'NEO550',
    'CIM': 'CIM',
    'MiniCIM': 'MiniCIM',
    'Bag': 'Bag',
    '775pro': 'Vex775Pro'
};

/**
 * Maps mechanism type to template filename
 */
const MECHANISM_TEMPLATES = {
    'Arm': 'Arm.java.hbs',
    'Pivot': 'Pivot.java.hbs',
    'Elevator': 'Elevator.java.hbs',
    'Shooter': 'Shooter.java.hbs',
    'Flywheel': 'Shooter.java.hbs'
};

/**
 * Generates a YAMS subsystem from wizard data
 * @param {Object} data - Data collected from the YAMS wizard
 * @param {string} rootPath - Workspace root path
 */
async function generateYAMSSubsystem(data, rootPath) {
    const extensionPath = vscode.extensions.getExtension('frc-workbench.frc-workbench')?.extensionPath
        || path.join(__dirname, '..', '..');

    // Determine mechanism type and template
    const mechType = data.mechType || data.yamsMechType || 'Arm';
    const templateFile = MECHANISM_TEMPLATES[mechType] || 'Arm.java.hbs';
    const templatePath = path.join(extensionPath, 'src', 'templates', templateFile);

    if (!(await exists(templatePath))) {
        vscode.window.showErrorMessage(`Template not found: ${templateFile}`);
        return;
    }

    // Read and compile template
    const templateSource = await readFile(templatePath);
    const template = Handlebars.compile(templateSource);

    // Ensure subsystem name ends with Subsystem
    let subsystemName = data.subsystemName || data.yamsSubsystemName || 'Subsystem';
    if (!subsystemName.endsWith('Subsystem')) {
        subsystemName += 'Subsystem';
    }
    // Capitalize first letter
    subsystemName = subsystemName.charAt(0).toUpperCase() + subsystemName.slice(1);

    // Map wizard data to template context
    const motorType = data.motorType || data.yamsMotorType || 'NEO';
    const controller = data.controller || data.yamsController || 'SparkMax';

    const context = {
        subsystemName: subsystemName,
        motorControllerType: controller,
        motorModel: MOTOR_MODEL_MAP[motorType] || 'NEO',
        canId: data.canId || data.yamsCanId || 1,
        controlMode: data.controlMode || data.yamsControlLoop || 'CLOSED_LOOP',

        // PID values
        pid: {
            kP: data.kP || data.yamsKp || '0.0',
            kI: data.kI || data.yamsKi || '0.0',
            kD: data.kD || data.yamsKd || '0.0',
            kF: data.kF || data.yamsKf || null
        },
        // Use same values for simulation if not specified
        simPid: {
            kP: data.simKp || data.kP || data.yamsKp || '0.0',
            kI: data.simKi || data.kI || data.yamsKi || '0.0',
            kD: data.simKd || data.kD || data.yamsKd || '0.0',
            kF: data.simKf || data.kF || data.yamsKf || null
        },

        // Feedforward values
        ff: {
            kS: data.kS || data.yamsKs || '0.0',
            kG: data.kG || data.yamsKg || '0.0',
            kV: data.kV || data.yamsKv || '0.0',
            kA: data.kA || data.yamsKa || null
        },
        simFf: {
            kS: data.simKs || data.kS || data.yamsKs || '0.0',
            kG: data.simKg || data.kG || data.yamsKg || '0.0',
            kV: data.simKv || data.kV || data.yamsKv || '0.0',
            kA: data.simKa || data.kA || data.yamsKa || null
        },

        // Motor configuration
        gearingStages: data.gearingStages || data.yamsGearing || '1.0',
        inverted: data.inverted || data.yamsInverted || false,
        idleMode: data.idleMode || data.yamsIdleMode || 'BRAKE',
        statorCurrentLimit: data.statorCurrentLimit || data.yamsStatorLimit || 40,
        supplyCurrentLimit: data.supplyCurrentLimit || data.yamsSupplyLimit || 40,
        rampRate: data.rampRate || data.yamsRampRate || '0.1',
        maxVelocity: data.maxVelocity || data.yamsMaxVelocity || '180',
        maxAcceleration: data.maxAcceleration || data.yamsMaxAcceleration || '90',

        // Arm-specific
        armLength: data.armLength || data.yamsArmLength || '0.5',
        mass: data.mass || data.yamsMass || '5',
        minSoftLimit: data.minSoftLimit || data.yamsMinSoftLimit || '-45',
        maxSoftLimit: data.maxSoftLimit || data.yamsMaxSoftLimit || '90',
        minHardLimit: data.minHardLimit || data.yamsMinHardLimit || '-60',
        maxHardLimit: data.maxHardLimit || data.yamsMaxHardLimit || '100',
        startingAngle: data.startingAngle || data.yamsStartingAngle || '0',
        horizontalZero: data.horizontalZero || data.yamsHorizontalZero || '0',

        // Elevator-specific
        startingHeight: data.startingHeight || data.yamsStartingHeight || '0',
        minHeight: data.minHeight || data.yamsMinHeight || '0',
        maxHeight: data.maxHeight || data.yamsMaxHeight || '1',
        mechanismCircumference: data.mechanismCircumference || data.yamsDrumDiameter || '0.1',

        // Shooter/Flywheel-specific
        flywheelDiameter: data.flywheelDiameter || data.yamsFlywheelDiameter || '4',
        flywheelMaxRpm: data.flywheelMaxRpm || data.yamsFlywheelMaxRpm || '5000'
    };

    // Render template
    const generatedCode = template(context);

    // Write to subsystems folder
    const subsystemsPath = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', 'subsystems');

    if (!(await exists(subsystemsPath))) {
        await mkdir(subsystemsPath);
    }

    const outputPath = path.join(subsystemsPath, `${subsystemName}.java`);
    await writeFile(outputPath, generatedCode);

    vscode.window.showInformationMessage(`Generated ${subsystemName}.java successfully!`);

    // Open the generated file
    const doc = await vscode.workspace.openTextDocument(outputPath);
    await vscode.window.showTextDocument(doc);
}

module.exports = { generateYAMSSubsystem };

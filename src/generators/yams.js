const vscode = require('vscode');
const path = require('path');
const Handlebars = require('handlebars');

/**
 * YAMS Generator - Fetches Handlebars templates from GitHub and generates Java code
 * 
 * Templates hosted at: https://github.com/riteshrajas/YAMS_Gen
 * - Arm.java.hbs       → yams.mechanisms.positional.Arm
 * - Pivot.java.hbs     → yams.mechanisms.positional.Pivot
 * - Elevator.java.hbs  → yams.mechanisms.positional.Elevator
 * - Shooter.java.hbs   → yams.mechanisms.velocity.FlyWheel
 * - SwerveDrive.java.hbs → yams.mechanisms.swerve.SwerveDrive
 */

// GitHub raw content base URL
const TEMPLATE_BASE_URL = 'https://raw.githubusercontent.com/riteshrajas/YAMS_Gen/main';

// Template mapping based on mechanism type
const MECHANISM_TEMPLATES = {
  'Arm': 'Arm.java.hbs',
  'Pivot': 'Pivot.java.hbs',
  'Elevator': 'Elevator.java.hbs',
  'Flywheel': 'Shooter.java.hbs',
  'Shooter': 'Shooter.java.hbs',
  'SwerveDrive': 'SwerveDrive.java.hbs',
  'Simple': 'Arm.java.hbs', // Fallback for simple mechanisms
  'Generic': 'Arm.java.hbs' // Fallback
};

// Motor controller type mapping (wizard input → template value)
const CONTROLLER_TYPE_MAP = {
  'TalonFX': 'TalonFX',
  'SparkMax': 'SparkMax',
  'SparkFlex': 'SparkMax', // SparkFlex uses same wrapper pattern
  'TalonFXS': 'TalonFXS',
  'Nova': 'Nova',
  'Kraken X60': 'TalonFX',
  'Talon FX': 'TalonFX',
  'Falcon 500': 'TalonFX'
};

// Motor model mapping (motor type → DCMotor suffix)
const MOTOR_MODEL_MAP = {
  'Kraken X60': 'KrakenX60',
  'Talon FX': 'Falcon500',
  'Falcon 500': 'Falcon500',
  'NEO': 'NEO',
  'NEO 1.1': 'NEO',
  'Vortex': 'NeoVortex',
  'NEO Vortex': 'NeoVortex',
  'NEO550': 'NEO550',
  'CIM': 'CIM',
  'MiniCIM': 'MiniCIM',
  'Bag': 'Bag',
  '775pro': '775Pro'
};

// Register Handlebars helpers
function registerHelpers() {
  // 'eq' helper for equality comparison
  Handlebars.registerHelper('eq', function (a, b) {
    return a === b;
  });

  // 'neq' helper for inequality
  Handlebars.registerHelper('neq', function (a, b) {
    return a !== b;
  });

  // 'or' helper
  Handlebars.registerHelper('or', function (a, b) {
    return a || b;
  });

  // 'and' helper
  Handlebars.registerHelper('and', function (a, b) {
    return a && b;
  });

  // 'default' helper for fallback values
  Handlebars.registerHelper('default', function (value, defaultValue) {
    return value !== undefined && value !== null && value !== '' ? value : defaultValue;
  });
}

/**
 * Fetch a template from GitHub
 * @param {string} templateName - Name of the template file (e.g., 'Arm.java.hbs')
 * @returns {Promise<string>} - Template content
 */
async function fetchTemplate(templateName) {
  const url = `${TEMPLATE_BASE_URL}/${templateName}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    throw new Error(`Could not fetch template '${templateName}' from GitHub: ${error.message}`);
  }
}

/**
 * Map wizard data to template-expected format for Arm mechanism
 * The new wizard sends data with properties already matching template names
 */
function mapToArmData(data) {
  const config = data.yamsConfig || {};

  return {
    subsystemName: data.subsystemName,
    motorControllerType: config.motorControllerType || 'TalonFX',
    motorModel: config.motorModel || 'KrakenX60',
    canId: config.canId || 1,

    inverted: config.inverted || false,
    idleMode: config.idleMode || 'BRAKE',
    gearingStages: config.gearingStages || '1',
    currentLimit: config.currentLimit || 40,
    rampRate: config.rampRate || 0.1,

    // PID - passed directly from wizard
    pid: config.pid || { kP: 0.6, kI: 0, kD: 0.02 },
    simPid: config.simPid || config.pid || { kP: 0.6, kI: 0, kD: 0.02 },

    // Feedforward - passed directly from wizard
    ff: config.ff || { kS: 0.2, kG: 0.4, kV: 1.1, kA: 0 },
    simFf: config.simFf || config.ff || { kS: 0.2, kG: 0.4, kV: 1.1, kA: 0 },

    // Arm-specific
    minSoftLimit: config.minSoftLimit || -45,
    maxSoftLimit: config.maxSoftLimit || 90,
    minHardLimit: config.minHardLimit || -60,
    maxHardLimit: config.maxHardLimit || 100,
    startingAngle: config.startingAngle || 0,
    armLength: config.armLength || 0.6,
    mass: config.armMass || 8
  };
}

/**
 * Map wizard data to template-expected format for Elevator mechanism
 */
function mapToElevatorData(data) {
  const config = data.yamsConfig || {};

  return {
    subsystemName: data.subsystemName,
    motorControllerType: config.motorControllerType || 'TalonFX',
    motorModel: config.motorModel || 'KrakenX60',
    canId: config.canId || 1,

    inverted: config.inverted || false,
    idleMode: config.idleMode || 'BRAKE',
    gearingStages: config.gearingStages || '1',
    currentLimit: config.currentLimit || 40,
    rampRate: config.rampRate || 0.1,

    mechanismCircumference: config.mechanismCircumference || 0.1,

    // PID - passed directly from wizard
    pid: config.pid || { kP: 0.6, kI: 0, kD: 0.02 },
    simPid: config.simPid || config.pid || { kP: 0.6, kI: 0, kD: 0.02 },

    // Feedforward - passed directly from wizard
    ff: config.ff || { kS: 0.2, kG: 0.8, kV: 1.0, kA: 0 },
    simFf: config.simFf || config.ff || { kS: 0.2, kG: 0.8, kV: 1.0, kA: 0 },

    // Elevator-specific
    startingHeight: config.startingHeight || 0,
    minHeight: config.minHeight || 0,
    maxHeight: config.maxHeight || 1.5,
    mass: config.elevatorMass || 10
  };
}

/**
 * Map wizard data to template-expected format for Shooter/Flywheel mechanism
 */
function mapToShooterData(data) {
  const config = data.yamsConfig || {};

  return {
    subsystemName: data.subsystemName,
    motorControllerType: config.motorControllerType || 'TalonFX',
    motorModel: config.motorModel || 'KrakenX60',
    canId: config.canId || 1,

    inverted: config.inverted || false,
    gearingStages: config.gearingStages || '1',
    currentLimit: config.currentLimit || 80,
    rampRate: config.rampRate || 0.1,

    // PID - passed directly from wizard (velocity control uses lower gains)
    pid: config.pid || { kP: 0.1, kI: 0, kD: 0 },
    simPid: config.simPid || config.pid || { kP: 0.1, kI: 0, kD: 0 },

    // Feedforward - no kG for velocity mechanisms
    ff: { kS: config.ff?.kS || 0.1, kV: config.ff?.kV || 0.12, kA: config.ff?.kA || 0 },
    simFf: { kS: config.simFf?.kS || 0.1, kV: config.simFf?.kV || 0.12, kA: config.simFf?.kA || 0 },

    // Flywheel-specific
    flywheelDiameter: config.flywheelDiameter || 4,
    mass: config.flywheelMass || 2,
    maxVelocity: config.maxVelocity || 6000
  };
}

/**
 * Map wizard data to template-expected format for Pivot mechanism
 */
function mapToPivotData(data) {
  const config = data.yamsConfig || {};

  // Pivot uses arm-like data but from pivot-specific fields
  return {
    subsystemName: data.subsystemName,
    motorControllerType: config.motorControllerType || 'TalonFX',
    motorModel: config.motorModel || 'KrakenX60',
    canId: config.canId || 1,

    inverted: config.inverted || false,
    idleMode: config.idleMode || 'BRAKE',
    gearingStages: config.gearingStages || '1',
    currentLimit: config.currentLimit || 40,
    rampRate: config.rampRate || 0.1,

    pid: config.pid || { kP: 0.6, kI: 0, kD: 0.02 },
    simPid: config.simPid || config.pid || { kP: 0.6, kI: 0, kD: 0.02 },

    ff: config.ff || { kS: 0.2, kG: 0.4, kV: 1.1, kA: 0 },
    simFf: config.simFf || config.ff || { kS: 0.2, kG: 0.4, kV: 1.1, kA: 0 },

    // Pivot-specific
    minSoftLimit: config.pivotMinAngle || -90,
    maxSoftLimit: config.pivotMaxAngle || 90,
    minHardLimit: (config.pivotMinAngle || -90) - 10,
    maxHardLimit: (config.pivotMaxAngle || 90) + 10,
    startingAngle: config.pivotStartAngle || 0,
    armLength: config.pivotLength || 0.3,
    mass: config.pivotMass || 4
  };
}


/**
 * Main YAMS Subsystem Generator
 * @param {Object} data - Data from the YAMS wizard
 * @param {string} rootPath - Workspace root path
 */
async function generateYAMSSubsystem(data, rootPath) {
  const { subsystemName, yamsConfig } = data;

  if (!subsystemName) {
    vscode.window.showErrorMessage('YAMS Generation Failed: Subsystem name is required.');
    return;
  }

  // Determine mechanism type
  const mechType = yamsConfig?.mechType || 'Arm';
  const templateName = MECHANISM_TEMPLATES[mechType];

  if (!templateName) {
    vscode.window.showErrorMessage(`YAMS Generation Failed: Unknown mechanism type '${mechType}'.`);
    return;
  }

  // Show progress
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Generating YAMS ${mechType} Subsystem...`,
    cancellable: false
  }, async (progress) => {
    try {
      // Register Handlebars helpers
      registerHelpers();

      // Step 1: Fetch template from GitHub
      progress.report({ message: 'Fetching template from GitHub...', increment: 20 });
      const templateSource = await fetchTemplate(templateName);

      // Step 2: Compile template
      progress.report({ message: 'Compiling template...', increment: 20 });
      const template = Handlebars.compile(templateSource);

      // Step 3: Map data based on mechanism type
      progress.report({ message: 'Preparing data...', increment: 20 });
      let templateData;
      switch (mechType) {
        case 'Arm':
        case 'Simple':
        case 'Generic':
          templateData = mapToArmData(data);
          break;
        case 'Pivot':
          templateData = mapToPivotData(data);
          break;
        case 'Elevator':
          templateData = mapToElevatorData(data);
          break;
        case 'Flywheel':
        case 'Shooter':
          templateData = mapToShooterData(data);
          break;
        default:
          templateData = mapToArmData(data);
      }

      // Step 4: Render template
      progress.report({ message: 'Generating code...', increment: 20 });
      const generatedCode = template(templateData);

      // Step 5: Write file
      progress.report({ message: 'Writing file...', increment: 20 });
      const targetDir = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', 'subsystems');
      const fileName = `${subsystemName}.java`;
      const filePath = path.join(targetDir, fileName);

      // Ensure directory exists
      try {
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(targetDir));
      } catch (_) { /* Directory may already exist */ }

      // Write file
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(filePath),
        new TextEncoder().encode(generatedCode)
      );

      // Open the generated file
      const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
      await vscode.window.showTextDocument(doc);

      vscode.window.showInformationMessage(`✅ Generated YAMS ${mechType} Subsystem: ${fileName}`);

    } catch (error) {
      vscode.window.showErrorMessage(`YAMS Generation Failed: ${error.message}`);
      console.error('YAMS Generation Error:', error);
    }
  });
}

/**
 * Get available mechanism types and their descriptions
 */
function getAvailableMechanisms() {
  return [
    { id: 'Arm', name: 'Arm', description: 'Positional arm mechanism with angular control' },
    { id: 'Pivot', name: 'Pivot', description: 'Positional pivot/wrist mechanism' },
    { id: 'Elevator', name: 'Elevator', description: 'Linear elevator/lift mechanism' },
    { id: 'Flywheel', name: 'Flywheel/Shooter', description: 'Velocity-controlled flywheel' },
    { id: 'SwerveDrive', name: 'Swerve Drive', description: 'Holonomic swerve drive (advanced)' }
  ];
}

/**
 * Get the list of supported motor controllers
 */
function getSupportedControllers() {
  return Object.keys(CONTROLLER_TYPE_MAP);
}

/**
 * Get the list of supported motor types
 */
function getSupportedMotors() {
  return Object.keys(MOTOR_MODEL_MAP);
}

module.exports = {
  generateYAMSSubsystem,
  getAvailableMechanisms,
  getSupportedControllers,
  getSupportedMotors,
  TEMPLATE_BASE_URL,
  fetchTemplate
};

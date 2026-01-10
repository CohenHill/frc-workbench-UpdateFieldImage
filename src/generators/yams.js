const vscode = require('vscode');
const path = require('path');
const Handlebars = require('handlebars');

/**
 * YAMS Generator - Fetches Handlebars templates from LOCAL DIRECTORY and generates Java code
 * 
 * Templates located in: src/templates/
 * - Arm.java.hbs
 * - Pivot.java.hbs
 * - Elevator.java.hbs
 * - Shooter.java.hbs
 * - SwerveDrive.java.hbs
 */

// GitHub raw content base URL (Deprecated for local use, but kept for reference if needed)
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
 * Fetch a template from LOCAL EXTENSION DIRECTORY
 * @param {string} templateName - Name of the template file (e.g., 'Arm.java.hbs')
 * @returns {Promise<string>} - Template content
 */
async function fetchTemplate(templateName) {
  try {
    // Get extension context - we need to pass this or use a global access method?
    // In this context, we usually receive context in activate, but this is a helper module.
    // However, we can assume this script runs in node environment where vscode API functions work.
    // The issue is getting the extension path.
    // The rootPath passed to generateYAMSSubsystem is the WORKSPACE root.
    // The templates are in the EXTENSION source.

    // Quick fix: We can try to use relative path if we know where this file is relative to templates.
    // This file is in src/generators/yams.js
    // Templates are in src/templates/

    // We can use __dirname if available in Node context of VS Code ext.
    const templatesDir = path.join(__dirname, '..', 'templates');
    const templatePath = path.join(templatesDir, templateName);

    // Use vscode.workspace.fs to read? Or standard fs?
    // Standard fs is safer for local files if we are in node.
    // But vscode.workspace.fs works with VFS. Let's try vscode.workspace.fs first or fallback.
    // Since __dirname gives a filesystem path, let's use vscode.workspace.fs with file URI.

    const fileUri = vscode.Uri.file(templatePath);
    const readData = await vscode.workspace.fs.readFile(fileUri);
    return new TextDecoder().decode(readData);

  } catch (error) {
    throw new Error(`Could not fetch template '${templateName}' from local '${path.join(__dirname, '..', 'templates')}': ${error.message}`);
  }
}

/**
 * Map wizard data to template-expected format for Arm mechanism
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

    // PID
    pid: config.pid || { kP: 0.6, kI: 0, kD: 0.02 },
    simPid: config.simPid || config.pid || { kP: 0.6, kI: 0, kD: 0.02 },

    // Feedforward
    ff: config.ff || { kS: 0.2, kG: 0.4, kV: 1.1, kA: 0 },
    simFf: config.simFf || config.ff || { kS: 0.2, kG: 0.4, kV: 1.1, kA: 0 },

    // Arm-specific
    minSoftLimit: config.minSoftLimit || -45,
    maxSoftLimit: config.maxSoftLimit || 90,
    minHardLimit: config.minHardLimit || -60,
    maxHardLimit: config.maxHardLimit || 100,
    startingAngle: config.startingAngle || 0,
    armLength: config.armLength || 0.6,
    mass: config.armMass || 8,

    // Follower
    hasFollower: config.hasFollower || false,
    followerId: config.followerId || 0,
    followerInverted: config.followerInverted || false
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

    // PID
    pid: config.pid || { kP: 0.6, kI: 0, kD: 0.02 },
    simPid: config.simPid || config.pid || { kP: 0.6, kI: 0, kD: 0.02 },

    // Feedforward
    ff: config.ff || { kS: 0.2, kG: 0.8, kV: 1.0, kA: 0 },
    simFf: config.simFf || config.ff || { kS: 0.2, kG: 0.8, kV: 1.0, kA: 0 },

    // Elevator-specific
    startingHeight: config.startingHeight || 0,
    minHeight: config.minHeight || 0,
    maxHeight: config.maxHeight || 1.5,
    mass: config.elevatorMass || 10,

    // Follower
    hasFollower: config.hasFollower || false,
    followerId: config.followerId || 0,
    followerInverted: config.followerInverted || false
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

    // PID (velocity uses lower gains typically)
    pid: config.pid || { kP: 0.1, kI: 0, kD: 0 },
    simPid: config.simPid || config.pid || { kP: 0.1, kI: 0, kD: 0 },

    // Feedforward
    ff: { kS: config.ff?.kS || 0.1, kV: config.ff?.kV || 0.12, kA: config.ff?.kA || 0 },
    simFf: { kS: config.simFf?.kS || 0.1, kV: config.simFf?.kV || 0.12, kA: config.simFf?.kA || 0 },

    // Flywheel-specific
    flywheelDiameter: config.flywheelDiameter || 4,
    mass: config.flywheelMass || 2,
    maxVelocity: config.maxVelocity || 6000,

    // Follower
    hasFollower: config.hasFollower || false,
    followerId: config.followerId || 0,
    followerInverted: config.followerInverted || false
  };
}

/**
 * Map wizard data to template-expected format for Pivot mechanism
 */
function mapToPivotData(data) {
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
    mass: config.pivotMass || 4,

    // Follower
    hasFollower: config.hasFollower || false,
    followerId: config.followerId || 0,
    followerInverted: config.followerInverted || false
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

      // Step 1: Fetch template from LOCAL
      progress.report({ message: 'Fetching template...', increment: 20 });
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
      let generatedCode = template(templateData);

      // --- Post-Processing Fixes (User Request) ---

      // 1. Fix Motor Config and Imports for YAMS classes
      generatedCode = generatedCode.replace(/import yams\.utils\.GearBox;/g, 'import yams.gearing.GearBox;');
      generatedCode = generatedCode.replace(/import yams\.utils\.MechanismGearing;/g, 'import yams.gearing.MechanismGearing;');
      generatedCode = generatedCode.replace(/import yams\.motorcontrollers\.local\.TalonFXWrapper;/g, 'import yams.motorcontrollers.TalonFXWrapper;');

      // 2. Fix Kraken X60 typo
      generatedCode = generatedCode.replace(/DCMotor\.getKraken X60/g, 'DCMotor.getKrakenX60');

      // 3. Inject Follower Code
      if (templateData.hasFollower && templateData.followerId) {
        let followerCode = '';
        const fid = templateData.followerId;
        const finv = templateData.followerInverted;
        const mcType = templateData.motorControllerType;

        // Determine Motor Class and Import
        if (mcType === 'TalonFX' || mcType === 'Kraken X60') {
          followerCode = `.withFollowers(Pair.of(new TalonFX(${fid}), ${finv}))`;
          if (!generatedCode.includes('import com.ctre.phoenix6.hardware.TalonFX;')) {
            generatedCode = generatedCode.replace(/package frc\.robot\.subsystems;/, "package frc.robot.subsystems;\n\nimport com.ctre.phoenix6.hardware.TalonFX;\nimport edu.wpi.first.math.Pair;");
          }
        } else if (mcType === 'SparkMax' || mcType === 'NEO') {
          followerCode = `.withFollowers(Pair.of(new SparkMax(${fid}, MotorType.kBrushless), ${finv}))`;
          if (!generatedCode.includes('import com.revrobotics.spark.SparkMax;')) {
            generatedCode = generatedCode.replace(/package frc\.robot\.subsystems;/, "package frc.robot.subsystems;\n\nimport com.revrobotics.spark.SparkMax;\nimport com.revrobotics.spark.SparkLowLevel.MotorType;\nimport edu.wpi.first.math.Pair;");
          }
        }

        if (followerCode) {
          // Find where to inject. Look for new SmartMotorControllerConfig(this)
          const searchStr = 'new SmartMotorControllerConfig(this)';
          const idx = generatedCode.indexOf(searchStr);

          if (idx !== -1) {
            // Insert code into the chain
            generatedCode = generatedCode.replace(searchStr, searchStr + '\n      ' + followerCode);
          }
        }
      }

      // Ensure specific config imports are present config/ArmConfig etc
      if (!generatedCode.includes('import yams.mechanisms.config.ArmConfig;') && templateData.mechType === 'Arm') {
        generatedCode = generatedCode.replace(/package frc\.robot\.subsystems;/, "package frc.robot.subsystems;\n\nimport yams.mechanisms.config.ArmConfig;");
      }
      if (!generatedCode.includes('import yams.mechanisms.positional.Arm;') && templateData.mechType === 'Arm') {
        generatedCode = generatedCode.replace(/package frc\.robot\.subsystems;/, "package frc.robot.subsystems;\n\nimport yams.mechanisms.positional.Arm;");
      }

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

function getAvailableMechanisms() {
  return [
    { id: 'Arm', name: 'Arm', description: 'Positional arm mechanism with angular control' },
    { id: 'Pivot', name: 'Pivot', description: 'Positional pivot/wrist mechanism' },
    { id: 'Elevator', name: 'Elevator', description: 'Linear elevator/lift mechanism' },
    { id: 'Flywheel', name: 'Flywheel/Shooter', description: 'Velocity-controlled flywheel' },
    { id: 'SwerveDrive', name: 'Swerve Drive', description: 'Holonomic swerve drive (advanced)' }
  ];
}

function getSupportedControllers() {
  return Object.keys(CONTROLLER_TYPE_MAP);
}

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

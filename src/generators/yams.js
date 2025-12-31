const vscode = require('vscode');
const path = require('path');
const https = require('https');
const Handlebars = require('handlebars');

// Register Handlebars Helpers
Handlebars.registerHelper('eq', (a, b) => a === b);
Handlebars.registerHelper('ne', (a, b) => a !== b);
Handlebars.registerHelper('lt', (a, b) => a < b);
Handlebars.registerHelper('gt', (a, b) => a > b);
Handlebars.registerHelper('le', (a, b) => a <= b);
Handlebars.registerHelper('ge', (a, b) => a >= b);
Handlebars.registerHelper('and', (a, b) => a && b);
Handlebars.registerHelper('or', (a, b) => a || b);

/**
 * Generates YAMS Subsystem files by fetching templates from yamgen.com.
 * @param {object} data - Configuration data from the UI.
 * @param {string} rootPath - Root path of the workspace.
 */
async function generateYAMSSubsystem(data, rootPath) {
  const {
    subsystemName,
    mechanismType
  } = data;

  const folderName = subsystemName;
  const subsystemClass = subsystemName;

  // Directory: src/main/java/frc/robot/subsystems/{Name}
  const targetDir = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', 'subsystems', folderName);

  // Ensure directory exists
  try {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(targetDir));
  } catch (_) {
    // Ignore if exists
  }

  // Determine Template URLs
  const typeLower = mechanismType.toLowerCase();
  const subsystemUrl = `https://www.yamgen.com/templates/${typeLower}-subsystem.java.hbs`;
  const simUrl = `https://www.yamgen.com/templates/${typeLower}-sim.java.hbs`;

  try {
    // 1. Prepare Data Context
    const context = prepareContext(data);

    // 2. Fetch and Render Subsystem
    vscode.window.showInformationMessage(`Fetching template for ${mechanismType}...`);
    const subsystemTemplate = await fetchTemplate(subsystemUrl);
    const compiledSubsystem = Handlebars.compile(subsystemTemplate);
    let subsystemCode = compiledSubsystem(context);

    // FIX: Update package declaration to match folder structure
    subsystemCode = subsystemCode.replace(
      /package\s+[^;]+;/g,
      `package frc.robot.subsystems.${folderName};`
    );

    // --- Post-Processing for Tunable PID ---
    if (context.controlType === 'Tunable') {
      // Ensure the custom class exists
      vscode.commands.executeCommand('frc-workbench.installCustomPID', 'profiled');

      // Regex Replacements
      // 1. Imports
      subsystemCode = subsystemCode.replace(
        /import edu\.wpi\.first\.math\.controller\.ProfiledPIDController;/g,
        'import frc.robot.lib.TuneableProfiledPIDController;\nimport frc.robot.lib.TuneableProfiledPIDController.FeedforwardType;'
      );

      // 2. Class Field Declaration
      subsystemCode = subsystemCode.replace(
        /private ProfiledPIDController ([\w]+);/g,
        'private TuneableProfiledPIDController $1;'
      );

      // 3. Instantiation
      subsystemCode = subsystemCode.replace(
        /(\w+)\s*=\s*new ProfiledPIDController\([^)]+\);/g,
        (match, varName) => {
          let ffType = 'FeedforwardType.STATIC';
          if (mechanismType === 'Elevator') ffType = 'FeedforwardType.ELEVATOR';
          if (mechanismType === 'Arm' || mechanismType === 'Pivot') ffType = 'FeedforwardType.ARM';
          return `${varName} = new TuneableProfiledPIDController("${subsystemName}PID", kP, kI, kD, kS, kV, kA, kG, ${ffType}, constraints);`;
        }
      );

      // 4. Comment out conflicting Feedforward declaration
      subsystemCode = subsystemCode.replace(
        /(private final \w*Feedforward feedforward = new \w*Feedforward\([^;]+;)/g,
        '// $1 // Replaced by TuneablePID'
      );

      // 5. Replace feedforward.calculate usage with 0.0 (handled internally by TunablePID)
      subsystemCode = subsystemCode.replace(
        /feedforward\.calculate\([^)]+\)/g,
        '0.0 /* Handled by TuneablePID */'
      );
    }

    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(path.join(targetDir, `${subsystemClass}.java`)),
      new TextEncoder().encode(subsystemCode)
    );

    // 3. Fetch and Render Sim (Optional/If exists)
    try {
      const simTemplate = await fetchTemplate(simUrl);
      const compiledSim = Handlebars.compile(simTemplate);
      let simCode = compiledSim(context);

      // FIX: Update package declaration for Sim
      simCode = simCode.replace(
        /package\s+[^;]+;/g,
        `package frc.robot.subsystems.${folderName};`
      );

      if (simCode && simCode.trim().length > 0) {
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(path.join(targetDir, `${subsystemClass}Sim.java`)),
          new TextEncoder().encode(simCode)
        );
      }
    } catch (simErr) {
      console.log("Sim template might not exist or failed, skipping.", simErr);
    }

    vscode.window.showInformationMessage(`Successfully generated ${subsystemName} in subsystems/${folderName}`);

  } catch (err) {
    vscode.window.showErrorMessage(`Failed to generate YAMS subsystem: ${err.message}`);
    console.error(err);
  }
}

function fetchTemplate(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch template ${url}: Status ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', (e) => reject(e));
  });
}

function prepareContext(data) {
  const { motorType, motorControllerType, canId, inverted, brakeMode, controlType } = data;

  const imports = [];
  let declaration = '';
  let initialization = '';
  // Method bodies
  let getPositionMethod = '';
  let getVelocityMethod = '';
  let getVoltageMethod = '';
  let getCurrentMethod = '';
  let getTemperatureMethod = '';
  let setPositionMethod = '';
  let setVelocityMethod = '';
  let setVoltageMethod = '';

  let periodic = '';
  let simPeriodic = '';
  let dcMotorType = '';

  // --- DC Motor Definitions ---
  switch (motorType) {
    case 'NEO': dcMotorType = 'DCMotor.getNEO(1)'; break;
    case 'NEO550': dcMotorType = 'DCMotor.getNeo550(1)'; break;
    case 'Krakenx60': dcMotorType = 'DCMotor.getKrakenX60(1)'; break;
    case 'Vortex': dcMotorType = 'DCMotor.getNEOVortex(1)'; break;
    case 'Minion': dcMotorType = 'new DCMotor(12, 3.1, 200.46, 1.43, Units.rotationsPerMinuteToRadiansPerSecond(7200), 1)'; break;
    case 'Krakenx44': dcMotorType = 'new DCMotor(12, 4.05, 275, 1.4, Units.rotationsPerMinuteToRadiansPerSecond(7530), 1)'; break;
    default: dcMotorType = 'DCMotor.getNEO(1)';
  }

  // --- Motor Controller Definitions ---
  if (motorControllerType === 'SparkMax' || motorControllerType === 'SparkFlex') {
    const clazz = motorControllerType === 'SparkMax' ? 'SparkMax' : 'SparkFlex';
    imports.push(`com.revrobotics.spark.${clazz}`);
    imports.push('com.revrobotics.spark.SparkLowLevel.MotorType');
    imports.push('com.revrobotics.spark.config.SparkBaseConfig.IdleMode');
    imports.push('com.revrobotics.spark.config.SparkMaxConfig');
    imports.push('com.revrobotics.spark.SparkBase.ResetMode');
    imports.push('com.revrobotics.spark.SparkBase.PersistMode');
    imports.push('com.revrobotics.spark.SparkClosedLoopController'); // Needed?
    imports.push('com.revrobotics.RelativeEncoder'); // Needed

    declaration = `
    private final ${clazz} motor;
    private final RelativeEncoder encoder;
    private final SparkClosedLoopController controller;
    `;

    initialization = `
    motor = new ${clazz}(canID, MotorType.kBrushless);
    encoder = motor.getEncoder();
    controller = motor.getClosedLoopController();

    var motorConfig = new com.revrobotics.spark.config.SparkMaxConfig();
    motorConfig.idleMode(brakeMode ? IdleMode.kBrake : IdleMode.kCoast);
    motorConfig.inverted(${inverted});
    motorConfig.smartCurrentLimit(statorCurrentLimit);
    
    // PID
    motorConfig.closedLoop.pid(kP, kI, kD, com.revrobotics.spark.ClosedLoopSlot.kSlot0);
    
    // Encoder conversion
    motorConfig.encoder.positionConversionFactor(1.0 / gearRatio);
    motorConfig.encoder.velocityConversionFactor((1.0 / gearRatio) / 60.0);

    motor.configure(motorConfig, ResetMode.kResetSafeParameters, PersistMode.kPersistParameters);
        `;

    getPositionMethod = 'return encoder.getPosition();';
    getVelocityMethod = 'return encoder.getVelocity();';
    getVoltageMethod = 'return motor.getAppliedOutput() * motor.getBusVoltage();';
    getCurrentMethod = 'return motor.getOutputCurrent();';
    getTemperatureMethod = 'return motor.getMotorTemperature();';

    setPositionMethod = `controller.setReference(positionRotations, com.revrobotics.spark.SparkBase.ControlType.kPosition);`;
    setVelocityMethod = `controller.setReference(velocityRotations, com.revrobotics.spark.SparkBase.ControlType.kVelocity);`;
    setVoltageMethod = `motor.setVoltage(voltage);`;

  } else if (motorControllerType === 'TalonFX') {
    imports.push('com.ctre.phoenix6.hardware.TalonFX');
    imports.push('com.ctre.phoenix6.configs.TalonFXConfiguration');
    imports.push('com.ctre.phoenix6.signals.NeutralModeValue');
    imports.push('com.ctre.phoenix6.controls.PositionVoltage');
    imports.push('com.ctre.phoenix6.controls.VelocityVoltage');
    imports.push('com.ctre.phoenix6.controls.VoltageOut');

    declaration = `
    private final TalonFX motor;
    private final PositionVoltage positionControl = new PositionVoltage(0);
    private final VelocityVoltage velocityControl = new VelocityVoltage(0);
    private final VoltageOut voltageControl = new VoltageOut(0);
    `;

    initialization = `
    motor = new TalonFX(canID);
    var config = new TalonFXConfiguration();
    config.MotorOutput.NeutralMode = brakeMode ? NeutralModeValue.Brake : NeutralModeValue.Coast;
    config.MotorOutput.Inverted = ${inverted ? 'com.ctre.phoenix6.signals.InvertedValue.Clockwise_Positive' : 'com.ctre.phoenix6.signals.InvertedValue.CounterClockwise_Positive'};
    config.CurrentLimits.StatorCurrentLimit = statorCurrentLimit;
    if (enableSupplyLimit) {
        config.CurrentLimits.SupplyCurrentLimit = supplyCurrentLimit;
        config.CurrentLimits.SupplyCurrentLimitEnable = true;
    }
    config.Slot0.kP = kP;
    config.Slot0.kI = kI;
    config.Slot0.kD = kD;
    // Feedback
    config.Feedback.SensorToMechanismRatio = gearRatio;
    
    motor.getConfigurator().apply(config);
        `;

    getPositionMethod = 'return motor.getPosition().getValue();';
    getVelocityMethod = 'return motor.getVelocity().getValue();';
    getVoltageMethod = 'return motor.getMotorVoltage().getValue();';
    getCurrentMethod = 'return motor.getStatorCurrent().getValue();';
    getTemperatureMethod = 'return motor.getDeviceTemp().getValue();';

    setPositionMethod = `motor.setControl(positionControl.withPosition(positionRotations));`;
    setVelocityMethod = `motor.setControl(velocityControl.withVelocity(velocityRotations));`;
    setVoltageMethod = `motor.setControl(voltageControl.withOutput(voltage));`;
  }

  // --- Context Construction ---
  return {
    subsystemName: data.subsystemName,
    ntKey: data.ntKey || data.subsystemName,
    motorControllerImports: imports.map(i => `import ${i};`).join('\n'),
    motorControllerType: data.motorControllerType,
    motorType: data.motorType,
    dcMotorType: dcMotorType,
    canId: canId,
    gearRatio: data.gearRatio,
    pidValues: data.pidValues,
    kS: data.kS,
    kV: data.kV,
    kA: data.kA,
    kG: data.kG,
    maxVelocity: data.maxVelocity,
    maxAcceleration: data.maxAcceleration,
    brakeMode: brakeMode,
    inverted: inverted,
    enableSoftLimits: false,
    enableStatorLimit: true,
    statorCurrentLimit: data.statorCurrentLimit,
    enableSupplyLimit: true,
    supplyCurrentLimit: data.supplyCurrentLimit,

    // Sim params
    mass: data.mass || data.armMass,
    drumRadius: data.drumRadius,
    hardLimitMin: data.minHeight || data.minAngle,
    hardLimitMax: data.maxHeight || data.maxAngle,
    distPerRot: 1.0,
    startingHeight: 0.0,

    // Methods
    getPositionMethod,
    getVelocityMethod,
    getVoltageMethod,
    getCurrentMethod,
    getTemperatureMethod,
    setPositionMethod,
    setVelocityMethod,
    setVoltageMethod,

    // Boilerplate injections
    motorControllerDeclaration: declaration,
    motorControllerInitialization: initialization,
    motorControllerPeriodic: periodic,
    motorControllerSimulationPeriodic: simPeriodic,

    // Control Type logic
    wpilibControlled: controlType === 'WPILib' || controlType === 'Tunable',
    controlType: controlType
  };
}

module.exports = {
  generateYAMSSubsystem
};

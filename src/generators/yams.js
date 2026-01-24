const vscode = require('vscode');
const path = require('path');

/* 
 * Generates YAMS Subsystem Code using the local YAMS API.
 * 
 * Target Structure (Based on User Feedback):
 * - Imports: yams.motorcontrollers.*, yams.gearing.*
 * - Wrapper: yams.motorcontrollers.remote.TalonFXWrapper (etc.)
 * - Config: SmartMotorControllerConfig builder pattern
 */

async function generateYAMSSubsystem(data, rootPath) {
  const {
    subsystemName,
    motorType,
    controller,
    hasFollower,
    followerInverted,
    mechType,
    gearing,
    supplyLimit,
    controlLoop,
    kP, kI, kD,
    kS, kV, kG, kA,
    profileType,
    maxVel, maxAccel,
    startPosition,
    sensorType,
    encoderGearing,
    encoderInverted,
    encoderOffset,
    mechConfig
  } = data;

  const subsystemClass = subsystemName.replace(/Subsystem$/, '') + 'Subsystem';
  const targetDir = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', 'subsystems');

  // Ensure directory exists
  try {
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(targetDir));
  } catch (_) { }

  // --- Determine Wrapper and Motor Classes ---
  let wrapperClass = 'SparkWrapper';
  let vendorClass = 'SparkMax';
  let vendorImport = 'com.revrobotics.spark.SparkMax';
  let yamsWrapperImport = 'yams.motorcontrollers.remote.SparkWrapper';
  let motorTypeArg = 'MotorType.kBrushless';
  let dcMotorMethod = 'DCMotor.getNEO(1)';

  if (controller === 'TalonFX' || controller === 'TalonFXS') {
    wrapperClass = 'TalonFXWrapper';
    vendorClass = 'TalonFX';
    vendorImport = 'com.ctre.phoenix6.hardware.TalonFX';
    yamsWrapperImport = 'yams.motorcontrollers.remote.TalonFXWrapper';
    dcMotorMethod = motorType.includes('Kraken') ? 'DCMotor.getKrakenX60(1)' : 'DCMotor.getFalcon500(1)';
  } else if (controller === 'SparkMax') {
    wrapperClass = 'SparkWrapper';
    vendorClass = 'SparkMax';
    vendorImport = 'com.revrobotics.spark.SparkMax';
    yamsWrapperImport = 'yams.motorcontrollers.remote.SparkWrapper';
    dcMotorMethod = motorType.includes('NEO550') ? 'DCMotor.getNeo550(1)' : 'DCMotor.getNEO(1)';
  } else if (controller === 'SparkFlex') {
    wrapperClass = 'SparkWrapper';
    vendorClass = 'SparkFlex';
    vendorImport = 'com.revrobotics.spark.SparkFlex';
    yamsWrapperImport = 'yams.motorcontrollers.remote.SparkWrapper';
    dcMotorMethod = motorType.includes('Vortex') ? 'DCMotor.getNeoVortex(1)' : 'DCMotor.getNEO(1)';
  } else if (controller === 'TalonSRX' || controller === 'VictorSPX') {
    // Legacy controllers - limited YAMS support
    vscode.window.showWarningMessage(`${controller} has limited YAMS support. Consider using TalonFX or SparkMax.`);
    wrapperClass = 'TalonSRXWrapper';
    vendorClass = controller;
    vendorImport = `com.ctre.phoenix.motorcontrol.can.${controller}`;
    yamsWrapperImport = 'yams.motorcontrollers.remote.TalonSRXWrapper';
    dcMotorMethod = 'DCMotor.getCIM(1)';
  }

  // --- Determine Feedforward Type ---
  let ffClass = 'SimpleMotorFeedforward';
  let ffImport = 'edu.wpi.first.math.controller.SimpleMotorFeedforward';
  let ffArgs = `${kS}, ${kV}, ${kA}`;

  if (mechType === 'Arm') {
    ffClass = 'ArmFeedforward';
    ffImport = 'edu.wpi.first.math.controller.ArmFeedforward';
    ffArgs = `${kS}, ${kG}, ${kV}, ${kA}`;
  } else if (mechType === 'Elevator') {
    ffClass = 'ElevatorFeedforward';
    ffImport = 'edu.wpi.first.math.controller.ElevatorFeedforward';
    ffArgs = `${kS}, ${kG}, ${kV}, ${kA}`;
  }

  // --- Build Imports ---
  const imports = [
    'edu.wpi.first.wpilibj2.command.SubsystemBase',
    'edu.wpi.first.wpilibj2.command.Command',
    'edu.wpi.first.math.system.plant.DCMotor',
    vendorImport,
    yamsWrapperImport,
    ffImport,
    'yams.motorcontrollers.SmartMotorController',
    'yams.motorcontrollers.SmartMotorControllerConfig',
    'yams.motorcontrollers.SmartMotorControllerConfig.ControlMode',
    'yams.motorcontrollers.SmartMotorControllerConfig.MotorMode',
    'yams.motorcontrollers.SmartMotorControllerConfig.TelemetryVerbosity',
    'yams.gearing.MechanismGearing',
    'yams.gearing.GearBox',
    'static edu.wpi.first.units.Units.*'
  ];

  if (vendorClass === 'SparkMax' || vendorClass === 'SparkFlex') {
    imports.push('com.revrobotics.spark.SparkLowLevel.MotorType');
  }

  const sortedImports = [...new Set(imports)].sort().map(i => `import ${i};`).join('\n');

  // --- Build Config ---
  const controlModeValue = controlLoop === 'OpenLoop' ? 'OPEN_LOOP' : 'CLOSED_LOOP';

  let configCode = `    private final SmartMotorControllerConfig config = new SmartMotorControllerConfig(this)
        .withTelemetry("${subsystemClass.replace('Subsystem', '')}Motor", TelemetryVerbosity.HIGH)
        .withControlMode(ControlMode.${controlModeValue})
        .withMotorInverted(false)
        .withIdleMode(MotorMode.BRAKE)
        .withGearing(new MechanismGearing(GearBox.fromReductionStages(${gearing})))
        .withStatorCurrentLimit(Amps.of(${supplyLimit}))`;

  if (controlLoop === 'ClosedLoop') {
    configCode += `
        .withClosedLoopController(${kP}, ${kI}, ${kD}, MetersPerSecond.of(${maxVel || 4}), MetersPerSecondPerSecond.of(${maxAccel || 8}))`;
  }

  configCode += `
        .withFeedforward(new ${ffClass}(${ffArgs}));`;

  // --- Build Constructor ---
  let constructorBody = '';
  if (vendorClass === 'SparkMax' || vendorClass === 'SparkFlex') {
    constructorBody = `        motor = new ${vendorClass}(1, ${motorTypeArg});
        smartMotorController = new ${wrapperClass}(motor, ${dcMotorMethod}, config);`;
  } else {
    constructorBody = `        motor = new ${vendorClass}(1, "rio");
        smartMotorController = new ${wrapperClass}(motor, ${dcMotorMethod}, config);`;
  }

  // Add mechanism-specific setup
  if (mechType === 'Arm' && mechConfig) {
    constructorBody += `
        // Arm: Length=${mechConfig.armLength}m, Range=[${mechConfig.minAngle}°, ${mechConfig.maxAngle}°], Mass=${mechConfig.mass}kg`;
  } else if (mechType === 'Elevator' && mechConfig) {
    constructorBody += `
        // Elevator: Drum=${mechConfig.drumRadius}m, Range=[${mechConfig.minHeight}m, ${mechConfig.maxHeight}m], Mass=${mechConfig.mass}kg`;
  }

  // --- Build Helper Methods ---
  let helperMethods = `
    /**
     * Sets the mechanism to a target position.
     * @param position Target position in meters (or radians for arm)
     * @return Command to set position
     */
    public Command setPosition(double position) {
        return run(() -> smartMotorController.setPosition(Meters.of(position)))
            .withName("Set Position");
    }

    /**
     * Sets motor duty cycle (-1.0 to 1.0).
     * @param speed Duty cycle percentage
     * @return Command to set speed
     */
    public Command setSpeed(double speed) {
        return run(() -> smartMotorController.setDutyCycle(speed))
            .withName("Set Speed");
    }

    /**
     * Stops the motor.
     * @return Command to stop
     */
    public Command stop() {
        return run(() -> smartMotorController.setDutyCycle(0))
            .withName("Stop");
    }

    /**
     * Gets current mechanism position.
     * @return Position in rotations
     */
    public double getPosition() {
        return smartMotorController.getMechanismPosition().in(Rotations);
    }

    /**
     * Gets current mechanism velocity.
     * @return Velocity in rotations per second
     */
    public double getVelocity() {
        return smartMotorController.getMechanismVelocity().in(RotationsPerSecond);
    }`;

  // --- Assemble Final Code ---
  const fileContent = `package frc.robot.subsystems;

${sortedImports}

/**
 * ${subsystemClass} - Generated by YAMS
 * Motor: ${motorType} with ${controller}
 * Mechanism: ${mechType}
 * Control: ${controlLoop}
 */
public class ${subsystemClass} extends SubsystemBase {

    private final ${vendorClass} motor;
    private final SmartMotorController smartMotorController;

${configCode}

    public ${subsystemClass}() {
${constructorBody}
    }

    @Override
    public void periodic() {
        // Update telemetry every cycle
        smartMotorController.updateTelemetry();
    }

    @Override
    public void simulationPeriodic() {
        // Update simulation model
        smartMotorController.simIterate();
    }
${helperMethods}
}`;

  // Write File
  const filePath = path.join(targetDir, `${subsystemClass}.java`);
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(filePath),
    new TextEncoder().encode(fileContent)
  );

  // Open the generated file
  const doc = await vscode.workspace.openTextDocument(filePath);
  await vscode.window.showTextDocument(doc);

  vscode.window.showInformationMessage(`Generated YAMS Subsystem: ${subsystemClass}`);
}

module.exports = { generateYAMSSubsystem };

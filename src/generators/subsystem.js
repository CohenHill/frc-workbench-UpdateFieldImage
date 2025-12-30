const { generateHardwareCode } = require('./hardware');

/**
 * Generates the full Java code for a subsystem.
 * @param {Object} data 
 * @returns {Object} { code: string, constants: Array } Java file content and constants list
 */
function generateSubsystemCode(data) {
  const {
    subsystemName,
    subsystemType,
    singleton,
    baseClass,
    hardware,
    pidConfig,
    states,
    saveConstants,
    constantsClassName = 'Constants'
  } = data;

  // Fix class name
  let className = subsystemName;
  if (!className.endsWith('Subsystem')) {
    className += 'Subsystem';
  }

  const { imports, declarations, initializers, helperMethods, constantDefinitions: hwConstants } = generateHardwareCode(hardware || [], className, saveConstants, constantsClassName);
  const collectedConstants = [...(hwConstants || [])];

  // Base specific logic
  const isPidSubsystem = subsystemType === 'pid';
  let extendsClause = `extends ${baseClass || 'SubsystemBase'}`;
  let constructorBody = '';

  if (!isPidSubsystem) {
    if (baseClass === 'SubsystemBase' || !baseClass) {
      imports.add('edu.wpi.first.wpilibj2.command.SubsystemBase');
    }
  }

  if (isPidSubsystem) {

    const kP = pidConfig?.kP || '0.0';
    const kI = pidConfig?.kI || '0.0';
    const kD = pidConfig?.kD || '0.0';
    const kS = pidConfig?.kS || '0.0';
    const kV = pidConfig?.kV || '0.0';
    const kA = pidConfig?.kA || '0.0';
    const kG = pidConfig?.kG || '0.0';
    const strategy = pidConfig?.strategy || 'simple';
    const maxVel = pidConfig?.maxVelocity || '0.0';
    const maxAcc = pidConfig?.maxAcceleration || '0.0';

    let pVal = kP, iVal = kI, dVal = kD, sVal = kS, vVal = kV, aVal = kA, gVal = kG, velVal = maxVel, accVal = maxAcc;

    if (saveConstants) {
      imports.add('frc.robot.RobotMap');
      const constClass = `${constantsClassName}.${className}Constants`;
      pVal = `${constClass}.kP`;
      iVal = `${constClass}.kI`;
      dVal = `${constClass}.kD`;
      sVal = `${constClass}.kS`;
      vVal = `${constClass}.kV`;
      aVal = `${constClass}.kA`;
      gVal = `${constClass}.kG`;
      velVal = `${constClass}.kMaxVelocity`;
      accVal = `${constClass}.kMaxAcceleration`;

      collectedConstants.push({ name: 'kP', value: kP, type: 'double' });
      collectedConstants.push({ name: 'kI', value: kI, type: 'double' });
      collectedConstants.push({ name: 'kD', value: kD, type: 'double' });
      collectedConstants.push({ name: 'kS', value: kS, type: 'double' });
      collectedConstants.push({ name: 'kV', value: kV, type: 'double' });
      collectedConstants.push({ name: 'kA', value: kA, type: 'double' });
      collectedConstants.push({ name: 'kG', value: kG, type: 'double' });
      collectedConstants.push({ name: 'kMaxVelocity', value: maxVel, type: 'double' });
      collectedConstants.push({ name: 'kMaxAcceleration', value: maxAcc, type: 'double' });
    }

    // Determine FF Type Enum string
    let ffTypeStr = 'TuneablePIDController.FeedforwardType.STATIC';
    if (pidConfig.isProfiled && !pidConfig.useTuneable) {
      // Only use Profiled controller enum if NOT using new Tuneable subsystem
      ffTypeStr = 'TuneableProfiledPIDController.FeedforwardType.STATIC';
      if (strategy === 'elevator') ffTypeStr = 'TuneableProfiledPIDController.FeedforwardType.ELEVATOR';
      else if (strategy === 'arm') ffTypeStr = 'TuneableProfiledPIDController.FeedforwardType.ARM';
    } else {
      // Use Standard TuneablePIDController enum
      if (strategy === 'elevator') ffTypeStr = 'TuneablePIDController.FeedforwardType.ELEVATOR';
      else if (strategy === 'arm') ffTypeStr = 'TuneablePIDController.FeedforwardType.ARM';
    }

    if (pidConfig.useTuneable) {
      // --- TUNEABLE PID SUBSYSTEM ---
      extendsClause = 'extends TuneablePIDSubsystem';
      imports.add('frc.robot.lib.TuneablePIDSubsystem');
      imports.add('frc.robot.lib.TuneablePIDController');

      // Build the controller using the Builder pattern
      let builderChain = `new TuneablePIDController.Builder("${subsystemName}PID")
        .withP(${pVal}).withI(${iVal}).withD(${dVal})
        .withS(${sVal}).withV(${vVal}).withA(${aVal}).withG(${gVal})
        .withFeedforwardType(${ffTypeStr})`;

      // Add output range if defined
      if (pidConfig?.minOutput && pidConfig?.maxOutput) {
        builderChain += `\n        .withOutputRange(${pidConfig.minOutput}, ${pidConfig.maxOutput})`;
      }

      builderChain += '\n        .build()';

      constructorBody += `    super(${builderChain});\n`;

      // Handle Profiling (TuneablePIDSubsystem handles this internally via setProfiled)
      if (pidConfig.isProfiled) {
        imports.add('edu.wpi.first.math.trajectory.TrapezoidProfile');
        constructorBody += `    setProfiled(new TrapezoidProfile.Constraints(${velVal}, ${accVal}));\n`;
      }

    } else if (pidConfig.isProfiled) {
      // --- STANDARD PROFILED PID ---
      extendsClause = 'extends ProfiledPIDSubsystem';
      imports.add('edu.wpi.first.math.controller.ProfiledPIDController');
      imports.add('edu.wpi.first.math.trajectory.TrapezoidProfile');
      imports.add('edu.wpi.first.wpilibj2.command.ProfiledPIDSubsystem');

      constructorBody += `    super(
      new ProfiledPIDController(
        ${pVal}, ${iVal}, ${dVal},
        new TrapezoidProfile.Constraints(${velVal}, ${accVal})
      )
    );\n`;

      if (pidConfig?.minOutput && pidConfig?.maxOutput) {
        constructorBody += `    getController().setIntegratorRange(${pidConfig.minOutput}, ${pidConfig.maxOutput});\n`;
      }

    } else {
      // --- STANDARD PID ---
      extendsClause = 'extends PIDSubsystem';
      imports.add('edu.wpi.first.math.controller.PIDController');
      imports.add('edu.wpi.first.wpilibj2.command.PIDSubsystem');

      constructorBody += `    super(new PIDController(${pVal}, ${iVal}, ${dVal}));\n`;

      if (pidConfig?.minOutput && pidConfig?.maxOutput) {
        constructorBody += `    getController().setIntegratorRange(${pidConfig.minOutput}, ${pidConfig.maxOutput});\n`;
      }
    }
  }

  // Add hardware inits
  constructorBody += initializers.join('\n');

  // States Enum
  let stateEnumCode = '';
  if (states && states.length > 0) {
    stateEnumCode = `
  public enum State {
    ${states.join(', ')}
  }
  private State currentState = State.${states[0]};

  public void setState(State newState) {
    this.currentState = newState;
  }

  public State getState() {
    return this.currentState;
  }
`;
  }

  // Singleton Logic
  let singletonCode = '';
  let constructorSig = `public ${className}()`;
  if (singleton) {
    constructorSig = `private ${className}()`;
    singletonCode = `
  private static ${className} instance;

  public static ${className} getInstance() {
    if (instance == null) {
      instance = new ${className}();
    }
    return instance;
  }
`;
  }

  // Assemble
  const code = `package frc.robot.subsystems;

${Array.from(imports).sort().map(i => `import ${i};`).join('\n')}

public class ${className} ${extendsClause} {
${singletonCode}
${declarations.join('\n')}
${stateEnumCode}

  ${constructorSig} {
${constructorBody}
  }

  @Override
  public void periodic() {
    // This method will be called once per scheduler run
    super.periodic();
  }

${isPidSubsystem ? `
  @Override
  public void useOutput(double output, ${pidConfig?.isProfiled && !pidConfig?.useTuneable ? 'TrapezoidProfile.State' : 'double'} setpoint) {
    // Use the output here
  }

  @Override
  public double getMeasurement() {
    // Return the process variable measurement here
    return 0;
  }` : ''}

${helperMethods.join('\n\n')}
}
`;

  return { code, constants: collectedConstants };
}

module.exports = { generateSubsystemCode };

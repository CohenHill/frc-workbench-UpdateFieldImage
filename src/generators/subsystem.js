const { generateHardwareCode, checkVendordeps } = require('./hardware');

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
  let additionalMethods = [];

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
    if (pidConfig.isProfiled) {
      ffTypeStr = 'TuneableProfiledPIDController.FeedforwardType.STATIC';
      if (strategy === 'elevator') ffTypeStr = 'TuneableProfiledPIDController.FeedforwardType.ELEVATOR';
      else if (strategy === 'arm') ffTypeStr = 'TuneableProfiledPIDController.FeedforwardType.ARM';
    } else {
      if (strategy === 'elevator') ffTypeStr = 'TuneablePIDController.FeedforwardType.ELEVATOR';
      else if (strategy === 'arm') ffTypeStr = 'TuneablePIDController.FeedforwardType.ARM';
    }

    if (pidConfig.isProfiled) {
      // --- PROFILED PID ---
      extendsClause = 'extends ProfiledPIDSubsystem';
      imports.add('edu.wpi.first.math.controller.ProfiledPIDController');
      imports.add('edu.wpi.first.math.trajectory.TrapezoidProfile');
      imports.add('edu.wpi.first.wpilibj2.command.ProfiledPIDSubsystem');

      if (pidConfig && pidConfig.useTuneable) {
        imports.add('frc.robot.lib.TuneableProfiledPIDController');
        constructorBody += `    super(
      new TuneableProfiledPIDController(
        "${subsystemName}PID",
        ${pVal}, ${iVal}, ${dVal},
        ${sVal}, ${vVal}, ${aVal}, ${gVal}, ${ffTypeStr},
        new TrapezoidProfile.Constraints(${velVal}, ${accVal})
      )
    );\n`;
      } else {
        constructorBody += `    super(
      new ProfiledPIDController(
        ${pVal}, ${iVal}, ${dVal},
        new TrapezoidProfile.Constraints(${velVal}, ${accVal})
      )
    );\n`;
      }
    } else {
      // --- STANDARD PID ---
      extendsClause = 'extends PIDSubsystem';
      imports.add('edu.wpi.first.math.controller.PIDController');
      imports.add('edu.wpi.first.wpilibj2.command.PIDSubsystem');

      if (pidConfig && pidConfig.useTuneable) {
        imports.add('frc.robot.lib.TuneablePIDController');
        // Standard: new TuneablePIDController(name, P, I, D, S, V, A, G, Type)
        constructorBody += `    super(new TuneablePIDController("${subsystemName}PID", ${pVal}, ${iVal}, ${dVal}, ${sVal}, ${vVal}, ${aVal}, ${gVal}, ${ffTypeStr}));\n`;
      } else {
        constructorBody += `    super(new PIDController(${pVal}, ${iVal}, ${dVal}));\n`;
      }
    }

    // Output Range (Common for both if wrapper supports it or we use getController())
    if (pidConfig?.minOutput && pidConfig?.maxOutput) {
      if (pidConfig.useTuneable) {
        constructorBody += `    ((Tuneable${pidConfig.isProfiled ? 'Profiled' : ''}PIDController)getController()).setOutputRange(${pidConfig.minOutput}, ${pidConfig.maxOutput});\n`;
      } else {
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
  }

${isPidSubsystem ? `
  @Override
  protected void useOutput(double output, ${pidConfig?.isProfiled ? 'TrapezoidProfile.State' : 'double'} setpoint) {
    // Use the output here
  }

  @Override
  protected double getMeasurement() {
    // Return the process variable measurement here
    return 0;
  }` : ''}

${helperMethods.join('\n\n')}
}
`;

  return { code, constants: collectedConstants };
}

module.exports = { generateSubsystemCode };

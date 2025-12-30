const vscode = require('vscode');
const path = require('path');

/**
 * Generates YAMS Subsystem and Sim files.
 * @param {object} data - Configuration data from the UI.
 * @param {string} rootPath - Root path of the workspace.
 */
async function generateYAMSSubsystem(data, rootPath) {
    const {
        subsystemName
    } = data;

    const folderName = subsystemName;
    const subsystemClass = subsystemName;
    const simClass = `${subsystemName}Sim`;

    // Directory: src/main/java/frc/robot/subsystems/{Name}
    const targetDir = path.join(rootPath, 'src', 'main', 'java', 'frc', 'robot', 'subsystems', folderName);

    // Ensure directory exists
    try {
        await vscode.workspace.fs.createDirectory(vscode.Uri.file(targetDir));
    } catch (e) {
        // Ignore if exists
    }

    // --- Generate Subsystem Java ---
    const subsystemCode = generateSubsystemCode(data, subsystemClass);
    await vscode.workspace.fs.writeFile(
        vscode.Uri.file(path.join(targetDir, `${subsystemClass}.java`)),
        new TextEncoder().encode(subsystemCode)
    );

    // --- Generate Sim Java ---
    const simCode = generateSimCode(data, subsystemClass, simClass);
    await vscode.workspace.fs.writeFile(
        vscode.Uri.file(path.join(targetDir, `${simClass}.java`)),
        new TextEncoder().encode(simCode)
    );

    vscode.window.showInformationMessage(`Generated ${subsystemClass} and ${simClass} in subsystems/${folderName}`);
}

function generateSubsystemCode(data, className) {
    const { mechanismType, motorConfig, controlConfig } = data;

    // Defaulting to Pivot logic as per user template, but using switch for slight variations if needed
    // The user provided template is specifically for a PIVOT (SingleJointedArm) using SparkMax.

    const isSparkMax = motorConfig.controllerType === 'SparkMax';
    // Ideally we handle TalonFX too, but for this step we match the user's requested SparkMax template.

    return `package frc.robot.subsystems.${data.subsystemName};

import static edu.wpi.first.units.Units.Radians;
import static edu.wpi.first.units.Units.RadiansPerSecond;
import static edu.wpi.first.units.Units.Rotations;
import static edu.wpi.first.units.Units.RotationsPerSecond;

import com.revrobotics.RelativeEncoder;
import com.revrobotics.sim.SparkRelativeEncoderSim;
import com.revrobotics.spark.ClosedLoopSlot;
import com.revrobotics.spark.FeedbackSensor;
import com.revrobotics.spark.SparkBase.ControlType;
import com.revrobotics.spark.SparkBase.PersistMode;
import com.revrobotics.spark.SparkBase.ResetMode;
import com.revrobotics.spark.SparkClosedLoopController;
import com.revrobotics.spark.SparkLowLevel.MotorType;
import com.revrobotics.spark.SparkMax;
import com.revrobotics.spark.SparkSim;
import com.revrobotics.spark.config.SparkBaseConfig.IdleMode;
import com.revrobotics.spark.config.SparkMaxConfig;
import edu.wpi.first.epilogue.Logged;
import edu.wpi.first.math.controller.ArmFeedforward;
import edu.wpi.first.math.system.plant.DCMotor;
import edu.wpi.first.math.util.Units;
import edu.wpi.first.wpilibj.RobotController;
import edu.wpi.first.wpilibj.simulation.BatterySim;
import edu.wpi.first.wpilibj.simulation.RoboRioSim;
import edu.wpi.first.wpilibj.simulation.SingleJointedArmSim;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.SubsystemBase;

/**
 * ${mechanismType} subsystem using ${motorConfig.controllerType}
 */
@Logged(name = "${className}")
public class ${className} extends SubsystemBase {

  // Constants
  private final DCMotor dcMotor = DCMotor.getNEO(1);
  private final int canID = ${motorConfig.canId || 1};
  private final double gearRatio = 15; // TODO: Make configurable
  private final double kP = ${controlConfig.kP || 0};
  private final double kI = ${controlConfig.kI || 0};
  private final double kD = ${controlConfig.kD || 0};
  private final double kS = ${controlConfig.kS || 0};
  private final double kV = ${controlConfig.kV || 0};
  private final double kA = ${controlConfig.kA || 0};
  private final double kG = ${controlConfig.kG || 0};
  private final double maxVelocity = 1; // rad/s
  private final double maxAcceleration = 1; // rad/s²
  private final boolean brakeMode = true;
  private final double statorCurrentLimit = 40;

  // Feedforward
  private final ArmFeedforward feedforward = new ArmFeedforward(
    kS, 
    0, // kG - Pivot doesn't need gravity compensation (or kG if vertical)
    kV, 
    kA
  );

  // Motor controller
  private final SparkMax motor;
  private final RelativeEncoder encoder;
  private final SparkSim motorSim;
  private final SparkClosedLoopController sparkPidController;

  // Simulation
  private final SingleJointedArmSim pivotSim;

  /**
   * Creates a new ${className}.
   */
  public ${className}() {
    // Initialize motor controller
    SparkMaxConfig motorConfig = new SparkMaxConfig();
    motor = new SparkMax(canID, MotorType.kBrushless);
    motorConfig.idleMode(brakeMode ? IdleMode.kBrake : IdleMode.kCoast);

    // Configure encoder
    encoder = motor.getEncoder();
    encoder.setPosition(0);

    // Set current limits
    motorConfig.smartCurrentLimit((int)statorCurrentLimit);

    // Configure Feedback and Feedforward
    sparkPidController = motor.getClosedLoopController();
    motorConfig.closedLoop
      .feedbackSensor(FeedbackSensor.kPrimaryEncoder)
      .pid(kP, kI, kD, ClosedLoopSlot.kSlot0);
    motorConfig.closedLoop.feedForward.kS(kS).kV(kV).kA(kA);
    motorConfig.closedLoop.feedForward.kG(kG);

    // Configure Encoder Gear Ratio
    motorConfig.encoder
      .positionConversionFactor(1.0 / gearRatio)
      .velocityConversionFactor((1.0 / gearRatio) / 60.0); // Convert RPM to RPS

    // Save configuration
    motor.configure(
      motorConfig,
      ResetMode.kResetSafeParameters,
      PersistMode.kPersistParameters
    );
    motorSim = new SparkSim(motor, dcMotor);

    // Initialize simulation
    pivotSim = new SingleJointedArmSim(
      dcMotor, // Motor type
      gearRatio,
      0.01, // Arm moment of inertia
      0.4, // Arm length (m)
      Units.degreesToRadians(-90), // Min angle (rad)
      Units.degreesToRadians(90), // Max angle (rad)
      false, // Simulate gravity - Disable gravity for pivot
      Units.degreesToRadians(0) // Starting position (rad)
    );
  }

  @Override
  public void periodic() {}

  /**
   * Update simulation.
   */
  @Override
  public void simulationPeriodic() {
    // Set input voltage from motor controller to simulation
    pivotSim.setInput(getVoltage());

    // Update simulation by 20ms
    pivotSim.update(0.020);
    RoboRioSim.setVInVoltage(
      BatterySim.calculateDefaultBatteryLoadedVoltage(
        pivotSim.getCurrentDrawAmps()
      )
    );

    double motorPosition = Radians.of(pivotSim.getAngleRads() * gearRatio).in(Rotations);
    double motorVelocity = RadiansPerSecond.of(pivotSim.getVelocityRadPerSec() * gearRatio).in(RotationsPerSecond);
    
    motorSim.iterate(motorVelocity, RoboRioSim.getVInVoltage(), 0.02);
  }

  /**
   * Get the current position in Rotations.
   * @return Position in Rotations
   */
  @Logged(name = "Position/Rotations")
  public double getPosition() {
    return encoder.getPosition();
  }
  
  public double getPositionRadians() {
      return Units.rotationsToRadians(getPosition());
  }

  /**
   * Get the current velocity in rotations per second.
   * @return Velocity in rotations per second
   */
  @Logged(name = "Velocity")
  public double getVelocity() {
    return encoder.getVelocity();
  }

  /**
   * Get the current applied voltage.
   * @return Applied voltage
   */
  @Logged(name = "Voltage")
  public double getVoltage() {
    return motor.getAppliedOutput() * motor.getBusVoltage();
  }

  public double getCurrent() {
    return motor.getOutputCurrent();
  }

  public double getTemperature() {
    return motor.getMotorTemperature();
  }

  /**
   * Set pivot angle.
   * @param angleDegrees The target angle in degrees
   */
  public void setAngle(double angleDegrees) {
    setAngle(angleDegrees, 0);
  }

  /**
   * Set pivot angle with acceleration.
   * @param angleDegrees The target angle in degrees
   * @param acceleration The acceleration in rad/s²
   */
  public void setAngle(double angleDegrees, double acceleration) {
    double angleRadians = Units.degreesToRadians(angleDegrees);
    double positionRotations = angleRadians / (2.0 * Math.PI);

    sparkPidController.setSetpoint(
      positionRotations,
      ControlType.kMAXMotionPositionControl,
      ClosedLoopSlot.kSlot0
    );
  }

  public void setVelocity(double velocityDegPerSec) {
    setVelocity(velocityDegPerSec, 0);
  }

  public void setVelocity(double velocityDegPerSec, double acceleration) {
    double velocityRadPerSec = Units.degreesToRadians(velocityDegPerSec);
    double velocityRotations = velocityRadPerSec / (2.0 * Math.PI);

    sparkPidController.setSetpoint(
      velocityRotations,
      ControlType.kVelocity,
      ClosedLoopSlot.kSlot0
    );
  }

  public void setVoltage(double voltage) {
    motor.setVoltage(voltage);
  }

  public SingleJointedArmSim getSimulation() {
    return pivotSim;
  }

  public Command setAngleCommand(double angleDegrees) {
    return runOnce(() -> setAngle(angleDegrees));
  }
  
  public Command stopCommand() {
    return runOnce(() -> setVelocity(0));
  }
}
`;
}

function generateSimCode(data, subsystemClass, simClassName) {
    return `package frc.robot.subsystems.${data.subsystemName};

import edu.wpi.first.math.util.Units;
import edu.wpi.first.wpilibj.smartdashboard.Mechanism2d;
import edu.wpi.first.wpilibj.smartdashboard.MechanismLigament2d;
import edu.wpi.first.wpilibj.smartdashboard.MechanismRoot2d;
import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;
import edu.wpi.first.wpilibj.util.Color;
import edu.wpi.first.wpilibj.util.Color8Bit;
import edu.wpi.first.wpilibj2.command.SubsystemBase;

/**
 * Visualization for the pivot subsystem in simulation.
 */
public class ${simClassName} extends SubsystemBase {

  private final ${subsystemClass} pivot;

  // Simulation display
  private final Mechanism2d mech;
  private final MechanismRoot2d root;
  private final MechanismLigament2d pivotMech;

  // Visualization constants
  private final double BASE_WIDTH = 60.0;
  private final double BASE_HEIGHT = 10.0;
  private final double PIVOT_LENGTH = 40.0;
  private final double PIVOT_WIDTH = 6.0;

  /**
   * Creates a new visualization for the pivot.
   *
   * @param pivotSubsystem The pivot subsystem to visualize
   */
  public ${simClassName}(${subsystemClass} pivotSubsystem) {
    this.pivot = pivotSubsystem;

    // Create the simulation display
    mech = new Mechanism2d(300, 300);
    root = mech.getRoot("PivotRoot", 150, 150);

    // Add base
    MechanismLigament2d base = root.append(
      new MechanismLigament2d(
        "Base",
        BASE_WIDTH,
        0,
        BASE_HEIGHT,
        new Color8Bit(Color.kDarkGray)
      )
    );

    // Add pivot point
    MechanismLigament2d pivotPoint = base.append(
      new MechanismLigament2d(
        "PivotPoint",
        5,
        90,
        5,
        new Color8Bit(Color.kBlack)
      )
    );

    // Add the pivot mechanism
    pivotMech = pivotPoint.append(
      new MechanismLigament2d(
        "Pivot",
        PIVOT_LENGTH,
        0,
        PIVOT_WIDTH,
        new Color8Bit(Color.kBlue)
      )
    );

    // Initialize visualization
    SmartDashboard.putData("Pivot Sim", mech);
  }

  @Override
  public void periodic() {
    // Update pivot angle
    double currentAngleRad = pivot.getSimulation().getAngleRads();
    pivotMech.setAngle(Units.radiansToDegrees(currentAngleRad));

    // Add telemetry data
    SmartDashboard.putNumber(
      "${data.subsystemName} Angle (deg)",
      Units.radiansToDegrees(currentAngleRad)
    );
    SmartDashboard.putNumber(
      "${data.subsystemName} Velocity (deg/s)",
      Units.radiansToDegrees(pivot.getSimulation().getVelocityRadPerSec())
    );
    SmartDashboard.putNumber(
      "${data.subsystemName} Current (A)",
      pivot.getSimulation().getCurrentDrawAmps()
    );
  }
}
`;
}

module.exports = {
    generateYAMSSubsystem
};

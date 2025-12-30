package frc.robot.lib;

import edu.wpi.first.math.controller.PIDController;
import edu.wpi.first.math.trajectory.TrapezoidProfile;
import edu.wpi.first.util.sendable.SendableBuilder;
import edu.wpi.first.wpilibj.smartdashboard.MechanismLigament2d;
import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.InstantCommand;
import edu.wpi.first.wpilibj2.command.RunCommand;
import edu.wpi.first.wpilibj2.command.SubsystemBase;

/**
 * A "Plenty Powerful" subsystem base for PID-controlled mechanisms.
 * Includes:
 * - Integration with {@link TuneablePIDController}
 * - Optional Motion Profiling (TrapezoidProfile)
 * - Stall Detection
 * - Mechanism2d Visualization
 * - Automatic Dashboard status publishing
 */
public abstract class TuneablePIDSubsystem extends SubsystemBase {

    protected final TuneablePIDController m_controller;
    protected boolean m_enabled = false;
    private double m_setpoint = 0.0;

    // Motion Profiling support
    private boolean m_isProfiled = false;
    private TrapezoidProfile.Constraints m_constraints;
    private TrapezoidProfile.State m_profileGoal = new TrapezoidProfile.State();
    private TrapezoidProfile.State m_profileSetpoint = new TrapezoidProfile.State();
    private final TrapezoidProfile m_profile = new TrapezoidProfile(new TrapezoidProfile.Constraints(0, 0)); // Dummy
                                                                                                             // init

    // Safety
    private StallDetector m_stallDetector;
    private double m_minSoftLimit = Double.NEGATIVE_INFINITY;
    private double m_maxSoftLimit = Double.POSITIVE_INFINITY;

    // Visualization
    private MechanismLigament2d m_visualizer;
    private double m_visOffset = 0.0; // Offset to add to measurement for visualization (e.g. angle mounting offset)

    /**
     * @param controller      The TuneablePIDController to use.
     * @param initialSetpoint The initial setpoint.
     */
    public TuneablePIDSubsystem(TuneablePIDController controller, double initialSetpoint) {
        this.m_controller = controller;
        this.m_setpoint = initialSetpoint;
        // Default to current measurement if possible? No, user must enable.
    }

    public TuneablePIDSubsystem(TuneablePIDController controller) {
        this(controller, 0.0);
    }

    /**
     * Returns the current measurement of the process variable.
     */
    public abstract double getMeasurement();

    /**
     * Uses the output from the PID controller.
     * 
     * @param output   The output to use (e.g. motor voltage or duty cycle).
     * @param setpoint The setpoint that generated this output (useful for
     *                 feedforward).
     */
    public abstract void useOutput(double output, double setpoint);

    /**
     * Optional: Returns the current velocity of the mechanism.
     * Required for Stall Detection if velocity threshold is used.
     */
    public double getVelocity() {
        return 0.0;
    }

    /**
     * Optional: Returns the current of the motor.
     * Required for Stall Detection if current threshold is used.
     */
    public double getCurrent() {
        return 0.0;
    }

    @Override
    public void periodic() {
        // safety: check soft limits
        // We do not strictly prevent movement here, but we can clamp the setpoint or
        // output if we wanted.
        // Usually soft limits are best handled in hardware or useOutput,
        // but we can disable if out of bounds.

        if (m_enabled) {
            double measurement = getMeasurement();

            // Check Stall
            if (m_stallDetector != null) {
                // We need the *previous* output to check for stall really, or the current
                // loop's proposed output.
                // Or current drawn.
                // For simplicity, we check based on the last applied state or just check
                // conditions now.
                // Since this runs before calculation, we are checking the state resulting from
                // the *previous* loop.
                // Ideally useOutput saves the last output.
                // Let's assume we can get meaningful data.
                // We might need to pass the *calculated* output to the detector.
            }

            double nextSetpoint = m_setpoint;

            if (m_isProfiled && m_constraints != null) {
                // Update profile
                m_profileGoal = new TrapezoidProfile.State(m_setpoint, 0);
                // Calculate new profile setpoint based on current state (or last profile
                // setpoint)
                // Using last profile setpoint ensures smooth continuity
                m_profileSetpoint = m_profile.calculate(0.02, m_profileSetpoint, m_profileGoal);
                nextSetpoint = m_profileSetpoint.position;
            }

            // Calculate PID
            double output = m_controller.calculate(measurement, nextSetpoint);

            // Check stall AFTER calculation (using the output we are about to apply)
            // OR check before using sensor data.
            // Let's delegate stall check to a user override if they want complex logic,
            // or we add a loop hook.
            if (m_stallDetector != null && m_stallDetector.checkStall(output, getVelocity(), getCurrent())) {
                disable();
                System.out.println("TuneablePIDSubsystem " + getName() + " disabled due to STALL!");
            } else {
                useOutput(output, nextSetpoint);
            }

        }

        // Visualization
        if (m_visualizer != null) {
            m_visualizer.setAngle(getMeasurement() + m_visOffset);
        }
    }

    public void setSetpoint(double setpoint) {
        this.m_setpoint = Math.min(Math.max(setpoint, m_minSoftLimit), m_maxSoftLimit);
    }

    public double getSetpoint() {
        return m_setpoint;
    }

    public void enable() {
        m_enabled = true;
        m_controller.reset();
        // Reset profile state to current measurement to avoid jumps
        m_profileSetpoint = new TrapezoidProfile.State(getMeasurement(), getVelocity());
        if (m_stallDetector != null)
            m_stallDetector.reset();
    }

    public void disable() {
        m_enabled = false;
        useOutput(0, 0); // Safety: Stop motor on disable
    }

    public boolean isEnabled() {
        return m_enabled;
    }

    public void toggle() {
        if (m_enabled)
            disable();
        else
            enable();
    }

    /**
     * Sets the setpoint to the current measurement and enables the controller.
     * Useful for "Hold Current Position" commands.
     */
    public void hold() {
        setSetpoint(getMeasurement());
        enable();
    }

    public boolean atSetpoint() {
        // Use controller's tolerance
        return m_controller.atSetpoint();
    }

    /**
     * Configures a Trapezoidal Motion Profile.
     * 
     * @param constraints standard WPILib constraints
     */
    public void setProfiled(TrapezoidProfile.Constraints constraints) {
        this.m_constraints = constraints;
        this.m_isProfiled = true; // Enable profiling
    }

    public void setSoftLimits(double min, double max) {
        m_minSoftLimit = min;
        m_maxSoftLimit = max;
    }

    public void setStallDetector(StallDetector detector) {
        this.m_stallDetector = detector;
    }

    public void setVisualizer(MechanismLigament2d visualizer, double offset) {
        this.m_visualizer = visualizer;
        this.m_visOffset = offset;
    }

    public TuneablePIDController getController() {
        return m_controller;
    }

    // --- Command Factories ---

    public Command enableCommand() {
        return new InstantCommand(this::enable, this).withName("Enable");
    }

    public Command disableCommand() {
        return new InstantCommand(this::disable, this).withName("Disable");
    }

    public Command setSetpointCommand(double setpoint) {
        return new InstantCommand(() -> setSetpoint(setpoint), this).withName("SetSetpoint");
    }

    public Command holdCommand() {
        return new InstantCommand(this::hold, this).withName("HoldPosition");
    }

    /**
     * returns a command that runs the PID loop (which runs in periodic anyway,
     * but this ensures requirements are required).
     * Actually since logic is in periodic, we just need a RunCommand that keeps the
     * subsystem required.
     * But if we want to change setpoint continuously:
     */
    public Command runToSetpoint(double setpoint) {
        return new RunCommand(() -> {
            setSetpoint(setpoint);
            enable(); // Ensure enabled
        }, this).beforeStarting(this::enable).finallyDo(this::disable);
    }

    @Override
    public void initSendable(SendableBuilder builder) {
        super.initSendable(builder);
        builder.addBooleanProperty("Enabled", this::isEnabled,
                (val) -> {
                    if (val)
                        enable();
                    else
                        disable();
                });
        builder.addDoubleProperty("Setpoint", this::getSetpoint, this::setSetpoint);
        builder.addDoubleProperty("Measurement", this::getMeasurement, null);
        builder.addBooleanProperty("AtSetpoint", this::atSetpoint, null);
        if (m_isProfiled) {
            builder.addDoubleProperty("ProfileSetpoint", () -> m_profileSetpoint.position, null);
        }
    }
}

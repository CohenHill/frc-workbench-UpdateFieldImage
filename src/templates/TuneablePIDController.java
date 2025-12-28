package frc.robot.lib;

import edu.wpi.first.math.MathUtil;
import edu.wpi.first.math.controller.PIDController;
import edu.wpi.first.util.sendable.SendableBuilder;
import edu.wpi.first.util.sendable.SendableRegistry;
import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;

/**
 * A wrapper around WPILib's PIDController that provides
 * easier integration with the FRC VS Code Plugin's PID Tuner.
 * Includes Feedforward (kF) and Output Range limiting.
 */
public class TuneablePIDController extends PIDController {
    private final String m_name;
    private double m_kS = 0.0;
    private double m_kV = 0.0;
    private double m_kA = 0.0; // Unused in standard PID calculate without profile, but kept for tuning
    private double m_kG = 0.0;
    private FeedforwardType m_type = FeedforwardType.STATIC;
    private double m_minOutput = -1.0;
    private double m_maxOutput = 1.0;

    public enum FeedforwardType {
        STATIC, ELEVATOR, ARM
    }

    /**
     * Create a new TuneablePIDController.
     *
     * @param name The name of the controller (for the Tuner).
     * @param kp   The proportional coefficient.
     * @param ki   The integral coefficient.
     * @param kd   The derivative coefficient.
     */
    public TuneablePIDController(String name, double kp, double ki, double kd) {
        this(name, kp, ki, kd, 0.0, 0.0, 0.0, 0.0, FeedforwardType.STATIC);
    }

    /**
     * Create a new TuneablePIDController with SVGA Feedforward.
     *
     * @param name The name of the controller (for the Tuner).
     * @param kp   The proportional coefficient.
     * @param ki   The integral coefficient.
     * @param kd   The derivative coefficient.
     * @param ks   The static gain.
     * @param kv   The velocity gain.
     * @param ka   The acceleration gain.
     */
    public TuneablePIDController(String name, double kp, double ki, double kd, double ks, double kv, double ka) {
        this(name, kp, ki, kd, ks, kv, ka, 0.0, FeedforwardType.STATIC);
    }

    /**
     * Create a new TuneablePIDController with SVGA Feedforward and Gravity
     * Feedforward.
     *
     * @param name The name of the controller (for the Tuner).
     * @param kP   The proportional coefficient.
     * @param kI   The integral coefficient.
     * @param kD   The derivative coefficient.
     * @param kS   The static gain.
     * @param kV   The velocity gain.
     * @param kA   The acceleration gain.
     * @param kG   The gravity gain.
     * @param type The type of feedforward (STATIC, ELEVATOR, ARM).
     */
    public TuneablePIDController(String name, double kP, double kI, double kD, double kS, double kV, double kA,
            double kG, FeedforwardType type) {
        super(kP, kI, kD);
        this.m_name = name;
        this.m_kS = kS;
        this.m_kV = kV;
        this.m_kA = kA;
        this.m_kG = kG;
        this.m_type = (type == null) ? FeedforwardType.STATIC : type;
        SendableRegistry.add(this, "TuneablePID", name);
        SmartDashboard.putData("PIDTuning/" + name, this);
    }

    /**
     * Create a new TuneablePIDController with SVGA Feedforward and Period.
     *
     * @param name   The name of the controller (for the Tuner).
     * @param kp     The proportional coefficient.
     * @param ki     The integral coefficient.
     * @param kd     The derivative coefficient.
     * @param ks     The static gain.
     * @param kv     The velocity gain.
     * @param ka     The acceleration gain.
     * @param period The period between controller updates in seconds.
     */
    public TuneablePIDController(String name, double kp, double ki, double kd, double ks, double kv, double ka,
            double period) {
        this(name, kp, ki, kd, ks, kv, ka, 0.0, FeedforwardType.STATIC, period);
    }

    /**
     * Create a new TuneablePIDController with SVGA Feedforward, Gravity
     * Feedforward, and Period.
     *
     * @param name   The name of the controller (for the Tuner).
     * @param kP     The proportional coefficient.
     * @param kI     The integral coefficient.
     * @param kD     The derivative coefficient.
     * @param kS     The static gain.
     * @param kV     The velocity gain.
     * @param kA     The acceleration gain.
     * @param kG     The gravity gain.
     * @param type   The type of feedforward (STATIC, ELEVATOR, ARM).
     * @param period The period between controller updates in seconds.
     */
    public TuneablePIDController(String name, double kP, double kI, double kD, double kS, double kV, double kA,
            double kG, FeedforwardType type,
            double period) {
        super(kP, kI, kD, period);
        this.m_name = name;
        this.m_kS = kS;
        this.m_kV = kV;
        this.m_kA = kA;
        this.m_kG = kG;
        this.m_type = (type == null) ? FeedforwardType.STATIC : type;
        SendableRegistry.add(this, "TuneablePID", name);
        SmartDashboard.putData("PIDTuning/" + name, this);
    }

    public String getName() {
        return m_name;
    }

    public void setS(double ks) {
        m_kS = ks;
    }

    public double getS() {
        return m_kS;
    }

    public void setV(double kv) {
        m_kV = kv;
    }

    public double getV() {
        return m_kV;
    }

    public void setA(double ka) {
        m_kA = ka;
    }

    public double getA() {
        return m_kA;
    }

    public void setkG(double kG) {
        m_kG = kG;
    }

    public double getkG() {
        return m_kG;
    }

    /**
     * Sets the minimum and maximum output range.
     *
     * @param min The minimum output.
     * @param max The maximum output.
     */
    public void setOutputRange(double min, double max) {
        m_minOutput = min;
        m_maxOutput = max;
    }

    @Override
    public double calculate(double measurement) {
        // Calculate standard PID
        double pidOutput = super.calculate(measurement);

        // Add Feedforward (kS * sign(setpoint) + kV * setpoint)
        double feedforward = m_kS * Math.signum(getSetpoint()) + m_kV * getSetpoint();

        if (m_type == FeedforwardType.ELEVATOR) {
            feedforward += m_kG;
        } else if (m_type == FeedforwardType.ARM) {
            feedforward += m_kG * Math.cos(getSetpoint()); // Assuming setpoint represents angle for Arm
        }

        // Combine and clamp
        return MathUtil.clamp(pidOutput + feedforward, m_minOutput, m_maxOutput);
    }

    @Override
    public void initSendable(SendableBuilder builder) {
        super.initSendable(builder);
        builder.setSmartDashboardType("PIDController");

        builder.addDoubleProperty("kS", this::getS, this::setS);
        builder.addDoubleProperty("kV", this::getV, this::setV);
        builder.addDoubleProperty("kA", this::getA, this::setA);
        builder.addDoubleProperty("kG", this::getkG, this::setkG);
        builder.addStringProperty("FFType", () -> m_type.toString(), null);
        builder.addDoubleProperty("minOutput", () -> m_minOutput, (val) -> m_minOutput = val);
        builder.addDoubleProperty("maxOutput", () -> m_maxOutput, (val) -> m_maxOutput = val);
    }
}

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
    private double m_kF = 0.0;
    private double m_minOutput = -1.0;
    private double m_maxOutput = 1.0;

    /**
     * Create a new TuneablePIDController.
     *
     * @param name The name of the controller (for the Tuner).
     * @param kp The proportional coefficient.
     * @param ki The integral coefficient.
     * @param kd The derivative coefficient.
     */
    public TuneablePIDController(String name, double kp, double ki, double kd) {
        this(name, kp, ki, kd, 0.0);
    }

    /**
     * Create a new TuneablePIDController with Feedforward.
     *
     * @param name The name of the controller (for the Tuner).
     * @param kp The proportional coefficient.
     * @param ki The integral coefficient.
     * @param kd The derivative coefficient.
     * @param kf The feedforward coefficient.
     */
    public TuneablePIDController(String name, double kp, double ki, double kd, double kf) {
        super(kp, ki, kd);
        this.m_name = name;
        this.m_kF = kf;
        SendableRegistry.add(this, "TuneablePID", name);
        SmartDashboard.putData("PIDTuning/" + name, this);
    }

    /**
     * Create a new TuneablePIDController with Feedforward and Period.
     *
     * @param name The name of the controller (for the Tuner).
     * @param kp The proportional coefficient.
     * @param ki The integral coefficient.
     * @param kd The derivative coefficient.
     * @param kf The feedforward coefficient.
     * @param period The period between controller updates in seconds.
     */
    public TuneablePIDController(String name, double kp, double ki, double kd, double kf, double period) {
        super(kp, ki, kd, period);
        this.m_name = name;
        this.m_kF = kf;
        SendableRegistry.add(this, "TuneablePID", name);
        SmartDashboard.putData("PIDTuning/" + name, this);
    }

    public String getName() {
        return m_name;
    }

    /**
     * Sets the Feedforward coefficient.
     *
     * @param kf The feedforward coefficient.
     */
    public void setF(double kf) {
        m_kF = kf;
    }

    /**
     * Gets the Feedforward coefficient.
     *
     * @return The feedforward coefficient.
     */
    public double getF() {
        return m_kF;
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
        
        // Add Feedforward (Simple kF * setpoint)
        double feedforward = m_kF * getSetpoint();
        
        // Combine and clamp
        return MathUtil.clamp(pidOutput + feedforward, m_minOutput, m_maxOutput);
    }

    @Override
    public void initSendable(SendableBuilder builder) {
        super.initSendable(builder);
        builder.setSmartDashboardType("PIDController");
        
        builder.addDoubleProperty("f", this::getF, this::setF);
        builder.addDoubleProperty("minOutput", () -> m_minOutput, (val) -> m_minOutput = val);
        builder.addDoubleProperty("maxOutput", () -> m_maxOutput, (val) -> m_maxOutput = val);
    }
}

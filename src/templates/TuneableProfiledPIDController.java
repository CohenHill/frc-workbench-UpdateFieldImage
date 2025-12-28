package frc.robot.lib;

import edu.wpi.first.math.controller.ProfiledPIDController;
import edu.wpi.first.math.trajectory.TrapezoidProfile;
import edu.wpi.first.math.MathUtil;
import edu.wpi.first.util.sendable.SendableBuilder;
import edu.wpi.first.util.sendable.SendableRegistry;

/**
 * A wrapper around ProfiledPIDController that automatically publishes values to
 * SmartDashboard/Shuffleboard for live tuning.
 */
public class TuneableProfiledPIDController extends ProfiledPIDController {
    private final String name;
    private static final String TABLE_NAME = "PIDTuning";
    private double m_kS;
    private double m_kV;
    private double m_kA;
    private double m_kG;
    private FeedforwardType m_type = FeedforwardType.STATIC;
    private double m_lastVelocity = 0;

    public enum FeedforwardType {
        STATIC, ELEVATOR, ARM
    }

    private double m_minOutput = -1.0;
    private double m_maxOutput = 1.0;

    public TuneableProfiledPIDController(String name, double kP, double kI, double kD, double kS, double kV, double kA,
            double kG, FeedforwardType type, TrapezoidProfile.Constraints constraints) {
        super(kP, kI, kD, constraints);
        this.name = name;
        m_kS = kS;
        m_kV = kV;
        m_kA = kA;
        m_kG = kG;
        m_type = type;
        if (m_type == null)
            m_type = FeedforwardType.STATIC;
        SendableRegistry.add(this, TABLE_NAME, name);
    }

    public TuneableProfiledPIDController(String name, double kP, double kI, double kD, double kS, double kV, double kA,
            TrapezoidProfile.Constraints constraints) {
        this(name, kP, kI, kD, kS, kV, kA, 0.0, FeedforwardType.STATIC, constraints);
    }

    @Override
    public void initSendable(SendableBuilder builder) {
        super.initSendable(builder);
        builder.addDoubleProperty("kP", this::getP, this::setP);
        builder.addDoubleProperty("kI", this::getI, this::setI);
        builder.addDoubleProperty("kD", this::getD, this::setD);
        builder.addDoubleProperty("kS", this::getS, this::setS);
        builder.addDoubleProperty("kV", this::getV, this::setV);
        builder.addDoubleProperty("kA", this::getA, this::setA);
        builder.addDoubleProperty("kG", this::getkG, this::setkG);
        // Type not strictly tuneable here, but could be useful to see
        builder.addStringProperty("FFType", () -> m_type.toString(), null);
        builder.addDoubleProperty("minOutput", () -> m_minOutput, (val) -> m_minOutput = val);
        builder.addDoubleProperty("maxOutput", () -> m_maxOutput, (val) -> m_maxOutput = val);
        builder.addDoubleProperty("Max Velocity", () -> getConstraints().maxVelocity,
                (val) -> setConstraints(new TrapezoidProfile.Constraints(val, getConstraints().maxAcceleration)));
        builder.addDoubleProperty("Max Acceleration", () -> getConstraints().maxAcceleration,
                (val) -> setConstraints(new TrapezoidProfile.Constraints(getConstraints().maxVelocity, val)));
        builder.addDoubleProperty("Goal", () -> getGoal().position, (val) -> setGoal(val));
        builder.addDoubleProperty("Setpoint", () -> getSetpoint().position, null);
        builder.addDoubleProperty("Error", this::getPositionError, null);
    }

    public void setConstraints(TrapezoidProfile.Constraints constraints) {
        super.setConstraints(constraints);
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

    public TrapezoidProfile.Constraints getConstraints() {
        return super.getConstraints();
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
        double output = super.calculate(measurement);
        var setpoint = getSetpoint();
        double accel = (setpoint.velocity - m_lastVelocity) / getPeriod();

        double ff = m_kS * Math.signum(setpoint.velocity) + m_kV * setpoint.velocity + m_kA * accel;

        if (m_type == FeedforwardType.ELEVATOR) {
            ff += m_kG;
        } else if (m_type == FeedforwardType.ARM) {
            ff += m_kG * Math.cos(setpoint.position);
        }

        m_lastVelocity = setpoint.velocity;
        return MathUtil.clamp(output + ff, m_minOutput, m_maxOutput);
    }

    public void setkG(double kG) {
        m_kG = kG;
    }

    public double getkG() {
        return m_kG;
    }

}

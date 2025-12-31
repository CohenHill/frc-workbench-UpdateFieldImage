package frc.robot.lib;

import edu.wpi.first.math.MathUtil;
import edu.wpi.first.math.controller.PIDController;
import edu.wpi.first.util.sendable.Sendable;
import edu.wpi.first.util.sendable.SendableBuilder;
import edu.wpi.first.util.sendable.SendableRegistry;
import edu.wpi.first.wpilibj.smartdashboard.SmartDashboard;

/**
 * A wrapper around WPILib's PIDController that provides
 * easier integration with the FRC VS Code Plugin's PID Tuner.
 * Includes Feedforward (kF) and Output Range limiting.
 * <p>
 * This class uses a Builder pattern for construction to manage the complexity
 * of multiple configuration options.
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

    // Shadowed fields for visualization and tracking
    private double m_measurement = 0.0;
    private double m_accumulatedError = 0.0;
    private double m_prevError = 0.0; // Shadowing PIDController's internal error for Tuner display
    private double m_latestOutput = 0.0;

    public enum FeedforwardType {
        STATIC, ELEVATOR, ARM
    }

    /**
     * Dedicated Sendable for the Tuning Interface.
     */
    private final Sendable m_tunerSendable = new Sendable() {
        @Override
        public void initSendable(SendableBuilder builder) {
            builder.setSmartDashboardType("PIDController");
            builder.addDoubleProperty("setpoint", TuneablePIDController.this::getSetpoint,
                    TuneablePIDController.this::setSetpoint);
            builder.addDoubleProperty("p", TuneablePIDController.this::getP, TuneablePIDController.this::setP);
            builder.addDoubleProperty("i", TuneablePIDController.this::getI, TuneablePIDController.this::setI);
            builder.addDoubleProperty("d", TuneablePIDController.this::getD, TuneablePIDController.this::setD);
            builder.addDoubleProperty("kS", TuneablePIDController.this::getS, TuneablePIDController.this::setS);
            builder.addDoubleProperty("kV", TuneablePIDController.this::getV, TuneablePIDController.this::setV);
            builder.addDoubleProperty("kA", TuneablePIDController.this::getA, TuneablePIDController.this::setA);
            builder.addDoubleProperty("kG", TuneablePIDController.this::getkG, TuneablePIDController.this::setkG);
            builder.addStringProperty("FFType", () -> m_type.toString(), null);
            builder.addDoubleProperty("minOutput", () -> m_minOutput, (val) -> m_minOutput = val);
            builder.addDoubleProperty("maxOutput", () -> m_maxOutput, (val) -> m_maxOutput = val);
            builder.addDoubleProperty(
                    "izone",
                    TuneablePIDController.this::getIZone,
                    (double toSet) -> {
                        try {
                            setIZone(toSet);
                        } catch (IllegalArgumentException e) {
                            System.out.println("IZone must be a non-negative number!");
                        }
                    });
            builder.addDoubleProperty("measurement", () -> m_measurement, null);
            // Use local shadowed fields for display
            builder.addDoubleProperty("previous error", () -> m_prevError, null);
            builder.addDoubleProperty("total error", () -> m_accumulatedError, null);
            builder.addDoubleProperty("output", () -> m_latestOutput, null);
        }
    };

    /**
     * Private constructor used by the Builder.
     */
    private TuneablePIDController(String name, double kp, double ki, double kd, double ks, double kv, double ka,
            double kg, FeedforwardType type, double period, double minOutput, double maxOutput) {
        super(kp, ki, kd, period);
        this.m_name = name;
        this.m_kS = ks;
        this.m_kV = kv;
        this.m_kA = ka;
        this.m_kG = kg;
        this.m_type = type;
        this.m_minOutput = minOutput;
        this.m_maxOutput = maxOutput;

        SendableRegistry.add(this, "TuneablePID", name);
        SendableRegistry.add(m_tunerSendable, "PIDTuner", name);
        SmartDashboard.putData("PIDTuning/" + name, m_tunerSendable);
    }

    /**
     * Builder class for TuneablePIDController.
     */
    public static class Builder {
        private final String name;
        private double kp = 0.0;
        private double ki = 0.0;
        private double kd = 0.0;
        private double ks = 0.0;
        private double kv = 0.0;
        private double ka = 0.0;
        private double kg = 0.0;
        private FeedforwardType type = FeedforwardType.STATIC;
        private double period = 0.02;
        private double minOutput = -1.0;
        private double maxOutput = 1.0;

        public Builder(String name) {
            this.name = name;
        }

        public Builder withP(double kp) {
            this.kp = kp;
            return this;
        }

        public Builder withI(double ki) {
            this.ki = ki;
            return this;
        }

        public Builder withD(double kd) {
            this.kd = kd;
            return this;
        }

        public Builder withS(double ks) {
            this.ks = ks;
            return this;
        }

        public Builder withV(double kv) {
            this.kv = kv;
            return this;
        }

        public Builder withA(double ka) {
            this.ka = ka;
            return this;
        }

        public Builder withG(double kg) {
            this.kg = kg;
            return this;
        }

        public Builder withFeedforwardType(FeedforwardType type) {
            this.type = type;
            return this;
        }

        public Builder withPeriod(double period) {
            this.period = period;
            return this;
        }

        public Builder withOutputRange(double min, double max) {
            this.minOutput = min;
            this.maxOutput = max;
            return this;
        }

        public TuneablePIDController build() {
            return new TuneablePIDController(name, kp, ki, kd, ks, kv, ka, kg, type, period, minOutput, maxOutput);
        }
    }

    // Deprecated constructors for backward compatibility
    /**
     * @deprecated Use {@link Builder} instead.
     */
    @Deprecated
    public TuneablePIDController(String name, double kp, double ki, double kd) {
        this(name, kp, ki, kd, 0.0, 0.0, 0.0, 0.0, FeedforwardType.STATIC, 0.02, -1.0, 1.0);
    }

    /**
     * @deprecated Use {@link Builder} instead.
     */
    @Deprecated
    public TuneablePIDController(String name, double kp, double ki, double kd, double ks, double kv, double ka) {
        this(name, kp, ki, kd, ks, kv, ka, 0.0, FeedforwardType.STATIC, 0.02, -1.0, 1.0);
    }

    /**
     * @deprecated Use {@link Builder} instead.
     */
    @Deprecated
    public TuneablePIDController(String name, double kP, double kI, double kD, double kS, double kV, double kA,
            double kG, FeedforwardType type) {
        this(name, kP, kI, kD, kS, kV, kA, kG, type, 0.02, -1.0, 1.0);
    }

    /**
     * @deprecated Use {@link Builder} instead.
     */
    @Deprecated
    public TuneablePIDController(String name, double kp, double ki, double kd, double ks, double kv, double ka,
            double period) {
        this(name, kp, ki, kd, ks, kv, ka, 0.0, FeedforwardType.STATIC, period, -1.0, 1.0);
    }

    /**
     * @deprecated Use {@link Builder} instead.
     */
    @Deprecated
    public TuneablePIDController(String name, double kP, double kI, double kD, double kS, double kV, double kA,
            double kG, FeedforwardType type, double period) {
        this(name, kP, kI, kD, kS, kV, kA, kG, type, period, -1.0, 1.0);
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
        // Track measurement locally
        m_measurement = measurement;

        // Capture previous error before calculation
        double currentError = getSetpoint() - measurement;
        // Approximation of accumulated error since we don't have direct access to
        // super's 'm_totalError'
        // This is a rough estimation for visualization.
        m_accumulatedError += currentError * getPeriod();
        // m_prevError will be the error from the *last* loop, but to visualize
        // "previous error"
        // confusingly, usually we want the error currently being used for D term.
        // Actually, PIDController calculates:
        // error = setpoint - measurement
        // D = (error - prevError) / period
        // So we want the error from the previous cycle.
        // We can capture 'prevError' by storing the *current* error at the end of this
        // method.
        // But for display in this cycle, we show what it *was* coming in.

        // Calculate standard PID
        double pidOutput = super.calculate(measurement);

        // Update our shadow 'prevError' for next time (or display)
        // Wait, super.calculate updates its internal prevError.
        // We can't easily see what it WAS before calculate called.
        // But we can store what the error IS now, for the NEXT call to display as
        // "previous".
        m_prevError = currentError;

        // Add Feedforward (kS * sign(setpoint) + kV * setpoint)
        double feedforward = m_kS * Math.signum(getSetpoint()) + m_kV * getSetpoint();

        if (m_type == FeedforwardType.ELEVATOR) {
            feedforward += m_kG;
        } else if (m_type == FeedforwardType.ARM) {
            feedforward += m_kG * Math.cos(getSetpoint()); // Assuming setpoint represents angle for Arm
        }

        // Combine and clamp
        double result = MathUtil.clamp(pidOutput + feedforward, m_minOutput, m_maxOutput);
        m_latestOutput = result;
        return result;
    }

    @Override
    public void initSendable(SendableBuilder builder) {
        super.initSendable(builder);
        builder.setSmartDashboardType("PIDController");

        builder.addDoubleProperty("kS", TuneablePIDController.this::getS, TuneablePIDController.this::setS);
        builder.addDoubleProperty("kV", TuneablePIDController.this::getV, TuneablePIDController.this::setV);
        builder.addDoubleProperty("kA", TuneablePIDController.this::getA, TuneablePIDController.this::setA);
        builder.addDoubleProperty("kG", TuneablePIDController.this::getkG, TuneablePIDController.this::setkG);
        builder.addStringProperty("FFType", () -> m_type.toString(), null);
        builder.addDoubleProperty("minOutput", () -> m_minOutput, (val) -> m_minOutput = val);
        builder.addDoubleProperty("maxOutput", () -> m_maxOutput, (val) -> m_maxOutput = val);
        builder.addDoubleProperty(
                "izone",
                TuneablePIDController.this::getIZone,
                (double toSet) -> {
                    try {
                        setIZone(toSet);
                    } catch (IllegalArgumentException e) {
                        System.out.println("IZone must be a non-negative number!");
                    }
                });
        builder.addDoubleProperty("measurement", () -> m_measurement, null);
        // Use local shadowed fields for display
        builder.addDoubleProperty("previous error", () -> m_prevError, null);
        builder.addDoubleProperty("total error", () -> m_accumulatedError, null);
        builder.addDoubleProperty("output", () -> m_latestOutput, null);
    }
}

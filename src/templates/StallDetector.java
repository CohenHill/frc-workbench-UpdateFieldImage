package frc.robot.lib;

import edu.wpi.first.wpilibj.Timer;

/**
 * A helper class to detect stalls in motors/mechanisms.
 * A stall is detected if the applied output signal is high,
 * but the velocity (or current) indicates no movement for a certain duration.
 */
public class StallDetector {
    private final double m_stallCurrentThreshold; // Amps, if using current
    private final double m_stallVelocityThreshold; // Units/sec, if using velocity
    private final double m_stallTimeThreshold; // Seconds
    private final double m_minOutputThreshold; // Minimum output (0-1) to check for stall

    private final Timer m_timer = new Timer();
    private boolean m_isStalled = false;

    /**
     * @param stallCurrentThreshold  Current (Amps) above which we might be stalled
     *                               (optional, pass 0 if unused).
     * @param stallVelocityThreshold Velocity (units/sec) below which we might be
     *                               stalled.
     * @param stallTimeThreshold     Time (seconds) to wait before triggering stall.
     * @param minOutputThreshold     Minimum control output (absolute value, 0-1)
     *                               required to consider checking for stall.
     *                               This prevents detecting stall when we are just
     *                               holding position with low power.
     */
    public StallDetector(double stallCurrentThreshold, double stallVelocityThreshold, double stallTimeThreshold,
            double minOutputThreshold) {
        this.m_stallCurrentThreshold = stallCurrentThreshold;
        this.m_stallVelocityThreshold = stallVelocityThreshold;
        this.m_stallTimeThreshold = stallTimeThreshold;
        this.m_minOutputThreshold = minOutputThreshold;
        m_timer.reset();
        m_timer.start();
    }

    /**
     * Check for stall.
     *
     * @param signal   The current output signal applied to the motor (-1 to 1 or
     *                 Volts).
     * @param velocity The current velocity of the mechanism.
     * @param current  The current draw of the motor (optional, pass 0 if unused).
     * @return True if stalled.
     */
    public boolean checkStall(double signal, double velocity, double current) {
        boolean highOutput = Math.abs(signal) > m_minOutputThreshold;
        boolean lowVelocity = Math.abs(velocity) < m_stallVelocityThreshold;

        // If we are providing significant power but not moving
        boolean potentialStall = highOutput && lowVelocity;

        // Optionally check current if threshold is set
        if (m_stallCurrentThreshold > 0) {
            boolean highCurrent = current > m_stallCurrentThreshold;
            potentialStall = potentialStall && highCurrent;
        }

        if (potentialStall) {
            if (m_timer.hasElapsed(m_stallTimeThreshold)) {
                m_isStalled = true;
            }
        } else {
            // Reset timer if we are moving or not applying power
            m_timer.reset();
            m_isStalled = false;
        }

        return m_isStalled;
    }

    public boolean isStalled() {
        return m_isStalled;
    }

    public void reset() {
        m_timer.reset();
        m_isStalled = false;
    }
}

# FRC Workbench

**Supercharge your FRC workflow in VS Code.**

FRC Workbench provides a suite of tools designed to streamline robot development, from subsystem generation to real-time tuning and path visualization.

## 🚀 Key Features

### 🎛️ Dynamic PID Tuner
Tune your PID controllers in real-time without redeploying code.
*   **Universal Tuning**: Automatically discovers and generates sliders for **any** numeric field exposed by your controller (kP, kI, kD, kS, kV, kA, kG, MaxVelocity, etc.).
*   **Smart Ranges**: Sliders automatically adapt their range based on the parameter name.
*   **Save to Code**: One-click save specific tuned values back to your `RobotMap.java` or `Constants.java`.

### 🛣️ PathPlanner Preview
Visualize your `.path` and `.auto` files directly in VS Code.
*   **Interactive Playback**: Play, pause, and scrub through your path to see the robot's heading at any point.
*   **Stress Visualization**: Paths are color-coded (Green to Red) to visualize curvature stress on the robot.
*   **Auto Routines**: See your full auto routine steps visualized on the field.

### 🧙‍♂️ Advanced Subsystem Creator
Generate robust, modern WPILib subsystems in seconds.
*   **Hardware Setup**: Drag & drop motors (TalonFX, CANSparkMax, etc.) and sensors.
*   **Helper Methods**: Automatically generate common methods like `getVelocity()`, `setPosition()`, or `resetEncoder()`.
*   **State Machines**: Define enum-based states (e.g., `IDLE`, `INTAKING`, `SHOOTING`) and generate the state machine skeleton.
*   **Profiled PID**: Built-in support for `ProfiledPIDController` with Feedforward (Simple, Elevator, Arm) and Trapezoidal profiles.
*   **Tunable PID**: Generate subsystems using the `TuneableProfiledPIDController` to adjust kP, kI, kD, and Feedforward gains live via Shuffleboard/SmartDashboard.
*   **YAMS Integration**: Directly access the YAMS Hub to generate complex mechanisms (Elevators, Arms) with full simulation support.

### 📦 Vendor Library Manager
*   **Smart Detection**: Automatically detects missing vendor libraries (CTRE Phoenix 6, REVLib, ReduxLib, NavX) based on your imports.
*   **One-Click Install**: Prompts to open the Vendor Library Manager if dependencies are missing.

### 📝 Constants Manager
*   **Organized View**: Manage your system constants in a clean, grouped UI.
*   **Safe Editing**: Modify values without worrying about syntax errors.

### ✅ Pre-Flight Checklist
*   **Interactive List**: Track battery status, bumpers, radio configuration, and code deployment before match start.

## Getting Started

1.  **Open Command Palette** (`Ctrl+Shift+P`).
2.  Type `FRC` to see available tools:
    *   `FRC: Subsystem Creator`
    *   `FRC: PID Tuner`
    *   `FRC: PathPlanner Preview` (or just double-click a `.path` file)
3.  Right-click any folder in the Explorer to access the **FRC** submenu.

## Requirements

*   A WPILib robot project (Java).
*   VS Code 1.90+.

## Extension Settings

*   `frcPlugin.constantsFileName`: The name of your constants file (default: `RobotMap.java`).
*   `frcPlugin.autoOpenManager`: Behavior when clicking the constants file.

## Release Notes

### 0.1.0
*   **New**: Dynamic PID Tuner with support for Feedforward (kS, kV, kA, kG) and generic numeric fields.
*   **New**: PathPlanner Preview with Playback controls and Curvature "Stress" visualization.
*   **New**: Enhanced Subsystem Creator with State Machine generation and Helper Methods.
*   **New**: YAMS Integration Hub: A complete mechanism generator UI built into VS Code.
    *   **Mechanism Library**: Auto-fetch latest templates for Elevators, Arms, and Pivots from YamGen.
    *   **Control Modes**: Choose between Motor Controller PID, WPILib ProfiledPID, or the new **Tunable PID** (Shuffleboard-tunable).
    *   **Sim Integration**: Seamlessly generates `SubsystemSim` files for Physics simulation.
*   **New**: Vendor Library presence checks (ReduxLib, NavX, CTRE, REV).
*   **Improved**: Context Menu organization.

---
**Good Luck Teams!** 🤖🚀

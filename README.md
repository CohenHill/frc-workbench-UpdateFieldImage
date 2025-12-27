# FRC Workbench

**The ultimate productivity suite for FRC teams.**

FRC Workbench supercharges your VS Code environment with tools designed specifically for FIRST Robotics Competition development. From tuning PIDs without redeploying to previewing PathPlanner files instantly, this extension helps you code faster and debug smarter.

## Features

### 🛣️ PathPlanner & Auto Preview
Visualize your `.path` and `.auto` files directly in VS Code without opening the PathPlanner app.
*   **Instant Preview**: Double-click any `.path` or `.auto` file.
*   **Full Auto Visualization**: See your entire auto routine, including paths, waits, and commands, on a timeline and the field.
*   **Hover Effects**: Hover over path commands to see exactly where the robot drives.

### 🎛️ Live PID Tuner
Tune your PID controllers in real-time over NetworkTables.
*   **Live Updates**: Change kP, kI, kD, kF values and see the robot react instantly.
*   **Save to Code**: One-click save writes the tuned values back to your `Constants.java` file automatically.

### 📝 Constants Manager
Manage your `RobotMap` or `Constants` file with a clean UI.
*   **No More Scrolling**: View constants grouped by subsystem/module.
*   **Safe Editing**: Edit values without risking syntax errors.

### 🧙‍♂️ Subsystem Wizard
Generate advanced subsystem boilerplate in seconds.
*   **Drag & Drop**: Add motors, sensors, and pneumatics visually.
*   **Modern Code**: Generates WPILib 2024+ Command-Based code.

### 🚀 Pre-Flight Checklist
Ensure your robot is ready for the match.
*   **Interactive Checklist**: Track battery, bumpers, radio, and code status.
*   **Deploy Integration**: Run the checklist before hitting deploy.

## Getting Started

1.  Install the extension.
2.  Open your FRC robot project.
3.  Use the Command Palette (`Ctrl+Shift+P`) and type `FRC:` to see available commands.
4.  Open a `.path` file to try the preview!

## Requirements

*   A WPILib robot project (Java).
*   VS Code 1.90+.

## Extension Settings

*   `frcPlugin.constantsFileName`: The name of your constants file (default: `RobotMap.java`).
*   `frcPlugin.autoOpenManager`: Whether to auto-open the manager when clicking the constants file.

## Known Issues

*   Path preview requires a `field.png` in the extension folder (will be bundled in future releases).

## Release Notes

### 0.0.1
*   Initial release with PathPlanner Preview, PID Tuner, and Constants Manager.

---

**Good Luck Teams!** 🤖🚀

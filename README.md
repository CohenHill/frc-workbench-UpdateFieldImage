# FRC Workbench

**Helpful tools for FRC teams.**

FRC Workbench adds a few convenient features to VS Code to help with FIRST Robotics Competition development. It aims to simplify common tasks like tuning PIDs and viewing path files.

## Features

### 🛣️ PathPlanner & Auto Preview
Visualize your `.path` and `.auto` files directly in VS Code.
*   **Quick Preview**: Double-click any `.path` or `.auto` file to see it.
*   **Auto Visualization**: See your auto routine steps and paths on the field.
*   **Hover Effects**: Hover over path commands to see where the robot drives.

### 🎛️ Live PID Tuner
Tune your PID controllers over NetworkTables.
*   **Live Updates**: Change kP, kI, kD, kF values and see the robot react.
*   **Save to Code**: Save the tuned values back to your `Constants.java` file.

### 📝 Constants Manager
Manage your `RobotMap` or `Constants` file with a simple UI.
*   **Organized View**: View constants grouped by subsystem/module.
*   **Safe Editing**: Edit values easily.

### 🧙‍♂️ Subsystem Wizard
Generate subsystem boilerplate code.
*   **Drag & Drop**: Add motors and sensors visually.
*   **Modern Code**: Generates WPILib Command-Based code.

### 🚀 Pre-Flight Checklist
A simple checklist to help ensure your robot is ready.
*   **Interactive Checklist**: Track battery, bumpers, radio, and code status.
*   **Deploy Integration**: Run the checklist before deploying.

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

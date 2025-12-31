# Change Log

All notable changes to the "frc-vs-code-plugin" extension will be documented in this file.

## [0.1.2] - 2025-12-30

### Added
- **Subsystem Wizard Integration**: Unified workflow for creating subsystems.
- **YAMS Integration Hub**: 
  - Comprehensive UI for configuring mechanisms (Elevators, Arms, Pivots).
  - Explicit options for **Control Type**: Motor Controller PID, WPILib ProfiledPID, or **Tunable PID** (Shuffleboard).
  - Automatic `SubsystemSim` generation.
  - Support for remote templates from `yamgen.com` with Handlebars rendering.
- **Hardware Device Generators**: Added `deviceHelpers.js` (initially internal) to support standardized device creation.
- **Tunable PID Controller**: Introduced `TuneableProfiledPIDController` class for live tuning of PID+FF constants.

## [Unreleased]

- Initial release
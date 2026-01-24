# YAMS_Gen

Handlebars (`.hbs`) templates for generating Java WPILib `SubsystemBase` classes backed by **YAMS** mechanisms.

This repo is intentionally lightweight: it contains **templates only** (no generator binary/script). You render the templates with your preferred Handlebars workflow (CLI, Node script, web tool, etc.), then drop the generated `.java` files into your robot project.

## Templates

- `Arm.java.hbs` → A positional arm (`yams.mechanisms.positional.Arm`)
- `Pivot.java.hbs` → A positional pivot (`yams.mechanisms.positional.Pivot`)
- `Elevator.java.hbs` → A positional elevator (`yams.mechanisms.positional.Elevator`)
- `Shooter.java.hbs` → A velocity flywheel/shooter (`yams.mechanisms.velocity.FlyWheel`)
- `SwerveDrive.java.hbs` → A holonomic swerve drive (`yams.mechanisms.swerve.SwerveDrive`)

## Supported hardware (via template switches)

Many imports and instantiations are conditional based on the input data.

- **Motor controllers**: `SparkMax`, `TalonFX`, `TalonFXS`, `Nova`
- **Gyros (swerve only)**: `Pigeon2`, `NavX`

## Prerequisites

- A WPILib robot project (the templates generate classes in `package frc.robot.subsystems;`)
- YAMS available on your robot project classpath (the generated code imports `yams.*`)
- A Handlebars renderer that supports custom helpers

These templates use an `eq` helper (example: `{{#if (eq motorControllerType 'SparkMax')}}`). If your renderer doesn’t provide it, you’ll need to register it.

## Usage

### 1) Create a JSON data file

Provide the variables referenced by the template. The easiest way to discover required fields is to search the template for `{{...}}` and mirror that structure in JSON.

Minimal example for `Arm.java.hbs` (save as `arm.json`):

```json
{
	"subsystemName": "Arm",
	"motorControllerType": "SparkMax",
	"motorModel": "NEO",
	"canId": 1,

	"pid": { "kP": 0.6, "kI": 0.0, "kD": 0.02 },
	"simPid": { "kP": 0.6, "kI": 0.0, "kD": 0.02 },

	"ff": { "kS": 0.2, "kG": 0.4, "kV": 1.1 },
	"simFf": { "kS": 0.2, "kG": 0.4, "kV": 1.1 },

	"gearingStages": "/* template inserts verbatim */",
	"inverted": false,
	"idleMode": "BRAKE",
	"currentLimit": 40,
	"rampRate": 0.1,

	"minSoftLimit": -45,
	"maxSoftLimit": 90,
	"minHardLimit": -60,
	"maxHardLimit": 100,
	"startingAngle": 0,
	"armLength": 0.6,
	"mass": 8
}
```

Notes:

- `motorModel` is used as `DCMotor.get{{motorModel}}(1)`. Pick a suffix that exists in your WPILib version (for example: `NEO`, `Falcon500`, `KrakenX60`, etc.).
- Some fields (like `gearingStages`) are inserted directly into the generated Java call. Provide a value that matches the YAMS API you’re using.

### 2) Render the template

Use any Handlebars setup you like. A common approach is the Node Handlebars CLI plus a tiny helper module providing `eq`.

Example `eq` helper implementation:

```js
// eq.js
module.exports = function (a, b) {
	return a === b;
};
```

Then render (exact flags vary by CLI/package):

```bash
handlebars Arm.java.hbs -f Arm.java -d arm.json --helper eq.js
```

### 3) Copy into your robot project

Place the generated file into your WPILib project, typically:

`src/main/java/frc/robot/subsystems/<SubsystemName>.java`

## Swerve template inputs (high level)

`SwerveDrive.java.hbs` expects a larger input object, including:

- `subsystemName`
- `motorControllerType`, `motorModel`
- `gyroType` and (for `Pigeon2`) `gyroCanId`
- Per-module objects: `frontLeft`, `frontRight`, `backLeft`, `backRight` with IDs (`driveId`, `azimuthId`, `encoderId`) and positions (`xPos`, `yPos`)
- Limits and PID groups: `maxAngularSpeed`, `maxLinearSpeed`, `translationPid`, `rotationPid`, `drivePid`, `azimuthPid`, `ppTranslationPid`, `ppRotationPid`
- Gearings/current limits: `driveGearingStages`, `azimuthGearingStages`, `wheelDiameter`, `driveCurrentLimit`, `azimuthCurrentLimit`

## License / attribution

The templates include the standard WPILib header comment used in generated robot code. Ensure your usage aligns with WPILib/YAMS licensing in your project.
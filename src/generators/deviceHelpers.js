const HELPER_LIBRARY = {
    // --- Motors (Generic interfaces) ---
    'TalonFX': [
        { id: 'setSpeed', label: 'setSpeed(%)', gen: (n) => `  public void set${n}Speed(double speed) {\n    ${n}.set(speed);\n  }` },
        { id: 'stop', label: 'stop()', gen: (n) => `  public void stop${n}() {\n    ${n}.stopMotor();\n  }` },
        {
            id: 'getVelocity',
            label: 'getVelocity()',
            requiredImports: ['edu.wpi.first.units.Units'],
            gen: (n) => `  public double get${n}Velocity() {\n    return ${n}.getVelocity().getValue().in(Units.RotationsPerSecond);\n  }`
        },
        {
            id: 'getPosition',
            label: 'getPosition()',
            requiredImports: ['edu.wpi.first.units.Units'],
            gen: (n) => `  public double get${n}Position() {\n    return ${n}.getPosition().getValue().in(Units.Rotations);\n  }`
        },
        { id: 'setVoltage', label: 'setVoltage()', gen: (n) => `  public void set${n}Voltage(double volts) {\n    ${n}.setVoltage(volts);\n  }` },
        {
            id: 'getTemp',
            label: 'getTemperature()',
            requiredImports: ['edu.wpi.first.units.Units'],
            gen: (n) => `  public double get${n}Temp() {\n    return ${n}.getDeviceTemp().getValue().in(Units.Celsius);\n  }`
        }
    ],
    'TalonFXS': [
        { id: 'setSpeed', label: 'setSpeed(%)', gen: (n) => `  public void set${n}Speed(double speed) {\n    ${n}.set(speed);\n  }` },
        { id: 'stop', label: 'stop()', gen: (n) => `  public void stop${n}() {\n    ${n}.stopMotor();\n  }` },
        {
            id: 'getVelocity',
            label: 'getVelocity()',
            requiredImports: ['edu.wpi.first.units.Units'],
            gen: (n) => `  public double get${n}Velocity() {\n    return ${n}.getVelocity().getValue().in(Units.RotationsPerSecond);\n  }`
        },
        {
            id: 'getPosition',
            label: 'getPosition()',
            requiredImports: ['edu.wpi.first.units.Units'],
            gen: (n) => `  public double get${n}Position() {\n    return ${n}.getPosition().getValue().in(Units.Rotations);\n  }`
        },
        { id: 'setVoltage', label: 'setVoltage()', gen: (n) => `  public void set${n}Voltage(double volts) {\n    ${n}.setVoltage(volts);\n  }` }
    ],
    'CANSparkMax': [
        { id: 'setSpeed', label: 'setSpeed(%)', gen: (n) => `  public void set${n}Speed(double speed) {\n    ${n}.set(speed);\n  }` },
        { id: 'stop', label: 'stop()', gen: (n) => `  public void stop${n}() {\n    ${n}.stopMotor();\n  }` },
        { id: 'getVelocity', label: 'getVelocity()', gen: (n) => `  public double get${n}Velocity() {\n    return ${n}.getEncoder().getVelocity();\n  }` },
        { id: 'getPosition', label: 'getPosition()', gen: (n) => `  public double get${n}Position() {\n    return ${n}.getEncoder().getPosition();\n  }` },
        { id: 'setVoltage', label: 'setVoltage()', gen: (n) => `  public void set${n}Voltage(double volts) {\n    ${n}.setVoltage(volts);\n  }` },
        { id: 'getTemp', label: 'getTemperature()', gen: (n) => `  public double get${n}Temp() {\n    return ${n}.getMotorTemperature();\n  }` }
    ],
    'SparkMax': [ // Alias for above
        { id: 'setSpeed', label: 'setSpeed(%)', gen: (n) => `  public void set${n}Speed(double speed) {\n    ${n}.set(speed);\n  }` },
        { id: 'stop', label: 'stop()', gen: (n) => `  public void stop${n}() {\n    ${n}.stopMotor();\n  }` },
        { id: 'getVelocity', label: 'getVelocity()', gen: (n) => `  public double get${n}Velocity() {\n    return ${n}.getEncoder().getVelocity();\n  }` },
        { id: 'getPosition', label: 'getPosition()', gen: (n) => `  public double get${n}Position() {\n    return ${n}.getEncoder().getPosition();\n  }` },
        { id: 'setVoltage', label: 'setVoltage()', gen: (n) => `  public void set${n}Voltage(double volts) {\n    ${n}.setVoltage(volts);\n  }` },
        { id: 'getTemp', label: 'getTemperature()', gen: (n) => `  public double get${n}Temp() {\n    return ${n}.getMotorTemperature();\n  }` }
    ],
    'SparkFlex': [
        { id: 'setSpeed', label: 'setSpeed(%)', gen: (n) => `  public void set${n}Speed(double speed) {\n    ${n}.set(speed);\n  }` },
        { id: 'stop', label: 'stop()', gen: (n) => `  public void stop${n}() {\n    ${n}.stopMotor();\n  }` },
        { id: 'getVelocity', label: 'getVelocity()', gen: (n) => `  public double get${n}Velocity() {\n    return ${n}.getEncoder().getVelocity();\n  }` },
        { id: 'getPosition', label: 'getPosition()', gen: (n) => `  public double get${n}Position() {\n    return ${n}.getEncoder().getPosition();\n  }` },
        { id: 'setVoltage', label: 'setVoltage()', gen: (n) => `  public void set${n}Voltage(double volts) {\n    ${n}.setVoltage(volts);\n  }` }
    ],
    'TalonSRX': [
        { id: 'setSpeed', label: 'setSpeed(%)', gen: (n) => `  public void set${n}Speed(double speed) {\n    ${n}.set(speed);\n  }` },
        { id: 'stop', label: 'stop()', gen: (n) => `  public void stop${n}() {\n    ${n}.stopMotor();\n  }` },
        { id: 'setVoltage', label: 'setVoltage()', gen: (n) => `  public void set${n}Voltage(double volts) {\n    ${n}.setVoltage(volts);\n  }` }
    ],
    'VictorSPX': [
        { id: 'setSpeed', label: 'setSpeed(%)', gen: (n) => `  public void set${n}Speed(double speed) {\n    ${n}.set(speed);\n  }` },
        { id: 'stop', label: 'stop()', gen: (n) => `  public void stop${n}() {\n    ${n}.stopMotor();\n  }` },
        { id: 'setVoltage', label: 'setVoltage()', gen: (n) => `  public void set${n}Voltage(double volts) {\n    ${n}.setVoltage(volts);\n  }` }
    ],

    // --- Sensors ---
    'CANcoder': [
        {
            id: 'getPosition',
            label: 'getPosition()',
            requiredImports: ['edu.wpi.first.units.Units'],
            gen: (n) => `  public double get${n}Position() {\n    return ${n}.getAbsolutePosition().getValue().in(Units.Rotations);\n  }`
        },
        {
            id: 'getVelocity',
            label: 'getVelocity()',
            requiredImports: ['edu.wpi.first.units.Units'],
            gen: (n) => `  public double get${n}Velocity() {\n    return ${n}.getVelocity().getValue().in(Units.RotationsPerSecond);\n  }`
        },
        { id: 'reset', label: 'setPosition(0)', gen: (n) => `  public void reset${n}() {\n    ${n}.setPosition(0);\n  }` },
        {
            id: 'getAbsPosition',
            label: 'getAbsolutePosition()',
            requiredImports: ['edu.wpi.first.units.Units'],
            gen: (n) => `  public double get${n}AbsPosition() {\n    return ${n}.getAbsolutePosition().getValue().in(Units.Rotations);\n  }`
        },
        {
            id: 'getVoltage',
            label: 'getSupplyVoltage()',
            requiredImports: ['edu.wpi.first.units.Units'],
            gen: (n) => `  public double get${n}Voltage() {\n    return ${n}.getSupplyVoltage().getValue().in(Units.Volts);\n  }`
        },
        {
            id: 'getTemp',
            label: 'getTemperature()',
            requiredImports: ['edu.wpi.first.units.Units'],
            gen: (n) => `  public double get${n}Temp() {\n    return ${n}.getMotorTemperature().getValue().in(Units.Celsius);\n  }`
        }
    ],
    'Pigeon 2.0': [
        {
            id: 'getYaw',
            label: 'getYaw()',
            requiredImports: ['edu.wpi.first.units.Units'],
            gen: (n) => `  public double get${n}Yaw() {\n    return ${n}.getYaw().getValue().in(Units.Degrees);\n  }`
        },
        {
            id: 'getPitch',
            label: 'getPitch()',
            requiredImports: ['edu.wpi.first.units.Units'],
            gen: (n) => `  public double get${n}Pitch() {\n    return ${n}.getPitch().getValue().in(Units.Degrees);\n  }`
        },
        {
            id: 'getRoll',
            label: 'getRoll()',
            requiredImports: ['edu.wpi.first.units.Units'],
            gen: (n) => `  public double get${n}Roll() {\n    return ${n}.getRoll().getValue().in(Units.Degrees);\n  }`
        },
        { id: 'reset', label: 'reset()', gen: (n) => `  public void reset${n}() {\n    ${n}.reset();\n  }` },
        {
            id: 'getRate',
            label: 'getRate()',
            requiredImports: ['edu.wpi.first.units.Units'],
            gen: (n) => `  public double get${n}Rate() {\n    return ${n}.getAngularVelocityZWorld().getValue().in(Units.DegreesPerSecond);\n  }`
        },
        { id: 'setYaw', label: 'setYaw()', gen: (n) => `  public void set${n}Yaw(double angle) {\n    ${n}.setYaw(angle);\n  }` },
    ],
    'NavX2 MXP': [
        { id: 'getYaw', label: 'getYaw()', gen: (n) => `  public double get${n}Yaw() {\n    return ${n}.getYaw();\n  }` },
        { id: 'reset', label: 'reset()', gen: (n) => `  public void reset${n}() {\n    ${n}.reset();\n  }` },
        { id: 'getRate', label: 'getRate()', gen: (n) => `  public double get${n}Rate() {\n    return ${n}.getRate();\n  }` },
        { id: 'getAngle', label: 'getAngle() (Total)', gen: (n) => `  public double get${n}TotalAngle() {\n    return ${n}.getAngle();\n  }` },
    ],
    'NavX2-Micro': [ // Same as MXP
        { id: 'getYaw', label: 'getYaw()', gen: (n) => `  public double get${n}Yaw() {\n    return ${n}.getYaw();\n  }` },
        { id: 'reset', label: 'reset()', gen: (n) => `  public void reset${n}() {\n    ${n}.reset();\n  }` },
        { id: 'getRate', label: 'getRate()', gen: (n) => `  public double get${n}Rate() {\n    return ${n}.getRate();\n  }` },
        { id: 'getAngle', label: 'getAngle() (Total)', gen: (n) => `  public double get${n}TotalAngle() {\n    return ${n}.getAngle();\n  }` },
    ],
    'Through Bore Encoder': [
        { id: 'getAbsolute', label: 'getAbsolutePosition()', gen: (n) => `  public double get${n}Absolute() {\n    return ${n}.getAbsolutePosition();\n  }` }
    ],

    // --- Solenoids ---
    'DoubleSolenoid': [
        { id: 'toggle', label: 'toggle()', gen: (n) => `  public void toggle${n}() {\n    ${n}.toggle();\n  }` },
        { id: 'extend', label: 'extend()', gen: (n) => `  public void extend${n}() {\n    ${n}.set(DoubleSolenoid.Value.kForward);\n  }` },
        { id: 'retract', label: 'retract()', gen: (n) => `  public void retract${n}() {\n    ${n}.set(DoubleSolenoid.Value.kReverse);\n  }` },
        { id: 'get', label: 'get()', gen: (n) => `  public DoubleSolenoid.Value get${n}() {\n    return ${n}.get();\n  }` },
        { id: 'isExtended', label: 'isExtended()', gen: (n) => `  public boolean is${n}Extended() {\n    return ${n}.get() == DoubleSolenoid.Value.kForward;\n  }` },
        { id: 'isRetracted', label: 'isRetracted()', gen: (n) => `  public boolean is${n}Retracted() {\n    return ${n}.get() == DoubleSolenoid.Value.kReverse;\n  }` },
    ],
    'Solenoid': [
        { id: 'toggle', label: 'toggle()', gen: (n) => `  public void toggle${n}() {\n    ${n}.toggle();\n  }` },
        { id: 'set', label: 'set(bool)', gen: (n) => `  public void set${n}(boolean on) {\n    ${n}.set(on);\n  }` },
        { id: 'get', label: 'get()', gen: (n) => `  public boolean get${n}() {\n    return ${n}.get();\n  }` },
    ],

    // --- Servos ---
    'Servo': [
        { id: 'setPosition', label: 'setPosition()', gen: (n) => `  public void set${n}Position(double pos) {\n    ${n}.set(pos);\n  }` },
        { id: 'getAngle', label: 'getAngle()', gen: (n) => `  public double get${n}Angle() {\n    return ${n}.getAngle();\n  }` },
        { id: 'setAngle', label: 'setAngle()', gen: (n) => `  public void set${n}Angle(double degrees) {\n    ${n}.setAngle(degrees);\n  }` },
        { id: 'getPosition', label: 'getPosition()', gen: (n) => `  public double get${n}Position() {\n    return ${n}.get();\n  }` },
    ]
};

module.exports = {
    HELPER_LIBRARY
};

// Mirror of src/generators/deviceHelpers.js
const DEVICE_HELPERS = {
    'TalonFX': [
        { id: 'setSpeed', label: 'setSpeed(%)' },
        { id: 'stop', label: 'stop()' },
        { id: 'getVelocity', label: 'getVelocity()' },
        { id: 'getPosition', label: 'getPosition()' },
        { id: 'setVoltage', label: 'setVoltage()' },
        { id: 'getTemp', label: 'getTemp()' }
    ],
    'TalonFXS': [
        { id: 'setSpeed', label: 'setSpeed(%)' },
        { id: 'stop', label: 'stop()' },
        { id: 'getVelocity', label: 'getVelocity()' },
        { id: 'getPosition', label: 'getPosition()' },
        { id: 'setVoltage', label: 'setVoltage()' }
    ],
    'CANSparkMax': [
        { id: 'setSpeed', label: 'setSpeed(%)' },
        { id: 'stop', label: 'stop()' },
        { id: 'getVelocity', label: 'getVelocity()' },
        { id: 'getPosition', label: 'getPosition()' },
        { id: 'setVoltage', label: 'setVoltage()' },
        { id: 'getTemp', label: 'getTemp()' }
    ],
    'SparkMax': [
        { id: 'setSpeed', label: 'setSpeed(%)' },
        { id: 'stop', label: 'stop()' },
        { id: 'getVelocity', label: 'getVelocity()' },
        { id: 'getPosition', label: 'getPosition()' },
        { id: 'setVoltage', label: 'setVoltage()' },
        { id: 'getTemp', label: 'getTemp()' }
    ],
    'SparkFlex': [
        { id: 'setSpeed', label: 'setSpeed(%)' },
        { id: 'stop', label: 'stop()' },
        { id: 'getVelocity', label: 'getVelocity()' },
        { id: 'getPosition', label: 'getPosition()' },
        { id: 'setVoltage', label: 'setVoltage()' }
    ],
    'TalonSRX': [
        { id: 'setSpeed', label: 'setSpeed(%)' },
        { id: 'stop', label: 'stop()' },
        { id: 'setVoltage', label: 'setVoltage()' }
    ],
    'VictorSPX': [
        { id: 'setSpeed', label: 'setSpeed(%)' },
        { id: 'stop', label: 'stop()' },
        { id: 'setVoltage', label: 'setVoltage()' }
    ],
    'CANcoder': [
        { id: 'getPosition', label: 'getPosition()' },
        { id: 'getVelocity', label: 'getVelocity()' },
        { id: 'reset', label: 'reset()' },
        { id: 'getAbsPosition', label: 'getAbsPosition()' },
        { id: 'getVoltage', label: 'getSupplyVoltage()' },
        { id: 'getTemp', label: 'getTemp()' },
        { id: 'get', label: 'get()' }
    ],
    'Pigeon 2.0': [
        { id: 'getYaw', label: 'getYaw()' },
        { id: 'getPitch', label: 'getPitch()' },
        { id: 'getRoll', label: 'getRoll()' },
        { id: 'reset', label: 'reset()' },
        { id: 'getRate', label: 'getRate()' },
        { id: 'setYaw', label: 'setYaw()' }
    ],
    'NavX2 MXP': [
        { id: 'getYaw', label: 'getYaw()' },
        { id: 'reset', label: 'reset()' },
        { id: 'getRate', label: 'getRate()' },
        { id: 'getAngle', label: 'getAngle()' }
    ],
    'NavX2-Micro': [
        { id: 'getYaw', label: 'getYaw()' },
        { id: 'reset', label: 'reset()' },
        { id: 'getRate', label: 'getRate()' },
        { id: 'getAngle', label: 'getAngle()' }
    ],
    'Through Bore Encoder': [{ id: 'getAbsolute', label: 'getAbsolute()' }],
    'DoubleSolenoid': [
        { id: 'toggle', label: 'toggle()' },
        { id: 'extend', label: 'extend()' },
        { id: 'retract', label: 'retract()' },
        { id: 'get', label: 'get()' },
        { id: 'isExtended', label: 'isExtended()' },
        { id: 'isRetracted', label: 'isRetracted()' }
    ],
    'Solenoid': [
        { id: 'toggle', label: 'toggle()' },
        { id: 'set', label: 'set(bool)' },
        { id: 'get', label: 'get()' }
    ],
    'Servo': [
        { id: 'setPosition', label: 'setPosition()' },
        { id: 'getAngle', label: 'getAngle()' },
        { id: 'setAngle', label: 'setAngle()' },
        { id: 'getPosition', label: 'getPosition()' }
    ]
};

const deviceTypes = [
    // --- Motor Controllers & Motors ---
    {
        name: 'Kraken X60',
        category: 'Motors',
        description: 'Brushless Motor w/ Integrated TalonFX', // Clarified it is integrated
        import: 'com.ctre.phoenix6.hardware.TalonFX',
        requiredVendor: 'Phoenix6',
        vendorUrl: 'https://v6.docs.ctr-electronics.com/en/stable/docs/installation/index.html',
        image: '../../images/image.png',
        needsController: true,
        validControllers: ['TalonFX']
    },
    {
        name: 'Kraken X44',
        category: 'Motors',
        description: 'Brushless Motor w/ Integrated TalonFX',
        import: 'com.ctre.phoenix6.hardware.TalonFX',
        requiredVendor: 'Phoenix6',
        vendorUrl: 'https://v6.docs.ctr-electronics.com/en/stable/docs/installation/index.html',
        image: '../../images/image.png',
        needsController: true,
        validControllers: ['TalonFX']
    },
    {
        name: 'NEO Vortex',
        category: 'Motors',
        description: 'Brushless Motor (Requires SparkFlex)', // Explicit requirement
        import: 'com.revrobotics.spark.SparkFlex',
        requiredVendor: 'REVLib',
        vendorUrl: 'https://docs.revrobotics.com/brushless/spark-flex/software-resources',
        image: '../../images/image.png',
        needsController: true,
        validControllers: ['SparkFlex']
    },
    {
        name: 'CTR Minion',
        category: 'Motors',
        description: 'Brushless Motor (Requires TalonFXS)', // Explicit requirement
        import: 'com.ctre.phoenix6.hardware.TalonFXS',
        requiredVendor: 'Phoenix6',
        vendorUrl: 'https://v6.docs.ctr-electronics.com/',
        image: '../../images/image.png',
        needsController: true,
        validControllers: ['TalonFXS']
    },
    {
        name: 'NEO 550 Brushless Motor',
        category: 'Motors',
        description: 'Brushless Motor (Requires ext. Brushless Controller)',
        import: 'com.revrobotics.SparkMax',
        requiredVendor: 'REVLib',
        vendorUrl: 'https://docs.revrobotics.com/',
        image: '../../images/image.png',
        needsController: true,
        validControllers: ['SparkMax']
    },
    {
        name: 'NEO Brushless Motor V1.1',
        category: 'Motors',
        description: 'Brushless Motor (Requires ext. Brushless Controller)',
        import: 'com.revrobotics.SparkMax',
        requiredVendor: 'REVLib',
        vendorUrl: 'https://docs.revrobotics.com/',
        image: '../../images/image.png',
        needsController: true,
        validControllers: ['SparkMax']
    },
    {
        name: 'NEO 2.0 Brushless Motor',
        category: 'Motors',
        description: 'Brushless Motor (Requires ext. Brushless Controller)',
        import: 'com.revrobotics.SparkMax',
        requiredVendor: 'REVLib',
        vendorUrl: 'https://docs.revrobotics.com/',
        image: '../../images/image.png',
        needsController: true,
        validControllers: ['SparkMax', 'SparkFlex']
    },

    // --- Controllers ---
    {
        name: 'TalonFX',
        category: 'Motor Controllers',
        description: 'Integrated Controller (Kraken/Falcon)',
        import: 'com.ctre.phoenix6.hardware.TalonFX',
        requiredVendor: 'Phoenix6',
        vendorUrl: 'https://v6.docs.ctr-electronics.com/',
        image: '../../images/image.png'
    },
    {
        name: 'TalonFXS',
        category: 'Motor Controllers',
        description: 'Controller for Minion/NEO/Vortex',
        import: 'com.ctre.phoenix6.hardware.TalonFXS',
        requiredVendor: 'Phoenix6',
        vendorUrl: 'https://v6.docs.ctr-electronics.com/',
        image: '../../images/image.png'
    },
    {
        name: 'SparkMax',
        category: 'Motor Controllers',
        description: 'Controller for NEO/CIM/775',
        import: 'com.revrobotics.spark.SparkMax',
        requiredVendor: 'REVLib',
        vendorUrl: 'https://docs.revrobotics.com/brushless/spark-max/software-resources',
        image: '../../images/image.png'
    },
    {
        name: 'SparkFlex',
        category: 'Motor Controllers',
        description: 'Controller for NEO Vortex',
        import: 'com.revrobotics.spark.SparkFlex',
        requiredVendor: 'REVLib',
        vendorUrl: 'https://docs.revrobotics.com/brushless/spark-flex/software-resources',
        image: '../../images/image.png'
    },
    {
        name: 'TalonSRX',
        category: 'Motor Controllers',
        description: 'Brushed Motor Controller (CAN)',
        import: 'com.ctre.phoenix.motorcontrol.can.TalonSRX',
        requiredVendor: 'Phoenix',
        vendorUrl: 'https://maven.ctr-electronics.com/release/com/ctre/phoenix/Phoenix5-frc2024-latest.json',
        image: '../../images/image.png'
    },
    {
        name: 'VictorSPX',
        category: 'Motor Controllers',
        description: 'Brushed Motor Controller (CAN)',
        import: 'com.ctre.phoenix.motorcontrol.can.VictorSPX',
        requiredVendor: 'Phoenix',
        vendorUrl: 'https://maven.ctr-electronics.com/release/com/ctre/phoenix/Phoenix5-frc2024-latest.json',
        image: '../../images/image.png'
    },

    // --- Sensors ---
    { name: 'Pigeon 2.0', category: 'Sensors', description: 'CTRE IMU (CAN)', import: 'com.ctre.phoenix6.hardware.Pigeon2', requiredVendor: 'Phoenix6', vendorUrl: 'https://v6.docs.ctr-electronics.com/', image: '../../images/image.png' },
    { name: 'CANcoder', category: 'Sensors', description: 'CTRE Absolute Encoder (CAN)', import: 'com.ctre.phoenix6.hardware.CANcoder', requiredVendor: 'Phoenix6', vendorUrl: 'https://v6.docs.ctr-electronics.com/', image: '../../images/image.png' },
    { name: 'CANrange', category: 'Sensors', description: 'CTRE Distance Sensor (CAN)', import: 'com.ctre.phoenix6.hardware.CANrange', requiredVendor: 'Phoenix6', vendorUrl: 'https://v6.docs.ctr-electronics.com/', image: '../../images/image.png' },
    { name: 'SRX Mag Encoder', category: 'Sensors', description: 'CTRE Magnetic Encoder', import: 'edu.wpi.first.wpilibj.DutyCycleEncoder', image: '../../images/image.png' },
    { name: 'NavX2 MXP', category: 'Sensors', description: 'KauaiLabs Navigation (MXP Port)', import: 'com.kauailabs.navx.frc.AHRS', requiredVendor: 'NavX', vendorUrl: 'https://docs.studica.com/en/latest/docs/VMX-FRC/software/roborio-setup/index.html', image: '../../images/image.png' },
    { name: 'NavX2-Micro', category: 'Sensors', description: 'KauaiLabs Navigation (USB)', import: 'com.kauailabs.navx.frc.AHRS', requiredVendor: 'NavX', vendorUrl: 'https://docs.studica.com/en/latest/docs/VMX-FRC/software/roborio-setup/index.html', image: '../../images/image.png' },
    { name: 'Limelight 4', category: 'Sensors', description: 'Vision Camera (Ethernet)', import: 'edu.wpi.first.networktables.NetworkTable', image: '../../images/image.png' },
    { name: 'Limelight 3/3A', category: 'Sensors', description: 'Vision Camera (Ethernet)', import: 'edu.wpi.first.networktables.NetworkTable', image: '../../images/image.png' },
    { name: 'Color Sensor V3', category: 'Sensors', description: 'REV Color/Proximity (I2C)', import: 'com.revrobotics.ColorSensorV3', requiredVendor: 'REVLib', vendorUrl: 'https://docs.revrobotics.com/', image: '../../images/image.png' },
    { name: 'Color Sensor V2', category: 'Sensors', description: 'REV Color/Proximity (I2C)', import: 'com.revrobotics.ColorSensorV3', requiredVendor: 'REVLib', vendorUrl: 'https://docs.revrobotics.com/', image: '../../images/image.png' },
    { name: '2m Distance Sensor', category: 'Sensors', description: 'REV Time-of-Flight (I2C)', import: 'com.revrobotics.Rev2mDistanceSensor', requiredVendor: 'REVLib', vendorUrl: 'https://docs.revrobotics.com/', image: '../../images/image.png' },
    { name: 'Through Bore Encoder', category: 'Sensors', description: 'REV Absolute Encoder (DIO/PWM)', import: 'edu.wpi.first.wpilibj.DutyCycleEncoder', image: '../../images/image.png' },
    { name: 'MAXSpline Encoder', category: 'Sensors', description: 'REV Absolute Encoder (DIO/PWM)', import: 'edu.wpi.first.wpilibj.DutyCycleEncoder', image: '../../images/image.png' },
    { name: 'Laser Distance', category: 'Sensors', description: 'goBILDA/Generic (Analog)', import: 'edu.wpi.first.wpilibj.AnalogInput', image: '../../images/image.png' },
    { name: 'LIDAR Lite v3', category: 'Sensors', description: 'Garmin LIDAR (I2C/PWM)', import: 'edu.wpi.first.wpilibj.I2C', image: '../../images/image.png' },
    { name: '9-Axis IMU', category: 'Sensors', description: 'Generic IMU (I2C)', import: 'edu.wpi.first.wpilibj.I2C', image: '../../images/image.png' },
    { name: 'Absolute IMU Fusion', category: 'Sensors', description: 'BNO055/Generic (I2C)', import: 'edu.wpi.first.wpilibj.I2C', image: '../../images/image.png' },

    // --- Pneumatics & Actuators ---
    { name: 'DoubleSolenoid', category: 'Pneumatics', description: 'Double Acting Cylinder Control', import: 'edu.wpi.first.wpilibj.DoubleSolenoid', image: '../../images/image.png' },
    { name: 'Solenoid', category: 'Pneumatics', description: 'Single Acting Cylinder Control', import: 'edu.wpi.first.wpilibj.Solenoid', image: '../../images/image.png' },
    { name: 'Linear Actuator (12V)', category: 'Actuators', description: 'Heavy Duty Actuator (Req. Motor Controller)', import: 'edu.wpi.first.wpilibj.motorcontrol.Spark', image: '../../images/image.png' },
    { name: 'Servo (2000 Series)', category: 'Actuators', description: 'goBILDA Dual Mode (PWM)', import: 'edu.wpi.first.wpilibj.Servo', image: '../../images/image.png' },

    // --- LEDs & Misc ---
    { name: 'CANdle', category: 'LEDs', description: 'CTRE LED Controller (CAN)', import: 'com.ctre.phoenix.led.CANdle', requiredVendor: 'Phoenix', vendorUrl: 'https://store.ctr-electronics.com/candle/', image: '../../images/image.png' },
    { name: 'CANdi', category: 'Misc', description: 'CTRE Digital Input Module (CAN)', import: 'com.ctre.phoenix6.hardware.CANdi', requiredVendor: 'Phoenix6', vendorUrl: 'https://v6.docs.ctr-electronics.com/', image: '../../images/image.png' },
    { name: 'Prism RGB Driver', category: 'LEDs', description: 'goBILDA LED Driver (PWM)', import: 'edu.wpi.first.wpilibj.PWM', image: '../../images/image.png' },
    { name: 'DigitalInput', category: 'Sensors', description: 'Limit Switch/Digital (DIO)', import: 'edu.wpi.first.wpilibj.DigitalInput', image: '../../images/image.png' },
    { name: 'Touch Sensor', category: 'Sensors', description: 'Generic (DIO)', import: 'edu.wpi.first.wpilibj.DigitalInput', image: '../../images/image.png' },
    { name: 'Magnetic Limit', category: 'Sensors', description: 'Generic (DIO)', import: 'edu.wpi.first.wpilibj.DigitalInput', image: '../../images/image.png' },


    // --- Custom / Existing ---
    {
        name: 'SmartMotorControllerConfig',
        category: 'Configuration',
        description: 'YAMS Controller Config (Drag to Motor)',
        import: '',
        image: '../../images/image.png',
        isConfig: true
    },

    // --- CTRE Phoenix 6 Devices ---
    {
        name: 'TalonFX Configuration',
        category: 'Configuration',
        description: 'TalonFX Config (Drag to TalonFX)',
        import: 'com.ctre.phoenix6.configs.TalonFXConfiguration',
        image: '../../images/image.png',
        isConfig: true
    },
    {
        name: 'TalonFXS Configuration',
        category: 'Configuration',
        description: 'TalonFXS Config (Drag to TalonFXS)',
        import: 'com.ctre.phoenix6.configs.TalonFXSConfiguration',
        image: '../../images/image.png',
        isConfig: true
    },
    {
        name: 'CANcoder Configuration',
        category: 'Configuration',
        description: 'CANcoder Config (Drag to CANcoder)',
        import: 'com.ctre.phoenix6.configs.CANcoderConfiguration',
        image: '../../images/image.png',
        isConfig: true
    },
    {
        name: 'Pigeon2 Configuration',
        category: 'Configuration',
        description: 'Pigeon2 Config (Drag to Pigeon2)',
        import: 'com.ctre.phoenix6.configs.Pigeon2Configuration',
        image: '../../images/image.png',
        isConfig: true
    },
    {
        name: 'CANdi Configuration',
        category: 'Configuration',
        description: 'CANdi Config (Drag to CANdi)',
        import: 'com.ctre.phoenix6.configs.CANdiConfiguration',
        image: '../../images/image.png',
        isConfig: true
    },
    {
        name: 'CANdle Configuration',
        category: 'Configuration',
        description: 'CANdle Config (Drag to CANdle)',
        import: 'com.ctre.phoenix6.configs.CANdleConfiguration',
        image: '../../images/image.png',
        isConfig: true
    },
    {
        name: 'CANrange Configuration',
        category: 'Configuration',
        description: 'CANrange Config (Drag to CANrange)',
        import: 'com.ctre.phoenix6.configs.CANrangeConfiguration',
        image: '../../images/image.png',
        isConfig: true
    },

    // --- REV Robotics Devices (REVLib 2025) ---
    {
        name: 'Spark Max Configuration',
        category: 'Configuration',
        description: 'Spark Max Config (Drag to Spark Max)',
        import: 'com.revrobotics.spark.config.SparkMaxConfig',
        image: '../../images/image.png',
        isConfig: true
    },
    {
        name: 'Spark Flex Configuration',
        category: 'Configuration',
        description: 'Spark Flex Config (Drag to Spark Flex)',
        import: 'com.revrobotics.spark.config.SparkFlexConfig',
        image: '../../images/image.png',
        isConfig: true
    }
];
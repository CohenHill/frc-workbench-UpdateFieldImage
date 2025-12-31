const { exists } = require('../utils/fsUtils');

const path = require('path');

const VENDOR_FILES = {
    'com.ctre.phoenix6.': ['Phoenix6.json'],
    'com.revrobotics.': ['REVLib.json'],
    'com.reduxrobotics.': ['ReduxLib.json'],
    'com.kauailabs.navx': ['navx_frc.json', 'kauailabs_navX_FRC.json']
};

/**
 * Checks if required vendordeps are installed in the project.
 * @param {string} rootPath 
 * @param {Set<string>} imports 
 * @returns {Promise<string[]>} List of missing libraries (names)
 */
async function checkVendordeps(rootPath, imports) {
    const missing = new Set();
    const vendorPath = path.join(rootPath, 'vendordeps');

    for (const imp of imports) {
        for (const [prefix, jsonNames] of Object.entries(VENDOR_FILES)) {
            if (imp.startsWith(prefix)) {
                let found = false;
                // Check all possible JSON names for this vendor
                for (const jsonName of jsonNames) {
                    const jsonPath = path.join(vendorPath, jsonName);
                    if (await exists(jsonPath)) {
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    // Default to the first name for the missing message
                    missing.add(jsonNames[0].replace('.json', ''));
                }
            }
        }
    }
    return Array.from(missing);
}

const { HELPER_LIBRARY } = require('./deviceHelpers');

/**
 * Generates imports, declarations, and initializers for hardware.
 * @param {Array} hardwareList - List of device objects from UI
 * @param {string} subsystemName - Name of subsystem (for Constants class)
 * @param {boolean} useConstants - Whether to use Constants.java
 * @param {string} constantsClassName - Name of the constants class (e.g. RobotMap)
 * @returns {Object} { imports, declarations, initializers, helperMethods, constantDefinitions }
 */
function generateHardwareCode(hardwareList, subsystemName, useConstants, constantsClassName = 'Constants') {
    const imports = new Set();
    const declarations = [];
    const initializers = [];
    const helperMethods = [];
    const constantDefinitions = [];

    hardwareList.forEach(device => {
        let { type, name, id, bus, helperMethods: methodsToGen } = device;
        let importPath = device.import;

        // Handle Nested Controller Override
        if (device.controller) {
            type = device.controller.type;
            id = device.controller.id;
            if (device.controller.import) importPath = device.controller.import;
        }

        // Add import if known
        if (importPath) imports.add(importPath);

        // Resolve ID value (Constant vs Literal)
        let idVal = id;
        // Skip constant generation for things that don't need IDs (like Limelight generic)
        const needsID = !['Limelight', 'Limelight 3/3A', 'Limelight 4'].some(l => type.includes(l));

        if (useConstants && needsID) {
            const constName = `k${name.charAt(0).toUpperCase() + name.slice(1)}ID`;
            const constClass = `${constantsClassName}.${subsystemName}Constants`;
            idVal = `${constClass}.${constName}`;
            constantDefinitions.push({ name: constName, value: id, type: 'int' });
        }

        switch (type) {
            // --- CTRE Phoenix 6 ---
            case 'TalonFX':
            case 'Kraken X60':
            case 'Kraken X44':
                imports.add('com.ctre.phoenix6.hardware.TalonFX');
                declarations.push(`  private final TalonFX ${name};`);
                initializers.push(`    ${name} = new TalonFX(${idVal}, "${bus || 'rio'}");`);
                break;

            case 'TalonFXS':
            case 'CTR Minion':
                // Minion is just a motor on a TalonFXS
                imports.add('com.ctre.phoenix6.hardware.TalonFXS');
                declarations.push(`  private final TalonFXS ${name};`);
                initializers.push(`    ${name} = new TalonFXS(${idVal}, "${bus || 'rio'}");`);
                break;

            case 'CANcoder':
                imports.add('com.ctre.phoenix6.hardware.CANcoder');
                declarations.push(`  private final CANcoder ${name};`);
                initializers.push(`    ${name} = new CANcoder(${idVal}, "${bus || 'rio'}");`);
                break;

            case 'Pigeon 2.0':
            case 'Pigeon2':
                imports.add('com.ctre.phoenix6.hardware.Pigeon2');
                declarations.push(`  private final Pigeon2 ${name};`);
                initializers.push(`    ${name} = new Pigeon2(${idVal}, "${bus || 'rio'}");`);
                break;

            case 'CANrange':
                imports.add('com.ctre.phoenix6.hardware.CANrange');
                declarations.push(`  private final CANrange ${name};`);
                initializers.push(`    ${name} = new CANrange(${idVal}, "${bus || 'rio'}");`);
                break;

            case 'CANdi':
                imports.add('com.ctre.phoenix6.hardware.CANdi');
                declarations.push(`  private final CANdi ${name};`);
                initializers.push(`    ${name} = new CANdi(${idVal}, "${bus || 'rio'}");`);
                break;

            // --- CTRE Phoenix 5 (Legacy) ---
            case 'TalonSRX':
                imports.add('com.ctre.phoenix.motorcontrol.can.TalonSRX');
                declarations.push(`  private final TalonSRX ${name};`);
                initializers.push(`    ${name} = new TalonSRX(${idVal});`);
                break;

            case 'VictorSPX':
                imports.add('com.ctre.phoenix.motorcontrol.can.VictorSPX');
                declarations.push(`  private final VictorSPX ${name};`);
                initializers.push(`    ${name} = new VictorSPX(${idVal});`);
                break;

            case 'CANdle':
                imports.add('com.ctre.phoenix.led.CANdle');
                declarations.push(`  private final CANdle ${name};`);
                initializers.push(`    ${name} = new CANdle(${idVal}, "${bus || 'rio'}");`);
                break;

            // --- REV Robotics ---
            case 'CANSparkMax':
            case 'SPARK MAX':
            case 'SparkMax':
                imports.add('com.revrobotics.CANSparkMax');
                imports.add('com.revrobotics.CANSparkLowLevel.MotorType');
                declarations.push(`  private final CANSparkMax ${name};`);
                initializers.push(`    ${name} = new CANSparkMax(${idVal}, MotorType.kBrushless);`);
                break;

            case 'SparkFlex':
            case 'NEO Vortex':
                imports.add('com.revrobotics.spark.SparkFlex');
                imports.add('com.revrobotics.spark.SparkLowLevel.MotorType');
                declarations.push(`  private final SparkFlex ${name};`);
                initializers.push(`    ${name} = new SparkFlex(${idVal}, MotorType.kBrushless);`);
                break;

            case 'Color Sensor V3':
            case 'Color Sensor V2':
                imports.add('com.revrobotics.ColorSensorV3');
                imports.add('edu.wpi.first.wpilibj.I2C');
                declarations.push(`  private final ColorSensorV3 ${name};`);
                initializers.push(`    ${name} = new ColorSensorV3(I2C.Port.kOnboard); // Verify port`);
                break;

            // --- Sensors / WPILib ---
            case 'NavX2 MXP':
            case 'NavX2-Micro':
                imports.add('com.kauailabs.navx.frc.AHRS');
                imports.add('edu.wpi.first.wpilibj.SPI');
                declarations.push(`  private final AHRS ${name};`);
                initializers.push(`    ${name} = new AHRS(SPI.Port.kMXP);`);
                break;

            case 'Limelight 4':
            case 'Limelight 3/3A':
            case 'Limelight':
                imports.add('edu.wpi.first.networktables.NetworkTable');
                imports.add('edu.wpi.first.networktables.NetworkTableInstance');
                declarations.push(`  private final NetworkTable ${name};`);
                initializers.push(`    ${name} = NetworkTableInstance.getDefault().getTable("limelight");`);
                break;

            case 'DoubleSolenoid':
                imports.add('edu.wpi.first.wpilibj.DoubleSolenoid');
                imports.add('edu.wpi.first.wpilibj.PneumaticsModuleType');
                declarations.push(`  private final DoubleSolenoid ${name};`);
                // Simple assumption: CTREPCM
                initializers.push(`    ${name} = new DoubleSolenoid(PneumaticsModuleType.CTREPCM, ${idVal}, ${idVal} + 1);`);
                break;

            case 'Solenoid':
                imports.add('edu.wpi.first.wpilibj.Solenoid');
                imports.add('edu.wpi.first.wpilibj.PneumaticsModuleType');
                declarations.push(`  private final Solenoid ${name};`);
                initializers.push(`    ${name} = new Solenoid(PneumaticsModuleType.CTREPCM, ${idVal});`);
                break;

            case 'DigitalInput':
            case 'Touch Sensor':
            case 'Magnetic Limit':
                imports.add('edu.wpi.first.wpilibj.DigitalInput');
                declarations.push(`  private final DigitalInput ${name};`);
                initializers.push(`    ${name} = new DigitalInput(${idVal});`);
                break;

            case 'Servo':
            case 'Servo (2000 Series)':
                imports.add('edu.wpi.first.wpilibj.Servo');
                declarations.push(`  private final Servo ${name};`);
                initializers.push(`    ${name} = new Servo(${idVal});`);
                break;

            case 'Through Bore Encoder':
            case 'MAXSpline Encoder':
            case 'SRX Mag Encoder':
            case 'DutyCycleEncoder':
                imports.add('edu.wpi.first.wpilibj.DutyCycleEncoder');
                declarations.push(`  private final DutyCycleEncoder ${name};`);
                initializers.push(`    ${name} = new DutyCycleEncoder(${idVal});`);
                break;

            default:
                // Fallback for unknown types - generic Object?
                initializers.push(`    // Unknown device type or initialization logic: ${type}`);
                break;
        }

        // --- Helper Generation Logic ---
        // Look up supported helpers for this device type
        const supportedHelpers = HELPER_LIBRARY[type];
        if (supportedHelpers && methodsToGen && methodsToGen.length > 0) {
            methodsToGen.forEach(methodId => {
                const helperDef = supportedHelpers.find(h => h.id === methodId);
                if (helperDef && helperDef.gen) {
                    helperMethods.push(helperDef.gen(name));
                    if (helperDef.requiredImports) {
                        helperDef.requiredImports.forEach(imp => imports.add(imp));
                    }
                }
            });
        }
    });

    return { imports, declarations, initializers, helperMethods, constantDefinitions };
}

module.exports = { generateHardwareCode, checkVendordeps };

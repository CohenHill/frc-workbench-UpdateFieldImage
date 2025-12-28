const { exists } = require('../utils/fsUtils');
const vscode = require('vscode');
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
        const { type, name, id, bus, helperMethods: methodsToGen } = device;

        // Resolve ID value
        let idVal = id;
        if (useConstants) {
            const constName = `k${name.charAt(0).toUpperCase() + name.slice(1)}ID`;
            const constClass = `${constantsClassName}.${subsystemName}Constants`;
            idVal = `${constClass}.${constName}`;
            constantDefinitions.push({ name: constName, value: id, type: 'int' });
        }

        // --- CTRE (Phoenix 6 Defaults) ---
        if (type === 'TalonFX') {
            imports.add('com.ctre.phoenix6.hardware.TalonFX');
            declarations.push(`  private final TalonFX ${name};`);
            initializers.push(`    ${name} = new TalonFX(${idVal}, "${bus || 'rio'}");`);

            if (methodsToGen && methodsToGen.find(m => m === 'getVelocity')) {
                helperMethods.push(`  public double get${name}Velocity() {\n    return ${name}.getVelocity().getValue();\n  }`);
            }
            if (methodsToGen && methodsToGen.find(m => m === 'getPosition')) {
                helperMethods.push(`  public double get${name}Position() {\n    return ${name}.getPosition().getValue();\n  }`);
            }
        } else if (type === 'CANcoder') {
            imports.add('com.ctre.phoenix6.hardware.CANcoder');
            declarations.push(`  private final CANcoder ${name};`);
            initializers.push(`    ${name} = new CANcoder(${idVal}, "${bus || 'rio'}");`);
            if (methodsToGen && methodsToGen.find(m => m === 'getPosition')) {
                helperMethods.push(`  public double get${name}Position() {\n    return ${name}.getAbsolutePosition().getValue();\n  }`);
            }
        } else if (type === 'Pigeon2') {
            imports.add('com.ctre.phoenix6.hardware.Pigeon2');
            declarations.push(`  private final Pigeon2 ${name};`);
            initializers.push(`    ${name} = new Pigeon2(${idVal}, "${bus || 'rio'}");`);
            if (methodsToGen && methodsToGen.find(m => m === 'getYaw')) {
                helperMethods.push(`  public double get${name}Yaw() {\n    return ${name}.getYaw().getValue();\n  }`);
            }

            // --- REV Robotics ---
        } else if (type === 'CANSparkMax') {
            imports.add('com.revrobotics.CANSparkMax');
            imports.add('com.revrobotics.CANSparkLowLevel.MotorType'); // REVLib 2024
            declarations.push(`  private final CANSparkMax ${name};`);
            initializers.push(`    ${name} = new CANSparkMax(${idVal}, MotorType.kBrushless);`);
            if (methodsToGen && methodsToGen.find(m => m === 'getVelocity')) {
                helperMethods.push(`  public double get${name}Velocity() {\n    return ${name}.getEncoder().getVelocity();\n  }`);
            }
            if (methodsToGen && methodsToGen.find(m => m === 'getPosition')) {
                helperMethods.push(`  public double get${name}Position() {\n    return ${name}.getEncoder().getPosition();\n  }`);
            }

            // --- WPILib ---
        } else if (type === 'DoubleSolenoid') {
            imports.add('edu.wpi.first.wpilibj.DoubleSolenoid');
            imports.add('edu.wpi.first.wpilibj.PneumaticsModuleType');
            // Solenoid usually takes two ports, forward and reverse. The current UI only asks for one ID.
            // Assuming user inputs one ID and logic adds 1 for the second, as per previous code.
            // If using constants, we might want kForwardID and kReverseID?
            // For simplicity, let's keep the existing logic where second port is id+1,
            // but if constants are used, we might need to handle the math or generate two constants.
            // Given 'idVal' assumes it's a number OR a static final field reference, doing arithmetic on it in Java (const + 1) is fine.
            declarations.push(`  private final DoubleSolenoid ${name};`);
            initializers.push(`    ${name} = new DoubleSolenoid(PneumaticsModuleType.CTREPCM, ${idVal}, ${idVal} + 1);`);
            if (methodsToGen && methodsToGen.find(m => m === 'toggle')) {
                imports.add('edu.wpi.first.wpilibj.DoubleSolenoid.Value');
                helperMethods.push(`  public void toggle${name}() {\n    ${name}.toggle();\n  }`);
            }
        } else {
            // Generic Fallback
            initializers.push(`    // Unknown device type: ${type}`);
        }
    });

    return { imports, declarations, initializers, helperMethods, constantDefinitions };
}

module.exports = { generateHardwareCode, checkVendordeps };

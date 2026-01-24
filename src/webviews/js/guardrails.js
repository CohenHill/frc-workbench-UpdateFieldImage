/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/**
 * YAMS Generator Guardrails Module
 * Implements validation rules and dependency management for the YAMS wizard.
 */

// ===========================================
// FIELD DEPENDENCY GRAPH
// ===========================================
// @ts-ignore - Used for reference and future dynamic validation
const FIELD_DEPENDENCIES = {
    // PID requires closed loop control
    'pidSection': ['yamsControlLoop'],
    // Feedforward requires closed loop
    'feedforwardFields': ['yamsControlLoop'],
    // Starting position depends on sensor type and offset
    'startPosField': ['yamsSensorType', 'yamsHasZeroOffset'],
    // Limits require gearing, encoder, and control mode
    'limitsSection': ['yamsGearing', 'yamsSensorType', 'yamsControlLoop'],
    // Motion profile requires closed loop
    'yamsProfileType': ['yamsControlLoop'],
};

// ===========================================
// VALIDATION RULES
// ===========================================
// @ts-ignore - Used for reference and future dynamic validation
const GUARDRAILS = {
    // Control Mode Rules (Guardrail #2)
    openLoop: {
        forbidden: ['pidSection', 'yamsProfileType'],
        required: []
    },
    closedLoop: {
        forbidden: [],
        required: ['yamsKp'] // At minimum kP must exist
    },

    // Motion Profile Rules (Guardrail #3)
    trapezoidal: {
        required: ['yamsKp', 'yamsMaxVel', 'yamsMaxAccel'],
        forbidden: ['yamsMaxVoltage']
    },
    exponential: {
        required: ['yamsKv', 'yamsKa', 'yamsMaxVoltage'],
        forbidden: ['yamsMaxVel', 'yamsMaxAccel']
    },

    // Mechanism Rules (Guardrail #6)
    arm: {
        required: ['yamsKg'], // Gravity feedforward
        recommended: ['yamsKv', 'yamsKa']
    },
    elevator: {
        required: ['yamsKg'],
        recommended: ['yamsKv', 'yamsKa']
    },
    flywheel: {
        required: [],
        recommended: ['yamsKv']
    },
    generic: {
        required: [],
        recommended: []
    }
};

// ===========================================
// VENDOR COMPATIBILITY MATRIX (Guardrail #4)
// ===========================================
const VENDOR_COMPATIBILITY = {
    // Motor Controller -> Valid Absolute Encoders
    'TalonFX': ['CANCoder', 'Internal'],
    'SparkMax': ['ThroughBore', 'Internal'],
    'SparkFlex': ['ThroughBore', 'Internal'],
    'TalonSRX': ['CANCoder', 'Internal']
};

// ===========================================
// CURRENT LIMIT DEFAULTS (from spec)
// ===========================================
const CURRENT_DEFAULTS = {
    'NEO550': { supply: 25, stator: 40 },
    'NEO': { supply: 40, stator: 80 },
    'Kraken X60': { supply: 60, stator: 100 },
    'Talon FX': { supply: 40, stator: 80 },
    'Vortex': { supply: 40, stator: 80 },
    'CIM': { supply: 30, stator: 60 }
};

// ===========================================
// GUARDRAIL ENFORCEMENT FUNCTIONS
// ===========================================

/**
 * Enforces Control Mode guardrails (Guardrail #2)
 * Hides/shows fields based on Open vs Closed loop selection.
 */
window.enforceControlModeGuardrails = () => {
    // @ts-ignore
    const loop = document.getElementById('yamsControlLoop')?.value;
    // @ts-ignore
    const pidSection = document.getElementById('pidSection');
    // @ts-ignore
    const profileSelect = document.getElementById('yamsProfileType');

    if (loop === 'OpenLoop') {
        // FORBIDDEN: PID, Feedforward, Profiling, Limits
        if (pidSection) pidSection.style.display = 'none';
        if (profileSelect) {
            profileSelect.value = 'None';
            profileSelect.disabled = true;
        }
    } else {
        // Closed Loop: PID mandatory
        if (pidSection) pidSection.style.display = 'block';
        if (profileSelect) profileSelect.disabled = false;
    }
};

/**
 * Enforces Motion Profile guardrails (Guardrail #3)
 */
window.enforceProfileGuardrails = () => {
    // @ts-ignore
    const profile = document.getElementById('yamsProfileType')?.value;
    // @ts-ignore
    const trapFields = document.getElementById('trapezoidalFields');
    // @ts-ignore
    const expFields = document.getElementById('exponentialFields');

    // These fields may not exist yet, but we prepare for them
    if (profile === 'Trapezoidal') {
        if (trapFields) trapFields.style.display = 'block';
        if (expFields) expFields.style.display = 'none';
    } else if (profile === 'Exponential') {
        if (trapFields) trapFields.style.display = 'none';
        if (expFields) expFields.style.display = 'block';
    } else {
        if (trapFields) trapFields.style.display = 'none';
        if (expFields) expFields.style.display = 'none';
    }
};

/**
 * Enforces Encoder guardrails (Guardrail #4 & #5)
 * Handles vendor compatibility and starting position visibility.
 */
window.enforceEncoderGuardrails = () => {
    // @ts-ignore
    const sensorType = document.getElementById('yamsSensorType')?.value;
    // @ts-ignore
    const hasOffset = document.getElementById('yamsHasZeroOffset')?.checked;
    // @ts-ignore
    const controller = document.getElementById('yamsController')?.value;
    // @ts-ignore
    const absoluteOptions = document.getElementById('absoluteOptions');
    // @ts-ignore
    const startPosField = document.getElementById('startPosField');
    // @ts-ignore
    const offsetField = document.getElementById('offsetField');

    const isAbsolute = sensorType === 'CANCoder' || sensorType === 'ThroughBore';

    // Show/hide absolute options
    if (absoluteOptions) {
        absoluteOptions.style.display = isAbsolute ? 'block' : 'none';
    }

    // Starting Position Logic (Guardrail #5)
    // Only show if: No absolute encoder OR absolute encoder without offset
    if (startPosField) {
        if (isAbsolute && hasOffset) {
            startPosField.style.display = 'none';
        } else {
            startPosField.style.display = 'block';
        }
    }

    // Offset field visibility
    if (offsetField) {
        offsetField.style.display = (isAbsolute && hasOffset) ? 'block' : 'none';
    }

    // Vendor compatibility warning (Guardrail #4)
    if (isAbsolute && controller) {
        const validEncoders = VENDOR_COMPATIBILITY[controller] || [];
        if (!validEncoders.includes(sensorType)) {
            // Show cross-vendor warning
            showGuardrailWarning('encoder-vendor',
                `⚠️ ${sensorType} requires software sync with ${controller}. YAMS will emit SMC.setEncoderPosition() calls.`);
        } else {
            hideGuardrailWarning('encoder-vendor');
        }
    }
};

/**
 * Enforces Mechanism-specific guardrails (Guardrail #6)
 */
window.enforceMechanismGuardrails = () => {
    // @ts-ignore
    const mechType = document.getElementById('yamsMechType')?.value;
    // @ts-ignore
    const kgField = document.getElementById('yamsKg');
    // @ts-ignore
    const kgLabel = kgField?.previousElementSibling;

    if (mechType === 'Arm') {
        // Arm requires kG (cosine gravity)
        if (kgField) kgField.placeholder = 'Required for Arm';
        if (kgLabel) kgLabel.innerHTML = 'kG <span style="color:#ff6b6b">*</span>';
    } else if (mechType === 'Elevator') {
        // Elevator requires kG (constant gravity)
        if (kgField) kgField.placeholder = 'Required for Elevator';
        if (kgLabel) kgLabel.innerHTML = 'kG <span style="color:#ff6b6b">*</span>';
    } else {
        // Generic/Flywheel: optional
        if (kgField) kgField.placeholder = '';
        if (kgLabel) kgLabel.textContent = 'kG';
    }
};

/**
 * Apply current limit defaults based on motor type
 */
window.applyCurrentDefaults = () => {
    // @ts-ignore
    const motorType = document.getElementById('yamsMotorType')?.value;
    const defaults = CURRENT_DEFAULTS[motorType];

    if (defaults) {
        // @ts-ignore
        const supply = document.getElementById('yamsSupplyLimit');
        // @ts-ignore
        const stator = document.getElementById('yamsStatorLimit');
        if (supply) supply.value = defaults.supply;
        if (stator) stator.value = defaults.stator;
    }
};

/**
 * Dependency Invalidation (Guardrail #9)
 * Reset dependent fields when prerequisites change.
 */
window.invalidateDependents = (changedField) => {
    const invalidations = {
        'yamsMotorType': ['yamsSensorType', 'yamsController'],
        'yamsSensorType': ['yamsHasZeroOffset', 'yamsStartPosition'],
        'yamsControlLoop': ['yamsProfileType', 'yamsKp', 'yamsKi', 'yamsKd']
    };

    const fieldsToReset = invalidations[changedField] || [];
    fieldsToReset.forEach(fieldId => {
        // @ts-ignore
        const field = document.getElementById(fieldId);
        if (field) {
            if (field.type === 'checkbox') {
                field.checked = false;
            } else if (field.tagName === 'SELECT') {
                field.selectedIndex = 0;
            } else {
                field.value = '';
            }
        }
    });
};

// ===========================================
// OUTPUT VALIDATION (Guardrail #10)
// ===========================================

/**
 * Validates all guardrails before code generation.
 * Returns { valid: boolean, errors: string[] }
 */
window.validateBeforeGenerate = () => {
    const errors = [];

    // @ts-ignore
    const controlLoop = document.getElementById('yamsControlLoop')?.value;
    // @ts-ignore
    const profile = document.getElementById('yamsProfileType')?.value;
    // @ts-ignore
    const mechType = document.getElementById('yamsMechType')?.value;
    // @ts-ignore
    const name = document.getElementById('yamsSubsystemName')?.value;

    // Required: Subsystem Name
    if (!name || name.trim() === '') {
        errors.push('Subsystem Name is required');
    }

    // Closed Loop requires PID
    if (controlLoop === 'ClosedLoop') {
        // @ts-ignore
        const kp = document.getElementById('yamsKp')?.value;
        if (!kp || kp.trim() === '') {
            errors.push('Closed Loop control requires at least kP');
        }
    }

    // Exponential profile requires feedforward
    if (profile === 'Exponential') {
        // @ts-ignore
        const kv = document.getElementById('yamsKv')?.value;
        // @ts-ignore
        const ka = document.getElementById('yamsKa')?.value;
        if (!kv || !ka) {
            errors.push('Exponential profile requires kV and kA feedforward values');
        }
    }

    // Arm/Elevator requires kG
    if (mechType === 'Arm' || mechType === 'Elevator') {
        // @ts-ignore
        const kg = document.getElementById('yamsKg')?.value;
        if (!kg || kg.trim() === '') {
            errors.push(`${mechType} mechanism requires kG (gravity feedforward)`);
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
};

// ===========================================
// WARNING DISPLAY HELPERS
// ===========================================

function showGuardrailWarning(id, message) {
    // @ts-ignore
    let container = document.getElementById('guardrail-warnings');
    if (!container) {
        // @ts-ignore
        container = document.createElement('div');
        container.id = 'guardrail-warnings';
        container.style.cssText = 'position:fixed;bottom:80px;right:20px;max-width:350px;z-index:1000;';
        // @ts-ignore
        document.body.appendChild(container);
    }

    // @ts-ignore
    let warning = document.getElementById(`warning-${id}`);
    if (!warning) {
        // @ts-ignore
        warning = document.createElement('div');
        warning.id = `warning-${id}`;
        warning.style.cssText = 'background:#4a3f00;border:1px solid #ff9800;color:#ffcc80;padding:10px 15px;border-radius:6px;margin-top:8px;font-size:0.85em;';
        container.appendChild(warning);
    }
    warning.textContent = message;
}

function hideGuardrailWarning(id) {
    // @ts-ignore
    const warning = document.getElementById(`warning-${id}`);
    if (warning) warning.remove();
}

// ===========================================
// MOTOR-CONTROLLER COMPATIBILITY (Guardrail #11)
// ===========================================
const MOTOR_CONTROLLER_MATRIX = {
    'Kraken X60': ['TalonFX'],
    'Talon FX': ['TalonFX'],
    'Vortex': ['SparkFlex', 'SparkMax'],
    'NEO': ['SparkMax', 'SparkFlex'],
    'NEO550': ['SparkMax', 'SparkFlex'],
    'CIM': ['TalonSRX', 'VictorSPX', 'SparkMax'],
    'MiniCIM': ['TalonSRX', 'VictorSPX', 'SparkMax'],
    'Bag': ['TalonSRX', 'VictorSPX', 'SparkMax'],
    '775pro': ['TalonSRX', 'VictorSPX', 'SparkMax']
};

/**
 * Enforces Motor-Controller compatibility (Guardrail #11)
 */
window.enforceMotorControllerGuardrails = () => {
    // @ts-ignore
    const motor = document.getElementById('yamsMotorType')?.value;
    // @ts-ignore
    const controller = document.getElementById('yamsController')?.value;

    const validControllers = MOTOR_CONTROLLER_MATRIX[motor] || [];

    // If we have a matrix entry and the current controller isn't in it
    if (validControllers.length > 0 && !validControllers.includes(controller)) {
        showGuardrailWarning('motor-controller',
            `⚠️ Incompatible: ${motor} typically does not work with ${controller}. Recommended: ${validControllers.join(' or ')}`);
    } else {
        hideGuardrailWarning('motor-controller');
    }
};

// ===========================================
// INITIALIZE GUARDRAILS ON LOAD
// ===========================================
window.initGuardrails = () => {
    // Attach change listeners to trigger guardrail enforcement
    const triggerFields = [
        'yamsControlLoop', 'yamsProfileType', 'yamsSensorType',
        'yamsHasZeroOffset', 'yamsMechType', 'yamsMotorType',
        'yamsController' // Added controller to triggers
    ];

    triggerFields.forEach(id => {
        // @ts-ignore
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                window.enforceControlModeGuardrails();
                window.enforceProfileGuardrails();
                window.enforceEncoderGuardrails();
                window.enforceMechanismGuardrails();
                window.enforceMotorControllerGuardrails(); // New check
                window.invalidateDependents(id);
            });
        }
    });

    // Motor type also updates current defaults
    // @ts-ignore
    const motorEl = document.getElementById('yamsMotorType');
    if (motorEl) {
        motorEl.addEventListener('change', window.applyCurrentDefaults);
    }

    // Initial enforcement
    window.enforceControlModeGuardrails();
    window.enforceEncoderGuardrails();
    window.enforceMechanismGuardrails();
    window.enforceMotorControllerGuardrails();
};

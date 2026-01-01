/* eslint-disable no-undef */
// @ts-ignore
const vscode = acquireVsCodeApi();

const devices = [];
const states = [];
const collapsedCategories = new Set(); // Global state for persistence
let draggedDevice = null;
let installedVendors = [];

// @ts-ignore
window.addEventListener('message', event => {
    const message = event.data;
    if (message.command === 'updateVendordeps') {
        installedVendors = message.vendors || [];
        renderDeviceTypes();
    }
});

// @ts-ignore
function filterDevices() {
    // @ts-ignore
    const query = document.getElementById('deviceSearch').value.toLowerCase();
    renderDeviceTypes(query);
}

// --- Sidebar Visibility Logic ---
function updateSidebarVisibility() {
    // Re-render sidebar to reflect changes (if any filtering applies)
    // @ts-ignore
    const query = document.getElementById('deviceSearch').value.toLowerCase();
    renderDeviceTypes(query);
}

function renderDeviceTypes(filter = '') {
    // @ts-ignore
    const list = document.getElementById('deviceTypeList');
    list.innerHTML = '';

    const categories = {};
    // @ts-ignore
    deviceTypes.forEach(dt => {
        if (filter && !dt.name.toLowerCase().includes(filter) && !dt.category.toLowerCase().includes(filter)) {
            return;
        }
        if (dt.hidden) return; // Respect hidden flag
        if (!categories[dt.category]) categories[dt.category] = [];
        categories[dt.category].push(dt);
    });

    // Defined Category Order
    const categoryOrder = [
        'Motors',
        'Motor Controllers',
        'Configuration',
        'Sensors',
        'Pneumatics',
        'Actuators',
        'LEDs',
        'Misc'
    ];

    // Get keys present in this render
    const presentKeys = Object.keys(categories);

    // Sort keys based on defined order, appending unknown categories at the end
    presentKeys.sort((a, b) => {
        const idxA = categoryOrder.indexOf(a);
        const idxB = categoryOrder.indexOf(b);
        if (idxA === -1 && idxB === -1) return a.localeCompare(b);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
    });

    presentKeys.forEach(category => {
        // @ts-ignore
        const header = document.createElement('div');
        header.className = 'sidebar-header';
        header.style.fontSize = '0.9em';
        header.style.marginTop = '10px';
        header.style.cursor = 'pointer';
        header.style.userSelect = 'none';
        header.style.display = 'flex';
        header.style.alignItems = 'center';
        header.style.justifyContent = 'space-between';
        header.setAttribute('data-category', category);

        // Initial State
        const isCollapsed = collapsedCategories.has(category);

        header.innerHTML = `
            <span>${category}</span>
            <span style="font-size:0.8em; transform: ${isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'}; transition: transform 0.2s;">▼</span>
        `;

        // Wrapper for items to toggle visibility
        // @ts-ignore
        const itemsContainer = document.createElement('div');
        itemsContainer.style.display = isCollapsed ? 'none' : 'block';
        itemsContainer.style.overflow = 'hidden';

        // Toggle Handler
        header.addEventListener('click', () => {
            const arrow = header.querySelector('span:last-child');
            if (itemsContainer.style.display === 'none') {
                itemsContainer.style.display = 'block';
                arrow.style.transform = 'rotate(0deg)';
                collapsedCategories.delete(category);
            } else {
                itemsContainer.style.display = 'none';
                arrow.style.transform = 'rotate(-90deg)';
                collapsedCategories.add(category);
            }
        });

        list.appendChild(header);
        list.appendChild(itemsContainer);

        categories[category].forEach(dt => {
            // @ts-ignore
            const item = document.createElement('div');
            item.className = 'device-type-item';

            // Check vendor requirement
            const isMissingVendor = dt.requiredVendor && !installedVendors.includes(dt.requiredVendor);

            if (isMissingVendor) {
                item.classList.add('disabled');
                item.title = `Requires ${dt.requiredVendor} library`;
            } else {
                item.draggable = true;
            }

            // Flex container for image + text
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.gap = '10px';

            // Image
            // @ts-ignore
            const img = document.createElement('img');
            img.src = dt.image || '';
            img.onerror = () => { img.style.display = 'none'; };
            item.appendChild(img);

            // @ts-ignore
            const text = document.createElement('span');
            text.textContent = dt.name;
            item.appendChild(text);

            if (!isMissingVendor) {
                item.addEventListener('dragstart', (e) => {
                    draggedDevice = dt.name;
                    item.classList.add('dragging');
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('text/plain', dt.name);
                });

                item.addEventListener('dragend', () => {
                    item.classList.remove('dragging');
                });
            }

            item.addEventListener('click', (e) => {
                if (isMissingVendor) {
                    showVendorPopup(dt, e);
                } else {
                    showInfoPopup(dt, e);
                }
            });

            itemsContainer.appendChild(item);
        });
    });
}

function showVendorPopup(deviceType, event) {
    // @ts-ignore
    const popup = document.getElementById('infoPopup');
    // @ts-ignore
    document.getElementById('popupTitle').innerHTML = `⚠️ Missing Library: ${deviceType.requiredVendor}`;
    // @ts-ignore
    document.getElementById('popupDescription').innerHTML =
        `To use <strong>${deviceType.name}</strong>, you need to install the <strong>${deviceType.requiredVendor}</strong> vendor library.<br><br>` +
        `<button class="btn" onclick="installVendor('${deviceType.vendorUrl}')">Download Library</button>`;

    // @ts-ignore
    document.getElementById('popupImport').style.display = 'none';

    popup.style.display = 'block';
    // @ts-ignore
    popup.style.left = Math.min(event.pageX + 10, window.innerWidth - 320) + 'px';
    popup.style.top = (event.pageY + 10) + 'px';
}

window.installVendor = (url) => {
    vscode.postMessage({ command: 'openVendorUrl', url: url });
};

// @ts-ignore
const dropZone = document.getElementById('dropZone');

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const deviceName = e.dataTransfer.getData('text/plain');
    if (deviceName) {
        // @ts-ignore
        const deviceType = deviceTypes.find(dt => dt.name === deviceName);
        if (deviceType) {
            // Prevent adding Config items as top-level devices
            if (!deviceType.isConfig) {
                addDeviceOfType(deviceType);
            }
        }
        draggedDevice = null;
    }
});

function showInfoPopup(deviceType, event) {
    // @ts-ignore
    const popup = document.getElementById('infoPopup');
    // @ts-ignore
    document.getElementById('popupTitle').textContent = deviceType.name;
    // @ts-ignore
    document.getElementById('popupDescription').textContent = deviceType.description;
    // @ts-ignore
    const importEl = document.getElementById('popupImport');
    importEl.style.display = 'block';
    importEl.innerHTML = `<strong>Import:</strong> <code>${deviceType.import}</code>`;

    popup.style.display = 'block';
    // @ts-ignore
    popup.style.left = Math.min(event.pageX + 10, window.innerWidth - 320) + 'px';
    popup.style.top = (event.pageY + 10) + 'px';
}

window.closeInfoPopup = () => {
    // @ts-ignore
    document.getElementById('infoPopup').style.display = 'none';
};

// @ts-ignore
document.addEventListener('click', (e) => {
    // @ts-ignore
    const popup = document.getElementById('infoPopup');
    if (!e.target.closest('.device-type-item') && !e.target.closest('.info-popup')) {
        popup.style.display = 'none';
    }
});

function addDeviceOfType(deviceType) {
    devices.push({
        type: deviceType.name,
        name: '',
        id: '',
        bus: 'rio',
        needsController: deviceType.needsController || false,
        validControllers: deviceType.validControllers || []
    });
    renderDevices();
    updateSidebarVisibility();
}

// @ts-ignore
function validateDependencies() {
    // Deprecated global check in favor of per-row nested logic
    return [];
}

function dropController(e, index) {
    e.preventDefault();
    e.stopPropagation();
    const deviceName = e.dataTransfer.getData('text/plain');
    const parentDevice = devices[index];

    // Validate
    // @ts-ignore
    const controllerType = deviceTypes.find(d => d.name === deviceName);
    if (!controllerType) return;

    // Check if valid controller for this motor
    // Map generic names to specific check strings if needed, but using name directly for now
    // The validControllers array in deviceTypes uses the 'name' property (e.g., 'TalonFXS') usually
    if (parentDevice.validControllers && !parentDevice.validControllers.includes(deviceName)) {
        // Use a more specific popup for this
        // @ts-ignore
        const popup = document.getElementById('infoPopup');
        // @ts-ignore
        document.getElementById('popupTitle').innerHTML = `Incompatible Controller`;
        // @ts-ignore
        document.getElementById('popupDescription').innerHTML =
            `<strong>${parentDevice.name}</strong> requires one of these controllers: <strong>${parentDevice.validControllers.join(', ')}</strong>. You tried to add <strong>${deviceName}</strong>.`;
        // @ts-ignore
        document.getElementById('popupImport').style.display = 'none';
        popup.style.display = 'block';
        // @ts-ignore
        popup.style.left = Math.min(e.pageX + 10, window.innerWidth - 320) + 'px';
        popup.style.top = (e.pageY + 10) + 'px';
        return;
    }

    // Assign controller
    parentDevice.controller = {
        type: deviceName,
        id: 1, // Default ID
        name: controllerType.name,
        import: controllerType.import // Capture import path!
    };

    // Remove highlighting
    // @ts-ignore
    const zone = document.getElementById(`nested-zone-${index}`);
    if (zone) zone.classList.remove('drag-over');

    renderDevices();
    updateSidebarVisibility();
}

// @ts-ignore
function removeNestedController(index) {
    if (devices[index]) {
        delete devices[index].controller;
        renderDevices();
        updateSidebarVisibility();
    }
}

window.openYamsModal = (index) => {
    // @ts-ignore
    const modal = document.getElementById('yamsConfigModal');
    const device = devices[index];
    // @ts-ignore
    document.getElementById('currentConfigDeviceIndex').value = index;

    // Load existing config or defaults
    const config = device.yamsConfig || getDefaultYamsConfig();

    // Populate fields
    // @ts-ignore
    document.getElementById('yamsControlMode').value = config.controlMode;
    // @ts-ignore
    document.getElementById('yamsInverted').value = config.inverted.toString();
    // @ts-ignore
    document.getElementById('yamsIdleMode').value = config.idleMode;

    // @ts-ignore
    document.getElementById('yamsCircumferenceValue').value = config.circumferenceValue;
    // @ts-ignore
    document.getElementById('yamsCircumferenceUnit').value = config.circumferenceUnit;
    // @ts-ignore
    document.getElementById('yamsGearing').value = config.gearing;
    // @ts-ignore
    document.getElementById('yamsMass').value = config.mass;

    // @ts-ignore
    document.getElementById('yamsStatorLimit').value = config.statorLimit;
    // @ts-ignore
    document.getElementById('yamsOpenLoopRamp').value = config.openLoopRamp;
    // @ts-ignore
    document.getElementById('yamsClosedLoopRamp').value = config.closedLoopRamp;

    // @ts-ignore
    document.getElementById('yamsKp').value = config.kP;
    // @ts-ignore
    document.getElementById('yamsKi').value = config.kI;
    // @ts-ignore
    document.getElementById('yamsKd').value = config.kD;
    // @ts-ignore
    document.getElementById('yamsMaxVel').value = config.maxVel;
    // @ts-ignore
    document.getElementById('yamsMaxAccel').value = config.maxAccel;

    // @ts-ignore
    document.getElementById('yamsFfType').value = config.ffType;
    // @ts-ignore
    document.getElementById('yamsKs').value = config.kS;
    // @ts-ignore
    document.getElementById('yamsKg').value = config.kG;
    // @ts-ignore
    document.getElementById('yamsKv').value = config.kV;
    // @ts-ignore
    document.getElementById('yamsKa').value = config.kA;

    // Sim Gains
    // @ts-ignore
    document.getElementById('yamsUseSimGains').checked = config.useSimGains;
    toggleSimGains(config.useSimGains);
    // @ts-ignore
    document.getElementById('yamsSimKp').value = config.simKp;
    // @ts-ignore
    document.getElementById('yamsSimKi').value = config.simKi;
    // @ts-ignore
    document.getElementById('yamsSimKd').value = config.simKd;

    // @ts-ignore
    document.getElementById('yamsTelemetryName').value = config.telemetryName || (device.name + "Motor");
    // @ts-ignore
    document.getElementById('yamsVerbosity').value = config.verbosity;

    modal.style.display = 'block';
};

window.closeYamsModal = () => {
    // @ts-ignore
    document.getElementById('yamsConfigModal').style.display = 'none';
};

window.saveYamsConfig = () => {
    // @ts-ignore
    const index = document.getElementById('currentConfigDeviceIndex').value;
    if (index === '-1' || !devices[index]) return;

    const config = {
        // @ts-ignore
        controlMode: document.getElementById('yamsControlMode').value,
        // @ts-ignore
        inverted: document.getElementById('yamsInverted').value === 'true',
        // @ts-ignore
        idleMode: document.getElementById('yamsIdleMode').value,

        // @ts-ignore
        circumferenceValue: document.getElementById('yamsCircumferenceValue').value,
        // @ts-ignore
        circumferenceUnit: document.getElementById('yamsCircumferenceUnit').value,
        // @ts-ignore
        gearing: document.getElementById('yamsGearing').value,
        // @ts-ignore
        mass: document.getElementById('yamsMass').value,

        // @ts-ignore
        statorLimit: document.getElementById('yamsStatorLimit').value,
        // @ts-ignore
        openLoopRamp: document.getElementById('yamsOpenLoopRamp').value,
        // @ts-ignore
        closedLoopRamp: document.getElementById('yamsClosedLoopRamp').value,

        // @ts-ignore
        kP: document.getElementById('yamsKp').value,
        // @ts-ignore
        kI: document.getElementById('yamsKi').value,
        // @ts-ignore
        kD: document.getElementById('yamsKd').value,
        // @ts-ignore
        maxVel: document.getElementById('yamsMaxVel').value,
        // @ts-ignore
        maxAccel: document.getElementById('yamsMaxAccel').value,

        // @ts-ignore
        ffType: document.getElementById('yamsFfType').value,
        // @ts-ignore
        kS: document.getElementById('yamsKs').value,
        // @ts-ignore
        kG: document.getElementById('yamsKg').value,
        // @ts-ignore
        kV: document.getElementById('yamsKv').value,
        // @ts-ignore
        kA: document.getElementById('yamsKa').value,

        // @ts-ignore
        useSimGains: document.getElementById('yamsUseSimGains').checked,
        // @ts-ignore
        simKp: document.getElementById('yamsSimKp').value,
        // @ts-ignore
        simKi: document.getElementById('yamsSimKi').value,
        // @ts-ignore
        simKd: document.getElementById('yamsSimKd').value,

        // @ts-ignore
        telemetryName: document.getElementById('yamsTelemetryName').value,
        // @ts-ignore
        verbosity: document.getElementById('yamsVerbosity').value
    };

    devices[index].yamsConfig = config;
    renderDevices();
    // @ts-ignore
    closeYamsModal();
};

function getDefaultYamsConfig() {
    return {
        controlMode: 'CLOSED_LOOP',
        inverted: false,
        idleMode: 'BRAKE',
        circumferenceValue: '1.0',
        circumferenceUnit: 'Rotations',
        gearing: '1',
        mass: '5.0',
        statorLimit: '40',
        openLoopRamp: '0.25',
        closedLoopRamp: '0.25',
        kP: '0.0', kI: '0.0', kD: '0.0',
        maxVel: '1.0', maxAccel: '1.0',
        ffType: 'Simple',
        kS: '0.0', kG: '0.0', kV: '0.0', kA: '0.0',
        useSimGains: false,
        simKp: '', simKi: '', simKd: '',
        telemetryName: '',
        verbosity: 'HIGH'
    };
}

// @ts-ignore
document.getElementById('yamsUseSimGains').addEventListener('change', (e) => {
    toggleSimGains(e.target.checked);
});

function toggleSimGains(show) {
    // @ts-ignore
    document.getElementById('yamsSimGainsBody').style.display = show ? 'grid' : 'none';
}

// Override dropController to handle Config Drop if dropped specifically on zone
// Although the row handler usually catches it, strictly nested calls might stop propagation.
const originalDropController = dropController;
// @ts-ignore
dropController = (e, index) => {
    // Check content first
    const deviceName = e.dataTransfer.getData('text/plain');
    if (deviceName === 'SmartMotorControllerConfig') {
        // Open Modal for this device
        e.preventDefault();
        e.stopPropagation();
        // @ts-ignore
        openYamsModal(index);
        // clear drop highlight
        // @ts-ignore
        const zone = document.getElementById(`nested-zone-${index}`);
        if (zone) zone.classList.remove('drag-over');
        return;
    }

    // Fallback
    originalDropController(e, index);
};

window.removeYamsConfig = (index) => {
    if (devices[index]) {
        delete devices[index].yamsConfig;
        renderDevices();
    }
};

window.removeVendorConfig = (index) => {
    if (devices[index]) {
        delete devices[index].vendorConfig;
        renderDevices();
    }
};

// @ts-ignore
function handleConfigDrop(e, index) {
    e.preventDefault();
    e.stopPropagation();
    // @ts-ignore
    const zone = document.getElementById(`config-zone-${index}`);
    if (zone) zone.classList.remove('drag-over');

    const deviceName = e.dataTransfer.getData('text/plain');

    const device = devices[index];
    // @ts-ignore
    const configType = deviceTypes.find(d => d.name === deviceName);
    if (!configType || !configType.isConfig) return;

    let compatible = false;
    if (deviceName === 'SmartMotorControllerConfig') {
        // @ts-ignore
        openYamsModal(index);
        return;
    } else if (deviceName === 'TalonFX Configuration' && (device.type.includes('TalonFX') || device.type.includes('Kraken'))) {
        compatible = true;
    } else if (deviceName === 'TalonFXS Configuration' && (device.type.includes('TalonFXS') || device.type.includes('Minion'))) {
        compatible = true;
    } else if (deviceName === 'CANcoder Configuration' && device.type === 'CANcoder') {
        compatible = true;
    } else if (deviceName === 'Pigeon2 Configuration' && device.type === 'Pigeon 2.0') {
        compatible = true;
    } else if (deviceName === 'CANdle Configuration' && device.type === 'CANdle') {
        compatible = true;
    } else if (deviceName === 'CANdi Configuration' && device.type === 'CANdi') {
        compatible = true;
    } else if (deviceName === 'CANrange Configuration' && device.type === 'CANrange') {
        compatible = true;
    } else if (deviceName === 'Spark Max Configuration' && (device.type.includes('SparkMax') || device.type.includes('NEO'))) {
        compatible = true;
    } else if (deviceName === 'Spark Flex Configuration' && (device.type.includes('SparkFlex') || device.type.includes('Vortex'))) {
        compatible = true;
    }

    if (compatible) {
        device.vendorConfig = deviceName;
        renderDevices();
    }
}

// Update function handler
// @ts-ignore
function updateDevice(index, field, value) {
    if (field === 'controllerId' && devices[index].controller) {
        devices[index].controller.id = value;
    } else {
        devices[index][field] = value;
    }
}

// @ts-ignore
function allowDropController(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

// @ts-ignore
function leaveDropController(e) {
    e.currentTarget.classList.remove('drag-over');
}

function renderDevices() {
    // @ts-ignore
    const table = document.getElementById('deviceTable');
    table.innerHTML = '';

    // Remove old warnings container as we validate per-item now
    // @ts-ignore
    const warningContainer = document.getElementById('validationWarnings');
    if (warningContainer) warningContainer.remove();

    if (devices.length === 0) {
        // @ts-ignore
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="6" style="text-align:center; opacity:0.5; padding:20px;">Drag devices here to add them</td>';
        table.appendChild(row);
        return;
    }

    devices.forEach((device, index) => {
        // @ts-ignore
        const row = document.createElement('tr');

        // --- Helper Methods Check ---
        // Use DEVICE_HELPERS for dynamic generation
        let targetType = device.controller ? device.controller.type : device.type;
        let helpersHtml = '';

        // @ts-ignore
        const availableHelpers = DEVICE_HELPERS[targetType];
        if (availableHelpers) {
            helpersHtml = `<div style="display:flex; flex-direction:column; gap:4px; font-size:0.85em;">`;
            if (availableHelpers.length > 3) {
                // Use a scrollable area if too many
                helpersHtml = `<div style="display:flex; flex-direction:column; gap:4px; font-size:0.85em; max-height:80px; overflow-y:auto; border:1px solid #333; padding:4px;">`;
            }

            availableHelpers.forEach(h => {
                const isChecked = device.helperMethods?.includes(h.id) ? 'checked' : '';
                helpersHtml += `<label style="white-space:nowrap;"><input type="checkbox" class="helper-method-checkbox" value="${h.id}" onchange="toggleHelper(${index}, '${h.id}', this.checked)" ${isChecked}> ${h.label}</label>`;
            });
            helpersHtml += `</div>`;
        } else {
            helpersHtml = `<span style="opacity:0.5; font-size:0.8em">None available</span>`;
        }

        // --- Nested Controller Logic ---
        // --- Nested Controller Logic ---
        let deviceCellContent = `<div class="device-header" style="display:flex; align-items:center; gap:8px; min-height:36px;">${device.type}</div>`;

        // If this device needs a controller
        if (device.needsController) {
            if (device.controller) {
                // Controller Attached State
                deviceCellContent += `
                    <div class="nested-device" style="margin-left:16px; margin-top:4px; font-size:0.9em;">
                        <span style="display:flex; align-items:center;">
                            <span style="color:#4CAF50; margin-right:5px;">✔</span> 
                            ${device.controller.type} (ID: ${device.controller.id})
                        </span>
                        <button class="btn btn-icon" onclick="removeNestedController(${index})" style="font-size:0.8em;">✕</button>
                    </div>
                `;
            } else {
                // Empty Drop Zone State
                const needsList = device.validControllers ? device.validControllers.join(' or ') : 'Controller';
                deviceCellContent += `
                    <div id="nested-zone-${index}" class="nested-drop-zone" 
                         style="margin-left:16px; margin-top:4px; height:30px;"
                         ondrop="dropController(event, ${index})" 
                         ondragover="allowDropController(event)" 
                         ondragleave="leaveDropController(event)">
                        Drag ${needsList} here
                    </div>
                `;
            }
        }

        // --- YAMS Config Zone ---
        // @ts-ignore
        const isYamsMode = document.getElementById('subsystemType').value === 'yams';

        if (isYamsMode && device.yamsConfig) {
            deviceCellContent += `
            <div class="nested-device" style="margin-left:16px; margin-top:4px; font-size:0.9em;">
                <span style="display:flex; align-items:center;">
                    <span>⚙️ YAMS Configured</span>
                </span>
                <div style="display:flex; align-items:center; gap:5px;">
                    <button class="btn btn-icon" onclick="openYamsModal(${index})" title="Edit" style="font-size:0.8em;">✏️</button>
                    <button class="btn btn-icon" onclick="removeYamsConfig(${index})" title="Remove" style="font-size:0.8em;">✕</button>
                </div>
            </div>`;
        }

        // Show Vendor Config if present
        if (device.vendorConfig) {
            deviceCellContent += `
            <div class="nested-device" style="margin-left:16px; margin-top:4px; font-size:0.9em;">
                 <span style="display:flex; align-items:center; gap:5px;">
                    <img src="../../images/image.png" style="width:16px; height:16px;">
                    ${device.vendorConfig}
                 </span>
                 <button class="btn btn-icon" onclick="removeVendorConfig(${index})" style="font-size:0.8em;">✕</button>
            </div>`;
        }

        // Add Drop Zone for Config
        // Only show if compatible motor and not already configured
        const isCompatibleWithVendorConfig = (
            device.type.includes('TalonFX') ||
            device.type.includes('Kraken') ||
            device.type.includes('TalonFXS') ||
            device.type.includes('Minion') ||
            device.type.includes('SparkMax') ||
            device.type.includes('NEO') ||
            device.type.includes('SparkFlex') ||
            device.type.includes('Vortex') ||
            device.type === 'CANcoder' ||
            device.type === 'Pigeon 2.0' ||
            device.type === 'CANdle' ||
            device.type === 'CANdi' ||
            device.type === 'CANrange'
        );

        if (isYamsMode || isCompatibleWithVendorConfig) {
            // In YAMS mode, only show if no yamsConfig. In PID mode, show if no vendorConfig.
            const showDrop = isYamsMode ? !device.yamsConfig : !device.vendorConfig;

            if (showDrop) {
                const dropId = `config - zone - ${index} `;
                deviceCellContent += `
                <div id="${dropId}" class="nested-drop-zone"
                    style="margin-left:16px; margin-top:5px; height:30px; font-size:0.8em;"
                    ondragover="allowDropController(event)"
                    ondragleave="leaveDropController(event)"
                    ondrop="handleConfigDrop(event, ${index})">
                    ${isYamsMode ? '+ Drag YAMS Config Here' : '+ Drag Config Here'}
                </div>`;
            }
        }

        // ID Input: If has nested controller, specificy that the ID belongs to that controller
        let idInput = `<input type="text" class="device-id" value="${device.controller ? device.controller.id : device.id}" onchange="updateDevice(${index}, '${device.controller ? 'controllerId' : 'id'}', this.value)" placeholder="1" style="text-align:center;">`;

        // Validation State for Row
        if (device.needsController && !device.controller) {
            row.style.background = 'rgba(255, 100, 100, 0.05)';
            row.style.borderLeft = '3px solid red';
        }

        row.className = 'device-row'; // Add class for styling
        row.style.borderBottom = '1px solid var(--border-color)';

        // We removed the whole-row drop logic to force using the specific zone
        // but we keep the styling


        row.innerHTML = `
            <td style="vertical-align:top;">${deviceCellContent}</td>
            <td style="vertical-align:top;"><input type="text" class="device-name" value="${device.name}" onchange="updateDevice(${index}, 'name', this.value)" placeholder="motorName"></td>
            <td style="vertical-align:top;">${idInput}</td>
            <td style="vertical-align:top;"><input type="text" class="device-bus" value="${device.bus}" onchange="updateDevice(${index}, 'bus', this.value)" placeholder="rio"></td>
            <td style="vertical-align:top;">${helpersHtml}</td>
            <td style="vertical-align:top;"><button class="btn btn-icon" onclick="deleteDevice(${index})">🗑</button></td>
            `;
        table.appendChild(row);
    });
}

window.toggleHelper = (index, method, checked) => {
    if (!devices[index].helperMethods) devices[index].helperMethods = [];
    if (checked) {
        if (!devices[index].helperMethods.includes(method)) devices[index].helperMethods.push(method);
    } else {
        devices[index].helperMethods = devices[index].helperMethods.filter(m => m !== method);
    }
};

window.deleteDevice = (index) => {
    devices.splice(index, 1);
    renderDevices();
    updateSidebarVisibility();
};

// --- Card Carousel & PID Logic ---
window.selectCard = (cardElement, value) => {
    // Update hidden input
    // @ts-ignore
    const input = document.getElementById('subsystemType');
    input.value = value;

    // Visual Update
    // @ts-ignore
    const cards = document.querySelectorAll('.card');
    cards.forEach(c => c.classList.remove('active'));
    cardElement.classList.add('active');

    togglePIDFields();
    toggleFormSections(); // Show/hide form sections based on subsystem type

    // Trigger Visibility Update on Mode Switch
    updateSidebarVisibility();
};

// Toggle visibility of form sections based on subsystem type
function toggleFormSections() {
    // @ts-ignore
    const type = document.getElementById('subsystemType').value;
    const isYamsMode = type === 'yams';

    // Get all the elements we want to hide for YAMS
    // Use .parentElement to traverse up from known IDs
    // @ts-ignore
    const subsystemNameRow = document.getElementById('subsystemName')?.parentElement;
    // @ts-ignore
    const checkboxGroup = document.querySelector('.checkbox-group');
    // @ts-ignore
    const statesSystemSection = document.getElementById('enableStates')?.parentElement?.parentElement;
    // @ts-ignore
    const baseClassRow = document.getElementById('baseClass')?.parentElement;

    // Find the hardware devices section (it's the div containing the h2 with "Hardware Devices")
    // @ts-ignore
    const allH2s = document.querySelectorAll('h2');
    let hardwareSection = null;
    allH2s.forEach(h2 => {
        if (h2.textContent.includes('Hardware Devices')) {
            hardwareSection = h2.parentElement;
        }
    });

    // Hide/show based on YAMS mode
    const displayValue = isYamsMode ? 'none' : 'block';

    if (subsystemNameRow) subsystemNameRow.style.display = displayValue;
    if (checkboxGroup) checkboxGroup.style.display = displayValue;
    if (statesSystemSection) statesSystemSection.style.display = displayValue;
    if (baseClassRow) baseClassRow.style.display = displayValue;
    // @ts-ignore
    if (hardwareSection) hardwareSection.style.display = displayValue;

    // Show/hide YAMS wizard
    // @ts-ignore
    const yamsWizard = document.getElementById('yams-wizard');
    if (yamsWizard) {
        yamsWizard.style.display = isYamsMode ? 'block' : 'none';
        if (isYamsMode) {
            // Reset wizard to step 1 when showing
            goToWizardStep(1);
        }
    }
}

// ==========================================
// YAMS WIZARD NAVIGATION
// ==========================================

let currentWizardStep = 1;
const totalWizardSteps = 5;

window.nextWizardStep = () => {
    if (currentWizardStep < totalWizardSteps) {
        goToWizardStep(currentWizardStep + 1);
    }
};

window.prevWizardStep = () => {
    if (currentWizardStep > 1) {
        goToWizardStep(currentWizardStep - 1);
    }
};

function goToWizardStep(stepNum) {
    currentWizardStep = stepNum;

    // Update pages
    // @ts-ignore
    const pages = document.querySelectorAll('.wizard-page');
    pages.forEach(page => {
        page.classList.remove('active');
        if (page.getAttribute('data-page') === String(stepNum)) {
            page.classList.add('active');
        }
    });

    // Update step indicators
    // @ts-ignore
    const steps = document.querySelectorAll('.wizard-step');
    steps.forEach(step => {
        const sNum = parseInt(step.getAttribute('data-step'));
        step.classList.remove('active', 'completed');
        if (sNum === stepNum) {
            step.classList.add('active');
        } else if (sNum < stepNum) {
            step.classList.add('completed');
        }
    });

    // Update connectors
    // @ts-ignore
    const connectors = document.querySelectorAll('.wizard-step-connector');
    connectors.forEach((conn, index) => {
        if (index < stepNum - 1) {
            conn.classList.add('completed');
        } else {
            conn.classList.remove('completed');
        }
    });

    // Update navigation buttons
    // @ts-ignore
    const prevBtn = document.querySelector('.wizard-btn-prev');
    // @ts-ignore
    const nextBtn = document.querySelector('.wizard-btn-next');
    // @ts-ignore
    const stepIndicator = document.getElementById('currentStepNum');

    if (prevBtn) prevBtn.disabled = (stepNum === 1);

    if (nextBtn) {
        if (stepNum === totalWizardSteps) {
            nextBtn.innerHTML = '✓ Generate';
            nextBtn.classList.add('finish');
        } else {
            nextBtn.innerHTML = 'Next →';
            nextBtn.classList.remove('finish');
        }
    }

    if (stepIndicator) stepIndicator.textContent = String(stepNum);
}

// Allow clicking on step indicators to navigate
// @ts-ignore
document.addEventListener('DOMContentLoaded', () => {
    // @ts-ignore
    const steps = document.querySelectorAll('.wizard-step');
    steps.forEach(step => {
        step.addEventListener('click', () => {
            const stepNum = parseInt(step.getAttribute('data-step'));
            // Only allow clicking if step is completed or current
            if (stepNum <= currentWizardStep) {
                goToWizardStep(stepNum);
            }
        });
    });
});

window.scrollCarousel = (direction) => {
    // @ts-ignore
    const track = document.getElementById('cardTrack');
    // card width (300) + gap (25) = 325
    const scrollAmount = 325;
    track.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
};

function togglePIDFields() {
    // @ts-ignore
    const type = document.getElementById('subsystemType').value;
    // @ts-ignore
    const pidSection = document.getElementById('pid-section');
    if (type === 'pid' || type === 'profiled_pid') {
        pidSection.style.display = 'block';
    } else {
        pidSection.style.display = 'none';
    }

    // Show/Hide Profiled fields
    // @ts-ignore
    const profiledFields = document.querySelectorAll('.profiled-only');
    profiledFields.forEach(el => el.style.display = (type === 'profiled_pid') ? 'block' : 'none');
}

// Initialize toggle
togglePIDFields();
toggleFormSections(); // Initialize form section visibility
// Force update sidebar on load
updateSidebarVisibility();

// --- State Management ---
window.addState = () => {
    // @ts-ignore
    const input = document.getElementById('newStateInput');
    const val = input.value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (val && !states.includes(val)) {
        states.push(val);
        renderStates();
        input.value = '';
    }
};

window.removeState = (val) => {
    const idx = states.indexOf(val);
    if (idx !== -1) {
        states.splice(idx, 1);
        renderStates();
    }
};

function renderStates() {
    // @ts-ignore
    const container = document.getElementById('statesList');
    container.innerHTML = states.map(s => `
                < div style = "background:var(--button-bg); color:var(--button-fg); padding:4px 8px; border-radius:12px; font-size:0.85em; display:flex; align-items:center; gap:6px;" >
                    ${s}
            <span onclick="removeState('${s}')" style="cursor:pointer; font-weight:bold;">×</span>
        </div >
                `).join('');
}

// Toggle States Section
// @ts-ignore
document.getElementById('enableStates').addEventListener('change', (e) => {
    // @ts-ignore
    document.getElementById('statesSection').style.display = e.target.checked ? 'block' : 'none';
});

// Toggle kG based on Strategy
// @ts-ignore
document.getElementById('pidStrategy').addEventListener('change', (e) => {
    const strategy = e.target.value;
    // @ts-ignore
    const kGRow = document.getElementById('kGRow');
    if (strategy === 'elevator' || strategy === 'arm') {
        kGRow.style.display = 'flex';
    } else {
        kGRow.style.display = 'none';
    }
});

// @ts-ignore
document.getElementById('generateBtn').addEventListener('click', () => {
    // @ts-ignore
    const name = document.getElementById('subsystemName').value.trim();
    if (!name) return;

    // Collect Hardware
    const hardwareList = [];
    // @ts-ignore
    const rows = document.querySelectorAll('#deviceTable tr');
    rows.forEach((row, index) => {
        const nameInput = row.querySelector('.device-name');
        const idInput = row.querySelector('.device-id');
        const busInput = row.querySelector('.device-bus');

        // Helper Methods handling
        const helperMethods = [];
        const checkboxes = row.querySelectorAll('.helper-method-checkbox');
        checkboxes.forEach(cb => {
            if (cb.checked) helperMethods.push(cb.value);
        });

        if (nameInput && nameInput.value) {
            hardwareList.push({
                type: devices[index].type,
                name: nameInput.value,
                id: idInput ? idInput.value : '',
                bus: busInput ? busInput.value : 'rio',
                helperMethods: helperMethods,
                controller: devices[index].controller,
                yamsConfig: devices[index].yamsConfig // Include YAMS Config if present
            });
        }
    });

    // @ts-ignore
    const type = document.getElementById('subsystemType').value;
    const data = {
        subsystemName: name,
        subsystemType: (type === 'pid' || type === 'profiled_pid') ? 'pid' : (type === 'yams' ? 'yams' : 'generic'),
        // @ts-ignore
        autoAppend: document.getElementById('autoAppend').checked,
        // @ts-ignore
        singleton: document.getElementById('createSingleton').checked,
        // @ts-ignore
        baseClass: document.getElementById('baseClass').value,
        hardware: hardwareList,
        // @ts-ignore
        states: document.getElementById('enableStates').checked ? states : [],
        // @ts-ignore
        saveConstants: document.getElementById('saveToConstants').checked
    };

    // Add PID config if it's a PID subsystem
    if (type !== 'generic') {
        data.pidConfig = {
            // @ts-ignore
            kP: document.getElementById('pidP').value,
            // @ts-ignore
            kI: document.getElementById('pidI').value,
            // @ts-ignore
            kD: document.getElementById('pidD').value,
            // @ts-ignore
            kS: document.getElementById('pidS').value,
            // @ts-ignore
            kV: document.getElementById('pidV').value,
            // @ts-ignore
            kA: document.getElementById('pidA').value,
            // @ts-ignore
            kG: document.getElementById('pidG').value,
            // @ts-ignore
            strategy: document.getElementById('pidStrategy').value,
            // @ts-ignore
            maxVelocity: document.getElementById('pidMaxVel').value,
            // @ts-ignore
            maxAcceleration: document.getElementById('pidMaxAccel').value,
            // @ts-ignore
            minOutput: document.getElementById('minOutput').value,
            // @ts-ignore
            maxOutput: document.getElementById('maxOutput').value,
            // @ts-ignore
            useTuneable: document.getElementById('useTuneable').checked,
            isProfiled: type === 'profiled_pid'
        };
    }

    vscode.postMessage({ command: 'generate', data: data });
});

// @ts-ignore
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        // @ts-ignore
        document.getElementById('generateBtn').click();
    }
});

// @ts-ignore
document.getElementById('generatorsBtn').addEventListener('click', () => {
    vscode.postMessage({ command: 'openGenerators' });
});

// @ts-ignore
document.getElementById('refreshBtn').addEventListener('click', () => {
    vscode.postMessage({ command: 'refresh' });
    // Add a little animation or feedback
    // @ts-ignore
    const btn = document.getElementById('refreshBtn');
    btn.style.transform = 'rotate(360deg)';
    btn.style.transition = 'transform 0.5s';
    setTimeout(() => {
        btn.style.transform = 'none';
        btn.style.transition = 'none';
    }, 500);
});

renderDeviceTypes();
renderDevices();

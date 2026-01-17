// @ts-nocheck
/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
// @ts-nocheck
const vscode = acquireVsCodeApi();

const devices = [];
const states = [];
const collapsedCategories = new Set(); // Global state for persistence
let draggedDevice = null;
let installedVendors = [];

// Global function for inline onclick handlers in HTML
function selectMechCard(element, mechType) {
    console.log('selectMechCard called with:', mechType);

    // Stop event propagation to prevent any parent handlers
    if (event) {
        event.stopPropagation();
    }

    // Remove active from all cards
    document.querySelectorAll('.mech-card').forEach(card => {
        card.classList.remove('active');
    });

    // Add active to selected
    element.classList.add('active');

    // Update hidden input
    const input = document.getElementById('yamsMechType');
    if (input) {
        input.value = mechType;
        console.log('Updated yamsMechType to:', mechType);
    } else {
        console.error('yamsMechType input not found!');
    }

    // Auto-fill subsystem name if empty
    const nameInput = document.getElementById('yamsSubsystemName');
    if (nameInput && !nameInput.value.trim()) {
        const randomSuffix = Math.floor(10000 + Math.random() * 90000); // 5 digits
        nameInput.value = `${mechType} - ${randomSuffix}`;
    }

    console.log('Selected mechanism:', mechType);
}

// ==========================================
// YAMS MOTOR DRAG-DROP HANDLERS
// ==========================================

function handleYamsDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    e.currentTarget.classList.add('drag-over');
}

function handleYamsDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
}

function handleYamsControllerDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const deviceData = e.dataTransfer.getData('application/json');
    if (!deviceData) {
        showDropError(e.currentTarget, 'No device data found');
        return;
    }

    const device = JSON.parse(deviceData);
    console.log('Controller drop:', device);

    // Validate: only accept Motor Controllers
    if (device.category !== 'Motor Controllers') {
        showDropError(e.currentTarget, 'Only Motor Controllers can be dropped here');
        return;
    }

    // Update hidden input
    const input = document.getElementById('yamsController');
    if (input) {
        input.value = device.name;
    }

    // Update drop zone to show selected item
    updateDropZoneContent(e.currentTarget, device, 'yamsControllerDropZone');
}

function handleYamsMotorDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');

    const deviceData = e.dataTransfer.getData('application/json');
    if (!deviceData) {
        showDropError(e.currentTarget, 'No device data found');
        return;
    }

    const device = JSON.parse(deviceData);
    console.log('Motor drop:', device);

    // Validate: only accept Motors
    if (device.category !== 'Motors') {
        showDropError(e.currentTarget, 'Only Motors can be dropped here');
        return;
    }

    // Update hidden input
    const input = document.getElementById('yamsMotorType');
    if (input) {
        input.value = device.name;
    }

    // Update drop zone to show selected item
    updateDropZoneContent(e.currentTarget, device, 'yamsMotorDropZone');
}

function showDropError(dropZone, message) {
    dropZone.classList.add('error');
    console.warn(message);
    setTimeout(() => {
        dropZone.classList.remove('error');
    }, 500);
}

function updateDropZoneContent(dropZone, device, zoneId) {
    dropZone.classList.add('filled');
    dropZone.innerHTML = `
        <div class="dropped-item">
            <img class="dropped-item-icon" src="${device.icon || 'media/default.png'}" alt="${device.name}">
            <div class="dropped-item-info">
                <div class="dropped-item-name">${device.name}</div>
                <div class="dropped-item-category">${device.category}</div>
            </div>
            <button class="dropped-item-remove" onclick="clearYamsDropZone('${zoneId}', '${device.category === 'Motors' ? 'yamsMotorType' : 'yamsController'}')">✕</button>
        </div>
    `;
}

function clearYamsDropZone(zoneId, inputId) {
    const dropZone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);

    if (dropZone) {
        dropZone.classList.remove('filled');
        const isMotor = zoneId === 'yamsMotorDropZone';
        dropZone.innerHTML = `
            <div class="drop-zone-content">
                <span class="drop-zone-icon">${isMotor ? '⚙️' : '⚡'}</span>
                <span class="drop-zone-text">Drag a ${isMotor ? 'Motor' : 'Motor Controller'} here</span>
            </div>
        `;
    }

    if (input) {
        input.value = '';
    }
}

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
                    // Set JSON data for YAMS drop zones
                    e.dataTransfer.setData('application/json', JSON.stringify({
                        name: dt.name,
                        category: dt.category,
                        icon: dt.image || 'media/default.png'
                    }));
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
                const dropId = `config-zone-${index}`;
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
    console.log('nextWizardStep called. currentWizardStep:', currentWizardStep);

    // Validate step 1: require mechanism selection
    if (currentWizardStep === 1) {
        const mechType = document.getElementById('yamsMechType')?.value;
        console.log('Step 1 validation - mechType:', mechType);
        if (!mechType) {
            alert('Please select a mechanism type before proceeding.');
            return;
        }
    }

    if (currentWizardStep < totalWizardSteps) {
        console.log('Calling goToWizardStep with:', currentWizardStep + 1);
        goToWizardStep(currentWizardStep + 1);
    } else if (currentWizardStep === totalWizardSteps) {
        // On last step, clicking "Generate" should trigger generation
        triggerYamsGenerate();
    }
};

window.prevWizardStep = () => {
    if (currentWizardStep > 1) {
        goToWizardStep(currentWizardStep - 1);
    }
};

// YAMS Generate Function - Maps to Handlebars templates
function triggerYamsGenerate() {
    console.log("Triggering YAMS Generate...");

    const name = document.getElementById('yamsSubsystemName').value.trim();
    if (!name) {
        alert("Please enter a Subsystem Name.");
        goToWizardStep(1);
        return;
    }

    // Helper functions for safe value extraction
    const getNum = (id, def = 0) => {
        const el = document.getElementById(id);
        return el && el.value ? parseFloat(el.value) : def;
    };
    const getString = (id, def = '') => {
        const el = document.getElementById(id);
        return el ? (el.value || def) : def;
    };
    const getBool = (id) => {
        const el = document.getElementById(id);
        if (!el) return false;
        if (el.type === 'checkbox') return el.checked;
        return el.value === 'true';
    };

    const mechType = getString('yamsMechType', 'Arm');
    if (!mechType) {
        alert("Please select a Mechanism Type.");
        goToWizardStep(1);
        return;
    }

    const useSameSim = getBool('yamsUseSameSimGains');

    // Build config matching Handlebars template expectations
    const yamsConfig = {
        // Mechanism type (determines which template to use)
        mechType: mechType,

        // Motor Controller
        motorControllerType: getString('yamsController', 'TalonFX'),
        motorModel: getString('yamsMotorType', 'KrakenX60'),
        canId: parseInt(getString('yamsMotorId', '1')),
        inverted: getBool('yamsMotorInverted'),
        inverted: getBool('yamsMotorInverted'),
        idleMode: getString('yamsIdleMode', 'BRAKE'),

        // Follower Config
        hasFollower: getBool('yamsHasFollower'),
        followerId: parseInt(getString('yamsFollowerId', '0')),
        followerInverted: getBool('yamsFollowerInverted'),

        // Gearing & Limits
        gearingStages: getString('yamsGearing', '1'),
        currentLimit: getNum('yamsCurrentLimit', 40),
        rampRate: getNum('yamsRampRate', 0.1),

        // PID
        pid: {
            kP: getNum('yamsKp', 0.6),
            kI: getNum('yamsKi', 0),
            kD: getNum('yamsKd', 0.02)
        },
        simPid: {
            kP: useSameSim ? getNum('yamsKp', 0.6) : getNum('yamsSimKp', 0.6),
            kI: useSameSim ? getNum('yamsKi', 0) : getNum('yamsSimKi', 0),
            kD: useSameSim ? getNum('yamsKd', 0.02) : getNum('yamsSimKd', 0.02)
        },

        // Feedforward
        ff: {
            kS: getNum('yamsKs', 0.2),
            kG: getNum('yamsKg', 0.4),
            kV: getNum('yamsKv', 1.1),
            kA: getNum('yamsKa', 0)
        },
        simFf: {
            kS: getNum('yamsKs', 0.2),
            kG: getNum('yamsKg', 0.4),
            kV: getNum('yamsKv', 1.1),
            kA: getNum('yamsKa', 0)
        },

        // Arm-specific
        armLength: getNum('yamsArmLength', 0.6),
        minSoftLimit: getNum('yamsMinSoftLimit', -45),
        maxSoftLimit: getNum('yamsMaxSoftLimit', 90),
        minHardLimit: getNum('yamsMinHardLimit', -60),
        maxHardLimit: getNum('yamsMaxHardLimit', 100),
        startingAngle: getNum('yamsStartingAngle', 0),
        armMass: getNum('yamsArmMass', 8),

        // Pivot-specific (similar to arm)
        pivotLength: getNum('yamsPivotLength', 0.3),
        pivotMinAngle: getNum('yamsPivotMinAngle', -90),
        pivotMaxAngle: getNum('yamsPivotMaxAngle', 90),
        pivotStartAngle: getNum('yamsPivotStartAngle', 0),
        pivotMass: getNum('yamsPivotMass', 4),

        // Elevator-specific
        mechanismCircumference: getNum('yamsMechCircumference', 0.1),
        minHeight: getNum('yamsMinHeight', 0),
        maxHeight: getNum('yamsMaxHeight', 1.5),
        startingHeight: getNum('yamsStartingHeight', 0),
        elevatorMass: getNum('yamsElevatorMass', 10),

        // Shooter/Flywheel-specific
        flywheelDiameter: getNum('yamsFlywheelDiameter', 4),
        flywheelMass: getNum('yamsFlywheelMass', 2),
        maxVelocity: getNum('yamsMaxVelocity', 6000),

        // Swerve-specific
        gyroType: getString('yamsGyroType', 'Pigeon2'),
        gyroCanId: getNum('yamsGyroCanId', 0),
        maxLinearSpeed: getNum('yamsMaxLinearSpeed', 4.5),
        maxAngularSpeed: getNum('yamsMaxAngularSpeed', 12),
        wheelDiameter: getNum('yamsWheelDiameter', 0.1016)
    };

    const data = {
        subsystemName: name,
        subsystemType: 'yams',
        autoAppend: document.getElementById('autoAppend').checked,
        singleton: document.getElementById('createSingleton').checked,
        baseClass: document.getElementById('baseClass').value,
        saveConstants: document.getElementById('saveToConstants').checked,
        // @ts-ignore
        states: document.getElementById('enableStates').checked ? states : [],
        yamsConfig: yamsConfig
    };

    console.log("Sending YAMS Generate message:", data);
    console.log("Mechanism Type:", yamsConfig.mechType);
    console.log("Motor:", yamsConfig.motorControllerType, yamsConfig.motorModel, "CAN ID:", yamsConfig.canId);
    vscode.postMessage({ command: 'generate', data: data });
}

function goToWizardStep(stepNum) {
    console.log(`goToWizardStep called with stepNum: ${stepNum}, currentWizardStep was: ${currentWizardStep}`);
    currentWizardStep = stepNum;

    // Update pages
    // @ts-ignore
    const pages = document.querySelectorAll('.wizard-page');
    console.log(`Found ${pages.length} wizard pages`);
    pages.forEach(page => {
        page.classList.remove('active');
        const pageNum = page.getAttribute('data-page');
        console.log(`Page ${pageNum}: checking if equals ${stepNum}`);
        if (pageNum === String(stepNum)) {
            page.classList.add('active');
            console.log(`Activated page ${pageNum}`);
        }
    });

    // Update Visibility for Mechanism Config on Step 3
    if (stepNum === 3) {
        updateMechConfigVisibility();
    }

    // Update Review page on Step 5
    if (stepNum === 5) {
        updateReviewPage();
    }

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
            // Hide footer button on last step, prefer the main "Generate" button in the form
            nextBtn.style.display = 'none';
        } else {
            nextBtn.style.display = 'block';
            nextBtn.innerHTML = 'Next →';
            nextBtn.classList.remove('finish');
        }
    }

    // Review page is now handled by updateReviewPage()

    if (stepIndicator) stepIndicator.textContent = String(stepNum);
}

// Allow clicking on step indicators to navigate
// @ts-ignore
// event delegation for wizard navigation
// @ts-ignore
document.addEventListener('click', (e) => {
    // @ts-ignore
    const target = e.target;

    // Safety check for text nodes and non-elements
    // @ts-ignore
    if (!target || typeof target.closest !== 'function') return;

    // NOTE: Next and Prev buttons are handled by inline onclick in HTML
    // Do NOT add handlers here to avoid double-triggering

    // Step Indicators (allow clicking on completed steps)
    const step = target.closest('.wizard-step');
    if (step) {
        const stepNum = parseInt(step.getAttribute('data-step') || '1');
        // Only allow clicking if step is completed or current
        if (stepNum <= currentWizardStep) {
            goToWizardStep(stepNum);
        }
    }
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

// Follower Toggle Listener
document.getElementById('yamsHasFollower').addEventListener('change', (e) => {
    const hasFollower = e.target.value === 'true';
    const section = document.getElementById('followerConfig');

    if (hasFollower) {
        section.style.display = 'block';
    } else {
        section.style.display = 'none';
    }
});

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
window.resetMotorDrop = (e) => {
    e.stopPropagation();
    const zone = document.getElementById('motorDropZone');
    if (zone) {
        zone.querySelector('.dropped-content').style.display = 'none';
        zone.querySelector('.placeholder-content').style.display = 'block';
    }
    const select = document.getElementById('yamsMotorType');
    if (select && select.options.length > 0) select.selectedIndex = 0;
    // Clear ID too?
    const idInput = document.getElementById('yamsMotorId');
    if (idInput) idInput.value = '';

    if (typeof window.applyCurrentDefaults === 'function') {
        window.applyCurrentDefaults();
    }
}

window.resetControllerDrop = (e) => {
    e.stopPropagation();
    const zone = document.getElementById('controllerDropZone');
    if (zone) {
        zone.querySelector('.dropped-content').style.display = 'none';
        zone.querySelector('.placeholder-content').style.display = 'block';
    }
    const select = document.getElementById('yamsController');
    if (select && select.options.length > 0) select.selectedIndex = 0;
}

document.getElementById('generateBtn').addEventListener('click', () => {
    console.log("Generate button clicked");
    // Determine name based on mode
    const type = document.getElementById('subsystemType').value;

    if (type === 'yams') {
        triggerYamsGenerate();
        return;
    }

    let name = '';

    if (type === 'yams') {
        name = document.getElementById('yamsSubsystemName').value.trim();
    } else {
        name = document.getElementById('subsystemName').value.trim();
    }

    if (!name) {
        // Show error to user
        alert("Please enter a Subsystem Name before generating.");
        console.log("Validation failed: No subsystem name. Type was:", type);
        return;
    }

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

    // type is already declared above
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
        // @ts-ignore
        states: document.getElementById('enableStates').checked ? states : [],
        // @ts-ignore
        saveConstants: document.getElementById('saveToConstants').checked
    };



    console.log("Posting generate message:", data);
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

// --- YAMS Wizard Helper Functions ---

window.updateCurrentDefaults = () => {
    // @ts-ignore
    const type = document.getElementById('yamsMotorType').value;
    // @ts-ignore
    const supply = document.getElementById('yamsSupplyLimit');
    // @ts-ignore
    const stator = document.getElementById('yamsStatorLimit');

    if (type === 'NEO550') {
        supply.value = '25';
        stator.value = '40';
    } else if (type === 'NEO') {
        supply.value = '40';
        stator.value = '80';
    } else if (type === 'Kraken X60') {
        supply.value = '60';
        stator.value = '100';
    } else if (type === 'CIM') {
        supply.value = '30';
        stator.value = '60';
    } else {
        // Defaults for Talon FX/Vortex
        supply.value = '40';
        stator.value = '80';
    }
};

window.updateSensorFields = () => {
    // @ts-ignore
    const type = document.getElementById('yamsSensorType').value;
    // @ts-ignore
    const absOptions = document.getElementById('absoluteOptions');
    // @ts-ignore
    const startPos = document.getElementById('startPosField');

    if (type === 'Internal') {
        absOptions.style.display = 'none';
        startPos.style.display = 'block';
    } else {
        absOptions.style.display = 'block';
        // Check zero offset state to decide on start pos
        window.toggleStartPos();
    }
};

window.toggleStartPos = () => {
    // @ts-ignore
    const hasOffset = document.getElementById('yamsHasZeroOffset').checked;
    // @ts-ignore
    const startPos = document.getElementById('startPosField');
    // @ts-ignore
    const offsetField = document.getElementById('offsetField');

    if (hasOffset) {
        startPos.style.display = 'none';
        offsetField.style.display = 'block';
    } else {
        startPos.style.display = 'block';
        offsetField.style.display = 'none';
    }
};

window.updateProfileFields = () => {
    // @ts-ignore
    const loop = document.getElementById('yamsControlLoop').value;
    // @ts-ignore
    const pidSection = document.getElementById('pidSection');

    if (loop === 'OpenLoop') {
        pidSection.style.display = 'none';
    } else {
        pidSection.style.display = 'block';
    }
};

/* ==========================================
   DRAG AND DROP FOR PAGE 2
   ========================================== */

const motorDropZone = document.getElementById('motorDropZone');
const controllerDropZone = document.getElementById('controllerDropZone');

if (motorDropZone) {
    motorDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        motorDropZone.classList.add('drag-over');
    });
    motorDropZone.addEventListener('dragleave', () => {
        motorDropZone.classList.remove('drag-over');
    });
    motorDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        motorDropZone.classList.remove('drag-over');
        const deviceName = e.dataTransfer.getData('text/plain');
        handleMotorDrop(deviceName);
    });
}

if (controllerDropZone) {
    controllerDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        controllerDropZone.classList.add('drag-over');
    });
    controllerDropZone.addEventListener('dragleave', () => {
        controllerDropZone.classList.remove('drag-over');
    });
    controllerDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        controllerDropZone.classList.remove('drag-over');
        const deviceName = e.dataTransfer.getData('text/plain');
        handleControllerDrop(deviceName);
    });
}

function handleMotorDrop(deviceName) {
    const select = document.getElementById('yamsMotorType');
    if (!select) return;

    let valueToSelect = null;
    if (deviceName.includes('Kraken')) valueToSelect = 'Kraken X60';
    else if (deviceName.includes('Talon FX')) valueToSelect = 'Talon FX';
    else if (deviceName.includes('Vortex')) valueToSelect = 'Vortex';
    else if (deviceName === 'NEO') valueToSelect = 'NEO';
    else if (deviceName.includes('NEO 550')) valueToSelect = 'NEO550';
    else if (deviceName === 'CIM') valueToSelect = 'CIM';
    else if (deviceName === 'Mini CIM') valueToSelect = 'MiniCIM';
    else if (deviceName.includes('Bag')) valueToSelect = 'Bag';
    else if (deviceName === '775pro') valueToSelect = '775pro';

    if (valueToSelect) {
        select.value = valueToSelect;

        // Prompt for CAN ID
        setTimeout(() => {
            const id = window.prompt(`Enter CAN ID for ${deviceName}:`, "1");
            if (id) {
                const idInput = document.getElementById('yamsMotorId');
                if (idInput) idInput.value = id;
                updateDropZoneUI('motorDropZone', `${deviceName} (ID: ${id})`);
            } else {
                updateDropZoneUI('motorDropZone', deviceName);
            }
        }, 100);

        if (typeof window.applyCurrentDefaults === 'function') {
            window.applyCurrentDefaults();
        }
    }
}

function handleControllerDrop(deviceName) {
    const select = document.getElementById('yamsController');
    if (!select) return;

    let valueToSelect = null;
    if (deviceName.includes('TalonFX')) valueToSelect = 'TalonFX';
    else if (deviceName.includes('Spark Max')) valueToSelect = 'SparkMax';
    else if (deviceName.includes('Spark Flex')) valueToSelect = 'SparkFlex';
    else if (deviceName.includes('Talon SRX')) valueToSelect = 'TalonSRX';
    else if (deviceName.includes('Victor SPX')) valueToSelect = 'VictorSPX';

    if (valueToSelect) {
        select.value = valueToSelect;
        updateDropZoneUI('controllerDropZone', deviceName);
    }
}

function updateDropZoneUI(zoneId, name) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;

    const placeholder = zone.querySelector('.placeholder-content');
    const dropped = zone.querySelector('.dropped-content');
    const nameSpan = zone.querySelector('.dropped-name');
    const img = zone.querySelector('.dropped-icon');

    if (placeholder && dropped && nameSpan) {
        placeholder.style.display = 'none';
        dropped.style.display = 'flex';
        nameSpan.textContent = name;
        if (img) img.style.display = 'none';
    }
}

window.resetMotorDrop = (e) => {
    e.stopPropagation();
    resetDropZone('motorDropZone');
    const select = document.getElementById('yamsMotorType');
    if (select) select.selectedIndex = 0;
};

window.resetControllerDrop = (e) => {
    e.stopPropagation();
    resetDropZone('controllerDropZone');
    const select = document.getElementById('yamsController');
    if (select) select.selectedIndex = 0;
};

function resetDropZone(zoneId) {
    const zone = document.getElementById(zoneId);
    if (!zone) return;
    const placeholder = zone.querySelector('.placeholder-content');
    const dropped = zone.querySelector('.dropped-content');
    if (placeholder && dropped) {
        placeholder.style.display = 'block';
        dropped.style.display = 'none';
    }
}

// Update Mechanism Visibility
window.updateMechVisibility = () => {
    // @ts-ignore
    const mechType = document.getElementById('yamsMechType') ? document.getElementById('yamsMechType').value : 'Simple';
    const armConfig = document.getElementById('armConfig');
    const elevatorConfig = document.getElementById('elevatorConfig');
    const flywheelConfig = document.getElementById('flywheelConfig');
    const genericConfig = document.getElementById('genericConfig');

    // Reset all
    if (armConfig) armConfig.style.display = 'none';
    if (elevatorConfig) elevatorConfig.style.display = 'none';
    if (flywheelConfig) flywheelConfig.style.display = 'none';
    if (genericConfig) genericConfig.style.display = 'none';

    if (mechType === 'Arm') {
        if (armConfig) armConfig.style.display = 'block';
    } else if (mechType === 'Elevator') {
        if (elevatorConfig) elevatorConfig.style.display = 'block';
    } else if (mechType === 'Flywheel') {
        if (flywheelConfig) flywheelConfig.style.display = 'block';
    } else {
        if (genericConfig) genericConfig.style.display = 'block';
    }
};

// ==========================================
// NEW FUNCTIONS FOR 5-STEP WIZARD
// ==========================================

// Mechanism Card Selection
window.selectMechCard = (element, mechType) => {
    // Remove active from all cards
    document.querySelectorAll('.mech-card').forEach(card => {
        card.classList.remove('active');
    });

    // Add active to selected
    element.classList.add('active');
    console.log("Hello World");

    // Update hidden input
    const input = document.getElementById('yamsMechType');
    if (input) {
        input.value = mechType;
        console.log('Updated yamsMechType to:', mechType);
    } else {
        console.error('yamsMechType input not found!');
    }

    // Auto-fill subsystem name if empty
    const nameInput = document.getElementById('yamsSubsystemName');
    if (nameInput && !nameInput.value.trim()) {
        nameInput.value = mechType;
    }

    console.log('Selected mechanism:', mechType);

    // Update config visibility immediately (in case we are revisiting the step)
    if (typeof window.updateMechConfigVisibility === 'function') {
        window.updateMechConfigVisibility();
    }
};

// Initiate Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    console.log("Subsystem Wizard: DOMContentLoaded - Attaching Listeners");

    // Mechanism Card Selection
    const mechCards = document.querySelectorAll('.mech-card');
    if (mechCards.length === 0) {
        console.warn("Subsystem Wizard: No mechanism cards found!");
    }

    mechCards.forEach(card => {
        card.onclick = (e) => {
            // Use onclick to avoid multiple listener accumulation if script re-runs
            const mechType = card.getAttribute('data-type');
            if (mechType) {
                window.selectMechCard(card, mechType);
            }
        };
    });

    // Toggle sim gains visibility
    const checkbox = document.getElementById('yamsUseSameSimGains');
    const simSection = document.getElementById('simGainsSection');

    if (checkbox && simSection) {
        checkbox.addEventListener('change', () => {
            simSection.style.display = checkbox.checked ? 'none' : 'block';
        });
    }

    console.log("Subsystem Wizard: Event Listeners Attached");
});

// Since the script might load after DOMContentLoaded, also run immediately if ready
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    // Manually trigger the listener attachment logic if DOM is already ready
    // We can't re-dispatch DOMContentLoaded, so we inline the logic or extract a function.
    // Let's rely on the user interface refreshing or the script running once.
    // But for safety, let's just run the selectors now too.
    const mechCards = document.querySelectorAll('.mech-card');
    mechCards.forEach(card => {
        card.onclick = (e) => {
            const mechType = card.getAttribute('data-type');
            if (mechType) {
                window.selectMechCard(card, mechType);
            }
        };
    });
}

// Update mechanism config section visibility on Step 3
function updateMechConfigVisibility() {
    const mechType = document.getElementById('yamsMechType')?.value || 'Arm';

    // Hide all config sections
    const sections = ['armConfigSection', 'pivotConfigSection', 'elevatorConfigSection', 'shooterConfigSection', 'swerveConfigSection'];
    sections.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Show the appropriate section
    const mechIcons = { Arm: '🦾', Pivot: '🔄', Elevator: '📐', Shooter: '🎯', SwerveDrive: '🚗' };
    const mechTitles = {
        Arm: 'Arm Configuration',
        Pivot: 'Pivot Configuration',
        Elevator: 'Elevator Configuration',
        Shooter: 'Shooter/Flywheel Configuration',
        SwerveDrive: 'Swerve Drive Configuration'
    };
    const mechDescs = {
        Arm: 'Configure your arm mechanism parameters.',
        Pivot: 'Configure your pivot/wrist mechanism.',
        Elevator: 'Configure your elevator/lift mechanism.',
        Shooter: 'Configure your flywheel/shooter mechanism.',
        SwerveDrive: 'Configure your swerve drivetrain.'
    };

    // Update header
    const titleEl = document.getElementById('mechConfigTitle');
    const descEl = document.getElementById('mechConfigDesc');
    if (titleEl) titleEl.textContent = `${mechIcons[mechType] || '🔧'} ${mechTitles[mechType] || 'Configuration'}`;
    if (descEl) descEl.textContent = mechDescs[mechType] || 'Configure your mechanism.';

    // Map mechanism type to section ID
    const sectionMap = {
        Arm: 'armConfigSection',
        Pivot: 'pivotConfigSection',
        Elevator: 'elevatorConfigSection',
        Shooter: 'shooterConfigSection',
        Flywheel: 'shooterConfigSection',
        SwerveDrive: 'swerveConfigSection'
    };

    const sectionId = sectionMap[mechType];
    if (sectionId) {
        const section = document.getElementById(sectionId);
        if (section) section.style.display = 'block';
    }

    // Show/hide kG for velocity mechanisms (shooter doesn't use gravity feedforward)
    const kGRow = document.getElementById('kGRow');
    if (kGRow) {
        kGRow.style.display = (mechType === 'Shooter' || mechType === 'Flywheel') ? 'none' : 'block';
    }

    // Show/Hide Arm Diagram
    const armImage = document.getElementById('armConfigImage');
    if (armImage) {
        armImage.style.display = (mechType === 'Arm') ? 'block' : 'none';
    }
}

// Update review page on Step 5
function updateReviewPage() {
    const name = document.getElementById('yamsSubsystemName')?.value || 'Untitled';
    const mechType = document.getElementById('yamsMechType')?.value || 'Arm';
    const controller = document.getElementById('yamsController')?.value || 'TalonFX';
    const motor = document.getElementById('yamsMotorType')?.value || 'KrakenX60';
    const canId = document.getElementById('yamsMotorId')?.value || '1';
    const gearing = document.getElementById('yamsGearing')?.value || '1';
    const currentLimit = document.getElementById('yamsCurrentLimit')?.value || '40';
    const kP = document.getElementById('yamsKp')?.value || '0.6';
    const kI = document.getElementById('yamsKi')?.value || '0';
    const kD = document.getElementById('yamsKd')?.value || '0.02';

    const mechIcons = { Arm: '🦾', Pivot: '🔄', Elevator: '📐', Shooter: '🎯', SwerveDrive: '🚗' };

    // Update review elements
    const reviewNameEl = document.getElementById('reviewName');
    if (reviewNameEl) reviewNameEl.textContent = `${mechIcons[mechType] || ''} ${name}`;

    const reviewMechTypeEl = document.getElementById('reviewMechType');
    if (reviewMechTypeEl) reviewMechTypeEl.textContent = mechType;

    const reviewControllerEl = document.getElementById('reviewController');
    if (reviewControllerEl) reviewControllerEl.textContent = controller;

    const reviewMotorEl = document.getElementById('reviewMotor');
    if (reviewMotorEl) reviewMotorEl.textContent = motor;

    const reviewCanIdEl = document.getElementById('reviewCanId');
    if (reviewCanIdEl) reviewCanIdEl.textContent = canId;

    const reviewGearingEl = document.getElementById('reviewGearing');
    if (reviewGearingEl) reviewGearingEl.textContent = `${gearing}:1`;

    const reviewCurrentLimitEl = document.getElementById('reviewCurrentLimit');
    if (reviewCurrentLimitEl) reviewCurrentLimitEl.textContent = `${currentLimit}A`;

    const reviewPIDEl = document.getElementById('reviewPID');
    if (reviewPIDEl) reviewPIDEl.textContent = `kP=${kP}, kI=${kI}, kD=${kD}`;
}

// Update motor options based on controller selection
window.updateMotorDefaults = () => {
    const controller = document.getElementById('yamsController')?.value;
    const motorSelect = document.getElementById('yamsMotorType');

    if (!motorSelect) return;

    // Clear and repopulate based on controller
    if (controller === 'TalonFX' || controller === 'TalonFXS') {
        motorSelect.innerHTML = `
            <option value="KrakenX60">Kraken X60</option>
            <option value="Falcon500">Falcon 500</option>
        `;
    } else if (controller === 'SparkMax') {
        motorSelect.innerHTML = `
            <option value="NEO">NEO 1.1</option>
            <option value="NEO550">NEO 550</option>
        `;
    } else if (controller === 'SparkFlex') {
        motorSelect.innerHTML = `
            <option value="NeoVortex">NEO Vortex</option>
            <option value="NEO">NEO 1.1</option>
        `;
    } else if (controller === 'Nova') {
        motorSelect.innerHTML = `
            <option value="NEO">NEO</option>
            <option value="NeoVortex">NEO Vortex</option>
        `;
    } else {
        // Default all motors
        motorSelect.innerHTML = `
            <option value="KrakenX60">Kraken X60</option>
            <option value="Falcon500">Falcon 500</option>
            <option value="NEO">NEO 1.1</option>
            <option value="NeoVortex">NEO Vortex</option>
            <option value="NEO550">NEO 550</option>
        `;
    }
};

// Initialize Guardrails (if module loaded)
if (typeof window.initGuardrails === 'function') {
    window.initGuardrails();
}

// Note: Initialization is now handled by the DOMContentLoaded listener above.

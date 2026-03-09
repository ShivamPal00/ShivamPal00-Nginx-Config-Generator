// Common utility functions for Nginx Config Generator

/**
 * Copies text from an element to clipboard
 * @param {string} elementId - ID of the textarea or input element
 */
function copyText(elementId) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.select();
    document.execCommand("copy");
}

/**
 * Downloads text content as a file
 * @param {string} elementId - ID of the textarea containing the content
 * @param {string} filename - Name of the file to download
 */
function downloadFile(elementId, filename) {
    const element = document.getElementById(elementId);
    if (!element) return;

    const blob = new Blob([element.value], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

/**
 * Clears all form elements and data
 * @param {Array<string>} elementIds - Array of element IDs to clear
 */
function clearAll(elementIds = []) {
    // Clear file inputs
    const fileInputs = document.querySelectorAll('input[type="file"]');
    fileInputs.forEach(input => input.value = "");

    // Clear textareas
    const textareas = document.querySelectorAll('textarea');
    textareas.forEach(textarea => textarea.value = "");

    // Clear status messages
    const statusElements = document.querySelectorAll('#status');
    statusElements.forEach(status => status.innerText = "");

    // Clear manual inputs container
    const manualInputs = document.getElementById("manualInputs");
    if (manualInputs) manualInputs.innerHTML = "";

    // Clear data arrays
    if (typeof dataRows !== 'undefined') dataRows = [];
    if (typeof headers !== 'undefined') headers = [];

    // Clear storage
    localStorage.clear();
    sessionStorage.clear();
}

/**
 * Validates Nginx configuration syntax
 * @param {string} config - The nginx config text to validate
 * @returns {Array<string>} Array of error messages
 */
function validateNginxConfig(config) {
    const errors = [];
    const rules = {
        root: ["server", "http", "limit_req_zone", "upstream", "location"],
        http: ["server", "upstream", "limit_req_zone"],
        server: ["listen", "server_name", "ssl_certificate", "ssl_certificate_key", "access_log", "error_log", "location", "limit_req"],
        location: ["proxy_pass", "limit_req", "limit_except"],
        upstream: ["server"]
    };

    const stack = ["root"];
    const locations = [];
    const zones = [];
    const lines = config.split("\n");

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line || line.startsWith("#")) continue;

        // Block start
        if (line.endsWith("{")) {
            const parts = line.replace("{", "").trim().split(/\s+/);
            const directive = parts[0];
            const context = stack[stack.length - 1];

            if (rules[context] && !rules[context].includes(directive)) {
                errors.push(`Invalid directive '${directive}' inside ${context} (line ${i + 1})`);
            }

            stack.push(directive);

            if (directive === "location" && parts[1]) {
                locations.push(parts[1]);
            }
            continue;
        }

        // Block end
        if (line === "}") {
            if (stack.length === 1) {
                errors.push(`Unexpected } at line ${i + 1}`);
            } else {
                stack.pop();
            }
            continue;
        }

        // Semicolon check
        if (!line.endsWith(";")) {
            errors.push(`Missing ';' at line ${i + 1}`);
            continue;
        }

        const clean = line.replace(";", "");
        const parts = clean.split(/\s+/);
        const directive = parts[0];
        const context = stack[stack.length - 1];

        if (rules[context] && !rules[context].includes(directive)) {
            errors.push(`Directive '${directive}' not allowed in ${context} (line ${i + 1})`);
        }

        // proxy_pass validation
        if (directive === "proxy_pass") {
            const target = parts[1];
            if (!target || !target.startsWith("http://")) {
                errors.push(`Invalid proxy_pass at line ${i + 1}`);
            }
        }

        // limit_except validation
        if (directive === "limit_except") {
            const methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];
            if (!methods.includes(parts[1])) {
                errors.push(`Invalid HTTP method '${parts[1]}' at line ${i + 1})`);
            }
        }

        // limit_req_zone validation
        if (directive === "limit_req_zone") {
            const rateMatch = line.match(/rate=([^\s;]+)/);
            if (!rateMatch) {
                errors.push(`limit_req_zone missing rate at line ${i + 1}`);
            } else {
                const rateVal = rateMatch[1];
                if (!/^[0-9]+r\/[sm]$/.test(rateVal)) {
                    errors.push(`Invalid rate format '${rateVal}' at line ${i + 1}`);
                }
            }

            const zoneMatch = line.match(/zone=([^:]+)/);
            if (zoneMatch) {
                zones.push(zoneMatch[1]);
            }
        }
    }

    // Check unclosed blocks
    if (stack.length > 1) {
        errors.push(`Unclosed block '${stack[stack.length - 1]}'`);
    }

    // Duplicate location detection
    const dupLoc = locations.filter((v, i, a) => a.indexOf(v) !== i);
    if (dupLoc.length > 0) {
        errors.push("Duplicate location blocks: " + dupLoc.join(", "));
    }

    // Duplicate zone detection
    const dupZones = zones.filter((v, i, a) => a.indexOf(v) !== i);
    if (dupZones.length > 0) {
        errors.push("Duplicate rate zones: " + dupZones.join(", "));
    }

    return errors;
}

/**
 * Updates status element with validation results
 * @param {Array<string>} errors - Array of error messages
 * @param {string} successMessage - Message to show on success
 */
function updateValidationStatus(errors, successMessage = "✓ Validation passed") {
    const status = document.getElementById("status");
    if (!status) return;

    if (errors.length === 0) {
        status.className = "success";
        status.innerText = successMessage;
    } else {
        status.className = "error";
        status.innerText = "Validation errors:\n" + errors.join("\n");
    }
}
let dataRows = [];
let headers = [];

document.getElementById("fileUpload").addEventListener("change", handleFile);

function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        parseFile(evt.target.result);
        checkMissingFields();
    };
    reader.readAsText(file);
}

function detectSeparator(line) {
    if (line.includes(",")) return ",";
    if (line.includes(";")) return ";";
    if (line.includes("\t")) return "\t";
    return ",";
}

function parseFile(text) {
    const output = text.replace(/"/g, '');
    const rows = output.split(/\r?\n/).filter(r => r.trim() !== "");

    if (rows.length === 0) return;

    const sep = detectSeparator(rows[0]);
    headers = rows[0].split(sep).map(h => h.trim().toLowerCase());
    dataRows = [];

    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(sep);
        const obj = {};
        headers.forEach((h, index) => {
            obj[h] = (cols[index] || "").trim();
        });
        dataRows.push(obj);
    }
}

function getRequiredFields() {
    const rate = document.getElementById("rateRequired").value;
    if (rate === "yes") {
        return [
            "api_path",
            "method",
            "upstream",
            "rate_limit",
            "rate_key",
            "zone_name"
        ];
    } else {
        return [
            "api_path",
            "method",
            "upstream"
        ];
    }
}

function checkMissingFields() {
    const required = getRequiredFields();
    const container = document.getElementById("manualInputs");
    container.innerHTML = "";

    required.forEach(field => {
        const exists = dataRows.some(r => r[field] && r[field].trim() !== "");
        if (!exists) {
            const wrapper = document.createElement("div");
            const label = document.createElement("label");
            label.innerText = "Missing: " + field;

            const input = document.createElement("input");
            input.id = "manual_" + field;
            input.classList.add("missing");

            wrapper.appendChild(label);
            wrapper.appendChild(input);
            container.appendChild(wrapper);
        }
    });
}

function getValue(field, row) {
    // Priority 1: manual input
    const manual = document.getElementById("manual_" + field);
    if (manual && manual.value.trim() !== "") {
        return manual.value.trim();
    }

    // Priority 2: row value
    if (row[field] && row[field].trim() !== "") {
        return row[field];
    }

    // Priority 3: search other rows
    for (const r of dataRows) {
        if (r[field] && r[field].trim() !== "") {
            return r[field];
        }
    }

    return "";
}

function generateConfig() {
    const status = document.getElementById("status");
    status.innerText = "";

    if (dataRows.length === 0) {
        status.innerText = "Upload data first";
        return;
    }

    const required = getRequiredFields();
    let mainConf = "";
    let rateConf = "";
    const zones = new Set();

    for (const row of dataRows) {
        const api = getValue("api_path", row);
        const method = getValue("method", row);
        const upstream = getValue("upstream", row);

        if (!api || !method || !upstream) {
            status.innerText = "Missing required values";
            return;
        }

        mainConf += `\nlocation ${api} {\n`;

        if (required.includes("rate_limit")) {
            const zone = getValue("zone_name", row);
            const rate = getValue("rate_limit", row);
            const key = getValue("rate_key", row);

            if (!zone || !rate || !key) {
                status.innerText = "Missing rate limit fields";
                return;
            }

            mainConf += `    limit_req zone=${zone};\n`;
            zones.add(`${key}|${zone}|${rate}`);
        }

        mainConf += `
    limit_except ${method} {
        deny all;
    }

    proxy_pass http://${upstream};

}
`;
    }

    zones.forEach(z => {
        const p = z.split("|");
        rateConf += `limit_req_zone ${p[0]} zone=${p[1]}:10m rate=${p[2]};\n`;
    });

    document.getElementById("mainConf").value = mainConf;
    document.getElementById("rateConf").value = rateConf;
}

function goHome() {
    window.location.href = "index.html";
}

function validateNginxLocations() {
    const main = document.getElementById("mainConf")?.value || "";
    const rate = document.getElementById("rateConf")?.value || "";
    const config = (main + "\n" + rate).trim();
    const errors = validateNginxConfig(config);
    updateValidationStatus(errors, "✓ Location + rate limit validation passed");
}
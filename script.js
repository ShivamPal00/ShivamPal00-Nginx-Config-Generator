let dataRows = [];
let headers = [];

const requiredFields = [
    "domain",
    "port",
    "zone_name",
    "rate_key",
    "rate_limit",
    "upstream",
    "api_path",
    "method"
];

// Prevent error on pages without file upload
if (document.getElementById("fileUpload")) {
    document.getElementById("fileUpload").addEventListener("change", handleFile);
}

function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        parseCSV(evt.target.result);
        createManualInputs();
    };
    reader.readAsText(file);
}

function parseCSV(text) {
    const rows = text.split(/\r?\n/).filter(r => r.trim() !== "");
    if (rows.length === 0) return;

    headers = rows[0].split(/,|\t/).map(h => h.trim().toLowerCase());
    dataRows = [];

    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(/,|\t/);
        const obj = {};
        headers.forEach((h, index) => {
            obj[h] = (cols[index] || "").trim();
        });
        dataRows.push(obj);
    }
}

function createManualInputs() {
    const container = document.getElementById("manualInputs");
    if (!container) return;

    container.innerHTML = "";

    requiredFields.forEach(field => {
        const missing = !dataRows.some(r => r[field]);
        if (missing) {
            const wrapper = document.createElement("div");
            const label = document.createElement("label");
            label.innerText = field.toUpperCase();

            const input = document.createElement("input");
            input.classList.add("missing");
            input.id = "manual_" + field;
            input.placeholder = "Example: " + getExample(field);

            wrapper.appendChild(label);
            wrapper.appendChild(input);
            container.appendChild(wrapper);
        }
    });
}

function getExample(field) {
    const examples = {
        domain: "example.com",
        port: "443",
        zone_name: "api_zone",
        rate_key: "$uri",
        rate_limit: "400r/s",
        upstream: "backend_servers",
        api_path: "/api/v1/users",
        method: "GET"
    };
    return examples[field] || "";
}

function generateConfig() {
    const status = document.getElementById("status");
    if (!status) return;
    status.innerText = "";

    const configValues = {};

    // Collect manual inputs
    requiredFields.forEach(field => {
        const manual = document.getElementById("manual_" + field);
        if (manual && manual.value.trim() !== "") {
            configValues[field] = manual.value.trim();
        }
    });

    // Collect from data rows
    dataRows.forEach(row => {
        Object.keys(row).forEach(key => {
            if (row[key] && !configValues[key]) {
                configValues[key] = row[key];
            }
        });
    });

    // Check required fields
    for (const field of requiredFields) {
        if (!configValues[field]) {
            status.innerText = "Missing required field: " + field;
            return;
        }
    }

    const { domain, port, upstream, rate_limit: rate, zone_name: zone, rate_key: rateKey } = configValues;
    const sslCert = configValues.ssl_cert || "";
    const sslKey = configValues.ssl_key || "";
    const accessLog = configValues.access_log || "";
    const errorLog = configValues.error_log || "";

    let mainConf = `server {
    listen ${port} ssl;
    server_name ${domain};
    ssl_certificate ${sslCert};
    ssl_certificate_key ${sslKey};
    access_log ${accessLog};
    error_log ${errorLog};
    limit_req zone=${zone};
`;

    dataRows.forEach(r => {
        const api = r.api_path || configValues.api_path;
        const method = r.method || configValues.method;

        if (api && method) {
            mainConf += `
    location ${api} {
        limit_except ${method} {
            deny all;
        }
        proxy_pass http://${upstream};
    }`;
        }
    });

    mainConf += "\n}";

    const rateConf = `limit_req_zone ${rateKey} zone=${zone}:10m rate=${rate};`;

    document.getElementById("mainConf").value = mainConf;
    document.getElementById("rateConf").value = rateConf;

    saveState();
}

function copyText(id){

let text=document.getElementById(id)

if(!text) return

text.select()
document.execCommand("copy")

}

function downloadFile(id,name){

let text=document.getElementById(id)

if(!text) return

let blob=new Blob([text.value],{type:"text/plain"})
let link=document.createElement("a")

link.href=URL.createObjectURL(blob)
link.download=name
link.click()

}

function clearAll(){

if(document.getElementById("fileUpload"))
document.getElementById("fileUpload").value=""

if(document.getElementById("manualInputs"))
document.getElementById("manualInputs").innerHTML=""

if(document.getElementById("mainConf"))
document.getElementById("mainConf").value=""

if(document.getElementById("rateConf"))
document.getElementById("rateConf").value=""

if(document.getElementById("status"))
document.getElementById("status").innerText=""

dataRows=[]

localStorage.clear()
sessionStorage.clear()
}

function saveState() {
    const mainConf = document.getElementById("mainConf");
    const rateConf = document.getElementById("rateConf");

    if (mainConf) localStorage.setItem("mainConf", mainConf.value);
    if (rateConf) localStorage.setItem("rateConf", rateConf.value);
}

window.onload = function() {
    const mainConf = document.getElementById("mainConf");
    const rateConf = document.getElementById("rateConf");

    if (mainConf) {
        const main = localStorage.getItem("mainConf");
        if (main) mainConf.value = main;
    }

    if (rateConf) {
        const rate = localStorage.getItem("rateConf");
        if (rate) rateConf.value = rate;
    }
};

function validateNginx() {
    const main = document.getElementById("mainConf")?.value || "";
    const rate = document.getElementById("rateConf")?.value || "";
    const config = (main + "\n" + rate).trim();
    const errors = validateNginxConfig(config);
    updateValidationStatus(errors, "✓ Nginx validation passed");
}


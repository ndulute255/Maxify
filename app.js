// --- Global Simulator Configuration State ---
let streamInterval = null;
const logStream = document.getElementById('log-stream');

// --- Feature Extraction Engine ---
// Simulates extraction of parameters computed dynamically 
function processTransaction(type = "LEGIT") {
    const prefixes = ['066', '062', '076', '071'];
    const sender = prefixes[Math.floor(Math.random() * prefixes.length)] + Math.floor(1000000 + Math.random() * 9000000);
    
    let amount = Math.floor(Math.random() * 80000) + 2000; // Normal transactions (TZS 2,000 - 82,000)
    let velocity = Math.floor(Math.random() * 2) + 1;       // Transactions in past 1 min
    let newDevice = Math.random() > 0.9 ? 1 : 0;            // 10% chance new hardware

    if (type === "FRAUD") {
        amount = Math.floor(Math.random() * 400000) + 150000; // Large, abnormal drain spikes
        velocity = Math.floor(Math.random() * 5) + 4;         // Distinctly high velocity (4 to 8 transactions)
        newDevice = 1;                                        // Forces account takeover simulation
    }

    return { sender, amount, velocity, newDevice, actual: type };
}

// --- Model 1: Halotel Rule-Based Model Implementation ---
// Mimics classical rule books: hard ceilings, no contextual nuance.
function evaluateRuleModel(tx) {
    if (tx.amount > 200000) {
        return { action: "BLOCK", reason: "LIMIT_EXCEEDED" };
    }
    if (tx.velocity >= 4) {
        return { action: "BLOCK", reason: "VELOCITY_BURST" };
    }
    return { action: "CLEAR", reason: "No anomalies flagged" };
}

// --- Model 2: Ported Random Forest Engine ---
// Evaluates multiple weak mathematical splits derived from Python matrix evaluations.
function evaluateRandomForestModel(tx) {
    let treesPassed = 0;
    
    // Tree 1 logic path
    if (tx.amount > 120000 && tx.newDevice === 1) treesPassed += 1;
    // Tree 2 logic path 
    if (tx.velocity > 3) treesPassed += 1;
    // Tree 3 logic path
    if (tx.amount > 250000 || (tx.velocity > 2 && tx.newDevice === 1)) treesPassed += 1;

    const riskScore = treesPassed / 3; // Normalize output profile boundary (0.00 to 1.00)
    return {
        score: riskScore.toFixed(2),
        verdict: riskScore >= 0.66 ? "FRAUDULENT" : "LEGITIMATE"
    };
}

// --- UI Display Intermediary Pipelines ---
function handleIncomingTx(tx) {
    // 1. Update Inspector Panel Data
    document.getElementById('inspect-sender').innerText = tx.sender;
    document.getElementById('inspect-amount').innerText = `TZS ${tx.amount.toLocaleString()}`;
    document.getElementById('inspect-device').innerText = tx.newDevice === 1 ? "New IMEI" : "Trusted";
    document.getElementById('inspect-velocity').innerText = `${tx.velocity} tx/min`;

    // 2. Compute Rule Model Verdict
    const ruleResult = evaluateRuleModel(tx);
    const rVerdictEl = document.getElementById('rule-verdict');
    rVerdictEl.innerText = ruleResult.action;
    document.getElementById('rule-reason').innerText = ruleResult.reason;
    
    if(ruleResult.action === "BLOCK") {
        rVerdictEl.className = "status-danger";
    } else {
        rVerdictEl.className = "status-safe";
    }

    // 3. Compute Random Forest Decision Node Scoring
    const rfResult = evaluateRandomForestModel(tx);
    const rfScoreEl = document.getElementById('rf-score');
    const rfVerdictEl = document.getElementById('rf-verdict');
    
    rfScoreEl.innerText = rfResult.score;
    rfVerdictEl.innerText = rfResult.verdict;

    if(rfResult.verdict === "FRAUDULENT") {
        rfScoreEl.className = "status-danger";
        rfVerdictEl.className = "status-danger";
    } else {
        rfScoreEl.className = "status-safe";
        rfVerdictEl.className = "status-safe";
    }

    // 4. Update the Stream Logs
    const timestamp = new Date().toLocaleTimeString();
    const logRow = document.createElement('div');
    logRow.className = `log-row ${tx.actual === 'FRAUD' ? 'status-danger' : ''}`;
    logRow.innerHTML = `
        <span>${timestamp}</span>
        <span>${tx.sender}</span>
        <span>TZS ${tx.amount}</span>
        <strong>${tx.actual}</strong>
    `;
    logStream.insertBefore(logRow, logStream.firstChild);
}

// --- Event Orchestration Listeners ---
document.getElementById('btn-start').addEventListener('click', () => {
    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-stop').disabled = false;
    
    streamInterval = setInterval(() => {
        // 90% legit background noise, 10% unexpected random organic spikes
        const type = Math.random() > 0.90 ? "FRAUD" : "LEGIT";
        handleIncomingTx(processTransaction(type));
    }, 1500);
});

document.getElementById('btn-stop').addEventListener('click', () => {
    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-stop').disabled = true;
    clearInterval(streamInterval);
});

document.getElementById('btn-inject').addEventListener('click', () => {
    // Explicit manual execution bypass to test model sensitivity immediately
    handleIncomingTx(processTransaction("FRAUD"));
});

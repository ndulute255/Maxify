// --- Core Analytics Performance Matrix Tracker ---
let matrix = { tp: 0, fp: 0, fn: 0, tn: 0 };
let streamInterval = null;

// --- Specialized Attack Vector Generator ---
function extractNetworkPayload(forcedVector = null) {
    const prefixes = ['066', '062', '076', '071'];
    const sender = prefixes[Math.floor(Math.random() * prefixes.length)] + Math.floor(1000000 + Math.random() * 9000000);
    
    // Default Base Metrics (Legitimate Subsystem Operations)
    let payload = {
        sender: sender,
        amount: Math.floor(Math.random() * 45000) + 5000, 
        velocity: Math.floor(Math.random() * 2) + 1,       
        simImsiChanged: 0,                                 
        channel: "USSD_MENU",
        groundTruth: "LEGIT"
    };

    const targetVector = forcedVector || (Math.random() > 0.85 ? ["SIM_SWAP", "MULE_RING", "AIRTIME_EXPLOIT"][Math.floor(Math.random()*3)] : "LEGIT");

    if (targetVector === "SIM_SWAP") {
        // Attack Pattern: Account takeover via sudden IMSI swap followed by full balance pull
        payload.amount = Math.floor(Math.random() * 300000) + 150000; 
        payload.velocity = 1; 
        payload.simImsiChanged = 1; // Direct structural flag
        payload.channel = "USSD_MENU";
        payload.groundTruth = "FRAUD";
    } 
    else if (targetVector === "MULE_RING") {
        // Attack Pattern: Structured layering using unusual channels (API/Web) with extreme transaction frequencies
        payload.amount = Math.floor(Math.random() * 20000) + 5000; 
        payload.velocity = Math.floor(Math.random() * 5) + 6; // High frequency burst
        payload.simImsiChanged = 0;
        payload.channel = "WEB_API_PORTAL";
        payload.groundTruth = "FRAUD";
    } 
    else if (targetVector === "AIRTIME_EXPLOIT") {
        // Attack Pattern: Draining small amounts repeatedly via airtime purchase systems to slide past baseline rules
        payload.amount = Math.floor(Math.random() * 4000) + 1000; 
        payload.velocity = Math.floor(Math.random() * 4) + 4; 
        payload.simImsiChanged = 0;
        payload.channel = "AIRTIME_VOUCHER";
        payload.groundTruth = "FRAUD";
    }

    return payload;
}

// --- Model 1: Legacy Rule-Based Model (Halotel Mockup) ---
function runLegacyRules(tx) {
    if (tx.amount > 200000) return { verdict: "BLOCK", reason: "MAX_LIMIT_LIMIT" };
    if (tx.velocity >= 6) return { verdict: "BLOCK", reason: "VELOCITY_CEILING" };
    return { verdict: "CLEAR", reason: "Passed Rule Book Checks" };
}

// --- Model 2: Advanced Ported Random Forest Classifier ---
function runRandomForest(tx) {
    let internalVotingScore = 0;

    // Estimator Tree 1: Targets account takeovers via device state changes
    if (tx.simImsiChanged === 1 && tx.amount > 100000) internalVotingScore += 0.35;
    // Estimator Tree 2: Targets integration channel frequency anomalies
    if (tx.velocity > 4 && tx.channel === "WEB_API_PORTAL") internalVotingScore += 0.35;
    // Estimator Tree 3: Tracks sneaky system airtime resource drains 
    if (tx.velocity > 3 && tx.channel === "AIRTIME_VOUCHER") internalVotingScore += 0.30;

    return {
        probability: internalVotingScore.toFixed(2),
        prediction: internalVotingScore >= 0.35 ? "FRAUD" : "LEGIT"
    };
}

// --- Real-Time Performance Analytics & Visualization Math Engine ---
function updateConfusionMatrix(prediction, actual) {
    if (prediction === "FRAUD" && actual === "FRAUD") matrix.tp++;
    else if (prediction === "FRAUD" && actual === "LEGIT") matrix.fp++;
    else if (prediction === "LEGIT" && actual === "FRAUD") matrix.fn++;
    else if (prediction === "LEGIT" && actual === "LEGIT") matrix.tn++;

    const total = matrix.tp + matrix.fp + matrix.fn + matrix.tn;
    
    // 1. Calculate Rolling Accuracy
    const accuracy = total > 0 ? ((matrix.tp + matrix.tn) / total) * 100 : 0;
    
    // 2. Calculate Rolling Precision, Recall, and F1-Score
    const precision = (matrix.tp + matrix.fp) > 0 ? matrix.tp / (matrix.tp + matrix.fp) : 0;
    const recall = (matrix.tp + matrix.fn) > 0 ? matrix.tp / (matrix.tp + matrix.fn) : 0;
    const f1Score = (precision + recall) > 0 ? 2 * ((precision * recall) / (precision + recall)) : 0;

    // 3. Update Visual Displays & Progress Bars
    document.getElementById('stat-accuracy').innerText = `${accuracy.toFixed(1)}%`;
    document.getElementById('bar-accuracy').style.width = `${accuracy}%`;

    document.getElementById('stat-f1').innerText = f1Score.toFixed(2);
    document.getElementById('bar-f1').style.width = `${f1Score * 100}%`;
}

// --- Main Operational Pipeline ---
function processIncomingData(tx) {
    // Update live inspector card components
    document.getElementById('inspect-sender').innerText = tx.sender;
    document.getElementById('inspect-amount').innerText = `TZS ${tx.amount.toLocaleString()}`;
    document.getElementById('inspect-device').innerText = tx.simImsiChanged === 1 ? "IMSI_SWAPPED" : "UNCHANGED";
    document.getElementById('inspect-vector').innerText = tx.channel;

    // Run evaluations
    const legacy = runLegacyRules(tx);
    const rf = runRandomForest(tx);

    // Update Confusion Matrix against Random Forest outputs
    updateConfusionMatrix(rf.prediction, tx.groundTruth);

    // Render Legacy Rules Dashboard indicators
    const legacyEl = document.getElementById('rule-verdict');
    legacyEl.innerText = legacy.verdict;
    document.getElementById('rule-reason').innerText = legacy.reason;
    legacyEl.className = legacy.verdict === "BLOCK" ? "status-danger" : "status-safe";

    // Render Random Forest Engine Dashboard indicators
    const rfScoreEl = document.getElementById('rf-score');
    const rfVerdictEl = document.getElementById('rf-verdict');
    rfScoreEl.innerText = rf.probability;
    rfVerdictEl.innerText = rf.prediction === "FRAUD" ? "FRAUDULENT" : "LEGITIMATE";
    
    if (rf.prediction === "FRAUD") {
        rfScoreEl.className = "status-danger";
        rfVerdictEl.className = "status-danger";
    } else {
        rfScoreEl.className = "status-safe";
        rfVerdictEl.className = "status-safe";
    }

    // Append history ticker logs rows
    const logStream = document.getElementById('log-stream');
    const row = document.createElement('div');
    row.className = `log-row ${tx.groundTruth === 'FRAUD' ? 'log-row-fraud' : ''}`;
    row.innerHTML = `
        <span>${new Date().toLocaleTimeString()}</span>
        <span>${tx.sender}</span>
        <span class="${tx.groundTruth === 'FRAUD'?'status-danger':''}">TZS ${tx.amount}</span>
        <strong class="${tx.groundTruth === 'FRAUD'?'status-danger':''}">${tx.groundTruth === 'FRAUD' ? tx.channel : 'NORMAL'}</strong>
    `;
    logStream.insertBefore(row, logStream.firstChild);
}

// --- User Interaction Listeners ---
document.getElementById('btn-start').addEventListener('click', () => {
    document.getElementById('btn-start').disabled = true;
    document.getElementById('btn-stop').disabled = false;
    streamInterval = setInterval(() => {
        processIncomingData(extractNetworkPayload());
    }, 1200);
});

document.getElementById('btn-stop').addEventListener('click', () => {
    document.getElementById('btn-start').disabled = false;
    document.getElementById('btn-stop').disabled = true;
    clearInterval(streamInterval);
});

document.querySelectorAll('.inject-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const vector = e.target.getAttribute('data-vector');
        processIncomingData(extractNetworkPayload(vector));
    });
});

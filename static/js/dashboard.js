const txBody = document.getElementById('tx-body');
const totalTrans = document.getElementById('total-trans');
const activeAlerts = document.getElementById('active-alerts');
const blockedVolume = document.getElementById('blocked-volume');

async function fetchMetrics(){
  try{
    const res = await fetch('/api/v1/dashboard-metrics');
    const data = await res.json();

    totalTrans.innerText = data.total_transactions;
    activeAlerts.innerText = data.active_fraud_alerts;
    blockedVolume.innerText = `TZS ${(data.blocked_fraud_volume/1000000).toFixed(2)}M`;

    // populate table
    txBody.innerHTML = '';
    data.recent_transactions.forEach(tx => {
      const row = document.createElement('div');
      row.className = 'tx-row';
      const riskPct = Math.min(100, Math.round(tx.risk_score || 0));
      const badgeClass = tx.prediction_label === 'CRITICAL' ? 'badge-critical' : (tx.prediction_label === 'MEDIUM RISK' ? 'badge-medium' : 'badge-low');

      row.innerHTML = `
        <div>TXN_TZ_${tx.transaction_id}</div>
        <div>${new Date(tx.timestamp).toLocaleTimeString()}</div>
        <div>${tx.sender_id}</div>
        <div>${tx.receiver_id}</div>
        <div>TZS ${tx.amount.toLocaleString()}</div>
        <div>
          <div class="risk-meter"><div class="risk-fill" style="width:${riskPct}%"></div></div>
        </div>
        <div><span class="${badgeClass}">${tx.prediction_label}</span></div>
        <div class="action-btns">
          <button class="approve" onclick="performAction('approve', ${tx.transaction_id})">Approve</button>
          <button class="freeze" onclick="performFreeze('${tx.sender_id}')">Freeze Account</button>
        </div>
      `;
      txBody.appendChild(row);
    });

  }catch(e){
    console.error('metrics fetch err', e);
  }
}

async function performAction(action, tx_id){
  await fetch(`/api/v1/action/${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({transaction_id:tx_id})});
  fetchMetrics();
}

async function performFreeze(phone){
  await fetch(`/api/v1/action/freeze`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone})});
  fetchMetrics();
}

fetchMetrics();
setInterval(fetchMetrics, 1500);


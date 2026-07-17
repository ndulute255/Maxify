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

    txBody.innerHTML = '';
    data.recent_transactions.forEach(tx => {
      const row = document.createElement('div');
      row.className = 'tx-row';
      const riskPct = Math.min(100, Math.round(tx.risk_score || 0));
      const badgeClass = tx.prediction_label === 'CRITICAL' ? 'badge-critical' : (tx.prediction_label === 'MEDIUM RISK' ? 'badge-medium' : 'badge-low');
      const isBlocked = tx.status === 'BLOCKED' || tx.prediction_label === 'CRITICAL';
      const statusText = tx.status || 'PENDING';
      const badgeText = statusText === 'BLOCKED' ? 'BLOCKED' : tx.prediction_label;
      const rowStateClass = tx.status === 'BLOCKED' ? 'tx-row-blocked' : '';

      row.classList.add(rowStateClass);
      row.innerHTML = `
        <div>TXN_TZ_${tx.transaction_id}</div>
        <div>${new Date(tx.timestamp).toLocaleTimeString()}</div>
        <div>${tx.sender_id}</div>
        <div>${tx.receiver_id}</div>
        <div>TZS ${Number(tx.amount).toLocaleString()}</div>
        <div>
          <div class="risk-meter"><div class="risk-fill" style="width:${riskPct}%"></div></div>
        </div>
        <div><span class="${badgeClass}">${badgeText}</span></div>
        <div class="action-btns">
          <button class="approve" data-action="approve" data-tx-id="${tx.transaction_id}" data-sender="${tx.sender_id}">Approve</button>
          ${isBlocked ? `<button class="unfreeze" data-action="unfreeze" data-sender="${tx.sender_id}">Unfreeze</button>` : `<button class="freeze" data-action="freeze" data-sender="${tx.sender_id}" data-tx-id="${tx.transaction_id}">Freeze Account</button>`}
        </div>
      `;
      txBody.appendChild(row);
    });

    txBody.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const action = btn.getAttribute('data-action');
        const txId = btn.getAttribute('data-tx-id');
        const sender = btn.getAttribute('data-sender');
        const payload = action === 'approve' ? { transaction_id: txId, sender_phone: sender } : { transaction_id: txId, phone: sender, sender_phone: sender };
        await fetch(`/api/v1/action/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        fetchMetrics();
      });
    });
  }catch(e){
    console.error('metrics fetch err', e);
  }
}

fetchMetrics();
setInterval(fetchMetrics, 1500);


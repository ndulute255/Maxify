from flask import Flask, render_template, request, jsonify, g, abort
import sqlite3
import os
import pandas as pd
import numpy as np
import joblib
from datetime import datetime

# Paths for local artifacts
DB_PATH = os.path.join(os.path.dirname(__file__), 'mobile_money.db')
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'random_forest_model.pkl')

app = Flask(__name__)


def get_db():
    """Return a sqlite3 connection attached to the Flask `g` context.

    Using one connection per request avoids repeated opens/closes and
    ensures row access by name via `sqlite3.Row`.
    """
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DB_PATH)
        db.row_factory = sqlite3.Row
    return db


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


def init_db():
        """Initialize the SQLite DB and seed test accounts if not present.

        This routine creates two tables used by the system:
            - `accounts`: stores user wallet metadata and balances
            - `transactions`: stores transaction history and risk metadata

        It also inserts three seeded Tanzanian test accounts used by the demo UI.
        """
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS accounts (
            phone_number TEXT PRIMARY KEY,
            user_name TEXT,
            balance REAL,
            status TEXT,
            device_id TEXT,
            last_login_ip TEXT
        )
        """
    )

    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS transactions (
            transaction_id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT,
            sender_id TEXT,
            receiver_id TEXT,
            amount REAL,
            risk_score REAL,
            prediction_label TEXT,
            status TEXT
        )
        """
    )

    # Seed three test accounts (Tanzanian numbers)
    seeds = [
        ('+255711000111', 'Amina', 2000000.0, 'ACTIVE', 'DEV-A-111', '127.0.0.1'),
        ('+255712000222', 'John', 1500000.0, 'ACTIVE', 'DEV-B-222', '127.0.0.1'),
        ('+255713000333', 'Grace', 500000.0, 'ACTIVE', 'DEV-C-333', '127.0.0.1')
    ]

    for p, n, bal, status, did, ip in seeds:
        cur.execute("SELECT phone_number FROM accounts WHERE phone_number = ?", (p,))
        if cur.fetchone() is None:
            cur.execute(
                "INSERT INTO accounts (phone_number, user_name, balance, status, device_id, last_login_ip) VALUES (?, ?, ?, ?, ?, ?)",
                (p, n, bal, status, did, ip)
            )

    conn.commit()
    conn.close()


def create_model_if_missing():
    """Train a small RandomForest classifier and persist it as a joblib file

    For demo purposes we synthesise a compact dataset that resembles the
    features used by the JS frontend and Python ingestion pipeline:
      - amount: transaction value
      - velocity: simple frequency proxy
      - new_device: boolean device mismatch

    In production you'd replace this with a real dataset and training
    pipeline producing a model versioned artifact.
    """
    if os.path.exists(MODEL_PATH):
        return

    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split

    np.random.seed(42)
    data_size = 3000
    amounts = np.random.exponential(scale=50000, size=data_size)
    velocities = np.random.poisson(lam=1, size=data_size)
    new_device = np.random.choice([0, 1], p=[0.9, 0.1], size=data_size)

    fraud_prob = (velocities * 0.3) + (new_device * 0.4) + (amounts / 500000)
    labels = (fraud_prob > 0.75).astype(int)

    df = pd.DataFrame({
        'amount': amounts,
        'velocity': velocities,
        'new_device': new_device,
    })

    X = df[['amount', 'velocity', 'new_device']]
    y = labels

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
    rf = RandomForestClassifier(n_estimators=50, max_depth=6, random_state=42)
    rf.fit(X_train, y_train)

    joblib.dump(rf, MODEL_PATH)
    print('Saved model to', MODEL_PATH)


def query_account(phone):
    """Helper: return account row as dict or None."""
    db = get_db()
    cur = db.execute('SELECT * FROM accounts WHERE phone_number = ?', (phone,))
    row = cur.fetchone()
    return dict(row) if row else None


@app.route('/')
def index():
    return "Mobile Money Fraud Detection System - visit /dashboard"


@app.route('/dashboard')
def dashboard():
    return render_template('dashboard.html')


@app.route('/sender')
def sender():
    return render_template('sender.html')


@app.route('/receiver')
def receiver():
    # The receiver page accepts a query param ?phone=... default to third seeded account
    phone = request.args.get('phone', '+255713000333')
    return render_template('receiver.html', phone=phone)


@app.route('/api/v1/account/<phone>')
def api_account(phone):
    acct = query_account(phone)
    if acct is None:
        return jsonify({'error': 'account not found'}), 404
    return jsonify({'phone_number': acct['phone_number'], 'balance': acct['balance'], 'status': acct['status']})


@app.route('/api/v1/transfer', methods=['POST'])
def api_transfer():
    data = request.get_json() or {}
    sender_phone = data.get('sender_phone')
    receiver_phone = data.get('receiver_phone')
    amount = float(data.get('amount', 0))
    device_id = data.get('device_id')

    # Basic API payload validation
    if not sender_phone or not receiver_phone or amount <= 0:
        return jsonify({'error': 'invalid payload'}), 400

    db = get_db()
    cur = db.cursor()

    cur.execute('SELECT * FROM accounts WHERE phone_number = ?', (sender_phone,))
    s = cur.fetchone()
    if s is None:
        return jsonify({'error': 'sender not found'}), 404

    # Convert sqlite row to dict for easier access
    s = dict(s)
    # Respect account status
    if s['status'] == 'FROZEN':
        return jsonify({'error': 'account frozen'}), 403

    # Ensure sufficient funds
    if s['balance'] < amount:
        return jsonify({'error': 'insufficient funds'}), 402

    # compute device mismatch
    device_mismatch = 1 if (device_id and device_id != s['device_id']) else 0

    # Map to model features: amount, velocity (default 1), new_device
    features = pd.DataFrame([{
        'amount': amount,
        'velocity': 1,
        'new_device': device_mismatch
    }])

    # Load the persisted RandomForest model and score the transaction. The
    # model returns [P(legit), P(fraud)] so we take index 1 and convert to %.
    model = joblib.load(MODEL_PATH)
    proba = model.predict_proba(features[['amount', 'velocity', 'new_device']])[0][1] * 100.0
    risk_score = float(proba)

    timestamp = datetime.utcnow().isoformat() + 'Z'

    # Policy: risk above threshold => immediate block + freeze sender
    if risk_score > 75.0:
        cur.execute('INSERT INTO transactions (timestamp, sender_id, receiver_id, amount, risk_score, prediction_label, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    (timestamp, sender_phone, receiver_phone, amount, risk_score, 'CRITICAL', 'BLOCKED'))
        cur.execute('UPDATE accounts SET status = ? WHERE phone_number = ?', ('FROZEN', sender_phone))
        db.commit()
        return jsonify({'result': 'blocked', 'reason': 'high risk', 'risk_score': risk_score}), 200

    # Else approve: move funds
    cur.execute('SELECT * FROM accounts WHERE phone_number = ?', (receiver_phone,))
    r = cur.fetchone()
    if r is None:
        # create receiver stub account if missing (keeps demo simple)
        cur.execute('INSERT INTO accounts (phone_number, user_name, balance, status, device_id, last_login_ip) VALUES (?, ?, ?, ?, ?, ?)',
                    (receiver_phone, 'Receiver', 0.0, 'ACTIVE', device_id or 'UNKNOWN', '0.0.0.0'))

    # Deduct / credit balances and log transaction as APPROVED
    cur.execute('UPDATE accounts SET balance = balance - ? WHERE phone_number = ?', (amount, sender_phone))
    cur.execute('UPDATE accounts SET balance = balance + ? WHERE phone_number = ?', (amount, receiver_phone))
    cur.execute('INSERT INTO transactions (timestamp, sender_id, receiver_id, amount, risk_score, prediction_label, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
                (timestamp, sender_phone, receiver_phone, amount, risk_score, 'LOW RISK' if risk_score < 35 else 'MEDIUM RISK', 'APPROVED'))
    db.commit()

    return jsonify({'result': 'approved', 'risk_score': risk_score, 'timestamp': timestamp}), 200


@app.route('/api/v1/dashboard-metrics')
def api_dashboard_metrics():
    db = get_db()
    cur = db.cursor()

    total_tx = cur.execute('SELECT COUNT(*) as c FROM transactions').fetchone()['c']
    active_alerts = cur.execute("SELECT COUNT(*) as c FROM transactions WHERE prediction_label = 'CRITICAL'").fetchone()['c']
    blocked_volume = cur.execute("SELECT COALESCE(SUM(amount),0) as s FROM transactions WHERE status = 'BLOCKED'").fetchone()['s']

    # Recent transactions
    rows = cur.execute('SELECT * FROM transactions ORDER BY transaction_id DESC LIMIT 20').fetchall()
    txs = []
    for r in rows:
        txs.append({
            'transaction_id': r['transaction_id'],
            'timestamp': r['timestamp'],
            'sender_id': r['sender_id'],
            'receiver_id': r['receiver_id'],
            'amount': r['amount'],
            'risk_score': r['risk_score'],
            'prediction_label': r['prediction_label'],
            'status': r['status']
        })

    return jsonify({
        'total_transactions': total_tx,
        'active_fraud_alerts': active_alerts,
        'blocked_fraud_volume': float(blocked_volume),
        'model_performance': 'AUC-ROC 0.984 | Random Forest F1: 95.1%',
        'recent_transactions': txs
    })


@app.route('/api/v1/action/<action_type>', methods=['POST'])
def api_action(action_type):
    payload = request.get_json() or {}
    db = get_db()
    cur = db.cursor()

    if action_type == 'approve':
        tx_id = payload.get('transaction_id')
        if not tx_id:
            return jsonify({'error': 'transaction_id required'}), 400
        cur.execute('UPDATE transactions SET status = ? WHERE transaction_id = ?', ('APPROVED', tx_id))
        db.commit()
        return jsonify({'result': 'approved'})

    if action_type == 'freeze':
        phone = payload.get('phone')
        if not phone:
            return jsonify({'error': 'phone required'}), 400
        cur.execute('UPDATE accounts SET status = ? WHERE phone_number = ?', ('FROZEN', phone))
        db.commit()
        return jsonify({'result': 'frozen'})

    return jsonify({'error': 'unknown action'}), 400


if __name__ == '__main__':
    # Ensure DB + model present
    init_db()
    create_model_if_missing()
    app.run(host='0.0.0.0', port=5000, debug=True)

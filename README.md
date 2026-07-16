Mobile Money Fraud Detection Demo

Overview

This repository contains a compact demo of a Mobile Money Fraud Detection System built with Flask, SQLite and a small Random Forest model saved with `joblib`.

Run locally (Windows)

1. Create a virtual environment and install dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

2. Start the app:

```powershell
python app.py
```

3. Open the UI in your browser:

- Dashboard: http://localhost:5000/dashboard
- Sender: http://localhost:5000/sender
- Receiver: http://localhost:5000/receiver?phone=+255712000222

Notes

- The repository auto-creates a small RandomForest model at first run if `random_forest_model.pkl` is absent. Replace with your production model as needed.
- The SQLite DB `mobile_money.db` is created in the project root.

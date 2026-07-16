import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split

# 1. Synthesize minimal training data mimicking Halotel traffic
np.random.seed(42)
data_size = 5000

amounts = np.random.exponential(scale=50000, size=data_size)  # Normal distribution of TZS
velocities = np.random.poisson(lam=1, size=data_size)       # Tx per minute
is_new_device = np.random.choice([0, 1], p=[0.9, 0.1], size=data_size)

# Create deterministic labels with a bit of noise for fraud
# Fraud if high velocity or massive amount on a brand new device
fraud_prob = (velocities * 0.3) + (is_new_device * 0.4) + (amounts / 500000)
labels = (fraud_prob > 0.75).astype(int)

df = pd.DataFrame({
    'amount': amounts,
    'velocity': velocities,
    'new_device': is_new_device,
    'is_fraud': labels
})

# 2. Train Random Forest
X = df[['amount', 'velocity', 'new_device']]
y = df['is_fraud']
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)

rf = RandomForestClassifier(n_estimators=3, max_depth=3, random_state=42)
rf.fit(X_train, y_train)

# 3. Extract the feature importance and mean thresholds for Javascript edge porting
print("Random Forest Training Complete!")
print(f"Accuracy Score: {rf.score(X_test, y_test) * 100:.2f}%")
print(f"Feature Importances: {rf.feature_importances_}")

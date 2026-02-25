# Step 1: One observation, one database point, one coordinate (Easting)
import math
import random
import numpy as np
import matplotlib.pyplot as plt
import pandas as pd
from scipy.optimize import minimize

# Gaussian probability density function
def gaussian_pdf(x, mu, sigma):
	return (1 / math.sqrt(2 * math.pi * sigma ** 2)) * math.exp(-((x - mu) ** 2) / (2 * sigma ** 2))

# Observation (relative position)
X_obs = 1  # Example: observed X = 1

# Database reference point
E0 = 317306  # Example: Easting of reference point

# Predicted position
E_pred = E0 + X_obs

# Load database from ExampleData.csv
db_df = pd.read_csv('ExampleData.csv')
db_df.columns = db_df.columns.str.strip()
for col in db_df.select_dtypes(include='object').columns:
    db_df[col] = db_df[col].str.strip()
db_points = db_df[['Easting', 'Northing', 'Species', 'DBH']].dropna().values

# Set default sigmas and species error probability
sigma_position = 2.0  # meters
sigma_dbh = 0.01      # meters
p_wrong_species = 0.05

db_E = np.array([row[0] for row in db_points])
db_N = np.array([row[1] for row in db_points])
db_species = np.array([row[2] for row in db_points])
db_dbh = np.array([row[3] for row in db_points])

# Log-probability for 2D Gaussian (position)
def log_gaussian_2d_pdf(x, y, mu_x, mu_y, sigma):
    return -np.log(2 * np.pi * sigma ** 2) - ((x - mu_x) ** 2 + (y - mu_y) ** 2) / (2 * sigma ** 2)

# Log-probability for 1D Gaussian (DBH)
def log_gaussian_1d_pdf(x, mu, sigma):
    return -np.log(np.sqrt(2 * np.pi) * sigma) - ((x - mu) ** 2) / (2 * sigma ** 2)

# Log-probability for species match
def log_species_prob(obs_species, db_species, p_wrong):
    if obs_species == db_species:
        return np.log(1 - p_wrong)
    else:
        return np.log(p_wrong)

# Generate 5 random (X, Y) offsets for predictions (within -10 to 10 meters)
random.seed()
relative_offsets = [(random.uniform(-10, 10), random.uniform(-10, 10)) for _ in range(5)]
pred_species = ['Fagus', 'Pinus', 'Quercus', 'Picea', 'Populus']
pred_dbh = [0.15, 0.5, 0.3, 0.1, 0.05]  # Example DBH values (meters)

# Objective: negative total log-likelihood (so we minimize)
def objective(ref):
    ref_E, ref_N = ref
    pred_points = [(ref_E + dx, ref_N + dy, s, d) for (dx, dy), s, d in zip(relative_offsets, pred_species, pred_dbh)]
    total_log_likelihood = 0
    for (E_pred, N_pred, species_pred, dbh_pred) in pred_points:
        best_idx = None
        best_log_likelihood = -np.inf
        for idx in range(len(db_E)):
            ll_pos = log_gaussian_2d_pdf(E_pred, N_pred, db_E[idx], db_N[idx], sigma_position)
            ll_dbh = log_gaussian_1d_pdf(dbh_pred, db_dbh[idx], sigma_dbh)
            ll_species = log_species_prob(species_pred, db_species[idx], p_wrong_species)
            ll_total = ll_pos + ll_dbh + ll_species
            if ll_total > best_log_likelihood:
                best_log_likelihood = ll_total
                best_idx = idx
        total_log_likelihood += best_log_likelihood
    return -total_log_likelihood  # minimize negative log-likelihood

# Initial guess: mean of database points
init_E = np.mean(db_E)
init_N = np.mean(db_N)

result = minimize(objective, x0=[init_E, init_N], method='Nelder-Mead')
opt_E, opt_N = result.x

# Get best predictions and matches
best_pred_points = [(opt_E + dx, opt_N + dy, s, d) for (dx, dy), s, d in zip(relative_offsets, pred_species, pred_dbh)]
best_matches = []
for (E_pred, N_pred, species_pred, dbh_pred) in best_pred_points:
    best_idx = None
    best_log_likelihood = -np.inf
    for idx in range(len(db_E)):
        ll_pos = log_gaussian_2d_pdf(E_pred, N_pred, db_E[idx], db_N[idx], sigma_position)
        ll_dbh = log_gaussian_1d_pdf(dbh_pred, db_dbh[idx], sigma_dbh)
        ll_species = log_species_prob(species_pred, db_species[idx], p_wrong_species)
        ll_total = ll_pos + ll_dbh + ll_species
        if ll_total > best_log_likelihood:
            best_log_likelihood = ll_total
            best_idx = idx
    best_matches.append((db_E[best_idx], db_N[best_idx], db_species[best_idx], db_dbh[best_idx]))

# Visualization with optional display modes
show_all = True  # Set to False to show only predicted circles and best matches

plt.figure(figsize=(10, 8))

if show_all:
    # Plot all database points (blue)
    plt.scatter(db_E, db_N, color='blue', s=80, label='Database Points', edgecolors='white', linewidths=1.0)
    plt.scatter([opt_E], [opt_N], color='red', s=150, label='Best Reference Point', edgecolors='white', linewidths=2.0)

# Plot predicted points (black)
pred_E = [e for e, n, s, d in best_pred_points]
pred_N = [n for e, n, s, d in best_pred_points]
plt.scatter(pred_E, pred_N, color='black', s=120, label='Prediction Points', edgecolors='white', linewidths=1.5)

# Draw circles for predicted points
for (e, n, s, d) in best_pred_points:
    circle = plt.Circle((e, n), sigma_position, color='black', fill=False, linestyle='--', linewidth=1.5, alpha=0.5)
    plt.gca().add_patch(circle)

# Draw spatial pattern line connecting predicted points (only if show_all is False)
if not show_all:
    plt.plot(pred_E, pred_N, color='white', linestyle='-', linewidth=2, label='Predicted Pattern')

# Draw lines from predictions to their matched database points
for (e_pred, n_pred, s_pred, d_pred), (e_match, n_match, s_match, d_match) in zip(best_pred_points, best_matches):
    plt.plot([e_pred, e_match], [n_pred, n_match], color='yellow', linestyle=':', linewidth=1)
    plt.scatter([e_match], [n_match], color='green', s=120, label='Best Match', edgecolors='white', linewidths=1.5)

plt.title('Pattern Matching: Prediction Circles and Best Matches')
plt.xlabel('Easting')
plt.ylabel('Northing')
plt.legend()
plt.grid(True, color='gray', linestyle='--', linewidth=0.5, alpha=0.3)
plt.gca().set_facecolor('black')
plt.show()

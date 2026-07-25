# SCS-RG Risk Fusion Formula & Weight Justification (Test Case 30)

This document provides the mathematical specification and engineering rationale for the **Risk Fusion Algorithm** implemented in `src/app/utils/riskFusion.ts`.

---

## 1. Mathematical Formula

The overall Risk Fusion Score ($\text{RiskScore} \in [0.0, 100.0]$) is computed as:

$$\text{RiskScore} = w_{\text{fire}} \cdot S_{\text{fire}} + w_{\text{gas}} \cdot S_{\text{gas}} + w_{\text{water}} \cdot S_{\text{water}} + w_{\text{occ}} \cdot S_{\text{occ}}$$

Where:
- $S_{\text{fire}} = \min\left(1.0, \frac{\text{flame\_raw}}{1000.0}\right)$ (Normalized Flame Sensor ADC)
- $S_{\text{gas}} = \min\left(1.0, \frac{\text{gas\_raw}}{1000.0}\right)$ (Normalized MQ-2 Gas Sensor ADC)
- $S_{\text{water}} = \min\left(1.0, \frac{\text{water\_raw}}{1000.0}\right)$ (Normalized Water Sensor ADC)
- $S_{\text{occ}} = 1.0 \text{ if motion == true else } 0.0$ (Occupancy Multiplier)

---

## 2. Weight Allocations & Rationale

| Hazard Parameter | Weight ($w_i$) | Max Points | Engineering Justification |
|---|---|---|---|
| **Flame ($w_{\text{fire}}$)** | **40%** | 40.0 pts | **Life Safety & Structural Urgency**: Open flame represents the highest immediate threat of structural collapse and rapid fire spread. |
| **Combustible Gas ($w_{\text{gas}}$)** | **25%** | 25.0 pts | **Explosive Potential & Toxicity**: Gas leaks carry explosive risk and respiratory damage, requiring immediate ventilation or cutoff. |
| **Water / Flood ($w_{\text{water}}$)** | **20%** | 20.0 pts | **Infrastructure & Electrical Short Risk**: Flooding damages electronic infrastructure and creates electrical hazards. |
| **Occupancy ($w_{\text{occ}}$)** | **15%** | 15.0 pts | **Human Priority Multiplier**: Increases risk score when human lives are active in the zone, prioritizing evacuation response. |

---

## 3. Hazard State Classification Thresholds

- $\text{RiskScore} \ge 65.0 \implies$ **`CRITICAL`** (Triggers emergency sirens, relay cutoff, and priority queue ranking)
- $30.0 \le \text{RiskScore} < 65.0 \implies$ **`WARNING`** (Triggers amber visual alert)
- $\text{RiskScore} < 30.0 \implies$ **`SAFE`** (Normal baseline)

---

## 4. Debouncing & Signal Conditioning

- **N=5 Debounce Window**: Requires 5 consecutive flame threshold breaches before locking into a debounced fire state, eliminating transient light flickering false positives.
- **Linear Decay Rate**: When sensor readings drop below threshold, risk score decays linearly over 3–5 seconds to prevent rapid alarm toggling ("flapping").
- **30s Gas Sensor Warm-Up Window**: Filters out uncalibrated heater coil spikes during initial node boot.

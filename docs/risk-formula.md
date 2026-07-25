# SCS-RG Risk Fusion Formula & Weight Justification (Test Case 30)

This document provides the mathematical specification and engineering rationale for the **Bounded Multi-Hazard Risk Fusion Algorithm** implemented in `src/app/utils/riskFusion.ts`.

---

## 1. Mathematical Formula

The overall Risk Fusion Score ($\text{RiskScore} \in [0.0, 100.0]$) is computed as a bounded multi-hazard sum capped at 100.0:

$$\text{RiskScore} = \min\left(100.0, \, w_{\text{fire}} \cdot S_{\text{fire}} + w_{\text{gas}} \cdot S_{\text{gas}} + w_{\text{water}} \cdot S_{\text{water}} + w_{\text{occ}} \cdot S_{\text{occ}}\right)$$

Where:
- $S_{\text{fire}} = \text{debouncedFire} ? 1.0 : \min\left(1.0, \frac{\text{flame}_{\text{raw}}}{\text{MaxADC}}\right)$ (Normalized Flame Sensor ADC)
- $S_{\text{gas}} = \text{isWarmUp} ? 0.0 : \min\left(1.0, \frac{\text{gas}_{\text{raw}}}{\text{MaxADC}}\right)$ (Normalized MQ-2 Gas Sensor ADC)
- $S_{\text{water}} = \min\left(1.0, \frac{\text{water}_{\text{raw}}}{\text{MaxADC}}\right)$ (Normalized Water Sensor ADC)
- $S_{\text{occ}} = \begin{cases} 1.0 & \text{if motion is true} \\ 0.0 & \text{otherwise} \end{cases}$ (Occupancy Multiplier)

---

## 2. Weight Allocations & Rationale

| Hazard Parameter | Max Points ($w_i$) | Engineering Justification |
|---|---|---|
| **Flame ($w_{\text{fire}}$)** | **40.0 pts** | **Life Safety & Structural Urgency**: Open flame represents an immediate threat of structural damage and rapid fire spread. Combined with occupancy ($25.0$), severe fire breaches the $\ge 65.0$ `CRITICAL` emergency threshold. |
| **Combustible Gas ($w_{\text{gas}}$)** | **40.0 pts** | **Explosive Potential & Toxicity**: Severe gas leaks carry immediate explosion and respiratory failure hazards. Combined with occupancy ($25.0$), severe gas breaches the $\ge 65.0$ `CRITICAL` emergency threshold (triggering siren, red LED, and power relay cutoff). |
| **Water / Flood ($w_{\text{water}}$)** | **30.0 pts** | **Infrastructure & Electrical Short Risk**: Flooding damages electronic infrastructure and creates electrical shock hazards. |
| **Occupancy ($w_{\text{occ}}$)** | **25.0 pts** | **Human Safety Priority Multiplier**: Escalates risk score when human lives are active in the zone, prioritizing evacuation and critical sirens. |

*Note: Total raw hazard sum can reach up to $135.0$ points, but the output score is hard-capped at $\min(100.0, \text{TotalScore})$ to maintain a standard $0.0 - 100.0$ risk scale.*

---

## 3. Hazard State Classification Thresholds

- $\text{RiskScore} \ge 65.0 \implies$ **`CRITICAL`** (Triggers emergency sirens, red LED, relay cutoff, and priority queue ranking)
- $30.0 \le \text{RiskScore} < 65.0 \implies$ **`WARNING`** (Triggers amber visual alert)
- $\text{RiskScore} < 30.0 \implies$ **`SAFE`** (Normal baseline)

---

## 4. Debouncing & Signal Conditioning

- **N=3 Debounce Window**: Requires 3 consecutive flame threshold breaches before locking into a debounced fire state.
- **Linear Decay Rate**: When sensor readings drop below threshold, risk score decays linearly over 3–5 seconds to prevent rapid alarm toggling ("flapping").
- **30s Gas Sensor Warm-Up Window**: Filters out uncalibrated heater coil spikes during initial node boot.

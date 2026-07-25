# Server Room — Circuit Diagram

## Pin Mapping

| ESP32 Pin | Connected To            | Signal          |
|-----------|-------------------------|-----------------|
| 3V3       | pot VCC, sonar VCC, relay VCC | Power     |
| GND       | pot GND, sonar GND, LED GND, buzzer GND, relay GND | Ground |
| GPIO34    | pot WIP (wiper)         | flame_raw ADC   |
| GPIO26    | sonar TRIG              | HC-SR04 trigger |
| GPIO27    | sonar ECHO              | HC-SR04 echo    |
| GPIO14    | LED red anode           | LED red         |
| GPIO12    | LED green anode         | LED green       |
| GPIO13    | LED blue anode          | LED blue        |
| GPIO25    | Buzzer VCC              | Buzzer          |
| GPIO15    | Relay IN                | Relay cutoff    |

## Schematic (text)

```
               ┌─────────────┐
               │   ESP32     │
               │             │
    ┌──────────┤ 3V3         ├──────┐
    │          │             │      │
    │     ┌────┤ GND         ├──┐   │
    │     │    │             │  │   │
    │     │    │ GPIO34 ◄────┘  │   │
    │     │    │ GPIO26 ───┐    │   │
    │     │    │ GPIO27 ◄──┤    │   │
    │     │    │ GPIO14 ───┤──┐ │   │
    │     │    │ GPIO12 ───┤──┤─┐│   │
    │     │    │ GPIO13 ───┤──┤─┤│   │
    │     │    │ GPIO25 ───┤──┤─┤│──┐│
    │     │    │ GPIO15 ───┤──┤─┤│──┤│
    │     │    └─────────────┘  │ ││  ││
    │     │                     │ ││  ││
   ┌┴┐   ┌┴┐            ┌──────┘ ││  ││
   │P│   │H│            │ ┌──────┘│  ││
   │o│   │C│            │ │ ┌────┘  ││
   │t│   │ │            │ │ │ ┌─────┘│
   │ │   │-│       ┌────┴─┴─┴─┴──┐  │
   └┬┘   │S│       │   RGB LED   │  │
    │    │R│       │ R   G   B   │  │
    │    │0│       └──────────────┘  │
    │    │4│                    ┌────┘
    │    └─┘                    │
    │                      ┌───┴───┐
    │                      │BUZZER │
    │                      └───────┘
    │                     ┌────────┐
    │                     │ RELAY  │
    │                     └────────┘
```

## Components

| Ref | Part                  | Purpose                            |
|-----|-----------------------|------------------------------------|
| Pot | wokwi-potentiometer   | Flame intensity (0-4095 ADC)       |
| Son | wokwi-hc-sr04         | Water level (distance → inverted)  |
| LED | wokwi-led × 3         | RGB status indicator               |
| Buz | wokwi-buzzer          | Audible alert                      |
| Rel | wokwi-relay-module    | Power cutoff                       |

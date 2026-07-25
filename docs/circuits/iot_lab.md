# IoT Lab — Circuit Diagram

## Pin Mapping

| ESP32 Pin | Connected To           | Signal        |
|-----------|------------------------|---------------|
| 3V3       | pot VCC, gas VCC, PIR VCC, relay VCC | Power |
| GND       | pot GND, gas GND, PIR GND, LED GND, buzzer GND, relay GND | Ground |
| GPIO34    | pot WIP (wiper)        | flame_raw ADC |
| GPIO35    | gas AO                 | gas_raw ADC   |
| GPIO32    | gas DO                 | gas digital   |
| GPIO33    | PIR OUT                | motion        |
| GPIO14    | LED red anode          | LED red       |
| GPIO12    | LED green anode        | LED green     |
| GPIO13    | LED blue anode         | LED blue      |
| GPIO25    | Buzzer VCC             | Buzzer        |
| GPIO15    | Relay IN               | Relay cutoff  |

## Schematic (text)

```
               ┌─────────────┐
               │   ESP32     │
               │             │
    ┌──────────┤ 3V3         ├──────────┐
    │          │             │          │
    │     ┌────┤ GND         ├────┐     │
    │     │    │             │    │     │
    │     │    │ GPIO34 ◄────┘    │     │
    │     │    │ GPIO35 ◄──┐      │     │
    │     │    │ GPIO32 ◄──┤      │     │
    │     │    │ GPIO33 ◄──┤      │     │
    │     │    │ GPIO14 ───┤──┐   │     │
    │     │    │ GPIO12 ───┤──┤──┐│     │
    │     │    │ GPIO13 ───┤──┤──┤│     │
    │     │    │ GPIO25 ───┤──┤──┤│──┐  │
    │     │    │ GPIO15 ───┤──┤──┤│──┤──┐
    │     │    └─────────────┘  │  ││  │  │
    │     │                     │  ││  │  │
   ┌┴┐   ┌┴┐                   │  ││  │  │
   │P│   │P│              ┌────┘  ││  │  │
   │o│   │I│              │  ┌────┘│  │  │
   │t│   │R│              │  │  ┌──┘  │  │
   │ │   │ │         ┌────┴──┴──┴──┐  │  │
   └┬┘   └┬┘         │   RGB LED   │  │  │
    │     │          │ R   G   B   │  │  │
    │     │          └──────────────┘  │  │
    │   ┌─┴─┐                    ┌─────┘  │
    │   │ MQ│                    │ ┌──────┘
    │   │ -2│                    │ │
    │   │   │                ┌───┴─┴──┐
    │   └───┘                │ BUZZER │
    │                        └────────┘
    │                       ┌─────────┐
    │                       │  RELAY  │
    │                       └─────────┘
```

## Components

| Ref | Part                  | Purpose                         |
|-----|-----------------------|---------------------------------|
| Pot | wokwi-potentiometer   | Flame intensity (0-4095 ADC)    |
| Gas | wokwi-gas-sensor      | MQ-2 gas sensor (analog + dig)  |
| PIR | wokwi-pir-motion-sensor| Occupancy detection             |
| LED | wokwi-led × 3         | RGB status indicator            |
| Buz | wokwi-buzzer          | Audible alert                   |
| Rel | wokwi-relay-module    | Power cutoff                    |

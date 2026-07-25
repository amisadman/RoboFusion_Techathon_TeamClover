// ================================================================
// Zone Node — Multi-Hazard Smart Campus Safety & Response Grid
// ================================================================

#define ZONE_ID "data_science_lab"
#define WIFI_SSID "Wokwi-GUEST"
#define WIFI_PASS ""
#define BACKEND_HOST "robofusion-techathon-teamclover.onrender.com"
#define BACKEND_URL "https://" BACKEND_HOST
#define ZONE_API_KEY "key_data_science_789"

#define HAS_GAS 0
#define HAS_WATER 1
#define HAS_MOTION 0

#define PIN_FLAME 34
#define PIN_GAS_A 35
#define PIN_GAS_D 32
#define PIN_PIR 33
#define PIN_TRIG 26
#define PIN_ECHO 27
#define PIN_LED_R 14
#define PIN_LED_G 4
#define PIN_LED_Y 13
#define PIN_BUZZER 25
#define PIN_RELAY 16

#define POST_INTERVAL_MS 100
#define GAS_WARMUP_MS 0
#define SENSOR_HEALTH_MS 1000

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

static const char *BACKEND_PATH = "/api/readings";

unsigned long seq = 0;
unsigned long boot_ms = 0;
unsigned long last_post = 0;

struct
{
  String led = "green";
  bool buzzer = false;
  bool relay_cutoff = false;
} cmd;

void setup()
{
  Serial.begin(115200);
  boot_ms = millis();

  pinMode(PIN_FLAME, INPUT);
  pinMode(PIN_LED_R, OUTPUT);
  pinMode(PIN_LED_G, OUTPUT);
  pinMode(PIN_LED_Y, OUTPUT);
  pinMode(PIN_BUZZER, OUTPUT);
  pinMode(PIN_RELAY, OUTPUT);

#if HAS_GAS
  pinMode(PIN_GAS_A, INPUT);
  pinMode(PIN_GAS_D, INPUT);
#endif

#if HAS_MOTION
  pinMode(PIN_PIR, INPUT);
#endif

#if HAS_WATER
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
#endif

  set_led("green");
  digitalWrite(PIN_BUZZER, LOW);
  digitalWrite(PIN_RELAY, LOW);

  connect_wifi();
}

void loop()
{
  unsigned long now = millis();

  if (now - last_post >= POST_INTERVAL_MS)
  {
    last_post = now;
    send_reading();
  }

  apply_commands();
}

void connect_wifi()
{
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println(" OK");
  Serial.print("IP: ");
  Serial.println(WiFi.localIP());
}

int read_flame()
{
  return analogRead(PIN_FLAME);
}

#if HAS_GAS
int read_gas()
{
  return analogRead(PIN_GAS_A);
}
#endif

#if HAS_MOTION
bool read_motion()
{
  return digitalRead(PIN_PIR) == HIGH;
}
#endif

#if HAS_WATER
float read_water_pct()
{
  digitalWrite(PIN_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);

  long duration = pulseIn(PIN_ECHO, HIGH, 30000UL);
  if (duration == 0)
    return 0.0;

  float dist_cm = duration * 0.034 / 2.0;
  return constrain(100.0 - (dist_cm / 200.0 * 100.0), 0.0, 100.0);
}
#endif

const char *health_str(int raw, int lo, int hi)
{
  return (raw >= lo && raw <= hi) ? "ok" : "disconnected";
}

void send_reading()
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("WiFi down");
    return;
  }

  unsigned long now = millis();

  int flame = read_flame();
#if HAS_GAS
  int gas = (now - boot_ms < GAS_WARMUP_MS) ? 0 : read_gas();
#else
  int gas = 0;
#endif

#if HAS_WATER
  float pct = read_water_pct();
  int water = map((int)pct, 0, 100, 0, 4095);
#else
  int water = 0;
#endif

#if HAS_MOTION
  bool motion = read_motion();
#else
  bool motion = false;
#endif

  ++seq;

  StaticJsonDocument<512> doc;
  doc["zone_id"] = ZONE_ID;
  doc["seq"] = seq;
  doc["timestamp_ms"] = now;

  JsonObject s = doc.createNestedObject("sensors");
  s["flame_raw"] = flame;
  s["gas_raw"] = gas;
  s["water_raw"] = water;
  s["motion"] = motion;

  JsonObject h = doc.createNestedObject("sensor_health");
  h["flame"] = health_str(flame, 0, 4095);
  h["gas"] = (now - boot_ms < GAS_WARMUP_MS) ? "ok" : health_str(gas, 0, 4095);
  h["water"] = health_str(water, 0, 4095);
  h["motion"] = "ok";

  String body;
  serializeJson(doc, body);

  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  http.begin(client, BACKEND_HOST, 443, BACKEND_PATH, true);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Zone-Key", ZONE_API_KEY);

  int code = http.POST(body);

  if (code > 0)
  {
    String resp = http.getString();

    if (code == 200)
    {
      StaticJsonDocument<512> r;
      DeserializationError err = deserializeJson(r, resp);

      if (!err && r["success"] == true)
      {
        JsonObject d = r["data"];
        if (d["accepted"] == true)
        {
          cmd.led = d["commands"]["led"].as<String>();
          cmd.buzzer = d["commands"]["buzzer"];
          cmd.relay_cutoff = d["commands"]["relay_cutoff"];

          Serial.printf("seq=%u  state=%s  led=%s  buzzer=%d  relay=%d\n",
                        seq,
                        d["state"].as<const char *>(),
                        cmd.led.c_str(), cmd.buzzer, cmd.relay_cutoff);
        }
        else
        {
          Serial.printf("Rejected: %s\n", d["error"].as<const char *>());
        }
      }
      else
      {
        Serial.printf("Bad response: %s\n", resp.c_str());
      }
    }
    else
    {
      Serial.printf("HTTP %d: %s\n", code, resp.c_str());
    }
  }
  else
  {
    Serial.printf("WiFi: %d, seq: %u\n", WiFi.status(), seq);
    Serial.println("POST failed");
  }

  http.end();
}

void set_led(const String &color)
{
  digitalWrite(PIN_LED_R, LOW);
  digitalWrite(PIN_LED_G, LOW);
  digitalWrite(PIN_LED_Y, LOW);

  if (color == "red")
    digitalWrite(PIN_LED_R, HIGH);
  else if (color == "yellow")
    digitalWrite(PIN_LED_Y, HIGH);
  else if (color == "green")
    digitalWrite(PIN_LED_G, HIGH);
}

void apply_commands()
{
  set_led(cmd.led);

  if (cmd.relay_cutoff)
    digitalWrite(PIN_BUZZER, cmd.buzzer ? HIGH : LOW);
  else
    digitalWrite(PIN_BUZZER, LOW);

  digitalWrite(PIN_RELAY, cmd.relay_cutoff ? HIGH : LOW);
}

import time
import requests
import random

SERVER_URL = "http://localhost:5000/api/telemetry"

print("=" * 55)
print("  AgriPulse Edge IoT Sensor Node Simulator")
print("  Target Endpoint:", SERVER_URL)
print("=" * 55)

# Initial baseline readings
moisture = 42.0
nitrogen = 138
sulphur = 22
temperature = 28.2
humidity = 64
pump_active = False

while True:
    try:
        # Simulate physical dynamics
        if pump_active:
            # Pumping water increases moisture
            moisture += random.uniform(2.5, 4.0)
            if moisture >= 60.0:
                pump_active = False
                print(">> Moisture optimal (>= 60%). Simulated auto-pump shutoff.")
        else:
            # Evaporation / drying decreases moisture
            moisture -= random.uniform(0.8, 1.8)
            if moisture < 35.0:
                pump_active = True
                print(">> CRITICAL: Moisture dropped below 35%! Simulated auto-pump ON.")

        # Keep values clamped in realistic ranges
        moisture = max(20.0, min(75.0, round(moisture, 1)))
        temperature = round(27.0 + random.uniform(0.5, 2.5), 1)
        humidity = int(60 + random.randint(-4, 5))
        nitrogen = max(115, min(165, nitrogen + random.choice([-1, 0, 1])))

        payload = {
            "moisture": moisture,
            "nitrogen": nitrogen,
            "sulphur": sulphur,
            "temperature": temperature,
            "humidity": humidity,
            "pumpStatus": pump_active
        }

        # Send telemetry to Express Backend
        response = requests.post(SERVER_URL, json=payload, timeout=3)
        if response.status_code == 201:
            print(f"[INGEST OK] Moisture: {moisture}% | N: {nitrogen} mg/kg | Temp: {temperature}C | Pump: {'ON' if pump_active else 'OFF'}")
        else:
            print(f"[WARN] Gateway responded with status: {response.status_code}")

    except requests.exceptions.ConnectionError:
        print("[FAIL] Cannot connect to Backend on port 5000. Is server running?")
    except Exception as e:
        print(f"[ERROR] {e}")

    time.sleep(3)
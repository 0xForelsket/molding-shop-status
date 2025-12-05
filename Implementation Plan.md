Alright, let's build this thing. I'll break it down into phases.

---

## Phase 1: Bill of Materials

### Per Machine (×18)

| Item | Qty | Unit Cost | Notes |
|------|-----|-----------|-------|
| ESP32-WROOM-32 dev board | 1 | $5-8 | NodeMCU-32S or similar |
| 4-channel optocoupler module (PC817) | 1 | $1-2 | Isolates 24V from ESP32 |
| 1kΩ resistors | 3 | $0.10 | Current limiting for optocoupler LEDs |
| Small project enclosure | 1 | $3-5 | IP65 if near coolant/oil |
| 5V buck converter (mini) | 1 | $1-2 | MP1584 or similar, 24V→5V |
| Terminal blocks or Wago connectors | 1 set | $2 | Clean connections |
| Wire (22-24 AWG stranded) | ~3m | $1 | Signal runs to stack light |

**Per-machine cost: ~$15-25**

### Central System (×1)

| Item | Qty | Cost | Notes |
|------|-----|------|-------|
| Raspberry Pi 4 (2GB+) | 1 | $45-60 | Or any PC you have lying around |
| MicroSD card (32GB) | 1 | $8 | |
| 43-55" TV or monitor | 1 | $250-400 | Commercial preferred for brightness |
| WiFi access point (if needed) | 1 | $30-50 | Needs coverage across shop floor |

---

## Phase 2: Wiring Design

### Stack Light Basics

Your stack lights are almost certainly 24VDC. The tower typically has:
- **Common wire** (usually 24V+ or 0V, varies by manufacturer)
- **Individual wire per color** (red, yellow, green, sometimes blue/white)

You'll want to tap **green** (running) and probably **red** (fault). Yellow is usually "idle" which you can infer from the absence of green.

### Wiring Diagram

```
STACK LIGHT WIRING                         ESP32
─────────────────                         ──────

  24V Common ────────┬─────────────────────────────┐
                     │                             │
                     │    ┌──────────────────┐     │
  Green wire ────────┼───►│ 1kΩ    PC817    │     │
                     │    │  ┌─┐   ┌─────┐  │     │
                     │    └──┤R├───┤►│   ├──┼─────┼──► GPIO 34
                     │       └─┘   │ LED │  │     │
                     │             └─────┘  │     │
                     │                      │     │
  Red wire ──────────┼───►│ 1kΩ    PC817    │     │
                     │    │  ┌─┐   ┌─────┐  │     │
                     │    └──┤R├───┤►│   ├──┼─────┼──► GPIO 35
                     │       └─┘   │ LED │  │     │
                     │             └─────┘  │     │
  0V Common ─────────┴─────────────────────────────┴──► GND


  24V ──────► [Buck Converter 24V→5V] ──────► ESP32 VIN
  0V  ──────►                          ──────► ESP32 GND
```

### Key Points

1. **Find the common** - Use a multimeter to figure out if the stack light uses common-positive or common-negative. Measure between the common and each color wire when that light is on.

2. **Optocoupler wiring** - The PC817 module has an LED side (24V) and a transistor side (3.3V). The 1kΩ resistor limits current through the LED to ~20mA at 24V.

3. **ESP32 input pins** - Use GPIO 34, 35, 36, 39 (input-only pins) since you don't need output capability. Enable internal pullups or use the module's built-in pullups.

---

## Phase 3: ESP32 Firmware

```cpp
// machine_monitor.ino

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============== CONFIGURATION ==============
const char* WIFI_SSID = "YourPlantWiFi";
const char* WIFI_PASSWORD = "YourPassword";
const char* SERVER_URL = "http://192.168.1.100:8000/api/status";

// Unique ID for this machine - change for each ESP32
const int MACHINE_ID = 1;
const char* MACHINE_NAME = "Haitian 1";

// Pin assignments
const int PIN_GREEN = 34;  // Running
const int PIN_RED = 35;    // Fault

// Timing
const unsigned long SEND_INTERVAL_MS = 5000;      // Send update every 5 sec
const unsigned long CYCLE_DEBOUNCE_MS = 500;      // Debounce for cycle counting
const unsigned long WIFI_RETRY_INTERVAL = 30000;  // Retry WiFi every 30 sec

// ============== STATE ==============
bool lastGreenState = false;
bool lastRedState = false;
unsigned long lastSendTime = 0;
unsigned long lastCycleTime = 0;
unsigned long cycleCount = 0;
bool wifiConnected = false;

void setup() {
  Serial.begin(115200);
  
  pinMode(PIN_GREEN, INPUT);
  pinMode(PIN_RED, INPUT);
  
  connectWiFi();
}

void connectWiFi() {
  Serial.printf("Connecting to %s...\n", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.printf("\nConnected! IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    wifiConnected = false;
    Serial.println("\nWiFi connection failed, will retry...");
  }
}

String getStatus(bool green, bool red) {
  if (red) return "fault";
  if (green) return "running";
  return "idle";
}

void sendStatus(bool green, bool red) {
  if (WiFi.status() != WL_CONNECTED) {
    wifiConnected = false;
    return;
  }
  
  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<256> doc;
  doc["machine_id"] = MACHINE_ID;
  doc["machine_name"] = MACHINE_NAME;
  doc["status"] = getStatus(green, red);
  doc["green"] = green;
  doc["red"] = red;
  doc["cycle_count"] = cycleCount;
  doc["uptime_sec"] = millis() / 1000;
  
  String json;
  serializeJson(doc, json);
  
  int responseCode = http.POST(json);
  
  if (responseCode > 0) {
    Serial.printf("Sent: %s (response: %d)\n", json.c_str(), responseCode);
  } else {
    Serial.printf("Send failed: %s\n", http.errorToString(responseCode).c_str());
  }
  
  http.end();
}

void loop() {
  unsigned long now = millis();
  
  // Reconnect WiFi if needed
  if (!wifiConnected || WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWifiRetry = 0;
    if (now - lastWifiRetry > WIFI_RETRY_INTERVAL) {
      lastWifiRetry = now;
      connectWiFi();
    }
  }
  
  // Read current state (inverted because optocoupler pulls low when active)
  bool greenOn = digitalRead(PIN_GREEN) == LOW;
  bool redOn = digitalRead(PIN_RED) == LOW;
  
  // Detect cycle completion (green turning ON after being OFF)
  if (greenOn && !lastGreenState) {
    if (now - lastCycleTime > CYCLE_DEBOUNCE_MS) {
      cycleCount++;
      lastCycleTime = now;
      Serial.printf("Cycle detected! Total: %lu\n", cycleCount);
    }
  }
  
  // Send periodic updates OR on state change
  bool stateChanged = (greenOn != lastGreenState) || (redOn != lastRedState);
  bool timeToSend = (now - lastSendTime) >= SEND_INTERVAL_MS;
  
  if (stateChanged || timeToSend) {
    sendStatus(greenOn, redOn);
    lastSendTime = now;
  }
  
  lastGreenState = greenOn;
  lastRedState = redOn;
  
  delay(100);  // Poll at 10Hz
}
```

---

## Phase 4: Server Backend (FastAPI)

I'll give you a complete backend you can run on the Pi:

```python
# server/main.py

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional
import sqlite3
import json
from pathlib import Path
from contextlib import contextmanager

app = FastAPI(title="Machine Status Dashboard")

DB_PATH = "machine_status.db"

# ============== Database Setup ==============

def init_db():
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS machines (
                machine_id INTEGER PRIMARY KEY,
                machine_name TEXT,
                status TEXT DEFAULT 'offline',
                green INTEGER DEFAULT 0,
                red INTEGER DEFAULT 0,
                cycle_count INTEGER DEFAULT 0,
                last_seen TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS status_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                machine_id INTEGER,
                status TEXT,
                cycle_count INTEGER,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE INDEX IF NOT EXISTS idx_status_log_time 
                ON status_log(machine_id, timestamp);
        """)

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()

# ============== Models ==============

class StatusUpdate(BaseModel):
    machine_id: int
    machine_name: str
    status: str
    green: bool
    red: bool
    cycle_count: int
    uptime_sec: Optional[int] = 0

class MachineStatus(BaseModel):
    machine_id: int
    machine_name: str
    status: str
    green: bool
    red: bool
    cycle_count: int
    last_seen: Optional[str]
    seconds_since_seen: Optional[int]

# ============== API Endpoints ==============

@app.on_event("startup")
async def startup():
    init_db()

@app.post("/api/status")
async def update_status(update: StatusUpdate):
    """Receive status update from ESP32"""
    with get_db() as conn:
        # Upsert machine status
        conn.execute("""
            INSERT INTO machines (machine_id, machine_name, status, green, red, cycle_count, last_seen)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(machine_id) DO UPDATE SET
                machine_name = excluded.machine_name,
                status = excluded.status,
                green = excluded.green,
                red = excluded.red,
                cycle_count = excluded.cycle_count,
                last_seen = excluded.last_seen
        """, (
            update.machine_id,
            update.machine_name,
            update.status,
            int(update.green),
            int(update.red),
            update.cycle_count,
            datetime.now().isoformat()
        ))
        
        # Log status change
        conn.execute("""
            INSERT INTO status_log (machine_id, status, cycle_count)
            VALUES (?, ?, ?)
        """, (update.machine_id, update.status, update.cycle_count))
    
    return {"received": True}

@app.get("/api/machines")
async def get_all_machines():
    """Get current status of all machines"""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT machine_id, machine_name, status, green, red, cycle_count, last_seen
            FROM machines
            ORDER BY machine_id
        """).fetchall()
    
    machines = []
    now = datetime.now()
    
    for row in rows:
        last_seen = row["last_seen"]
        seconds_since = None
        status = row["status"]
        
        if last_seen:
            last_seen_dt = datetime.fromisoformat(last_seen)
            seconds_since = int((now - last_seen_dt).total_seconds())
            
            # Mark as offline if no update in 30 seconds
            if seconds_since > 30:
                status = "offline"
        
        machines.append({
            "machine_id": row["machine_id"],
            "machine_name": row["machine_name"],
            "status": status,
            "green": bool(row["green"]),
            "red": bool(row["red"]),
            "cycle_count": row["cycle_count"],
            "last_seen": last_seen,
            "seconds_since_seen": seconds_since
        })
    
    return machines

@app.get("/api/summary")
async def get_summary():
    """Get summary counts"""
    machines = await get_all_machines()
    
    return {
        "total": len(machines),
        "running": sum(1 for m in machines if m["status"] == "running"),
        "idle": sum(1 for m in machines if m["status"] == "idle"),
        "fault": sum(1 for m in machines if m["status"] == "fault"),
        "offline": sum(1 for m in machines if m["status"] == "offline"),
        "total_cycles": sum(m["cycle_count"] for m in machines)
    }

# Serve dashboard
@app.get("/", response_class=HTMLResponse)
async def dashboard():
    return Path("static/dashboard.html").read_text()

app.mount("/static", StaticFiles(directory="static"), name="static")
```

---

## Phase 5: Dashboard Frontend

```html
<!-- server/static/dashboard.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Machine Status Dashboard</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background: #1a1a2e;
            color: #eee;
            min-height: 100vh;
            padding: 20px;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 2px solid #333;
        }
        
        .header h1 {
            font-size: 2rem;
            font-weight: 600;
        }
        
        .summary {
            display: flex;
            gap: 20px;
            font-size: 1.2rem;
        }
        
        .summary-item {
            padding: 8px 16px;
            border-radius: 8px;
            background: #252542;
        }
        
        .summary-item.running { border-left: 4px solid #22c55e; }
        .summary-item.idle { border-left: 4px solid #eab308; }
        .summary-item.fault { border-left: 4px solid #ef4444; }
        .summary-item.offline { border-left: 4px solid #6b7280; }
        
        .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
        }
        
        .machine-card {
            background: #252542;
            border-radius: 12px;
            padding: 20px;
            text-align: center;
            transition: transform 0.2s, box-shadow 0.2s;
            border: 3px solid transparent;
        }
        
        .machine-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }
        
        .machine-card.running {
            border-color: #22c55e;
            background: linear-gradient(135deg, #252542 0%, #1a3a1a 100%);
        }
        
        .machine-card.idle {
            border-color: #eab308;
            background: linear-gradient(135deg, #252542 0%, #3a3a1a 100%);
        }
        
        .machine-card.fault {
            border-color: #ef4444;
            background: linear-gradient(135deg, #252542 0%, #3a1a1a 100%);
            animation: pulse-fault 1.5s infinite;
        }
        
        .machine-card.offline {
            border-color: #6b7280;
            opacity: 0.6;
        }
        
        @keyframes pulse-fault {
            0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
            50% { box-shadow: 0 0 20px 10px rgba(239, 68, 68, 0.2); }
        }
        
        .machine-name {
            font-size: 1.3rem;
            font-weight: 600;
            margin-bottom: 10px;
        }
        
        .machine-status {
            font-size: 1.1rem;
            text-transform: uppercase;
            font-weight: 500;
            margin-bottom: 8px;
        }
        
        .running .machine-status { color: #22c55e; }
        .idle .machine-status { color: #eab308; }
        .fault .machine-status { color: #ef4444; }
        .offline .machine-status { color: #6b7280; }
        
        .cycle-count {
            font-size: 0.9rem;
            color: #aaa;
        }
        
        .last-update {
            font-size: 0.75rem;
            color: #666;
            margin-top: 8px;
        }
        
        .clock {
            font-size: 1.5rem;
            font-weight: 300;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Injection Molding - Machine Status</h1>
        <div class="summary" id="summary">
            <div class="summary-item running"><span id="running-count">0</span> Running</div>
            <div class="summary-item idle"><span id="idle-count">0</span> Idle</div>
            <div class="summary-item fault"><span id="fault-count">0</span> Fault</div>
            <div class="summary-item offline"><span id="offline-count">0</span> Offline</div>
        </div>
        <div class="clock" id="clock"></div>
    </div>
    
    <div class="grid" id="machine-grid"></div>

    <script>
        function updateClock() {
            const now = new Date();
            document.getElementById('clock').textContent = 
                now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }
        
        function formatLastSeen(seconds) {
            if (seconds === null) return 'Never';
            if (seconds < 10) return 'Just now';
            if (seconds < 60) return `${seconds}s ago`;
            if (seconds < 3600) return `${Math.floor(seconds/60)}m ago`;
            return `${Math.floor(seconds/3600)}h ago`;
        }
        
        async function fetchAndRender() {
            try {
                const [machines, summary] = await Promise.all([
                    fetch('/api/machines').then(r => r.json()),
                    fetch('/api/summary').then(r => r.json())
                ]);
                
                // Update summary
                document.getElementById('running-count').textContent = summary.running;
                document.getElementById('idle-count').textContent = summary.idle;
                document.getElementById('fault-count').textContent = summary.fault;
                document.getElementById('offline-count').textContent = summary.offline;
                
                // Update grid
                const grid = document.getElementById('machine-grid');
                grid.innerHTML = machines.map(m => `
                    <div class="machine-card ${m.status}">
                        <div class="machine-name">${m.machine_name}</div>
                        <div class="machine-status">${m.status}</div>
                        <div class="cycle-count">Cycles: ${m.cycle_count.toLocaleString()}</div>
                        <div class="last-update">${formatLastSeen(m.seconds_since_seen)}</div>
                    </div>
                `).join('');
                
            } catch (err) {
                console.error('Failed to fetch:', err);
            }
        }
        
        // Initial load
        updateClock();
        fetchAndRender();
        
        // Refresh every 2 seconds
        setInterval(fetchAndRender, 2000);
        setInterval(updateClock, 1000);
    </script>
</body>
</html>
```

---

## Phase 6: Raspberry Pi Setup

```bash
# On the Raspberry Pi

# 1. Update and install dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip python3-venv -y

# 2. Create project directory
mkdir ~/machine-dashboard && cd ~/machine-dashboard

# 3. Set up virtual environment
python3 -m venv venv
source venv/bin/activate

# 4. Install Python packages
pip install fastapi uvicorn[standard] pydantic

# 5. Create directory structure
mkdir -p server/static

# 6. Copy main.py to server/ and dashboard.html to server/static/

# 7. Run the server
cd server
uvicorn main:app --host 0.0.0.0 --port 8000

# 8. (Optional) Set up as systemd service for auto-start
sudo nano /etc/systemd/system/machine-dashboard.service
```

Systemd service file:
```ini
[Unit]
Description=Machine Status Dashboard
After=network.target

[Service]
User=pi
WorkingDirectory=/home/pi/machine-dashboard/server
Environment="PATH=/home/pi/machine-dashboard/venv/bin"
ExecStart=/home/pi/machine-dashboard/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl enable machine-dashboard
sudo systemctl start machine-dashboard
```

---

## Phase 7: Installation Sequence

### Week 1: Pilot (2-3 machines)
1. Order parts for 3 machines + central system
2. Build and flash one ESP32 on your bench with test LEDs
3. Set up Pi and verify server works
4. Pick 2-3 machines for pilot install
5. Trace stack light wiring, identify common and color wires
6. Install and validate

### Week 2-3: Rollout
7. Order remaining parts
8. Build remaining ESP32 units (assembly line style)
9. Install in batches of 4-5 machines
10. Update `MACHINE_ID` and `MACHINE_NAME` for each unit before flashing

---

## Gotchas to Watch For

1. **Stack light wiring polarity** - Some towers use common-positive, others common-negative. Check with a meter first.

2. **WiFi dead spots** - Walk the floor with your phone and check signal. You may need an access point.

3. **Power source** - If 24V isn't convenient, you can use a small USB power adapter per machine instead.

4. **Unique machine IDs** - Don't forget to change `MACHINE_ID` when flashing each ESP32. Easy to miss.

5. **ESP32 input pins** - GPIO 34/35/36/39 are input-only but don't have internal pull-ups. The optocoupler module usually has external pull-ups, but verify.

---

Want me to put together a shopping list you can order from, or dive deeper into any particular section?
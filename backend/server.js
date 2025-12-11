require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const mqtt = require('mqtt');
const cors = require('cors');
const path = require('path');
const db = require('./dataManager');

// --- CONFIGURATION ---
const PORT = process.env.PORT || 8080;
const MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://test.mosquitto.org'; 
const MQTT_TOPIC_TELEMETRY = 'manuscript_ai/+/telemetry';
const MQTT_TOPIC_LOGS = 'manuscript_ai/+/logs';

// --- 1. EXPRESS SERVER ---
const app = express();
app.use(cors());
app.use(express.json());

const buildPath = path.join(__dirname, '../dist');
if (require('fs').existsSync(buildPath)) {
    app.use(express.static(buildPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(buildPath, 'index.html'));
    });
} else {
    app.get('/', (req, res) => res.send('ManuScript.ai Backend Running'));
}

const server = http.createServer(app);

// --- 2. WEBSOCKET SERVER ---
const wss = new WebSocket.Server({ server });

function broadcast(type, payload) {
    const msg = JSON.stringify({ type, payload });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(msg);
        }
    });
}

wss.on('connection', (ws) => {
    console.log('[Client] Dashboard Connected');
    
    // Send Snapshot (Machines + Recent Alerts)
    ws.send(JSON.stringify({ 
        type: 'INIT', 
        payload: { 
            machines: db.getMachines(),
            recentAlerts: db.getAlerts().slice(0, 50) 
        } 
    }));

    ws.on('message', (messageStr) => {
        // Heartbeat Response
        if (messageStr.toString() === 'ping') {
            ws.send('pong');
            return;
        }

        try {
            const msg = JSON.parse(messageStr);
            if (msg.type === 'REGISTER_MACHINE') {
                db.upsertMachine(msg.payload.id, msg.payload);
                broadcast('INIT', { machines: db.getMachines(), recentAlerts: db.getAlerts().slice(0, 50) }); 
            }
        } catch (e) {
            console.error("WS Message Error:", e.message);
        }
    });
});

// --- 3. MQTT CLIENT ---
console.log(`[System] Connecting to Industrial Broker at ${MQTT_BROKER}...`);
const mqttClient = mqtt.connect(MQTT_BROKER);

mqttClient.on('connect', () => {
    console.log('✅ [MQTT] Connected to Machinery Grid');
    mqttClient.subscribe(MQTT_TOPIC_TELEMETRY);
    mqttClient.subscribe(MQTT_TOPIC_LOGS);
});

mqttClient.on('message', (topic, messageBuffer) => {
    const messageStr = messageBuffer.toString();
    const parts = topic.split('/');
    const machineId = parts[1]; 
    const dataType = parts[2];

    try {
        const payload = JSON.parse(messageStr);

        // Auto-Discovery
        const knownMachine = db.getMachines().find(m => m.id === machineId);
        if (!knownMachine) {
            db.upsertMachine(machineId, { 
                name: payload.machineName || `Device ${machineId}`,
                type: 'Auto-Detected Asset'
            });
            broadcast('INIT', { machines: db.getMachines(), recentAlerts: [] });
        }
        
        if (dataType === 'telemetry') {
            const status = determineStatus(payload);
            
            const reading = {
                timestamp: Date.now(),
                vibration: Number(payload.vibration),
                temperature: Number(payload.temperature),
                noise: Number(payload.noise),
                rpm: Number(payload.rpm),
                powerUsage: Number(payload.power || payload.powerUsage)
            };

            db.addReading(machineId, reading);

            // ACTIVE MONITORING: Check for status change
            if (knownMachine && knownMachine.status !== status) {
                db.upsertMachine(machineId, { status });
                
                // If status worsens, AUTO-GENERATE ALERT
                if (status !== 'NORMAL' && knownMachine.status === 'NORMAL') {
                    console.log(`[Alert] ${machineId} escalated to ${status}`);
                    const autoAlert = {
                        id: `auto-${Date.now()}-${machineId}`,
                        machineId: machineId,
                        machineName: knownMachine.name,
                        timestamp: Date.now(),
                        severity: status === 'CRITICAL' ? 'high' : 'medium',
                        message: `System Watchdog: ${status} anomaly detected. Vibration: ${reading.vibration.toFixed(2)}mm/s, Temp: ${reading.temperature.toFixed(1)}°C.`,
                        value: reading.vibration
                    };
                    db.addAlert(autoAlert);
                    broadcast('ALERT', autoAlert);
                }
            }
            
            broadcast('TELEMETRY', {
                machineId: machineId,
                status: status,
                reading: reading
            });
        } 
        else if (dataType === 'logs') {
            const alert = {
                id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                machineId: machineId,
                machineName: payload.machineName || knownMachine?.name || machineId,
                timestamp: Date.now(),
                severity: payload.severity || 'medium',
                message: payload.message
            };
            
            db.addAlert(alert);
            broadcast('ALERT', alert);
        }

    } catch (e) {
        // Ignore bad packets
    }
});

// Threshold Logic
function determineStatus(data) {
    if (data.vibration > 8.5 || data.temperature > 95) return 'CRITICAL';
    if (data.vibration > 5.5 || data.temperature > 82) return 'WARNING';
    return 'NORMAL';
}

server.listen(PORT, () => {
    console.log(`🚀 ManuScript.ai Backend Ready on Port ${PORT}`);
});
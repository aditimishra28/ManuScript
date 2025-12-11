const mqtt = require('mqtt');

// --- SIMULATION CONFIG ---
const BROKER = 'mqtt://test.mosquitto.org';
const SIMULATED_MACHINES = [
    { id: 'cnc_01', name: 'CNC Mill - Axis X' },
    { id: 'pump_04', name: 'Coolant Pump B' },
    { id: 'arm_07', name: 'Robotic Welder' }
];

console.log(`[Simulator] Initializing fleet of ${SIMULATED_MACHINES.length} machines...`);
const client = mqtt.connect(BROKER);

client.on('connect', () => {
    console.log(`[Simulator] Connected. Starting Sensor & Camera streams...`);

    SIMULATED_MACHINES.forEach(machine => {
        // 1. Telemetry Stream
        setInterval(() => sendTelemetry(machine), 2000 + Math.random() * 1000);

        // 2. Random Faults
        setInterval(() => sendRandomFault(machine), 45000 + Math.random() * 20000);

        // 3. Vision System Events (Simulating a camera finding defects)
        setInterval(() => sendVisionEvent(machine), 60000 + Math.random() * 30000);
    });
});

function sendTelemetry(machine) {
    const t = Date.now() / 1000;
    
    let vibration = 2.0 + Math.sin(t) + (Math.random() * 0.5);
    let temp = 65 + (Math.sin(t * 0.1) * 5);
    
    // Spike injection
    if (Math.random() > 0.98) vibration += 6.0; 
    if (Math.random() > 0.99) temp += 15.0;     

    const data = {
        machineName: machine.name,
        vibration: Math.abs(vibration), 
        temperature: temp,
        noise: 80 + Math.random() * 5,
        rpm: 1200 + Math.random() * 50,
        powerUsage: 45 + Math.random() * 2
    };

    client.publish(`manuscript_ai/${machine.id}/telemetry`, JSON.stringify(data));
    process.stdout.write(`.`);
}

function sendRandomFault(machine) {
    const faults = [
        "Hydraulic pressure variant detected",
        "Bearing frequency resonance: 400Hz",
        "Software timeout in controller",
        "Voltage sag on Phase B",
        "Excessive thermal load on motor"
    ];
    const isSevere = Math.random() > 0.7;
    const fault = faults[Math.floor(Math.random() * faults.length)];

    const payload = {
        machineName: machine.name,
        severity: isSevere ? 'high' : 'medium',
        message: isSevere ? `CRITICAL: ${fault}` : `WARNING: ${fault}`
    };

    console.log(`\n[Simulator] 🔥 Fault on ${machine.id}: ${fault}`);
    client.publish(`manuscript_ai/${machine.id}/logs`, JSON.stringify(payload));
}

function sendVisionEvent(machine) {
    // Simulates a smart camera processing a frame and finding an issue
    const visualDefects = [
        "Vision System: Hairline crack detected on outer casing",
        "Vision System: Coolant leak pool detected (Confidence: 89%)",
        "Vision System: Component misalignment > 3mm",
        "Vision System: Rust formation on primary joint"
    ];
    
    const defect = visualDefects[Math.floor(Math.random() * visualDefects.length)];
    
    const payload = {
        machineName: machine.name,
        severity: 'medium',
        message: defect,
        source: 'smart_camera_v2'
    };

    console.log(`\n[Simulator] 📷 Camera Alert on ${machine.id}`);
    client.publish(`manuscript_ai/${machine.id}/logs`, JSON.stringify(payload));
}
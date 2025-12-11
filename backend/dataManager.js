const fs = require('fs-extra');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const MACHINES_FILE = path.join(DATA_DIR, 'machines.json');
const ALERTS_FILE = path.join(DATA_DIR, 'alerts.json');

// Ensure data directory exists
fs.ensureDirSync(DATA_DIR);

// Initialize files if they don't exist
if (!fs.existsSync(MACHINES_FILE)) fs.writeJsonSync(MACHINES_FILE, []);
if (!fs.existsSync(ALERTS_FILE)) fs.writeJsonSync(ALERTS_FILE, []);

class DataManager {
    constructor() {
        try {
            this.machines = fs.readJsonSync(MACHINES_FILE);
            this.alerts = fs.readJsonSync(ALERTS_FILE);
        } catch (e) {
            console.error("[Storage] Corrupt DB detected, resetting...", e);
            this.machines = [];
            this.alerts = [];
        }
        
        this.dirty = false;
        
        // Lazy Save Strategy: Only write to disk every 5 seconds if data changed.
        setInterval(() => {
            if (this.dirty) {
                this.saveMachines();
                this.dirty = false;
            }
        }, 5000);

        console.log(`[Storage] System Boot: Loaded ${this.machines.length} machines and ${this.alerts.length} historical alerts.`);
    }

    getMachines() {
        return this.machines;
    }

    getAlerts() {
        return this.alerts;
    }

    saveMachines() {
        fs.writeJson(MACHINES_FILE, this.machines, { spaces: 2 }).catch(console.error);
    }

    saveAlerts() {
        // Cap alerts at 1000
        if (this.alerts.length > 1000) {
            this.alerts = this.alerts.slice(0, 1000);
        }
        fs.writeJson(ALERTS_FILE, this.alerts, { spaces: 2 }).catch(console.error);
    }

    upsertMachine(id, partialData) {
        let machine = this.machines.find(m => m.id === id);
        
        if (machine) {
            Object.assign(machine, partialData);
        } else {
            machine = {
                id,
                name: partialData.name || `Device ${id}`,
                type: partialData.type || 'Unknown Asset',
                location: 'Unassigned',
                status: 'NORMAL',
                lastMaintenance: new Date().toISOString(),
                history: [],
                imageUrl: 'https://picsum.photos/800/600',
                ...partialData
            };
            this.machines.push(machine);
            console.log(`[Storage] New Asset Discovered: ${id}`);
        }
        
        this.dirty = true;
        return machine;
    }

    addReading(machineId, reading) {
        const machine = this.machines.find(m => m.id === machineId);
        if (machine) {
            if (!Array.isArray(machine.history)) machine.history = [];
            
            machine.history.push(reading);
            
            // Rolling Buffer: Increased to 300 (approx 10 mins @ 2s rate) 
            // to support immediate trend analysis on frontend load.
            if (machine.history.length > 300) {
                machine.history.shift();
            }
            
            this.dirty = true;
        }
    }

    addAlert(alert) {
        this.alerts.unshift(alert);
        this.saveAlerts(); 
    }
}

module.exports = new DataManager();
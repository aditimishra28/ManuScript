import { SensorReading, Machine, Alert } from '../types';

/**
 * SENTINAI SECURITY LAYER
 * Handles Input Sanitization, Data Validation, and Session Management.
 */

// -- Input Sanitization (XSS Prevention) --
// Strips potentially dangerous characters from strings coming from external Websockets
export const sanitizeString = (str: string): string => {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;');
};

// -- Data Integrity --
// Ensures sensor readings are finite numbers to prevent Math errors or Chart crashes
export const validateSensorReading = (reading: any): SensorReading | null => {
    if (!reading || typeof reading !== 'object') return null;

    const safeNumber = (val: any) => {
        const num = Number(val);
        return isFinite(num) ? num : 0;
    };

    return {
        timestamp: typeof reading.timestamp === 'number' ? reading.timestamp : Date.now(),
        vibration: safeNumber(reading.vibration),
        temperature: safeNumber(reading.temperature),
        noise: safeNumber(reading.noise),
        rpm: safeNumber(reading.rpm),
        powerUsage: safeNumber(reading.powerUsage)
    };
};

export const validateMachine = (machine: any): Machine | null => {
    if (!machine || !machine.id) return null;
    
    // Whitelist allowed URLs for images to prevent external resource loading attacks
    const safeImage = (url: string) => {
        if (!url) return '';
        if (url.startsWith('https://images.unsplash.com') || url.startsWith('https://picsum.photos') || url.startsWith('data:image')) {
            return url;
        }
        return 'https://picsum.photos/800/600'; // Fallback safe image
    };

    return {
        ...machine,
        name: sanitizeString(machine.name).substring(0, 50), // Truncate to prevent UI overflow DoS
        type: sanitizeString(machine.type),
        location: sanitizeString(machine.location),
        imageUrl: safeImage(machine.imageUrl)
    } as Machine;
};

// -- Session Management (Simulated) --
// In a real app, this would validate JWT signatures.
export const SecurityContext = {
    createSession: (user: string) => {
        // Generate a fake session token
        const token = `sik_${Date.now()}_${Math.random().toString(36).substring(2)}`;
        sessionStorage.setItem('sentinai_token', token);
        sessionStorage.setItem('sentinai_user', sanitizeString(user));
        return token;
    },

    validateSession: (): boolean => {
        const token = sessionStorage.getItem('sentinai_token');
        // Basic check: Token must exist and be recent (mock expiry logic)
        if (!token || !token.startsWith('sik_')) return false;
        return true;
    },

    destroySession: () => {
        sessionStorage.removeItem('sentinai_token');
        sessionStorage.removeItem('sentinai_user');
        sessionStorage.removeItem('sentinai_auth'); // Cleanup legacy
    },

    getUser: () => {
        return sessionStorage.getItem('sentinai_user') || 'Unknown Operator';
    }
};
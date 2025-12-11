import { SensorReading, Machine, Alert } from '../types';

/**
 * MANUSCRIPT.AI SECURITY LAYER
 * Handles Input Sanitization, Data Validation, and Session Management.
 */

// -- Constants for Storage Keys --
const STORAGE_KEY_USERS = 'manuscript_ai_users_db';
const STORAGE_KEY_TOKEN = 'manuscript_ai_token';
const STORAGE_KEY_USER_INFO = 'manuscript_ai_user_info';

// -- Input Sanitization (XSS Prevention) --
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
    
    const safeImage = (url: string) => {
        if (!url) return '';
        if (url.startsWith('https://images.unsplash.com') || url.startsWith('https://picsum.photos') || url.startsWith('data:image')) {
            return url;
        }
        return 'https://picsum.photos/800/600'; 
    };

    return {
        ...machine,
        name: sanitizeString(machine.name).substring(0, 50),
        type: sanitizeString(machine.type),
        location: sanitizeString(machine.location),
        imageUrl: safeImage(machine.imageUrl)
    } as Machine;
};

// -- Auth & Session Management --

// Initialize Mock DB if empty
const initMockDB = () => {
    if (!localStorage.getItem(STORAGE_KEY_USERS)) {
        const defaultUsers = [
            { email: 'demo@manuscript.ai', password: 'demo123', name: 'Demo Operator', role: 'Admin' }
        ];
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(defaultUsers));
    }
};

export const SecurityContext = {
    
    // Create a new user in the local mock DB
    register: (email: string, password: string, name: string) => {
        initMockDB();
        const users = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
        
        // Check if user exists
        if (users.find((u: any) => u.email === email)) {
            return { success: false, message: 'Account already exists for this email.' };
        }

        const newUser = { 
            email, 
            password, // In a real app, this MUST be hashed (e.g. bcrypt)
            name: sanitizeString(name),
            role: 'Operator'
        };
        
        users.push(newUser);
        localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
        return { success: true };
    },

    // Authenticate user
    login: (email: string, password: string, rememberMe: boolean) => {
        initMockDB();
        const users = JSON.parse(localStorage.getItem(STORAGE_KEY_USERS) || '[]');
        const user = users.find((u: any) => u.email === email && u.password === password);

        if (user) {
            // Generate Session Token
            const token = `mai_${Date.now()}_${Math.random().toString(36).substring(2)}`;
            const userInfo = JSON.stringify({ name: user.name, email: user.email, role: user.role });

            // Store in requested storage medium
            const storage = rememberMe ? localStorage : sessionStorage;
            
            // Clear opposite storage to prevent conflicts
            (rememberMe ? sessionStorage : localStorage).removeItem(STORAGE_KEY_TOKEN);
            (rememberMe ? sessionStorage : localStorage).removeItem(STORAGE_KEY_USER_INFO);

            storage.setItem(STORAGE_KEY_TOKEN, token);
            storage.setItem(STORAGE_KEY_USER_INFO, userInfo);
            
            return { success: true, token };
        }
        
        return { success: false, message: 'Invalid credentials' };
    },

    // Check if a valid session exists
    validateSession: (): boolean => {
        const token = sessionStorage.getItem(STORAGE_KEY_TOKEN) || localStorage.getItem(STORAGE_KEY_TOKEN);
        if (!token || !token.startsWith('mai_')) return false;
        return true;
    },

    // Get current user details
    getUser: () => {
        const userStr = sessionStorage.getItem(STORAGE_KEY_USER_INFO) || localStorage.getItem(STORAGE_KEY_USER_INFO);
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch (e) {
                return { name: 'Unknown Operator', role: 'Guest' };
            }
        }
        return { name: 'Guest', role: 'Viewer' };
    },

    // Logout
    destroySession: () => {
        sessionStorage.removeItem(STORAGE_KEY_TOKEN);
        sessionStorage.removeItem(STORAGE_KEY_USER_INFO);
        localStorage.removeItem(STORAGE_KEY_TOKEN);
        localStorage.removeItem(STORAGE_KEY_USER_INFO);
    }
};
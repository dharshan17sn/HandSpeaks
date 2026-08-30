// ============================================================
//  API Configuration
//  Change BACKEND_URL to your Render deployment URL after deploy
// ============================================================
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://127.0.0.1:5000'
    : 'https://handspeaks.onrender.com';  // Render backend URL

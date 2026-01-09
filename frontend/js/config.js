/**
 * Configuration for Bootcamp Management Intelligence Service
 *
 * Define global constants and API endpoints settings here.
 */

const CONFIG = {
  // Current Environment: 'mock', 'production', or 'mock-hybrid'
  // 'mock-hybrid': Try API first, fallback to mock if failed.
  ENV: "production",

  // API Base URLs
  API: {
    // Local Backend (FastAPI/Node.js)
    DEV_BASE_URL: "http://localhost:8080/api",

    // Helper to get current URL
    get BASE_URL() {
      return this.DEV_BASE_URL; // Set this to PROD_BASE_URL for deployment
    },
  },

  // Feature Flags
  FEATURES: {
    USE_MOCK_DATA: true, // If true, uses js/data.js instead of real API
    ENABLE_AI_SIM: true, // Enable frontend-side AI simulation
  },
};

console.log(`[Config] Service initialized in ${CONFIG.ENV} mode.`);

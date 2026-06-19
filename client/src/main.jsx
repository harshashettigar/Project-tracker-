import React from 'react';
import ReactDOM from 'react-dom/client';
// Self-hosted IBM Plex Sans (the design typeface). Bundled at build time so it
// renders identically on every machine and needs no runtime font CDN — the
// office network blocks outbound CDNs and end-user Windows boxes don't ship the
// font, so naming it in CSS alone silently fell back to Segoe UI.
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans/latin-700.css';
import App from './App.jsx';
import { AuthProvider } from './auth/AuthProvider.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);

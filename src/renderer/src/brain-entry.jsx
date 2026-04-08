import React from 'react';
import ReactDOM from 'react-dom/client';
import BrainOnboarding from './components/brain/BrainOnboarding/BrainOnboarding';
import GlobalStatusLoader from './components/shared/GlobalStatusLoader/GlobalStatusLoader';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrainOnboarding />
    <GlobalStatusLoader />
  </React.StrictMode>
);

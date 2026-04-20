import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DatapathLayoutWorkbench } from './components/datapath/DatapathLayoutWorkbench';
import './styles.css';

const searchParams = new URLSearchParams(window.location.search);
const renderLayoutWorkbench = searchParams.get('layout') === 'workbench';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {renderLayoutWorkbench ? <DatapathLayoutWorkbench /> : <App />}
  </React.StrictMode>
);

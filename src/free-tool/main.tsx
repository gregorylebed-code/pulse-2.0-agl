import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import FreeTool from './FreeTool';

createRoot(document.getElementById('free-tool-root')!).render(
  <StrictMode>
    <FreeTool />
  </StrictMode>
);

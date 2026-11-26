import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { initPwa } from './services/pwaServiceWorker';

createRoot(document.getElementById('root')!).render(<App />);

// Service Worker: registro, detecção de atualização e estado offline.
void initPwa();

// O alerta sonoro é inicializado apenas no app autenticado (ver App.tsx),
// para o portal público não baixar o áudio de 162 KB sem necessidade.

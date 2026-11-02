import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { startAutoUpdate } from './utils/autoUpdate';

startAutoUpdate();

createRoot(document.getElementById('root')!).render(<App />);

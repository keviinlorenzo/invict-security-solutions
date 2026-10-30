import { analyzeReceiptHandler } from '../../lib/aiHandlers.js';

export default function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return analyzeReceiptHandler(req, res);
}

import { cloudSyncHandler } from '../lib/syncHandler.js';

export default function handler(req: any, res: any) {
  return cloudSyncHandler(req, res);
}

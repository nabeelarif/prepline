import type { AuthService } from '../auth/types';
import type { AppRepository } from '../repositories/types';
import type { PlanSharingRepository } from '../repositories/sharing';

/** What the app is wired to. Built in one place: `backend/index.ts`. */
export interface Backend {
  repo: AppRepository;
  sharing: PlanSharingRepository;
  auth: AuthService;
}

import type { AuthService } from '../auth/types';
import type { AppRepository } from '../repositories/types';

/** What the app is wired to. Built in one place: `backend/index.ts`. */
export interface Backend {
  repo: AppRepository;
  auth: AuthService;
}

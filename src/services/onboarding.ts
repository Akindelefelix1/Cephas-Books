import { authorizedRequest } from './auth';

export const onboardingSteps = ['business', 'financial', 'structure', 'tax', 'team'] as const;
export type OnboardingStep = (typeof onboardingSteps)[number];

export interface OnboardingProgress {
  onboardingData: Partial<Record<OnboardingStep, Record<string, string>>>;
  onboardingStep: number;
  onboardingCompletedAt: string | null;
}

export const onboardingApi = {
  get: () => authorizedRequest<OnboardingProgress>('/organizations/current/onboarding'),
  saveStep: (step: OnboardingStep, data: Record<string, string>) =>
    authorizedRequest<OnboardingProgress>(`/organizations/current/onboarding/${step}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  complete: () =>
    authorizedRequest<OnboardingProgress>('/organizations/current/onboarding/complete', {
      method: 'PATCH',
    }),
};

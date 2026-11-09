export const ONBOARDING_KEY = 'inkmind.onboarding.v1';

export function shouldShowOnboarding(storage: Pick<Storage, 'getItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): boolean {
  try {
    return storage?.getItem(ONBOARDING_KEY) !== 'dismissed';
  } catch {
    return true;
  }
}

export function dismissOnboarding(storage: Pick<Storage, 'setItem'> | null = typeof localStorage === 'undefined' ? null : localStorage): void {
  try {
    storage?.setItem(ONBOARDING_KEY, 'dismissed');
  } catch {
    /* ignore */
  }
}

export const PERSONALIZE_WIZARD_EVENT = 'dotlearn:open-personalize-wizard';

export const openPersonalizeWizard = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(PERSONALIZE_WIZARD_EVENT));
};

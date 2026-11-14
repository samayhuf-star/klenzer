import { formatBytes } from './format';

export const RD_SHEET_COPY = {
  headline: (bytes: number) => `${formatBytes(bytes)} is in Recently Deleted. Empty it to free the space now.`,
  stepsTitle: 'In the Photos app',
  steps: 'Albums > Recently Deleted > Select > Delete All',
  open: 'Open Photos',
  later: 'Later',
  dontShow: "Don't show again",
};

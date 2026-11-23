/** One-shot hand-off from the last onboarding screen to Home, which mounts only after onboarding ends. */
let openPlans = false;

export function requestPlansAfterOnboarding(): void {
  openPlans = true;
}

/** True once, if the user chose See plans on the last onboarding screen. */
export function consumePlansAfterOnboarding(): boolean {
  const wanted = openPlans;
  openPlans = false;
  return wanted;
}

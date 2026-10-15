// Klenzer only schedules local notifications. expo-notifications adds the push
// (aps-environment) entitlement automatically, which needs a push-enabled provisioning
// profile and an APNs capability the app does not use. Strip it.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults['aps-environment'];
    return cfg;
  });
};

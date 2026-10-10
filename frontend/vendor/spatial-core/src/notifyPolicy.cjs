/**
 * Notification policy is separate from monitoring. This stub decides that
 * nothing is sent. A later policy can replace the decision without fetching
 * providers or writing observations.
 */
function decideNotification(observation, policy) {
  return {
    notify: false,
    reason: "notification_policy_stub",
    provider: observation && observation.provider ? observation.provider : null,
    channel: policy && typeof policy.channel === "string" ? policy.channel : null,
  };
}

module.exports = {
  decideNotification,
};

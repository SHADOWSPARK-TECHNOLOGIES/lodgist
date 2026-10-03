const STATUS_TEXT = {
  REQUESTED: "Waiting for a response. This is not a confirmed viewing.",
  SCHEDULED: "Accepted for the requested time. Walk the house before you send rent.",
  CANCELLED: "This request was declined or cancelled.",
  COMPLETED: "This viewing is marked complete.",
  NO_SHOW: "This viewing was marked as a no-show.",
};

function viewingStatusText(status) {
  if (typeof status !== "string" || !STATUS_TEXT[status]) {
    return "Status is not one Lodgist explains yet.";
  }
  return STATUS_TEXT[status];
}

module.exports = { viewingStatusText };

function normalizeStatus(value) {
  return String(value || "available").trim().toLowerCase();
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function profileIsOnPto(profile, now = new Date()) {
  const status = normalizeStatus(profile.availability_status ?? profile.status);
  if (status !== "pto") {
    return false;
  }

  const from = parseDate(profile.pto_from);
  const to = parseDate(profile.pto_to);

  if (!from || !to) {
    return true;
  }

  return now >= from && now <= to;
}

function profileCanHandleDepartment(profile, department) {
  const role = String(profile.role || "");
  const permissions = Array.isArray(profile.permissions) ? profile.permissions : [];

  if (role === "super_admin") {
    return true;
  }

  if (department === "facilities") {
    return role === "facilities";
  }

  if (department === "finance") {
    return role === "finance";
  }

  if (department === "leasing") {
    return role === "leasing_manager";
  }

  if (department === "operations") {
    return role === "mall_manager" || permissions.includes("assign_tasks");
  }

  return permissions.includes("create_tasks") || permissions.includes("assign_tasks");
}

export function findAssignableProfiles(profiles, department) {
  return profiles.filter((profile) => {
    const active = profile.is_active !== false;
    return active && profileCanHandleDepartment(profile, department) && !profileIsOnPto(profile);
  });
}

export function chooseTaskAssignee({ requestedAssigneeId, profiles, tasks, department }) {
  if (requestedAssigneeId) {
    const matched = profiles.find((profile) => profile.id === requestedAssigneeId);

    if (!matched) {
      throw new Error("The selected assignee could not be found.");
    }

    if (profileIsOnPto(matched)) {
      const from = matched.pto_from ? new Date(matched.pto_from).toLocaleDateString("en-IN") : "the selected start date";
      const to = matched.pto_to ? new Date(matched.pto_to).toLocaleDateString("en-IN") : "the selected end date";
      throw new Error(`${matched.full_name || "The selected user"} is on PTO from ${from} to ${to}. Choose another assignee.`);
    }

    return matched;
  }

  const eligible = findAssignableProfiles(profiles, department);
  if (eligible.length === 0) {
    return null;
  }

  const openCounts = new Map();
  tasks.forEach((task) => {
    if (!task.assigned_to) {
      return;
    }
    const current = openCounts.get(task.assigned_to) || 0;
    openCounts.set(task.assigned_to, current + 1);
  });

  return [...eligible].sort((left, right) => {
    const leftCount = openCounts.get(left.id) || 0;
    const rightCount = openCounts.get(right.id) || 0;
    if (leftCount !== rightCount) {
      return leftCount - rightCount;
    }

    return String(left.full_name || "").localeCompare(String(right.full_name || ""));
  })[0];
}

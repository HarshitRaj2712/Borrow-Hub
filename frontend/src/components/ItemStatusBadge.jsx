import React from 'react'
const labels = {
  active: 'Available',
  inactive: 'Unavailable',
  flagged: 'Under review',
  suspended: 'Suspended',
  archived: 'Archived'
}

export default function ItemStatusBadge({ status = 'active', available = true }) {
  const resolvedStatus = status === 'active' && !available ? 'inactive' : status
  return <span className={`item-status-badge item-status-${resolvedStatus}`}>{labels[resolvedStatus] || 'Available'}</span>
}

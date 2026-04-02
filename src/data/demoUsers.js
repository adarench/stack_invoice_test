/**
 * Demo users for the OpsFlow pilot.
 * IDs match seeded profiles in the database.
 */
export const DEMO_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'ops@pilot.opsflow.local',
    full_name: 'Ops User',
    role: 'uploader',
    title: 'Operations',
    user_metadata: { full_name: 'Ops User' },
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'reviewer@pilot.opsflow.local',
    full_name: 'Reviewer User',
    role: 'reviewer',
    title: 'Reviewer',
    user_metadata: { full_name: 'Reviewer User' },
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'accounting@pilot.opsflow.local',
    full_name: 'Accounting User',
    role: 'accounting',
    title: 'Accounting',
    user_metadata: { full_name: 'Accounting User' },
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'admin@pilot.opsflow.local',
    full_name: 'Admin User',
    role: 'admin',
    title: 'Admin',
    user_metadata: { full_name: 'Admin User' },
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    email: 'vendor@pilot.opsflow.local',
    full_name: 'Vendor User',
    role: 'vendor',
    title: 'Vendor',
    user_metadata: { full_name: 'Vendor User' },
  },
]

/** Role display labels */
export const ROLE_LABELS = {
  uploader: 'Ops / Uploader',
  reviewer: 'Reviewer',
  accounting: 'Accounting',
  admin: 'Admin',
  vendor: 'Vendor',
}

/** Status display labels — maps DB enum values to UI labels */
export const WORKFLOW_STATUSES = {
  uploaded:  'Uploaded',
  in_review: 'In Review',
  approved:  'Approved',
  paid:      'Paid',
}

/** Normalize legacy DB states into the single supported workflow */
export function normalizeWorkflowStatus(status) {
  switch (status) {
    case 'under_review':
    case 'needs_triage':
      return 'in_review'
    case 'flagged':
    case 'rejected':
      return 'uploaded'
    case 'approved':
    case 'paid':
    case 'uploaded':
    case 'in_review':
      return status
    default:
      return 'uploaded'
  }
}

/** What each role can do */
export const ROLE_PERMISSIONS = {
  uploader: {
    canUpload: true,
    canEditFields: true,
    canAssign: true,
    canApprove: false,
    canReject: false,
    canMarkPaid: false,
    canOverride: false,
  },
  reviewer: {
    canUpload: false,
    canEditFields: false,
    canAssign: false,
    canApprove: true,
    canReject: true,
    canMarkPaid: false,
    canOverride: false,
  },
  accounting: {
    canUpload: false,
    canEditFields: false,
    canAssign: false,
    canApprove: false,
    canReject: false,
    canMarkPaid: true,
    canOverride: false,
  },
  admin: {
    canUpload: true,
    canEditFields: true,
    canAssign: true,
    canApprove: true,
    canReject: true,
    canMarkPaid: true,
    canOverride: true,
  },
  vendor: {
    canUpload: false,
    canEditFields: false,
    canAssign: false,
    canApprove: false,
    canReject: false,
    canMarkPaid: false,
    canOverride: false,
    canVendorSubmit: true,
  },
}

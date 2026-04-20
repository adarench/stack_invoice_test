/**
 * Demo users for the OpsFlow pilot.
 * IDs match seeded profiles in the database.
 */
export const DEMO_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'sharon@stackwithus.com',
    full_name: 'Sharon',
    role: 'ops',
    title: 'Tahoe',
    user_metadata: { full_name: 'Sharon' },
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    email: 'jen@stackwithus.com',
    full_name: 'Jen',
    role: 'ops',
    title: 'Operations',
    user_metadata: { full_name: 'Jen' },
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    email: 'kelson@stackwithus.com',
    full_name: 'Kelson',
    role: 'admin',
    title: 'All Buckets',
    user_metadata: { full_name: 'Kelson' },
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    email: 'andrew@stackwithus.com',
    full_name: 'Andrew',
    role: 'admin',
    title: 'Management',
    user_metadata: { full_name: 'Andrew' },
  },
  {
    id: '00000000-0000-0000-0000-000000000006',
    email: 'trevor@stackwithus.com',
    full_name: 'Trevor',
    role: 'ops',
    title: 'Farmington / Mgmt',
    user_metadata: { full_name: 'Trevor' },
  },
  {
    id: '00000000-0000-0000-0000-000000000007',
    email: 'ryan@stackwithus.com',
    full_name: 'Ryan',
    role: 'ops',
    title: 'Farmington',
    user_metadata: { full_name: 'Ryan' },
  },
  {
    id: '00000000-0000-0000-0000-000000000008',
    email: 'nn@stackstorage.us',
    full_name: 'Nache',
    role: 'ops',
    title: 'Storage',
    user_metadata: { full_name: 'Nache' },
  },
  {
    id: '00000000-0000-0000-0000-000000000009',
    email: 'jt@stackstorage.us',
    full_name: 'James',
    role: 'ops',
    title: 'Storage',
    user_metadata: { full_name: 'James' },
  },
  {
    id: '00000000-0000-0000-0000-000000000010',
    email: 'ec@buildconstruction.co',
    full_name: 'Ean',
    role: 'ops',
    title: 'BuildCo',
    user_metadata: { full_name: 'Ean' },
  },
  {
    id: '00000000-0000-0000-0000-000000000011',
    email: 'fernando@stackwithus.com',
    full_name: 'Fernando',
    role: 'admin',
    title: 'All Buckets',
    user_metadata: { full_name: 'Fernando' },
  },
  {
    id: '00000000-0000-0000-0000-000000000012',
    email: 'jessica@stackwithus.com',
    full_name: 'Jessica',
    role: 'ops',
    title: 'Ops',
    user_metadata: { full_name: 'Jessica' },
  },
  {
    id: '00000000-0000-0000-0000-000000000013',
    email: 'jan@stackwithus.com',
    full_name: 'Jan',
    role: 'ops',
    title: 'Building Codes',
    user_metadata: { full_name: 'Jan' },
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    email: 'vendor@stackwithus.com',
    full_name: 'Vendor User',
    role: 'vendor',
    title: 'Vendor',
    user_metadata: { full_name: 'Vendor User' },
  },
]

/** Role display labels */
export const ROLE_LABELS = {
  ops: 'Ops',
  approver: 'Approver',
  accounting: 'Accounting',
  admin: 'Admin',
  vendor: 'Vendor',
  // Legacy keys — so old DB records don't break label lookup
  uploader: 'Ops',
  reviewer: 'Approver',
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

/** Normalize legacy role keys */
export function normalizeRole(role) {
  if (role === 'uploader') return 'ops'
  if (role === 'reviewer') return 'approver'
  return role || 'ops'
}

/** What each role can do */
export const ROLE_PERMISSIONS = {
  ops: {
    canUpload: true,
    canEditFields: true,
    canAssign: true,
    canApprove: false,
    canReject: false,
    canMarkPaid: false,
    canOverride: false,
  },
  approver: {
    canUpload: true,
    canEditFields: false,
    canAssign: false,
    canApprove: true,
    canReject: true,
    canMarkPaid: false,
    canOverride: false,
  },
  accounting: {
    canUpload: true,
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
  // Legacy aliases so ROLE_PERMISSIONS[oldRole] still works
  uploader: {
    canUpload: true, canEditFields: true, canAssign: true,
    canApprove: false, canReject: false, canMarkPaid: false, canOverride: false,
  },
  reviewer: {
    canUpload: true, canEditFields: false, canAssign: false,
    canApprove: true, canReject: true, canMarkPaid: false, canOverride: false,
  },
}

/** Role-specific default landing views */
export const ROLE_DEFAULT_VIEW = {
  ops: 'dashboard',
  approver: 'my-queue',
  accounting: 'accounting',
  admin: 'dashboard',
  vendor: 'vendor-dashboard',
}

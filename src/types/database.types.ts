// ------------------------------------------------------------
// Hand-written DB types that mirror supabase/migrations/0001.
// Regenerate with: pnpm db:types (when Supabase CLI is wired in).
// ------------------------------------------------------------

export type UserRole =
  | 'super_admin'
  | 'management'
  | 'accounts'
  | 'client_servicing'
  | 'operations'
  | 'video_team'
  | 'design_team';

export type ClientStatus = 'active' | 'paused' | 'churned' | 'prospect';
export type ProfitabilityStatus = 'healthy' | 'at_risk' | 'bleeding' | 'unknown';

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus =
  | 'pending_classification'
  | 'approved'
  | 'in_progress'
  | 'waiting_approval'
  | 'completed'
  | 'delivered'
  | 'on_hold'
  | 'rejected'
  | 'cancelled';

export type Classification =
  | 'included'
  | 'extra_billable'
  | 'revision'
  | 'out_of_scope'
  | 'goodwill';

export type BillingStatus = 'not_billable' | 'pending_billing' | 'billed' | 'written_off';

export type ApprovalStage =
  | 'not_required'
  | 'pending_management'
  | 'pending_client'
  | 'approved'
  | 'rejected';

export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'waiting_approval'
  | 'completed'
  | 'delivered'
  | 'on_hold';

export interface User {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  department_id: string | null;
  designation: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Department {
  id: string;
  name: string;
  cost_center: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  client_code: string;
  client_name: string;
  brand_name: string;
  brand_code: 'FRM' | 'OV' | 'FM';
  retainer_amount: number;
  billing_cycle: string;
  scope_included: string[];
  allowed_revisions: number;
  account_manager_id: string | null;
  department_id: string | null;
  status: ClientStatus;
  profitability_status: ProfitabilityStatus;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  // Production fields (migration 0004)
  country: string;          // ISO-2: 'IN','US','AE',...
  currency: string;         // ISO-3: 'INR','USD','AED',...
  tax_rate: number;         // % e.g. 18.00 for India GST
  gstin: string | null;
  billing_name: string | null;
  billing_address: string | null;
  billing_email: string | null;
  payment_terms_days: number;
  invoice_timing: 'advance_100' | 'advance_50_50' | 'on_approval' | 'on_delivery';
  agreement_path: string | null;
  agreement_filename: string | null;
  agreement_size: number | null;
  agreement_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'written_off';

export interface Invoice {
  id: string;
  invoice_number: string;
  client_id: string;
  brand_code: string;
  billing_period: string;
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  status: InvoiceStatus;
  issued_at: string | null;
  due_at: string | null;
  paid_at: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface NotificationDispatch {
  id: string;
  user_id: string;
  channel: 'email' | 'slack' | 'whatsapp';
  type: string;
  subject: string;
  body: string | null;
  payload: Record<string, unknown>;
  status: 'pending' | 'sent' | 'failed';
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface JobCode {
  id: string;
  code: string;
  ticket_id: string | null;
  brand_code: string;
  client_id: string;
  month_key: string;
  type_code: string;
  sequence: number;
  created_at: string;
}

export interface Ticket {
  id: string;
  ticket_number: number;
  client_id: string;
  title: string;
  description: string | null;
  request_type: string;
  classification: Classification | null;
  priority: TicketPriority;
  status: TicketStatus;
  approval_stage: ApprovalStage;
  billing_status: BillingStatus;
  estimated_hours: number | null;
  estimated_amount: number | null;
  deadline: string | null;
  requested_by_id: string;
  assigned_team: string | null;
  assigned_to_id: string | null;
  job_code_id: string | null;
  parent_ticket_id: string | null;
  revision_round: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TicketFull extends Ticket {
  client_name: string;
  client_code: string;
  brand_code: string;
  job_code: string | null;
  requested_by_name: string | null;
  requested_by_email: string | null;
  assigned_to_name: string | null;
}

export interface Approval {
  id: string;
  ticket_id: string;
  stage: ApprovalStage;
  decision: 'requested' | 'approved' | 'rejected' | 'withdrawn';
  actor_id: string | null;
  actor_label: string | null;
  comment: string | null;
  estimated_amount: number | null;
  created_at: string;
}

export interface Task {
  id: string;
  ticket_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee_id: string | null;
  department_id: string | null;
  due_date: string | null;
  estimated_hours: number | null;
  actual_hours: number;
  completion_pct: number;
  depends_on: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TimeLog {
  id: string;
  task_id: string;
  user_id: string;
  hours: number;
  work_date: string;
  note: string | null;
  created_at: string;
}

export interface Revision {
  id: string;
  ticket_id: string;
  parent_ticket_id: string;
  round_number: number;
  within_scope: boolean;
  requested_by_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface ChangeRequest {
  id: string;
  client_id: string;
  title: string;
  original_scope: string | null;
  additional_request: string;
  estimated_cost: number | null;
  estimated_hours: number | null;
  timeline_impact: string | null;
  approval_stage: ApprovalStage;
  created_by_id: string | null;
  approved_by_id: string | null;
  client_decision_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Billable {
  id: string;
  ticket_id: string;
  client_id: string;
  job_code_id: string | null;
  classification: Classification;
  amount: number;
  currency: string;
  billing_period: string;
  status: BillingStatus;
  invoiced_at: string | null;
  invoice_ref: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  entity_type: 'ticket' | 'task' | 'change_request' | 'client';
  entity_id: string;
  author_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
}

/** Minimal shape used by the typed Supabase client. */
export interface Database {
  public: {
    Tables: {
      users: { Row: User; Insert: Partial<User> & Pick<User, 'id' | 'email' | 'full_name'>; Update: Partial<User> };
      departments: { Row: Department; Insert: Omit<Department, 'id' | 'created_at'>; Update: Partial<Department> };
      clients: { Row: Client; Insert: Omit<Client, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>; Update: Partial<Client> };
      tickets: { Row: Ticket; Insert: Omit<Ticket, 'id' | 'ticket_number' | 'created_at' | 'updated_at' | 'deleted_at'>; Update: Partial<Ticket> };
      tasks: { Row: Task; Insert: Omit<Task, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>; Update: Partial<Task> };
      approvals: { Row: Approval; Insert: Omit<Approval, 'id' | 'created_at'>; Update: Partial<Approval> };
      time_logs: { Row: TimeLog; Insert: Omit<TimeLog, 'id' | 'created_at'>; Update: Partial<TimeLog> };
      revisions: { Row: Revision; Insert: Omit<Revision, 'id' | 'created_at'>; Update: Partial<Revision> };
      change_requests: { Row: ChangeRequest; Insert: Omit<ChangeRequest, 'id' | 'created_at' | 'updated_at'>; Update: Partial<ChangeRequest> };
      billables: { Row: Billable; Insert: Omit<Billable, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Billable> };
      comments: { Row: Comment; Insert: Omit<Comment, 'id' | 'created_at' | 'edited_at' | 'deleted_at'>; Update: Partial<Comment> };
      notifications: { Row: Notification; Insert: Omit<Notification, 'id' | 'created_at'>; Update: Partial<Notification> };
      job_codes: { Row: JobCode; Insert: Omit<JobCode, 'id' | 'created_at'>; Update: Partial<JobCode> };
    };
    Views: {
      v_tickets_full: { Row: TicketFull };
    };
    Enums: {
      user_role: UserRole;
      client_status: ClientStatus;
      profitability_status: ProfitabilityStatus;
      ticket_priority: TicketPriority;
      ticket_status: TicketStatus;
      classification: Classification;
      billing_status: BillingStatus;
      approval_stage: ApprovalStage;
      task_status: TaskStatus;
    };
  };
}

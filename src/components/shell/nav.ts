import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Plane, ListChecks, Import, Wallet, BookOpen, FileSpreadsheet, Users, Percent, RefreshCcw, Bell, LifeBuoy, ShoppingCart, ReceiptText, Building2, ClipboardCheck, Banknote, Scale, FilePlus2, Radio, Headset, ShieldCheck, Landmark, Calculator, Wand2, Settings2, History, Globe2, BarChart3, TrendingUp, PieChart, AlertOctagon, Activity, Rocket, RotateCcw, Undo2 } from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon; perm?: string | string[]; tag?: 'G' | 'R' };
export type NavGroup = { title: string; items: NavItem[]; perm?: string | string[] };
export const AGENCY_NAV: NavGroup[] = [
  { title: 'Overview', items: [{ href: '/agency', label: 'Dashboard', icon: LayoutDashboard }, { href: '/agency/notifications', label: 'Notifications', icon: Bell, tag: 'G' }] },
  { title: 'Travel', items: [
    { href: '/agency/search', label: 'Book a Flight', icon: Plane, perm: 'AGENCY_BOOK' },
    { href: '/agency/bookings', label: 'Manage Booking', icon: ListChecks },
    { href: '/agency/import-pnr', label: 'Import PNR', icon: Import, perm: 'AGENCY_PNR_IMPORT' },
    { href: '/agency/refunds', label: 'Refund Tracking', icon: Undo2 },
    { href: '/agency/amendments', label: 'Amendments', icon: RefreshCcw, tag: 'G' },
    { href: '/agency/carts', label: 'Held Carts', icon: ShoppingCart, tag: 'G' },
  ] },
  { title: 'Finance', items: [
    { href: '/agency/wallet', label: 'Wallet & Credit', icon: Wallet, perm: 'AGENCY_FINANCE_VIEW' },
    { href: '/agency/passbook', label: 'Passbook', icon: BookOpen, perm: 'AGENCY_FINANCE_VIEW' },
    { href: '/agency/reports', label: 'Reports', icon: FileSpreadsheet, perm: 'AGENCY_REPORTS', tag: 'G' },
  ] },
  { title: 'Agency', items: [
    { href: '/agency/users', label: 'Manage Users', icon: Users, perm: 'AGENCY_USERS_MANAGE' },
    { href: '/agency/markup', label: 'Manage Markup', icon: Percent, perm: 'AGENCY_MARKUP_VIEW', tag: 'G' },
    { href: '/agency/support', label: 'Support Cases', icon: LifeBuoy, perm: 'AGENCY_SUPPORT' },
  ] },
];
export const HUB_NAV: NavGroup[] = [
  { title: 'Operations', perm: 'VIEW_ALL', items: [
    { href: '/operations', label: 'Overview', icon: LayoutDashboard },
    { href: '/operations/applications', label: 'Onboarding', icon: ClipboardCheck, perm: ['APPLICATION_REVIEW', 'VIEW_ALL'] },
    { href: '/operations/agencies', label: 'Agencies', icon: Building2 },
    { href: '/operations/bookings', label: 'Bookings', icon: ListChecks },
    { href: '/operations/refunds', label: 'Refund Applications', icon: Undo2 },
    { href: '/operations/payments', label: 'Payment Matching', icon: Banknote, perm: ['PAYMENT_MATCH', 'VIEW_ALL'] },
    { href: '/operations/supplier', label: 'Supplier Reconciliation', icon: Scale, tag: 'G' },
    { href: '/operations/cases', label: 'Support Cases', icon: Headset },
    { href: '/operations/import-pnr', label: 'Import PNR', icon: Import, perm: 'PNR_IMPORT_ANY' },
    { href: '/operations/amendments', label: 'Amendments', icon: RefreshCcw, tag: 'G' },
    { href: '/operations/manual-order', label: 'Manual Orders', icon: FilePlus2, perm: 'MANUAL_ORDER', tag: 'G' },
    { href: '/operations/gds', label: 'GDS / PCC Queues', icon: Radio, tag: 'G' },
    { href: '/operations/reports', label: 'Sample Reports', icon: FileSpreadsheet, tag: 'G' },
  ] },
  { title: 'Admin', perm: ['POLICY_EDIT', 'COMMERCIAL_EDIT', 'HUB_USERS_MANAGE', 'DEMO_RESET'], items: [
    { href: '/admin/users', label: 'Roles & Users', icon: ShieldCheck, perm: 'HUB_USERS_MANAGE' },
    { href: '/admin/credit', label: 'Credit & Payment', icon: Landmark, perm: 'POLICY_EDIT' },
    { href: '/admin/commercials', label: 'Core Commercials', icon: Calculator, perm: 'COMMERCIAL_EDIT' },
    { href: '/admin/advanced-rules', label: 'Advanced Rule Builder', icon: Wand2, perm: 'ADVANCED_RULES', tag: 'G' },
    { href: '/admin/refund-policies', label: 'Refund Policies', icon: Undo2, perm: 'POLICY_EDIT' },
    { href: '/admin/gds', label: 'GDS / Supplier / PCC', icon: Globe2, tag: 'G' },
    { href: '/admin/automation', label: 'Automation', icon: Settings2, tag: 'G' },
    { href: '/admin/audit', label: 'Audit Trail', icon: History, perm: ['POLICY_EDIT', 'HUB_USERS_MANAGE'] },
    { href: '/admin/fx', label: 'FX Adapter', icon: Globe2, tag: 'R' },
    { href: '/admin/demo', label: 'Demo Control', icon: RotateCcw, perm: 'DEMO_RESET' },
  ] },
  { title: 'Executive', perm: 'EXEC_VIEW', items: [
    { href: '/executive', label: 'Overview', icon: BarChart3 },
    { href: '/executive/ota', label: 'OTA Performance', icon: Building2 },
    { href: '/executive/sales', label: 'Sales Trends', icon: TrendingUp },
    { href: '/executive/cancellations', label: 'Cancellations & Refunds', icon: PieChart },
    { href: '/executive/risk', label: 'Credit Risk', icon: AlertOctagon },
    { href: '/executive/operations', label: 'Operations Performance', icon: Activity },
    { href: '/executive/reports', label: 'Reports', icon: FileSpreadsheet, tag: 'G' },
  ] },
  { title: 'Roadmap', items: [{ href: '/roadmap', label: 'Future Integrations', icon: Rocket, tag: 'R' }] },
];
export const allowed = (perms: string[], p?: string | string[]) => !p || (Array.isArray(p) ? p.some((x) => perms.includes(x)) : perms.includes(p));
export { ReceiptText };

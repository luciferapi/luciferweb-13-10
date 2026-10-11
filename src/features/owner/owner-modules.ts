import {
  Activity,
  CircleDollarSign,
  Database,
  FolderKanban,
  ClipboardList,
  MessagesSquare,
  Rocket,
  ScrollText,
  Send,
  ShieldCheck,
  Ticket,
  TrendingUp,
  UsersRound,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react"

export type OwnerModule = {
  slug: string
  title: string
  description: string[]
  icon: LucideIcon
  live: boolean
}

export const ownerModules: OwnerModule[] = [
  {
    slug: "maintenance",
    title: "Maintenance Management",
    description: ["Put individual routes into maintenance", "Add maintenance messages and images", "Enable, edit, or remove maintenance pages"],
    icon: Wrench,
    live: true,
  },
  {
    slug: "projects",
    title: "Project Management",
    description: ["Create and edit project listings", "Upload project images, demo videos, and source ZIPs"],
    icon: FolderKanban,
    live: true,
  },
  {
    slug: "project-requests",
    title: "Project Requests",
    description: ["Review incoming requests", "Accept, reject, or take action", "Manage request-specific roadmaps"],
    icon: ClipboardList,
    live: true,
  },
  {
    slug: "apis",
    title: "API Management",
    description: ["Create and edit API Explorer endpoints", "Upload API images and demo videos", "Set endpoint access and pricing"],
    icon: Database,
    live: true,
  },
  {
    slug: "users",
    title: "User Management",
    description: ["Total Users", "Active Users", "Block/Unblock Users"],
    icon: UsersRound,
    live: true,
  },
  {
    slug: "referrals",
    title: "Referral Management",
    description: ["Referral Settings", "Referral Income Reports", "Referral Hierarchy"],
    icon: TrendingUp,
    live: true,
  },
  {
    slug: "wallet",
    title: "Wallet Management",
    description: ["Total Wallet Balance", "Wallet Transactions", "Credit/Debit History"],
    icon: Wallet,
    live: true,
  },
  {
    slug: "payments",
    title: "Pay-In / Payout Management",
    description: ["Deposit Approvals", "Withdrawal Requests", "Payment Gateway Monitoring"],
    icon: CircleDollarSign,
    live: true,
  },
  {
    slug: "admins",
    title: "Admin Management",
    description: ["Add Admin", "Role Permissions", "Activity Logs"],
    icon: ShieldCheck,
    live: true,
  },
  {
    slug: "support",
    title: "Customer Support Management",
    description: ["Review User Requests", "Reply to Customers", "Track Ticket Status"],
    icon: MessagesSquare,
    live: true,
  },
  {
    slug: "escalations",
    title: "Forwarded Support Requests",
    description: ["Support Team Handoffs", "Owner Responses", "Resolution Tracking"],
    icon: Ticket,
    live: true,
  },
  {
    slug: "analytics",
    title: "Graph & Analytics",
    description: ["User Growth", "Purchase and Wallet Flows", "Support and Referral Activity", "System Operations"],
    icon: Activity,
    live: true,
  },
  {
    slug: "enhancements",
    title: "Enhancement Management",
    description: ["Feature Updates", "Version Control", "System Improvements"],
    icon: Rocket,
    live: false,
  },
  {
    slug: "banners",
    title: "Scroll Banner Management",
    description: ["Homepage Banners", "Promotional Banners", "Event Announcements"],
    icon: ScrollText,
    live: true,
  },
  {
    slug: "broadcasts",
    title: "Broadcast Management",
    description: ["Select Recipients", "Send Email Announcements", "Broadcast to All Email Users"],
    icon: Send,
    live: true,
  },
]

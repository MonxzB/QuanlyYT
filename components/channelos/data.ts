export type ChannelStatus = "Purchased" | "Setup" | "Warm-up" | "Active" | "Paused" | "Warning" | "Suspended" | "Dead";

export type Channel = {
  id: string;
  name: string;
  handle: string;
  status: ChannelStatus;
  niche: string;
  subscribers: string;
  views: string;
  videos: number;
  lastUpload: string;
  account: string;
  profile: string;
  health: "Healthy" | "Review" | "Critical";
  owner: string;
  country: string;
  purchased: string;
  started: string;
  avgViews: string;
  growth: string;
};

export const initialChannels: Channel[] = [
  { id: "ch-001", name: "History World", handle: "@historyworld", status: "Active", niche: "History", subscribers: "124K", views: "32.8M", videos: 182, lastUpload: "2 hours ago", account: "history.ops@gmail.com", profile: "Profile-023", health: "Healthy", owner: "Monz", country: "US", purchased: "Mar 12, 2025", started: "Apr 02, 2025", avgViews: "182K", growth: "+18.4%" },
  { id: "ch-002", name: "Fishing Lab", handle: "@fishinglab", status: "Warning", niche: "Fishing", subscribers: "42.6K", views: "8.4M", videos: 96, lastUpload: "10 days ago", account: "fish.lab@gmail.com", profile: "Profile-011", health: "Review", owner: "Alex", country: "CA", purchased: "Jun 18, 2025", started: "Jul 01, 2025", avgViews: "87K", growth: "-6.2%" },
  { id: "ch-003", name: "Ancient Archive", handle: "@ancientarchive", status: "Active", niche: "History", subscribers: "89.2K", views: "18.1M", videos: 128, lastUpload: "Yesterday", account: "archive.media@gmail.com", profile: "Profile-008", health: "Healthy", owner: "Monz", country: "UK", purchased: "Jan 22, 2025", started: "Feb 14, 2025", avgViews: "141K", growth: "+12.8%" },
  { id: "ch-004", name: "Roam Atlas", handle: "@roamatlas", status: "Warm-up", niche: "Travel", subscribers: "8.3K", views: "1.2M", videos: 31, lastUpload: "3 days ago", account: "roam.team@gmail.com", profile: "Profile-034", health: "Healthy", owner: "Linh", country: "AU", purchased: "Aug 03, 2026", started: "Aug 12, 2026", avgViews: "38K", growth: "+31.5%" },
  { id: "ch-005", name: "Defense Files", handle: "@defensefiles", status: "Active", niche: "Defense", subscribers: "218K", views: "61.5M", videos: 204, lastUpload: "6 hours ago", account: "defense.unit@gmail.com", profile: "Profile-017", health: "Healthy", owner: "Alex", country: "US", purchased: "Nov 08, 2024", started: "Dec 01, 2024", avgViews: "301K", growth: "+44.2%" },
  { id: "ch-006", name: "Ghibli Dreamscape", handle: "@ghiblidreamscape", status: "Setup", niche: "Ghibli", subscribers: "—", views: "—", videos: 0, lastUpload: "No uploads", account: "dreamscape.studio@gmail.com", profile: "Profile-041", health: "Review", owner: "Linh", country: "JP", purchased: "Sep 10, 2026", started: "—", avgViews: "—", growth: "—" },
  { id: "ch-007", name: "Timelapse Earth", handle: "@timelapseearth", status: "Paused", niche: "Timelapse", subscribers: "67.1K", views: "12.7M", videos: 74, lastUpload: "24 days ago", account: "time.earth@gmail.com", profile: "Profile-006", health: "Review", owner: "Minh", country: "DE", purchased: "Sep 17, 2024", started: "Oct 05, 2024", avgViews: "171K", growth: "-2.1%" },
  { id: "ch-008", name: "Wild Discovery", handle: "@wilddiscovery", status: "Active", niche: "Discovery", subscribers: "156K", views: "44.3M", videos: 153, lastUpload: "18 hours ago", account: "wild.discovery@gmail.com", profile: "Profile-029", health: "Healthy", owner: "Monz", country: "US", purchased: "May 20, 2024", started: "Jun 04, 2024", avgViews: "289K", growth: "+22.7%" },
  { id: "ch-009", name: "Deep Sea Journal", handle: "@deepseajournal", status: "Suspended", niche: "Discovery", subscribers: "31.4K", views: "6.8M", videos: 59, lastUpload: "42 days ago", account: "deepsea.media@gmail.com", profile: "Profile-015", health: "Critical", owner: "Minh", country: "NZ", purchased: "Feb 11, 2025", started: "Mar 03, 2025", avgViews: "115K", growth: "-100%" },
  { id: "ch-010", name: "River Tactics", handle: "@rivertactics", status: "Purchased", niche: "Fishing", subscribers: "—", views: "—", videos: 0, lastUpload: "No uploads", account: "river.tactics@gmail.com", profile: "Unassigned", health: "Review", owner: "Alex", country: "US", purchased: "Sep 14, 2026", started: "—", avgViews: "—", growth: "—" },
];

export const accounts = [
  { email: "history.ops@gmail.com", recovery: "recovery.his••@outlook.com", phone: "+1 ••• ••• 2291", twoFa: true, country: "US", channels: 3, profile: "Profile-023", status: "Active", created: "Mar 12, 2025" },
  { email: "fish.lab@gmail.com", recovery: "backup.fi••@gmail.com", phone: "+1 ••• ••• 8104", twoFa: true, country: "CA", channels: 2, profile: "Profile-011", status: "Review", created: "Jun 18, 2025" },
  { email: "defense.unit@gmail.com", recovery: "vault.de••@proton.me", phone: "+1 ••• ••• 4478", twoFa: true, country: "US", channels: 1, profile: "Profile-017", status: "Active", created: "Nov 08, 2024" },
  { email: "dreamscape.studio@gmail.com", recovery: "studio.re••@icloud.com", phone: "+81 •• •••• 9042", twoFa: false, country: "JP", channels: 1, profile: "Profile-041", status: "Setup", created: "Sep 10, 2026" },
  { email: "deepsea.media@gmail.com", recovery: "ocean.ba••@gmail.com", phone: "+64 •• ••• 1206", twoFa: true, country: "NZ", channels: 1, profile: "Profile-015", status: "Locked", created: "Feb 11, 2025" },
];

export const profiles = [
  { name: "Profile-023", country: "US", ip: "IP-US-•••.42", account: "history.ops@gmail.com", channel: "History World", status: "Active", notes: "Primary history cluster" },
  { name: "Profile-011", country: "CA", ip: "IP-CA-•••.18", account: "fish.lab@gmail.com", channel: "Fishing Lab", status: "Review", notes: "IP refresh scheduled" },
  { name: "Profile-017", country: "US", ip: "IP-US-•••.91", account: "defense.unit@gmail.com", channel: "Defense Files", status: "Active", notes: "Stable browser fingerprint" },
  { name: "Profile-041", country: "JP", ip: "IP-JP-•••.07", account: "dreamscape.studio@gmail.com", channel: "Ghibli Dreamscape", status: "Setup", notes: "Cookie warm-up day 4" },
  { name: "Profile-015", country: "NZ", ip: "IP-NZ-•••.55", account: "deepsea.media@gmail.com", channel: "Deep Sea Journal", status: "Blocked", notes: "Do not access until review" },
];

export const niches = [
  { name: "History", channels: 18, videos: 324, views: "42M", refs: 8, color: "#4f46e5", trend: "+18.4%" },
  { name: "Fishing", channels: 12, videos: 140, views: "18M", refs: 15, color: "#0f766e", trend: "+7.2%" },
  { name: "Travel", channels: 16, videos: 287, views: "31M", refs: 12, color: "#0284c7", trend: "+11.8%" },
  { name: "Ghibli", channels: 9, videos: 98, views: "9.8M", refs: 6, color: "#7c3aed", trend: "+24.1%" },
  { name: "Timelapse", channels: 11, videos: 174, views: "22M", refs: 9, color: "#d97706", trend: "-2.1%" },
  { name: "Defense", channels: 14, videos: 252, views: "56M", refs: 11, color: "#dc2626", trend: "+44.2%" },
  { name: "Discovery", channels: 21, videos: 398, views: "74M", refs: 18, color: "#2563eb", trend: "+16.5%" },
];

export const researchChannels = [
  { name: "Historia Civilis", niche: "History", subs: "1.02M", views: "186M", frequency: "2 / month", average: "1.8M", duration: "18:24", style: "Minimal maps", pattern: "How [Event] Really Happened" },
  { name: "Fishing Gear Lab", niche: "Fishing", subs: "412K", views: "92M", frequency: "3 / week", average: "380K", duration: "12:10", style: "Product close-up", pattern: "I Tested [Gear] for 30 Days" },
  { name: "RealLifeLore", niche: "Discovery", subs: "7.4M", views: "2.1B", frequency: "1 / week", average: "2.4M", duration: "21:05", style: "Map + bold text", pattern: "Why [Place] Is So Important" },
  { name: "Mustard", niche: "Defense", subs: "1.7M", views: "234M", frequency: "1 / month", average: "3.1M", duration: "16:48", style: "3D vehicle render", pattern: "The [Machine] That Changed Everything" },
];

export const alertsList = [
  { id: 1, channel: "Fishing Lab", message: "No upload for 10 days", severity: "Warning", time: "18 minutes ago", status: "Open" },
  { id: 2, channel: "Deep Sea Journal", message: "Channel is inaccessible", severity: "Critical", time: "1 hour ago", status: "Open" },
  { id: 3, channel: "Defense Files", message: "Views increased 180% in 48 hours", severity: "Info", time: "3 hours ago", status: "Open" },
  { id: 4, channel: "Timelapse Earth", message: "Views dropped 42% week over week", severity: "Warning", time: "Yesterday", status: "Open" },
  { id: 5, channel: "Ancient Archive", message: "Status changed: Warm-up → Active", severity: "Info", time: "Yesterday", status: "Resolved" },
];

export const contentCards = [
  { title: "Why Titanic Sank", channel: "History World", stage: "Editing", date: "Sep 20", progress: 72 },
  { title: "The Empire Nobody Remembers", channel: "Ancient Archive", stage: "Script", date: "Sep 24", progress: 24 },
  { title: "7 Lures That Actually Work", channel: "Fishing Lab", stage: "Voice", date: "Sep 21", progress: 45 },
  { title: "Inside the SR-71", channel: "Defense Files", stage: "Thumbnail", date: "Sep 18", progress: 88 },
  { title: "Iceland in 8K", channel: "Roam Atlas", stage: "Scheduled", date: "Sep 19", progress: 100 },
  { title: "Life Below 3,000 Meters", channel: "Wild Discovery", stage: "Idea", date: "Oct 02", progress: 8 },
  { title: "Tokyo Through the Night", channel: "Timelapse Earth", stage: "Published", date: "Sep 15", progress: 100 },
];

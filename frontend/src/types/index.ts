export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'artist' | 'finance' | 'marketing';
  avatar?: string;
  phone?: string;
  department?: string;
  isActive: boolean;
}

export interface ArtistDocument {
  _id: string;
  name: string;
  type: 'artist_agreement' | 'tax_form' | 'nda' | 'image_release' | 'payment_instructions' | 'code_of_conduct' | 'social_media_expectations' | 'recording_delivery_requirements' | 'existing_contract';
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  uploadedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  notes?: string;
}

export interface ArtistAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface EmergencyContact {
  name: string;
  relationship: string;
  phone: string;
  email: string;
}

export interface Publisher {
  name: string;
  contact: string;
}

export interface PaymentInfo {
  method: string;
  bankName: string;
  accountNumber: string;
  routingNumber: string;
  paypalEmail: string;
}

export interface TaxInfo {
  taxId: string;
  taxFormType: string;
  filingStatus: string;
}

export interface Artist {
  _id: string;
  legalName?: string;
  artistName?: string;
  name: string;
  stageName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  address?: ArtistAddress;
  emergencyContact?: EmergencyContact;
  bio?: string;
  image?: string;
  coverPhoto?: string;
  socialLinks?: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    spotify?: string;
    twitter?: string;
  };
  genre?: string;
  musicLinks?: string[];
  previousReleases?: string;
  catalogOwnership?: string;
  proAffiliation?: string;
  publisher?: Publisher;
  paymentInfo?: PaymentInfo;
  taxInfo?: TaxInfo;
  documents?: ArtistDocument[];
  status: 'active' | 'inactive' | 'on_hold' | 'upcoming';
  onboardingStatus: 'not_started' | 'in_progress' | 'pending_approval' | 'approved' | 'rejected';
  onboardingStep: 1 | 2 | 3 | 4;
  onboardingNotes?: string;
  onboardedBy?: User;
  onboardingPackage?: {
    version: string;
    deliveredAt?: string;
    acknowledgedAt?: string;
    acknowledgedBy?: User;
  };
  approvedAt?: string;
  approvedBy?: User;
  contractStart?: string;
  contractEnd?: string;
  manager?: User;
  totalStreams?: number;
  totalRevenue?: number;
  royaltyRate?: number;
  createdAt: string;
}

export interface Song {
  _id: string;
  title: string;
  artist: Artist;
  album?: string;
  genre?: string;
  duration?: number;
  status: 'demo' | 'in_production' | 'mixing' | 'mastering' | 'awaiting_approval' | 'approved' | 'released' | 'shelved';
  releaseDate?: string;
  streams?: number;
  revenue?: number;
  assignedTo?: User;
  priority: 'low' | 'medium' | 'high' | 'critical';
  productionWorkflow?: ProductionStep[];
  versions?: SongVersion[];
  credits?: Array<{ name: string; role: 'songwriter' | 'composer' | 'producer' | 'engineer' | 'mixer' | 'masterer' | 'featured_artist' | 'vocalist' | 'musician' | 'other'; percentage: number; notes?: string }>;
  beatInfo?: { producer: string; beatPurchaseDate?: string; licenseType: string; licenseFile?: string; ownershipVerified: boolean };
  producedBy?: string;
  writtenBy?: string;
  isrc?: string;
  notes?: string;
  createdAt: string;
}

export interface Project {
  _id: string;
  name: string;
  type: 'album' | 'ep' | 'single' | 'mixtape' | 'compilation';
  artist: Artist;
  status: 'not_started' | 'in_progress' | 'waiting_approval' | 'completed' | 'delayed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  releaseDate?: string;
  startDate?: string;
  budget?: number;
  spent?: number;
  assignedTo?: User;
  completionPercentage: number;
  description?: string;
  createdAt: string;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  assignedTo?: User;
  assignedBy?: User;
  relatedProject?: Project;
  relatedArtist?: Artist;
  deadline: string;
  status: 'not_started' | 'in_progress' | 'waiting_approval' | 'completed' | 'delayed' | 'blocked';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'production' | 'marketing' | 'finance' | 'legal' | 'distribution' | 'general';
  deliverable: string;
  completedAt?: string;
  notes: string;
  createdAt: string;
}

export interface KanbanColumns {
  not_started: Task[];
  in_progress: Task[];
  waiting_approval: Task[];
  blocked: Task[];
  delayed: Task[];
  completed: Task[];
}

export interface TeamMemberPerformance {
  _id: string;
  name: string;
  role: string;
  total: number;
  completed: number;
  delayed: number;
  inProgress: number;
  critical: number;
  onTime: number;
  completionRate: number;
  onTimeRate: number;
}

export interface TaskStats {
  total: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  overdue: number;
  dueThisWeek: number;
}

export interface WeeklyReport {
  _id: string;
  weekStart: string;
  weekEnd: string;
  completed: string;
  stillOpen: string;
  blocked: string;
  needsApproval: string;
  dueThisWeek: string;
  biggestRisk: string;
  nextActionOwner: string;
  notes: string;
  createdBy?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Finance {
  _id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description?: string;
  artist?: Artist;
  project?: Project;
  date: string;
  month?: number;
  year?: number;
  paymentStatus: 'pending' | 'paid' | 'overdue' | 'cancelled';
}

export interface ChecklistItem {
  _id: string;
  item: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'skipped';
  assignedTo?: User;
  dueDate?: string;
  completedAt?: string;
  notes: string;
  order: number;
}

export interface ReleasePhase {
  completed: boolean;
  startedAt?: string;
  completedAt?: string;
  checklist: ChecklistItem[];
}

export interface Release {
  _id: string;
  title: string;
  artist: Artist;
  releaseDate: string;
  type: 'album' | 'ep' | 'single' | 'mixtape' | 'compilation';
  status: 'scheduled' | 'in_preparation' | 'submitted' | 'approved' | 'released' | 'delayed' | 'cancelled';
  currentPhase: 'preparation' | 'distribution' | 'marketing' | 'post_release' | 'completed';
  phases: {
    preparation: ReleasePhase;
    distribution: ReleasePhase;
    marketing: ReleasePhase;
    post_release: ReleasePhase;
  };
  ownershipConfirmed: boolean;
  masterApproved: boolean;
  artworkApproved: boolean;
  metadataComplete: boolean;
  songs?: Array<{ _id: string; title: string }>;
  platforms?: Array<{ name: string; status: string; link?: string; submittedAt?: string; liveAt?: string }>;
  marketingBudget?: number;
  assignedTo?: User;
  priority: 'low' | 'medium' | 'high' | 'critical';
  notes: string;
  genre: string;
  language: string;
  explicit: boolean;
  preSaveLink: string;
  pressReleaseUrl: string;
  coverArt: string;
  upc: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReleaseDashboardData {
  total: number;
  byStatus: Record<string, number>;
  byPhase: Record<string, number>;
  byType: Array<{ _id: string; count: number }>;
  upcoming: Release[];
}

export interface ContractParty {
  name: string;
  role: string;
  entity: string;
}

export interface ContractRecoupment {
  type: 'none' | 'recoupable' | 'partially_recoupable' | 'cross_collateralized';
  advanceAmount: number;
  advancePaid: boolean;
  recoupmentRate: number;
  notes: string;
}

export interface ContractPayment {
  advanceAmount: number;
  advancePaid: boolean;
  royaltyFrequency: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  minimumGuarantee: number;
  notes: string;
}

export interface ContractOptionPeriod {
  label: string;
  durationMonths: number;
  exerciseDeadline?: string;
  exercised: boolean;
  exercisedAt?: string;
  notes: string;
}

export interface Contract {
  _id: string;
  title: string;
  artist?: Artist;
  type: 'artist_agreement' | 'producer_agreement' | 'beat_license' | 'split_sheet' | 'featured_artist' | 'work_for_hire' | 'video_release' | 'photo_release' | 'contractor' | 'nda' | 'sync_license' | 'merchandise' | 'recording' | 'publishing' | 'distribution' | 'management' | 'licensing' | 'endorsement';
  status: 'draft' | 'pending_signature' | 'active' | 'expired' | 'terminated' | 'renewed';
  parties: ContractParty[];
  signedDate?: string;
  startDate: string;
  endDate: string;
  renewalDate?: string;
  renewalDeadline?: string;
  renewalNoticeDays: number;
  autoRenew: boolean;
  optionPeriods: ContractOptionPeriod[];
  value: number;
  royaltyRate: number;
  recoupment: ContractRecoupment;
  ownershipTerms: string;
  paymentObligations: ContractPayment;
  fileUrl: string;
  fileName: string;
  managedBy?: User;
  terms: string;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContractStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Array<{ _id: string; count: number }>;
  totalValue: number;
  expiringSoon: number;
}

export interface ExpiringContracts {
  expiring: Contract[];
  expired: Contract[];
  renewalDue: Contract[];
  expiringCount: number;
  expiredCount: number;
  renewalDueCount: number;
}

export interface ContentItem {
  _id: string;
  title: string;
  platform: string;
  contentType: string;
  category: 'performance' | 'lifestyle' | 'behind_the_scenes' | 'storytelling' | 'educational' | 'fan_interaction' | 'promotional' | 'personal_connection';
  scheduledDate?: string;
  publishedDate?: string;
  status: 'draft' | 'scheduled' | 'published' | 'cancelled';
  caption: string;
  mediaUrl: string;
  link: string;
  impressions: number;
  clicks: number;
  likes: number;
  shares: number;
  comments: number;
  conversions: number;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  _id: string;
  name: string;
  type: string;
  artist?: Artist;
  project?: { _id: string; name: string };
  release?: { _id: string; title: string };
  status: 'planned' | 'active' | 'paused' | 'completed' | 'cancelled';
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  reach: number;
  impressions: number;
  clicks: number;
  conversions: number;
  engagement: number;
  costPerClick: number;
  costPerConversion: number;
  roi: number;
  attributedRevenue: number;
  profit: number;
  contentItems: ContentItem[];
  assignedTo?: User;
  goals: string[];
  objective: string;
  targetAudience: string;
  mainStory: string;
  contentThemes: string[];
  callsToAction: string[];
  releaseDate?: string;
  platforms: string[];
  contentCategories: string[];
  contentTarget: number;
  advertisingTests: Array<{ _id?: string; name: string; platform: string; audience: string; creative: string; callToAction: string; budget: number; spent: number; impressions: number; clicks: number; conversions: number; status: string; result: string }>;
  progress: number;
  notes: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalArtists: number;
  totalProjects: number;
  totalSongs: number;
  upcomingReleases: number;
  activeCampaigns: number;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  pendingApprovals: number;
  overdueTasks: number;
  criticalIssues: number;
  projectsInProduction: number;
}

export interface MonthlyFinancial {
  name: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface DeadlineItem {
  id: string;
  title: string;
  date: string;
  artist?: string;
  assignedTo?: string;
  type: 'release' | 'contract' | 'task' | 'campaign';
  priority?: string;
}

export interface OnboardingStats {
  not_started: number;
  in_progress: number;
  pending_approval: number;
  approved: number;
  rejected: number;
}

export interface SkillRatings {
  musicQuality: number;
  songwriting: number;
  vocalAbility: number;
  stagePerformance: number;
  branding: number;
  visualIdentity: number;
  socialMediaConsistency: number;
  interviewSkills: number;
  fanEngagement: number;
  professionalBehavior: number;
}

export interface MetricScores {
  songsCompleted: number;
  contentPosted: number;
  engagementGrowth: number;
  rehearsalsCompleted: number;
  deadlinesMet: number;
  revenueGenerated: number;
  audienceGrowth: number;
  teamCooperation: number;
}

export interface DevelopmentGoal {
  category?: string;
  title: string;
  description?: string;
  target?: string;
  targetDate?: string;
  completed: boolean;
  completedAt?: string;
  progress?: number;
  notes?: string;
  milestones?: Array<{
    title: string;
    dueDate?: string;
    completed: boolean;
    completedAt?: string;
    notes?: string;
  }>;
}

export interface Scorecard {
  _id: string;
  month: string;
  year: number;
  skillRatings: SkillRatings;
  metricScores: MetricScores;
  goals: DevelopmentGoal[];
  improvements: string[];
  comments: string;
  overallScore: number;
  scoredBy?: User;
  createdAt: string;
}

export interface DevelopmentPlan {
  _id: string;
  artistId: Artist;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'paused' | 'archived';
  goals: DevelopmentGoal[];
  focusAreas: string[];
  notes: string;
  scorecards: Scorecard[];
  createdBy?: User;
  createdAt: string;
  updatedAt: string;
}

export interface DevelopmentDashboardData {
  totalPlans: number;
  activePlans: number;
  totalScorecards: number;
  totalArtistsTracked: number;
  skillAverages: Record<keyof SkillRatings, number>;
  latestPerArtist: Array<{
    artist: Artist;
    scorecard: Scorecard;
    plan: DevelopmentPlan;
  }>;
  monthlyTrend: Array<{ month: string; avgScore: number; count: number }>;
}

export interface FileItem {
  _id: string;
  name: string;
  originalName: string;
  path: string;
  folderId?: string;
  mimeType: string;
  size: number;
  type: 'document' | 'image' | 'audio' | 'video' | 'archive' | 'other';
  category: string;
  tags: string[];
  artistId?: Artist;
  songId?: { _id: string; title: string };
  version: number;
  versionNote: string;
  backup: {
    primary: boolean;
    cloud: boolean;
    external: boolean;
    checksum?: string;
    primaryVerifiedAt?: string;
    cloudVerifiedAt?: string;
    externalVerifiedAt?: string;
    lastBackupAt?: string;
    lastError?: string;
  };
  uploadedBy?: User;
  downloads: number;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FolderItem {
  _id: string;
  name: string;
  parentId?: string;
  path: string;
  icon: string;
  color: string;
  createdBy?: User;
  createdAt: string;
  updatedAt: string;
}

export interface Breadcrumb {
  _id: string;
  name: string;
}

export interface FolderContents {
  folder: FolderItem;
  folders: FolderItem[];
  files: FileItem[];
  breadcrumbs: Breadcrumb[];
}

export interface StorageStats {
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  byType: Array<{ _id: string; count: number; size: number }>;
  byCategory: Array<{ _id: string; count: number }>;
  backup: { primary: number; cloud: number; external: number; healthy: number; total: number };
  backupConfiguration: {
    cloud: { label: string; configured: boolean; available: boolean };
    external: { label: string; configured: boolean; available: boolean };
  };
}

export interface SearchResults {
  files: FileItem[];
  folders: FolderItem[];
}

export interface OwnershipWriter {
  name: string;
  percentage: number;
  role: 'songwriter' | 'composer' | 'lyricist' | 'arranger';
}

export interface OwnershipPublisher {
  name: string;
  percentage: number;
  type: 'admin' | 'co_publishing' | 'sub_publishing' | 'mechanical';
}

export interface OwnershipFeaturedArtist {
  name: string;
  percentage: number;
  artistId?: Artist;
}

export interface BeatLicense {
  type: 'exclusive' | 'non_exclusive' | 'lease' | 'work_for_hire' | 'none';
  producer: string;
  cost: number;
  terms: string;
  expirationDate?: string;
  purchaseDate?: string;
  licenseNumber?: string;
  territory?: string;
  usageLimit?: string;
  documentUrl?: string;
}

export interface OwnershipSample {
  title: string;
  originalArtist: string;
  owner: string;
  percentage: number;
  clearanceStatus: 'cleared' | 'pending' | 'denied' | 'not_applicable';
  clearanceDocumentUrl?: string;
  notes: string;
}

export interface OwnershipSignature {
  _id?: string;
  partyName: string;
  role: 'master_owner' | 'songwriter' | 'publisher' | 'producer' | 'featured_artist' | 'sample_owner' | 'other';
  status: 'pending' | 'signed';
  documentUrl: string;
  signedAt?: string;
  notes: string;
}

export interface Ownership {
  _id: string;
  songId: { _id: string; title: string; artist: Artist };
  masterOwner: string;
  writers: OwnershipWriter[];
  publishers: OwnershipPublisher[];
  producer: string;
  producerPercentage: number;
  featuredArtists: OwnershipFeaturedArtist[];
  beatLicense: BeatLicense;
  samples: OwnershipSample[];
  signatures: OwnershipSignature[];
  copyrightStatus: 'registered' | 'pending' | 'not_registered' | 'disputed';
  copyrightNumber: string;
  proStatus: 'registered' | 'pending' | 'not_registered';
  proName: string;
  proIpi: string;
  distributionStatus: 'ready' | 'pending_metadata' | 'pending_approval' | 'distributed' | 'on_hold';
  totalPercentage: number;
  isComplete: boolean;
  signaturesComplete: boolean;
  isReadyForRelease: boolean;
  validationErrors: string[];
  releaseApproved: boolean;
  approvedBy?: User;
  approvedAt?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface OwnershipDashboardData {
  total: number;
  complete: number;
  incomplete: number;
  approved: number;
  pendingApproval: number;
  withSamples: number;
  readyForRelease: number;
  avgPercentage: number;
}

export interface OwnershipValidation {
  valid: boolean;
  errors: string[];
  ownership: Ownership;
}

export interface ArtistProgressData {
  plans: DevelopmentPlan[];
  scorecards: Scorecard[];
  summary: {
    totalScorecards: number;
    skillAverages: Record<keyof SkillRatings, number>;
    latestScorecard: Scorecard | null;
    previousScorecard: Scorecard | null;
    growth: Partial<Record<keyof SkillRatings, number>>;
    overallAverage: number;
  } | null;
}

// Music Creation System - Song Versions
export interface SongVersion {
  _id: string;
  type: 'explicit_master' | 'clean_master' | 'instrumental' | 'performance_version' | 'acappella' | 'radio_edit' | 'stems' | 'wav_high_quality' | 'reference_mp3';
  fileUrl: string;
  fileName: string;
  fileSize: number;
  format: string;
  uploadedAt: string;
  notes: string;
}

// Music Creation System - Production Workflow
export interface ProductionStep {
  _id: string;
  step: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
  completedAt?: string;
  notes: string;
  order: number;
}

// Royalty Ledger
export interface RoyaltyEntry {
  _id: string;
  artist: Artist;
  release?: { _id: string; title: string };
  song?: { _id: string; title: string };
  period: string;
  periodStart: string;
  periodEnd: string;
  grossIncome: number;
  incomeBySource: {
    streaming: number;
    publishing: number;
    mechanical: number;
    performance: number;
    sync: number;
    merchandise: number;
    other: number;
  };
  distributorFees: number;
  approvedDeductions: Array<{ description: string; amount: number; category: string }>;
  totalDeductions: number;
  recoupableExpenses: number;
  totalRecouped: number;
  remainingRecoupable: number;
  artistPercentage: number;
  labelPercentage: number;
  producerPercentage: number;
  featuredArtistPercentage: number;
  producerRoyalty: number;
  featuredArtistRoyalty: number;
  netIncome: number;
  artistGrossShare: number;
  artistShare: number;
  labelShare: number;
  paymentsIssued: Array<{ amount: number; date: string; method: string; reference: string }>;
  totalPaid: number;
  recoupedThisPeriod: number;
  remainingBalance: number;
  status: 'draft' | 'calculated' | 'approved' | 'paid' | 'disputed';
  statementGenerated: boolean;
  createdAt: string;
}

// Contract Template
export interface ContractTemplate {
  _id: string;
  name: string;
  type: string;
  description: string;
  content: string;
  clauses: Array<{ title: string; body: string; category: string; order: number }>;
  defaultTerms: {
    duration: number;
    renewalTerm: number;
    royaltyRate: number;
    advanceAmount: number;
    recoupmentType: string;
    notes: string;
  };
  isActive: boolean;
  usageCount: number;
  createdAt: string;
}

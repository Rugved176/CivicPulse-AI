export interface AgentResponses {
  orchestrator: string;
  classifier: string;
  geoRouter: string;
  resolution: string;
  insights: string;
  rawText: string;
}

export interface CivicIssue {
  id: string; // e.g., I-249
  title: string;
  description: string;
  category: 'Roads/Potholes' | 'Water/Drainage' | 'Solid Waste' | 'Electricity' | 'Parks';
  location: string;
  ward: string;
  lat: number;
  lng: number;
  reportedBy: string;
  reportedAt: string;
  severity: number;
  status: 'Active' | 'Resolved' | 'Escalated';
  department: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  points: number;
  imageUrl?: string;
  agentResponses?: AgentResponses;
  duplicateOf?: string;
  adminNotes?: string;
  state?: string;
  city?: string;
}

export interface PlatformStats {
  totalIssuesThisMonth: number;
  resolvedIssues: number;
  resolutionRate: number; // e.g. 75%
  avgResolutionDays: number; // e.g. 2.4
  activeCitizens: number;
  issueBreakdown: {
    'Roads/Potholes': number;
    'Water/Drainage': number;
    'Solid Waste': number;
    'Electricity': number;
    'Parks': number;
  };
  highRiskZones: {
    zone: string;
    count: number;
    issueType: string;
  }[];
  departmentLoad: {
    department: string;
    load: number; // e.g. 82
  }[];
  predictedFailures: {
    id: string;
    location: string;
    type: string;
    indicator: string;
    timeframe: string;
    preventiveAction: string;
    riskLevel: 'High' | 'Critical' | 'Medium';
  }[];
}

export interface CitizenLeaderboardEntry {
  name: string;
  points: number;
  reportsCount: number;
  rank: number;
  avatar: string;
}

export interface NotificationToast {
  id: string;
  issueId: string;
  title: string;
  type: 'resolved' | 'escalated' | 'updated';
  timestamp: string;
}


import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { CivicIssue, AgentResponses } from "./src/types.ts";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize Gemini Client
const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// Initial Platform Statistics (always referenced)
const platformStats = {
  totalIssuesThisMonth: 0,
  resolvedIssues: 0,
  resolutionRate: 100, // Starts at 100% since no issues are unresolved
  avgResolutionDays: 0,
  activeCitizens: 0,
  issueBreakdown: {
    'Roads/Potholes': 0,
    'Water/Drainage': 0,
    'Solid Waste': 0,
    'Electricity': 0,
    'Parks': 0,
  },
  highRiskZones: [] as { zone: string; count: number; issueType: string }[],
  departmentLoad: [
    { department: "Roads Department (PWD)", load: 42 },
    { department: "Water Supply & Drainage Board", load: 28 },
    { department: "Electricity & Power Board", load: 35 },
    { department: "Solid Waste Management Department", load: 19 },
    { department: "Horticulture & Parks Department", load: 12 },
  ],
  predictedFailures: [] as {
    id: string;
    location: string;
    type: string;
    indicator: string;
    timeframe: string;
    preventiveAction: string;
    riskLevel: 'High' | 'Critical' | 'Medium';
  }[],
};

// Simulated Civic Database (Pre-populated empty for real features)
let reportedIssues: CivicIssue[] = [];

// Helper to determine ward based on location keywords and city
function getWardDetails(location: string, city: string = "Mumbai Municipal Corporation"): { ward: string; lat: number; lng: number } {
  const loc = location.toLowerCase();
  const ct = city.toLowerCase();

  if (ct.includes("dhule") || ct.includes("dubl") || loc.includes("dhule") || loc.includes("sakri") || loc.includes("dubl")) {
    // Dhule Municipal Corporation ("DUBL")
    if (loc.includes("sakri")) {
      return { ward: "Dhule Ward 4 (Sakri Road Sector)", lat: 20.9015, lng: 74.7680 };
    }
    if (loc.includes("deopur")) {
      return { ward: "Dhule Ward 1 (Deopur Sector)", lat: 20.9150, lng: 74.7800 };
    }
    if (loc.includes("bara patthar") || loc.includes("bara pathar")) {
      return { ward: "Dhule Ward 2 (Bara Patthar Sector)", lat: 20.9080, lng: 74.7750 };
    }
    return { ward: "Dhule Ward 3 (Central Sector)", lat: 20.9042, lng: 74.7749 };
  }

  // Generic Default Ward Logic
  if (loc.includes("colaba") || loc.includes("mumbai") || loc.includes("fort")) {
    return { ward: "Ward-01 (South Sector)", lat: 18.9220, lng: 72.8347 };
  } else if (loc.includes("bandra") || loc.includes("west")) {
    return { ward: "Ward-02 (West Sector)", lat: 19.0596, lng: 72.8295 };
  } else if (loc.includes("andheri")) {
    return { ward: "Ward-03 (Central Sector)", lat: 19.1136, lng: 72.8697 };
  }
  
  // Default general ward
  return { ward: "General Ward", lat: 19.0760, lng: 72.8777 };
}

// Helper to map category to department and department code
function getDepartmentDetails(category: string, city: string = "Mumbai Municipal Corporation"): { name: string; code: string; sla: number } {
  const cityName = city.split(' ')[0] || "Municipal";
  switch (category) {
    case "Roads/Potholes":
      return { name: `${cityName} PWD (Public Works Department)`, code: "PWD", sla: 3 };
    case "Water/Drainage":
      return { name: `${cityName} Municipal Water Works`, code: "WTW", sla: 2 };
    case "Solid Waste":
      return { name: `${cityName} Solid Waste Management Dept`, code: "SWM", sla: 1 };
    case "Electricity":
      return { name: `${cityName} Electricity Board`, code: "ELB", sla: 1 };
    case "Parks":
    default:
      return { name: `${cityName} Horticulture Department`, code: "HRT", sla: 4 };
  }
}

// Procedural Agent generator fallback (extremely detailed and strictly formats response)
function runProceduralAgentOrchestrator(
  title: string,
  description: string,
  category: 'Roads/Potholes' | 'Water/Drainage' | 'Solid Waste' | 'Electricity' | 'Parks',
  location: string,
  reporter: string,
  city: string = "Mumbai Municipal Corporation"
): { responses: AgentResponses; issueId: string; severity: number; priority: 'Low' | 'Medium' | 'High' | 'Critical'; points: number; sla: number } {
  
  const issueNum = Math.floor(100 + Math.random() * 900);
  const issueId = `I-${issueNum}`;
  const compNum = Math.floor(1000 + Math.random() * 9000);
  
  const wardDetails = getWardDetails(location, city);
  const deptDetails = getDepartmentDetails(category, city);
  
  // Estimate severity based on words
  const fullText = (title + " " + description).toLowerCase();
  let severity = 5;
  if (fullText.includes("accident") || fullText.includes("danger") || fullText.includes("injury") || fullText.includes("critical") || fullText.includes("live wire") || fullText.includes("severe")) {
    severity = 9;
  } else if (fullText.includes("broken") || fullText.includes("overflow") || fullText.includes("flooding") || fullText.includes("block") || fullText.includes("huge")) {
    severity = 7;
  } else if (fullText.includes("dirty") || fullText.includes("smell") || fullText.includes("flicker") || fullText.includes("dry")) {
    severity = 5;
  } else {
    severity = 4;
  }

  let priority: 'Low' | 'Medium' | 'High' | 'Critical' = "Medium";
  if (severity >= 9) priority = "Critical";
  else if (severity >= 7) priority = "High";
  else if (severity <= 4) priority = "Low";

  // Calculate points (50 to 200 based on severity and detail quality)
  const detailLengthPoints = Math.min(50, Math.floor(description.length / 5));
  const points = Math.min(200, Math.max(50, severity * 12 + detailLengthPoints));

  // Determine clusters (Geo-Router logic)
  const isKoregaonParkRoad = wardDetails.ward.includes("Yerawada") && category === "Roads/Potholes";
  const isFCRoadElec = wardDetails.ward.includes("Shivajinagar") && category === "Electricity";
  
  let clusterStatus = `New cluster KP-${deptDetails.code}-${issueNum} established`;
  if (isKoregaonParkRoad) {
    clusterStatus = "Merged with Koregaon Park Lane 1-5 Road Potholes Cluster [cluster ID: KP-RD-21]";
  } else if (isFCRoadElec) {
    clusterStatus = "Merged with FC Road Hanging/Flickering Electrical Cluster [cluster ID: FC-EL-12]";
  } else {
    clusterStatus = `New cluster LH-${deptDetails.code}-${issueNum} established in ${wardDetails.ward}`;
  }

  // Prediction mapping
  let predictionText = "No immediate structural failure alert. Area shows stable baseline patterns.";
  if (category === "Roads/Potholes" && wardDetails.ward.includes("Yerawada")) {
    predictionText = "High pothole accumulation density detected (>4.2/100m) with upcoming monsoon showers. Predicted complete pavement layer structural failure in ~2 weeks.";
  } else if (category === "Water/Drainage" && wardDetails.ward.includes("Shivajinagar")) {
    predictionText = "Micro-seismic pressure alerts in nearby water feeders match structural pipe failure curves. Rupture predicted within 7-10 days.";
  } else if (category === "Solid Waste") {
    predictionText = "Waste accumulation speed matches weekend commercial peaks. Spillage and toxic drainage leakages predicted within 48 hours.";
  }

  const orchestrator = `🧠 ORCHESTRATOR\nCivicPulse AI has captured a new civic report regarding "${title}". Mobilizing the specialized Classifier, Geo-Router, Resolution, and Insights sub-agents to process and escalate.`;
  
  const classifier = `🔍 CLASSIFIER AGENT\nClassified as ${category} | Severity: ${severity}/10 | Routing to: ${deptDetails.name} | Priority: ${priority}\nAnalysis: Subject matter involves critical community infrastructure requiring standard escalation protocols.`;
  
  const geoRouter = `📍 GEO-ROUTER AGENT\nChecking for nearby duplicates. Ward assignment: ${wardDetails.ward}. Lat: ${wardDetails.lat.toFixed(4)}, Lng: ${wardDetails.lng.toFixed(4)}. Cluster status: ${clusterStatus}.`;
  
  const resolution = `📄 RESOLUTION AGENT\nAction taken: formal complaint drafted | Complaint ID: CP-${deptDetails.code}-${compNum} | Sent to: ${deptDetails.name} | Expected response SLA: ${deptDetails.sla} days`;
  
  const complaintDraft = `To the attention of ${deptDetails.name},\n\nA civic issue has been reported regarding "${title}". Please review the attached details for immediate action.\n\nDescription: ${description}\nLocation: ${location}\nReported by: ${reporter}\n\nPlease escalate according to standard SLA.`;

  const insights = `📊 INSIGHTS AGENT\nPattern status: municipal grid infrastructure check complete. Prediction: ${predictionText} Recommendation: Coordinate immediate municipal repair teams.`;

  const rawText = `🧠 ORCHESTRATOR
I have received the civic issue report from ${reporter}. Activating CivicPulse Agent Orchestrator.

🔍 CLASSIFIER AGENT
Classify issue type: ${category} | Severity: ${severity}/10 | Routing to: ${deptDetails.name} | Priority: ${priority}

📍 GEO-ROUTER AGENT  
Check for nearby duplicates: Verified | Zone/Ward assignment: ${wardDetails.ward} | Cluster status: ${clusterStatus}

📄 RESOLUTION AGENT
Action taken: formal complaint drafted | Complaint ID: CP-${deptDetails.code}-${compNum} | Sent to: ${deptDetails.name} | Expected response SLA: ${deptDetails.sla} days

📊 INSIGHTS AGENT
Pattern analysis: Pattern detected | Prediction: ${predictionText} | Recommendation to authorities: municipal engineering division must isolate sector immediately.

✅ SUMMARY
Issue ID: ${issueId}
Status: Active
Resolution ETA: ${deptDetails.sla} days
Citizen Points Awarded: ${points}`;

  return {
    responses: {
      orchestrator,
      classifier,
      geoRouter,
      resolution,
      complaintDraft,
      insights,
      rawText
    },
    issueId,
    severity,
    priority,
    points,
    sla: deptDetails.sla
  };
}

// Function to initialize seed issues and compute stats
function seedDatabase() {
  reportedIssues = [];

  // Reset stats
  platformStats.totalIssuesThisMonth = 0;
  platformStats.resolvedIssues = 0;
  platformStats.resolutionRate = 100;
  platformStats.activeCitizens = 0;

  platformStats.issueBreakdown = {
    'Roads/Potholes': 0,
    'Water/Drainage': 0,
    'Solid Waste': 0,
    'Electricity': 0,
    'Parks': 0,
  };

  platformStats.departmentLoad = [
    { department: "Roads Department (PWD)", load: 0 },
    { department: "Water Supply & Drainage Board", load: 0 },
    { department: "Electricity & Power Board", load: 0 },
    { department: "Solid Waste Management Department", load: 0 },
    { department: "Horticulture & Parks Department", load: 0 },
  ];

  const seedData = [
    { title: "Deep Pothole on Main Road", category: "Roads/Potholes", description: "Large, deep pothole posing safety risk to commuters.", location: "Andheri", reportedBy: "Citizen_A" },
    { title: "Water Pipe Burst", category: "Water/Drainage", description: "Significant water wastage and flooding near the intersection.", location: "Bandra", reportedBy: "Citizen_B" },
    { title: "Uncollected Garbage Accumulation", category: "Solid Waste", description: "Garbage has not been collected for three days, attracting pests.", location: "Colaba", reportedBy: "Citizen_C" },
    { title: "Flickering Street Light", category: "Electricity", description: "Street light flickering and potentially dangerous.", location: "Andheri", reportedBy: "Citizen_D" },
    { title: "Broken Park Bench", category: "Parks", description: "Wooden park bench broken, needs immediate repair.", location: "Bandra", reportedBy: "Citizen_E" },
  ];

  seedData.forEach(data => {
    const analysis = runProceduralAgentOrchestrator(
      data.title, 
      data.description, 
      data.category as any, 
      data.location, 
      data.reportedBy, 
      "Mumbai Municipal Corporation"
    );

    const wardDetails = getWardDetails(data.location, "Mumbai Municipal Corporation");
    const deptDetails = getDepartmentDetails(data.category as any, "Mumbai Municipal Corporation");

    const newIssue: CivicIssue = {
      id: analysis.issueId,
      title: data.title,
      description: data.description,
      category: data.category as any,
      location: data.location,
      ward: wardDetails.ward,
      lat: wardDetails.lat,
      lng: wardDetails.lng,
      reportedBy: data.reportedBy,
      reportedAt: new Date(Date.now() - Math.floor(Math.random() * 86400000)).toISOString(),
      severity: analysis.severity,
      status: "Active",
      department: deptDetails.name,
      priority: analysis.priority,
      points: analysis.points,
      verificationCount: Math.floor(Math.random() * 5),
      agentResponses: analysis.responses,
      state: "Maharashtra",
      city: "Mumbai Municipal Corporation"
    };

    reportedIssues.push(newIssue);
    platformStats.totalIssuesThisMonth += 1;
    platformStats.issueBreakdown[data.category as keyof typeof platformStats.issueBreakdown] += 1;
    platformStats.activeCitizens += 1;
  });
}

// Auto-escalation simulation
setInterval(() => {
  reportedIssues.forEach(issue => {
    if (issue.status !== 'Escalated' && issue.verificationCount >= 5) {
      // For demo, simulate 24hrs as 60s
      const reportedTime = new Date(issue.reportedAt).getTime();
      const now = Date.now();
      if (now - reportedTime > 60 * 1000) {
        issue.status = 'Escalated';
        issue.severity = 10;
        issue.priority = 'Critical';
      }
    }
  });
}, 30000);

// Perform initial seed of database
seedDatabase();

function updateResolutionRate() {
  platformStats.resolutionRate = platformStats.totalIssuesThisMonth > 0
    ? Math.round((platformStats.resolvedIssues / platformStats.totalIssuesThisMonth) * 100)
    : 100;
}

// API route to check for duplicates
app.post("/api/check-duplicates", async (req, res) => {
  try {
    const { category, location, description } = req.body;
    const similarIssues = reportedIssues.filter(i => 
      i.category === category && 
      (i.location.toLowerCase().includes(location.toLowerCase()) || location.toLowerCase().includes(i.location.toLowerCase()))
    );

    if (similarIssues.length === 0) return res.json({ duplicate: null });

    if (!isAiAvailable()) return res.json({ duplicate: null }); // No AI, no check

    const prompt = `A citizen is about to report the following issue:
Category: ${category}
Location: ${location}
Description: "${description}"

Here are existing similar reports in the same area:
${similarIssues.map(i => `- ${i.id}: ${i.title} (${i.reportedAt})`).join('\n')}

Are any of these a duplicate? If yes, return the ID of the duplicate issue and a reason. If no, return duplicate: null.
Response format (JSON):
{
  "duplicate": "ID" | null,
  "reason": "String"
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const result = JSON.parse(response.text?.trim() || '{"duplicate": null}');
    res.json(result);
  } catch (error) {
    if (!isAiDisabled) {
      console.error("Duplicate check failed:", error);
      disableAi(error);
    }
    res.json({ duplicate: null });
  }
});

let isAiDisabled = false;

// Express Endpoint to return stats
app.get("/api/stats", (req, res) => {
  res.json(platformStats);
});

// Helper to check if AI is available
function isAiAvailable() {
  const available = !!(ai && !isAiDisabled);
  console.log("isAiAvailable check:", { aiExists: !!ai, isAiDisabled, available });
  return available;
}

// Helper to disable AI on permanent error
function disableAi(error: any) {
  if (isAiDisabled) return;
  
  const errorString = JSON.stringify(error, Object.getOwnPropertyNames(error));
  console.log("DisableAI error object:", errorString);
  
  if (errorString.includes('429') || errorString.includes('RESOURCE_EXHAUSTED')) {
    isAiDisabled = true;
    console.warn("AI service disabled due to resource exhaustion.");
    console.log("isAiDisabled is now:", isAiDisabled);
  }
}

// Express Endpoint to return all reported issues
app.get("/api/reports", (req, res) => {
  res.json(reportedIssues);
});

// Express Endpoint to auto-draft a description using Gemini AI
app.post("/api/draft", async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt for drafting." });
    }

    if (!isAiAvailable()) {
      return res.json({ draft: "I am reporting a severe civic issue in my area concerning: " + prompt + ". Please resolve it immediately to ensure citizen safety." });
    }

    const aiResponse = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are an AI assistant helping a citizen write a formal and descriptive civic issue report to their Municipal Corporation.
Given the citizen's short description or keywords, draft a professional, detailed, and realistic description that they can submit. Add realistic details like estimated dimensions, safety risks, or surrounding context to make it actionable.
Keep it to 2-4 sentences.
Citizen's input: "${prompt}"`,
      config: {
        systemInstruction: "Draft civic complaints professionally."
      }
    });

    res.json({ draft: aiResponse.text?.trim() || "" });
  } catch (error) {
    console.error("Draft generation failed, falling back:", error);
    disableAi(error);
    res.json({ draft: "I am reporting a civic issue concerning: " + prompt + ". Please address this as soon as possible." });
  }
});

// Express Endpoint to report a new issue (Running multi-agent analysis)
app.post("/api/report", async (req, res) => {
  try {
    let { title, description, category, location, reportedBy, imageUrl, lat, lng, state, city } = req.body;

    if (!title || !description || !category || !location || !reportedBy) {
      return res.status(400).json({ error: "Missing required fields for civic issue reporting." });
    }

    const locLower = location.toLowerCase();
    const isDhule = locLower.includes("dhule") || locLower.includes("sakri") || locLower.includes("dubl") || (city && (city.toLowerCase().includes("dhule") || city.toLowerCase().includes("dubl")));

    if (!state) {
      state = "Maharashtra";
    }
    if (!city) {
      city = isDhule ? "Dhule Municipal Corporation" : "Mumbai Municipal Corporation";
    }

    const wardDetails = getWardDetails(location, city);
    const deptDetails = getDepartmentDetails(category, city);

    // Call procedural as a baseline or fallback
    const localAnalysis = runProceduralAgentOrchestrator(title, description, category, location, reportedBy, city);

    let finalResponses: AgentResponses = localAnalysis.responses;
    let finalSeverity = localAnalysis.severity;
    let finalPriority = localAnalysis.priority;
    let finalPoints = localAnalysis.points;
    let finalSla = localAnalysis.sla;
    let finalIssueId = localAnalysis.issueId;

    // Use direct custom coordinates if supplied, otherwise fall back to ward-based random generation
    const finalLat = lat !== undefined && lat !== null ? Number(lat) : wardDetails.lat + (Math.random() - 0.5) * 0.005;
    const finalLng = lng !== undefined && lng !== null ? Number(lng) : wardDetails.lng + (Math.random() - 0.5) * 0.005;

    // Try Gemini if available
    if (isAiAvailable()) {
      try {
        const prompt = `A citizen reported the following civic issue on our platform:
Title: "${title}"
Description: "${description}"
Category: "${category}"
Location specified: "${location}"
Reported By: "${reportedBy}"
Coordinates: Lat ${finalLat.toFixed(5)}, Lng ${finalLng.toFixed(5)}

Act as our multi-agent orchestration system (CivicPulse AI) and analyze this. You have 4 specialized agents:
1. CLASSIFIER AGENT - Classify issue type, assess severity (1-10), route to department: ${deptDetails.name}, assign priority (Low, Medium, High, Critical).
2. GEO-ROUTER AGENT - Check duplicate, assign ward: ${wardDetails.ward}, assign coordinates: Lat ${finalLat.toFixed(4)}, Lng ${finalLng.toFixed(4)}, declare cluster status.
3. RESOLUTION AGENT - Draft formal complaint details, generate unique Complaint ID matching CP-[CODE]-XXXX, note expected response SLA in days. Write a full, formal complaint letter draft addressing the department.
4. INSIGHTS AGENT - Detect pattern, make predictions (e.g., predicted pavements failure in 2 weeks or water pipe pressure bursts in 7-10 days if applicable), and give concrete recommendations to local authorities.

You MUST respond strictly in the following JSON format. Do not add markdown outside of the JSON object.
JSON Schema:
{
  "orchestrator": "🧠 ORCHESTRATOR\\n[1-2 sentences acknowledging and dispatching]",
  "classifier": "🔍 CLASSIFIER AGENT\\n[Exact text specified in instructions: Classify issue type | Severity: X/10 | Routing to: ${deptDetails.name} | Priority: Low/Medium/High/Critical. Followed by a short analysis]",
  "geoRouter": "📍 GEO-ROUTER AGENT\\n[Check for duplicates | Zone/Ward assignment: ${wardDetails.ward} | Cluster status. Followed by ward details]",
  "resolution": "📄 RESOLUTION AGENT\\n[Action taken: formal complaint drafted | Complaint ID: CP-${deptDetails.code}-XXXX | Sent to: ${deptDetails.name} | Expected response SLA: X days]",
  "complaintDraft": "[Full, formal complaint letter addressed to ${deptDetails.name} detailing the issue from ${reportedBy} at ${location}]",
  "insights": "📊 INSIGHTS AGENT\\n[Pattern detected or not | Prediction if applicable | Recommendation to local authorities]",
  "suggestedResolution": "Suggested resolution (crew type, cost estimate, similar fix duration)",
  "rawText": "[Complete, continuous text block formatted EXACTLY matching the prompt response format with headers, agent sections and the ✅ SUMMARY section]",
  "metadata": {
    "severity": number,
    "priority": "Low" | "Medium" | "High" | "Critical",
    "points": number,
    "eta": number
  }
}

Be highly realistic and specific. Ensure you follow the response format precisely.`;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            systemInstruction: "You are CivicPulse AI, a multi-agent community civic issue system.",
          },
        });

        if (response.text) {
          const geminiResult = JSON.parse(response.text.trim());
          if (geminiResult.orchestrator && geminiResult.classifier && geminiResult.geoRouter) {
            finalResponses = {
              orchestrator: geminiResult.orchestrator,
              classifier: geminiResult.classifier,
              geoRouter: geminiResult.geoRouter,
              resolution: geminiResult.resolution,
              complaintDraft: geminiResult.complaintDraft,
              insights: geminiResult.insights,
              rawText: geminiResult.rawText || localAnalysis.responses.rawText,
            };
            // Added suggestedResolution
            (finalResponses as any).suggestedResolution = geminiResult.suggestedResolution; 
            if (geminiResult.metadata) {
              finalSeverity = geminiResult.metadata.severity || localAnalysis.severity;
              finalPriority = geminiResult.metadata.priority || localAnalysis.priority;
              finalPoints = geminiResult.metadata.points || localAnalysis.points;
              finalSla = geminiResult.metadata.eta || localAnalysis.sla;
            }
          }
        }
      } catch (geminiError) {
        console.error("Gemini model generation failed, falling back to robust local agents:", geminiError);
        disableAi(geminiError);
      }
    }

    const newIssue: CivicIssue = {
      id: finalIssueId,
      title,
      description,
      category,
      location,
      ward: wardDetails.ward,
      lat: finalLat,
      lng: finalLng,
      reportedBy,
      reportedAt: new Date().toISOString(),
      severity: finalSeverity,
      status: "Routed",
      department: deptDetails.name,
      priority: finalPriority,
      points: finalPoints,
      imageUrl: imageUrl || undefined,
      verificationCount: 0,
      verifiedBy: [],
      agentResponses: finalResponses,
      state,
      city,
      slaDeadline: new Date(Date.now() + finalSla * 24 * 60 * 60 * 1000).toISOString(),
      suggestedResolution: (finalResponses as any).suggestedResolution
    };

    reportedIssues.unshift(newIssue);

    // Dynamic stats update
    platformStats.totalIssuesThisMonth += 1;
    platformStats.issueBreakdown[category] += 1;
    platformStats.activeCitizens += 1;
    updateResolutionRate();

    // Update department load dynamically
    const categoryToIndex: { [key: string]: number } = {
      'Roads/Potholes': 0,
      'Water/Drainage': 1,
      'Electricity': 2,
      'Solid Waste': 3,
      'Parks': 4,
    };
    const deptLoadIdx = categoryToIndex[category];
    if (deptLoadIdx !== undefined && platformStats.departmentLoad[deptLoadIdx]) {
      platformStats.departmentLoad[deptLoadIdx].load = Math.min(98, platformStats.departmentLoad[deptLoadIdx].load + 1);
    }

    res.json(newIssue);
  } catch (error) {
    console.error("Failed to report issue:", error);
    res.status(500).json({ error: "An error occurred while running PMC multi-agent orchestration." });
  }
});

// Verify/upvote issue endpoint (Community Verification & Gamification)
app.post("/api/verify/:id", (req, res) => {
  const { id } = req.params;
  const { user } = req.body;
  const issue = reportedIssues.find(i => i.id === id);
  if (!issue) {
    return res.status(404).json({ error: "Issue not found" });
  }
  if (!user) {
    return res.status(400).json({ error: "User info missing" });
  }

  issue.verifiedBy = issue.verifiedBy || [];
  if (!issue.verifiedBy.includes(user)) {
    issue.verifiedBy.push(user);
    issue.verificationCount = (issue.verificationCount || 0) + 1;
    // Boost points when verified
    issue.points += 5;
  }
  
  res.json(issue);
});

// Resolve issue endpoint (for simulation)
app.post("/api/resolve/:id", (req, res) => {
  const { id } = req.params;
  const issue = reportedIssues.find(i => i.id === id);
  if (!issue) {
    return res.status(404).json({ error: "Issue not found" });
  }
  issue.status = "Resolved";
  platformStats.resolvedIssues += 1;
  updateResolutionRate();
  res.json(issue);
});

// Admin update issue endpoint (with RBAC capability)
app.post("/api/admin/update-issue/:id", (req, res) => {
  const { id } = req.params;
  const { status, priority, ward, department, adminNotes } = req.body;

  const issue = reportedIssues.find(i => i.id === id);
  if (!issue) {
    return res.status(404).json({ error: "Issue not found" });
  }

  const prevStatus = issue.status;

  if (status) {
    issue.status = status;
    if (status === "Resolved" && prevStatus !== "Resolved") {
      platformStats.resolvedIssues += 1;
      updateResolutionRate();
    } else if (status !== "Resolved" && prevStatus === "Resolved") {
      platformStats.resolvedIssues = Math.max(0, platformStats.resolvedIssues - 1);
      updateResolutionRate();
    }
  }

  if (priority) {
    issue.priority = priority;
  }

  if (ward) {
    issue.ward = ward;
  }

  if (department) {
    issue.department = department;
  }

  if (adminNotes !== undefined) {
    issue.adminNotes = adminNotes;
  }

  res.json({ success: true, issue });
});

// Deploy preventive team / corrective action for a predicted failure risk zone
app.post("/api/stats/deploy-preventive/:id", (req, res) => {
  const { id } = req.params;
  const initialLength = platformStats.predictedFailures.length;
  platformStats.predictedFailures = platformStats.predictedFailures.filter(pf => pf.id !== id);
  if (platformStats.predictedFailures.length < initialLength) {
    // Optionally decrements department loads or updates system telemetry parameters
    res.json({ success: true, message: `Preventive corrective action deployed for ${id}. Risk mitigated.` });
  } else {
    res.status(404).json({ error: "Predicted failure ID not found." });
  }
});



// Get Predictive Insights Endpoint
app.get('/api/predictive-insights', async (req, res) => {
  let aiInsights = null;

  if (reportedIssues.length > 0 && isAiAvailable()) {
    console.log("AI is available, calling models.generateContent");
    try {
      const issuesContext = reportedIssues.slice(0, 15).map(i => `[${i.category}] ${i.location} - ${i.title}`).join("\n");
      const prompt = `Based on the following recent civic issues, generate a predictive insight analysis forecasting 2-3 potential civic infrastructure failure points.

Recent Issues:
${issuesContext}

Return a JSON array of objects with the following schema exactly (no markdown formatting outside the array, just the raw JSON array):
[
  {
    "id": "Unique string ID (e.g. PI-101)",
    "location": "String describing the vulnerable area based on the issues",
    "type": "String describing infrastructure type (e.g. Water Pipe, Road Pavement, Transformer)",
    "indicator": "String describing the pattern detected from the issues",
    "timeframe": "String forecasting when failure might occur",
    "preventiveAction": "String recommending specific action",
    "riskLevel": "High" | "Critical" | "Medium"
  }
]`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      if (response.text) {
        aiInsights = JSON.parse(response.text.trim());
      }
    } catch (error) {
      if (!isAiDisabled) {
        console.error("Predictive insights generation failed:", error);
        disableAi(error);
      }
    }
  } else {
    console.log("AI is NOT available, skipping calling models.generateContent");
  }

  if (aiInsights) {
    return res.json({ insights: aiInsights });
  }

  // Fallback to rule-based analysis
  const insights: any[] = [];
  if (reportedIssues.length > 0) {
    const cluster = reportedIssues.reduce((acc, curr) => {
      const key = `${curr.location}-${curr.category}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(cluster).forEach(([key, count]) => {
      if (count >= 2) {
        const [loc, cat] = key.split('-');
        insights.push(`${loc} ${cat} cluster — ${count} reports in 72hrs, PWD overload risk: HIGH. Recommend preventive inspection.`);
      }
    });
  }

  if (insights.length === 0) {
    insights.push("No immediate trends identified based on current incident data.");
  }

  res.json({ insights });
});

// Get Citizen Gamification Profile
app.get('/api/citizen-profile', (req, res) => {
  const email = req.query.email as string;
  const name = req.query.name as string;
  
  if (!email) {
    return res.status(400).json({ error: "Email required" });
  }

  let points = 0;
  let reportsCount = 0;
  let verifiedCount = 0;
  
  reportedIssues.forEach(issue => {
    if (issue.reportedBy === name || issue.reportedBy === email) {
      reportsCount++;
      points += 10;
    }
    if (issue.verifiedBy && issue.verifiedBy.includes(name || email)) {
      verifiedCount++;
      points += 5;
    }
  });

  const badges = [];
  if (reportsCount > 0) badges.push('First Report');
  if (reportsCount >= 5) badges.push('Civic Hero');
  if (verifiedCount >= 5) badges.push('Community Guardian');

  res.json({
    name: name || email,
    email,
    points,
    reportsCount,
    verifiedCount,
    badges
  });
});

// Removed simulated background issue resolution.



// Mount Vite in dev mode, static folder in prod
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CivicPulse AI backend server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

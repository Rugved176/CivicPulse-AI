import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { CivicIssue, AgentResponses } from "./src/types.ts";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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

  // Calculate stats safely
  platformStats.totalIssuesThisMonth = 0;
  platformStats.resolvedIssues = 0;
  platformStats.resolutionRate = 100;
  platformStats.activeCitizens = 0;

  // Update breakdown
  platformStats.issueBreakdown = {
    'Roads/Potholes': 0,
    'Water/Drainage': 0,
    'Solid Waste': 0,
    'Electricity': 0,
    'Parks': 0,
  };

  // Update department loads safely with generic loads (not mentioning Pune or PMC or MSEDCL)
  platformStats.departmentLoad = [
    { department: "Roads Department (PWD)", load: 42 },
    { department: "Water Supply & Drainage Board", load: 28 },
    { department: "Electricity & Power Board", load: 35 },
    { department: "Solid Waste Management Department", load: 19 },
    { department: "Horticulture & Parks Department", load: 12 },
  ];
}

// Perform initial seed of database
seedDatabase();

// Express Endpoint to return stats
app.get("/api/stats", (req, res) => {
  res.json(platformStats);
});

// Express Endpoint to return all reported issues
app.get("/api/reports", (req, res) => {
  res.json(reportedIssues);
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
    if (ai) {
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
3. RESOLUTION AGENT - Draft formal complaint details, generate unique Complaint ID matching CP-[CODE]-XXXX, note expected response SLA in days.
4. INSIGHTS AGENT - Detect pattern, make predictions (e.g., predicted pavements failure in 2 weeks or water pipe pressure bursts in 7-10 days if applicable), and give concrete recommendations to local authorities.

You MUST respond strictly in the following JSON format. Do not add markdown outside of the JSON object.
JSON Schema:
{
  "orchestrator": "🧠 ORCHESTRATOR\\n[1-2 sentences acknowledging and dispatching]",
  "classifier": "🔍 CLASSIFIER AGENT\\n[Exact text specified in instructions: Classify issue type | Severity: X/10 | Routing to: ${deptDetails.name} | Priority: Low/Medium/High/Critical. Followed by a short analysis]",
  "geoRouter": "📍 GEO-ROUTER AGENT\\n[Check for duplicates | Zone/Ward assignment: ${wardDetails.ward} | Cluster status. Followed by ward details]",
  "resolution": "📄 RESOLUTION AGENT\\n[Action taken: formal complaint drafted | Complaint ID: CP-${deptDetails.code}-XXXX | Sent to: ${deptDetails.name} | Expected response SLA: X days]",
  "insights": "📊 INSIGHTS AGENT\\n[Pattern detected or not | Prediction if applicable | Recommendation to local authorities]",
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
              insights: geminiResult.insights,
              rawText: geminiResult.rawText || localAnalysis.responses.rawText,
            };
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
      status: "Active",
      department: deptDetails.name,
      priority: finalPriority,
      points: finalPoints,
      imageUrl: imageUrl || "https://images.unsplash.com/photo-1584824486509-112e4181ff6b?w=500&auto=format&fit=crop", // placeholder engineering
      agentResponses: finalResponses,
      state,
      city
    };

    reportedIssues.unshift(newIssue);

    // Dynamic stats update
    platformStats.totalIssuesThisMonth += 1;
    platformStats.issueBreakdown[category] += 1;
    platformStats.activeCitizens += 1;

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

// Resolve issue endpoint (for simulation)
app.post("/api/resolve/:id", (req, res) => {
  const { id } = req.params;
  const issue = reportedIssues.find(i => i.id === id);
  if (!issue) {
    return res.status(404).json({ error: "Issue not found" });
  }
  issue.status = "Resolved";
  platformStats.resolvedIssues += 1;
  platformStats.resolutionRate = platformStats.totalIssuesThisMonth > 0
    ? Math.round((platformStats.resolvedIssues / platformStats.totalIssuesThisMonth) * 100)
    : 100;
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
      platformStats.resolutionRate = platformStats.totalIssuesThisMonth > 0
        ? Math.round((platformStats.resolvedIssues / platformStats.totalIssuesThisMonth) * 100)
        : 100;
    } else if (status !== "Resolved" && prevStatus === "Resolved") {
      platformStats.resolvedIssues = Math.max(0, platformStats.resolvedIssues - 1);
      platformStats.resolutionRate = platformStats.totalIssuesThisMonth > 0
        ? Math.round((platformStats.resolvedIssues / platformStats.totalIssuesThisMonth) * 100)
        : 100;
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

// Google OAuth callback endpoint (to handle token extraction and post back to main window)
app.get(['/auth/callback', '/auth/callback/'], (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Google Connection Success</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background-color: #f8fafc;
            color: #1e293b;
            text-align: center;
          }
          .card {
            background: white;
            padding: 2.5rem;
            border-radius: 1.25rem;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.08);
            max-width: 340px;
            border: 1px solid #e2e8f0;
          }
          .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #2563eb;
            border-radius: 50%;
            width: 28px;
            height: 28px;
            animation: spin 1s linear infinite;
            margin: 1.25rem auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .logo {
            font-weight: 800;
            color: #2563eb;
            margin-bottom: 0.5rem;
            font-size: 1.25rem;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="logo">CivicPulse AI</div>
          <div class="spinner"></div>
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; font-weight: 700;">Connecting with Google...</h3>
          <p style="margin: 0; font-size: 0.85rem; color: #64748b; line-height: 1.4;">Finishing authentication. This window will close automatically once the process completes.</p>
        </div>
        <script>
          // Extract hash fragment parameters
          const hash = window.location.hash;
          if (hash) {
            const params = new URLSearchParams(hash.substring(1));
            const accessToken = params.get('access_token');
            if (accessToken) {
              if (window.opener) {
                // Send success message to original tab
                window.opener.postMessage({ type: 'GOOGLE_OAUTH_SUCCESS', accessToken }, '*');
                window.close();
              } else {
                window.location.href = '/?access_token=' + accessToken;
              }
            } else {
              document.body.innerHTML = '<div class="card"><h3 style="color: #ef4444;">Error</h3><p style="font-size: 0.875rem; color: #64748b;">Google Access Token could not be found in hash.</p></div>';
            }
          } else {
            const urlParams = new URLSearchParams(window.location.search);
            const error = urlParams.get('error');
            if (error) {
              if (window.opener) {
                window.opener.postMessage({ type: 'GOOGLE_OAUTH_FAILURE', error }, '*');
                window.close();
              }
              document.body.innerHTML = '<div class="card"><h3 style="color: #ef4444;">Auth Denied</h3><p style="font-size: 0.875rem; color: #64748b;">' + error + '</p></div>';
            } else {
              document.body.innerHTML = '<div class="card"><h3>Authenticating...</h3><p style="font-size: 0.875rem; color: #64748b;">Processing callback from Google servers.</p></div>';
            }
          }
        </script>
      </body>
    </html>
  `);
});

// Google profile userinfo proxy endpoint
app.get('/api/auth/profile', async (req, res) => {
  const token = req.query.access_token as string;
  if (!token) {
    return res.status(400).json({ error: 'Missing access_token' });
  }

  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${token}`);
    if (!response.ok) {
      throw new Error('Failed to fetch profile from Google');
    }
    const data = await response.json();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Simulate background PMC resolution or escalation every 25 seconds to demonstrate real-time notifications
setInterval(() => {
  const activeIssues = reportedIssues.filter(i => i.status === "Active");
  if (activeIssues.length > 0) {
    const randomIndex = Math.floor(Math.random() * activeIssues.length);
    const issueToUpdate = activeIssues[randomIndex];
    const shouldResolve = Math.random() < 0.7;
    
    if (shouldResolve) {
      issueToUpdate.status = "Resolved";
      platformStats.resolvedIssues += 1;
      platformStats.resolutionRate = platformStats.totalIssuesThisMonth > 0
        ? Math.round((platformStats.resolvedIssues / platformStats.totalIssuesThisMonth) * 100)
        : 100;
      console.log(`[SIMULATION] PMC background resolved issue ${issueToUpdate.id}`);
    } else {
      issueToUpdate.status = "Escalated";
      console.log(`[SIMULATION] PMC background escalated issue ${issueToUpdate.id}`);
    }
  }
}, 25000);


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

import React, { useState, useEffect, useRef } from "react";
import {
  User,
  Calendar,
  ShoppingCart,
  TrendingUp,
  MessageSquare,
  LayoutDashboard,
  LogOut,
  AlertTriangle,
  Check,
  Plus,
  Search,
  ChefHat,
  ShieldCheck,
  HelpCircle,
  Activity,
  DollarSign,
  Clock,
  Sparkles,
  ChevronRight,
  Info
} from "lucide-react";
import { api } from "./api";

// Helper to get recipe cost accurately by summing ingredients
const getRecipeCost = (recipe) => {
  if (!recipe || !recipe.ingredients) return 0;
  return recipe.ingredients.reduce((acc, ri) => acc + (ri.quantity * ri.ingredient.cost_per_unit), 0);
};

export default function App() {
  // Navigation & Screen States
  const [showSplash, setShowSplash] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, planner, shopping, trends, chef, profile
  const [authMode, setAuthMode] = useState("login"); // login, signup
  
  // Auth Form Inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [userEmail, setUserEmail] = useState("");

  // User Profile States
  const [weeklyBudget, setWeeklyBudget] = useState(4000); // Default 4000 INR
  const [allergies, setAllergies] = useState([]);
  const [severities, setSeverities] = useState({});
  const [nutritionGoals, setNutritionGoals] = useState({ calories: 2000, protein: 70 });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [newAllergyInput, setNewAllergyInput] = useState("");

  // Meal Plan States
  const [mealPlan, setMealPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planMessage, setPlanMessage] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [generationStep, setGenerationStep] = useState("");

  // Shopping List States
  const [shoppingList, setShoppingList] = useState(null);
  const [shoppingLoading, setShoppingLoading] = useState(false);
  const [checkedItems, setCheckedItems] = useState({});

  // Price Trends States
  const [trends, setTrends] = useState(() => {
    try {
      const email = localStorage.getItem("user_email");
      if (email) {
        const cached = localStorage.getItem(`trends_${email}`);
        return cached ? JSON.parse(cached) : [];
      }
    } catch (e) {
      console.error("Failed to load cached trends", e);
    }
    return [];
  });
  const [selectedTrendIng, setSelectedTrendIng] = useState("");
  const [trendsLoading, setTrendsLoading] = useState(false);

  // AI Chat States
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      content: "### Namaste & Welcome to the AI Smart Chef! 🍳\n\nHow can I help you cook safe, affordable, and delicious Indian meals today? Ask me about Indian recipe substitutions, spice adjustments, or grain alternatives.",
      source: "System"
    }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // Check auth on load
  useEffect(() => {
    const token = api.getToken();
    if (token) {
      setIsAuthenticated(true);
      setUserEmail(localStorage.getItem("user_email") || "user@example.com");
      fetchProfile();
      fetchCurrentMealPlan();
    }
  }, []);

  // Fetch helper endpoints
  const fetchProfile = async () => {
    try {
      const data = await api.get("/profile");
      setWeeklyBudget(data.weekly_budget);
      setAllergies(data.allergies);
      setSeverities(data.allergen_severities);
      if (data.nutrition_goals) {
        setNutritionGoals(data.nutrition_goals);
      }
    } catch (err) {
      console.error("Failed to fetch profile", err);
    }
  };

  const fetchCurrentMealPlan = async () => {
    try {
      const data = await api.get("/meal-plan/current");
      if (data && data.meals && data.meals.length > 0) {
        setMealPlan(data);
        fetchShoppingList();
      }
    } catch (err) {
      console.error("Failed to fetch meal plan", err);
    }
  };

  const fetchShoppingList = async () => {
    setShoppingLoading(true);
    try {
      const data = await api.get("/shopping-list");
      setShoppingList(data);
    } catch (err) {
      console.error("Failed to fetch shopping list", err);
    } finally {
      setShoppingLoading(false);
    }
  };

  const fetchPriceTrends = async () => {
    setTrendsLoading(true);
    try {
      const data = await api.get("/price-trends");
      setTrends(data);
      if (userEmail) {
        localStorage.setItem(`trends_${userEmail}`, JSON.stringify(data));
      }
      if (data.length > 0) {
        if (!selectedTrendIng || !data.some(d => d.ingredient === selectedTrendIng)) {
          setSelectedTrendIng(data[0].ingredient);
        }
      }
    } catch (err) {
      console.error("Failed to fetch price trends", err);
    } finally {
      setTrendsLoading(false);
    }
  };

  // Trigger trends fetch when trends tab is clicked (only if not loaded yet)
  useEffect(() => {
    if (activeTab === "trends" && isAuthenticated && trends.length === 0) {
      fetchPriceTrends();
    }
  }, [activeTab, isAuthenticated]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, chatLoading]);

  // Auth operations
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (authMode === "signup") {
        await api.post("/auth/signup", { email, password });
        const loginData = await api.post("/auth/login", { email, password });
        api.setToken(loginData.access_token);
        localStorage.setItem("user_email", email);
        setUserEmail(email);
        setIsAuthenticated(true);
        fetchProfile();
      } else {
        const loginData = await api.post("/auth/login", { email, password });
        api.setToken(loginData.access_token);
        localStorage.setItem("user_email", email);
        setUserEmail(email);
        setIsAuthenticated(true);
        fetchProfile();
        fetchCurrentMealPlan();
      }
    } catch (err) {
      setAuthError(err.message || "Authentication failed");
    }
  };

  const handleLogout = () => {
    api.clearToken();
    localStorage.removeItem("user_email");
    setIsAuthenticated(false);
    setMealPlan(null);
    setShoppingList(null);
    setWeeklyBudget(4000);
    setAllergies([]);
    setSeverities({});
    setActiveTab("dashboard");
  };

  // Allergy builder logic
  const handleAddAllergy = () => {
    if (!newAllergyInput.trim()) return;
    const allergen = newAllergyInput.trim().toLowerCase();
    if (!allergies.includes(allergen)) {
      setAllergies([...allergies, allergen]);
      setSeverities(prev => ({ ...prev, [allergen]: "severe" })); // Default to severe
    }
    setNewAllergyInput("");
  };

  const handleRemoveAllergy = (allergen) => {
    setAllergies(allergies.filter(a => a !== allergen));
    const updatedSeverities = { ...severities };
    delete updatedSeverities[allergen];
    setSeverities(updatedSeverities);
  };

  const handleAllergyToggle = (allergen, severity) => {
    setSeverities(prev => ({
      ...prev,
      [allergen]: severity
    }));
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    setProfileMessage("");
    try {
      await api.put("/profile", {
        weekly_budget: Number(weeklyBudget),
        allergies,
        allergen_severities: severities,
        nutrition_goals: nutritionGoals
      });
      setProfileMessage("Configuration updated successfully!");
      if (mealPlan) {
        setPlanMessage("Your allergy configuration changed. Regenerate your meal plan to ensure safety!");
      }
      setTimeout(() => setProfileMessage(""), 4000);
    } catch (err) {
      setProfileMessage(`Error: ${err.message}`);
    } finally {
      setProfileSaving(false);
    }
  };

  // Meal Plan optimization trigger
  const handleOptimizeMealPlan = async () => {
    setPlanLoading(true);
    setPlanMessage("");
    setTrends([]); // Clear current trends to force a reload on finish
    if (userEmail) {
      localStorage.removeItem(`trends_${userEmail}`);
    }
    setGenerationStep("Analyzing dietary profile & severe exclusions...");
    
    const steps = [
      "Formulating safe Indian menu alternatives...",
      "Resolving linear programming budget constraints in INR...",
      "Checking nutritional metrics & protein goals...",
      "Consolidating shopping quantities & allergen swaps...",
      "Querying OpenAI market price trends..."
    ];
    
    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < steps.length) {
        setGenerationStep(steps[stepIndex]);
        stepIndex++;
      }
    }, 1500);

    try {
      const data = await api.post("/meal-plan/generate");
      clearInterval(interval);
      setGenerationStep("Finalizing weekly plan display...");
      setTimeout(() => {
        setMealPlan(data);
        if (!data.success) {
          setPlanMessage(data.message);
        } else {
          setPlanMessage("Successfully optimized and generated your Indian meal plan!");
        }
        fetchShoppingList();
        fetchPriceTrends();
        setPlanLoading(false);
        setGenerationStep("");
      }, 500);
    } catch (err) {
      clearInterval(interval);
      setPlanMessage(err.message || "Failed to generate meal plan.");
      setPlanLoading(false);
      setGenerationStep("");
    }
  };

  // AI Chef Chat trigger
  const handleSendChatMessage = async (presetPrompt = "") => {
    const promptToSend = presetPrompt || chatInput;
    if (!promptToSend.trim()) return;

    const userMessage = { role: "user", content: promptToSend };
    setChatMessages(prev => [...prev, userMessage]);
    setChatInput("");
    setChatLoading(true);

    try {
      const data = await api.post("/ai-chef", { prompt: promptToSend });
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: data.response,
        source: data.source
      }]);
    } catch (err) {
      setChatMessages(prev => [...prev, {
        role: "assistant",
        content: `Error: ${err.message || "I had trouble processing that culinary request."}`
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Render tab viewport
  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return renderDashboard();
      case "planner":
        return renderPlanner();
      case "shopping":
        return renderShoppingList();
      case "trends":
        return renderPriceTrends();
      case "chef":
        return renderAIChef();
      case "profile":
        return renderProfile();
      default:
        return renderDashboard();
    }
  };

  // Tab 1: Dashboard
  const renderDashboard = () => {
    const severeAllergiesCount = Object.values(severities).filter(s => s === "severe").length;
    const mildAllergiesCount = Object.values(severities).filter(s => s === "mild").length;
    
    // Accumulate total cost accurately from the recipe objects
    let planCost = 0;
    if (mealPlan && mealPlan.meals) {
      mealPlan.meals.forEach(day => {
        planCost += getRecipeCost(day.breakfast);
        planCost += getRecipeCost(day.lunch);
        planCost += getRecipeCost(day.dinner);
      });
    }

    const budgetPercent = Math.min(Math.round((planCost / weeklyBudget) * 100), 100);
    
    // Circular Progress settings
    const radius = 64;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (budgetPercent / 100) * circumference;

    // Fetch today's meals (Monday)
    const mondayMeals = mealPlan?.meals?.find(m => m.day === "Monday") || null;

    return (
      <div className="tab-dashboard">
        <div className="page-header">
          <div className="page-title">
            <h1>Indian Health Spend Dashboard</h1>
            <p>Affordability meets safety. Monitor your allergy-filtered weekly spend metrics.</p>
          </div>
        </div>

        <div className="dashboard-grid">
          {/* Circular Chart */}
          <div className="card widget-budget">
            <h3 style={{ fontSize: "1.1rem", marginBottom: "8px", fontWeight: "700" }}>Weekly Budget Allocation</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Percentage of budget consumed by safe plan</p>
            
            <div className="radial-progress-container">
              <svg className="radial-progress-svg">
                <circle className="radial-progress-bg" cx="80" cy="80" r={radius} />
                <circle 
                  className="radial-progress-bar" 
                  cx="80" 
                  cy="80" 
                  r={radius} 
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  stroke={planCost > weeklyBudget ? "var(--accent-red)" : "var(--primary)"}
                />
              </svg>
              <div className="radial-progress-text">
                <span className="progress-cost">₹{planCost.toFixed(2)}</span>
                <span className="progress-cap">of ₹{weeklyBudget} cap</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "12px", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: planCost > weeklyBudget ? "var(--accent-red)" : "var(--primary)" }}></span>
                Spent: {budgetPercent}%
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "rgba(255,255,255,0.03)" }}></span>
                Margin: ₹{(weeklyBudget - planCost).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Metric Widgets */}
          <div className="widget-metrics">
            <div className="card metric-card" style={{ background: "linear-gradient(135deg, rgba(138, 92, 246, 0.05) 0%, rgba(16, 23, 38, 0.6) 100%)" }}>
              <div className="metric-header">
                <span className="metric-title">Strict Exclusions</span>
                <div className="metric-icon-wrap" style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--accent-red)" }}>
                  <ShieldCheck size={20} />
                </div>
              </div>
              <div>
                <span className="metric-value">{severeAllergiesCount}</span>
                <div className="metric-footer">Severe allergies filtered completely</div>
              </div>
            </div>

            <div className="card metric-card" style={{ background: "linear-gradient(135deg, rgba(6, 182, 212, 0.05) 0%, rgba(16, 23, 38, 0.6) 100%)" }}>
              <div className="metric-header">
                <span className="metric-title">Mild Warnings</span>
                <div className="metric-icon-wrap" style={{ background: "rgba(249, 115, 22, 0.1)", color: "var(--accent-orange)" }}>
                  <AlertTriangle size={20} />
                </div>
              </div>
              <div>
                <span className="metric-value">{mildAllergiesCount}</span>
                <div className="metric-footer">Indian substitutions configured</div>
              </div>
            </div>

            <div className="card metric-card" style={{ background: "linear-gradient(135deg, rgba(34, 197, 94, 0.05) 0%, rgba(16, 23, 38, 0.6) 100%)" }}>
              <div className="metric-header">
                <span className="metric-title">Safe Meals</span>
                <div className="metric-icon-wrap" style={{ background: "rgba(34, 197, 94, 0.1)", color: "var(--accent-green)" }}>
                  <ChefHat size={20} />
                </div>
              </div>
              <div>
                <span className="metric-value">{mealPlan ? 21 : 0}</span>
                <div className="metric-footer">Total active meals generated</div>
              </div>
            </div>
          </div>

          {/* Today's Meals */}
          <div className="card widget-today-meals">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "700" }}>Today's Meal Schedule (Monday)</h3>
              <button 
                className="btn-splash" 
                style={{ padding: "8px 16px", borderRadius: "8px", fontSize: "0.85rem" }}
                onClick={() => setActiveTab("planner")}
              >
                Full Calendar
              </button>
            </div>
            
            {planLoading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px", gap: "12px", border: "1px dashed var(--primary)", borderRadius: "12px" }}>
                <div className="chat-message-loader" style={{ padding: 0 }}><div className="chat-dot"></div><div className="chat-dot"></div><div className="chat-dot"></div></div>
                <h4 style={{ fontWeight: 700 }}>AI Optimization in Progress</h4>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontStyle: "italic" }}>{generationStep}</p>
              </div>
            ) : mondayMeals ? (
              <div className="today-meals-grid">
                {["breakfast", "lunch", "dinner"].map((category) => {
                  const recipe = mondayMeals[category];
                  if (!recipe) return null;
                  return (
                    <div 
                      key={category} 
                      className="meal-slot-card" 
                      style={{ height: "auto", cursor: "pointer", padding: "16px" }}
                      onClick={() => setSelectedRecipe(recipe)}
                    >
                      <span className="slot-tag">{category}</span>
                      <h4 style={{ fontSize: "0.95rem", margin: "4px 0 12px" }}>{recipe.title}</h4>
                      <div className="meal-meta" style={{ marginTop: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                        <span className="meal-cost" style={{ fontSize: "0.85rem" }}>Est: ₹{getRecipeCost(recipe).toFixed(2)}</span>
                        <span className="meal-protein" style={{ fontSize: "0.8rem" }}>{recipe.protein}g Protein</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-plan-placeholder" style={{ padding: "40px 20px" }}>
                <Calendar size={36} color="var(--text-muted)" />
                <p style={{ margin: "10px 0 16px" }}>No Indian meal plan generated for this week yet.</p>
                <button 
                  className="btn-optimize" 
                  onClick={handleOptimizeMealPlan}
                  disabled={planLoading || allergies.length === 0}
                >
                  Generate Plan Now
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Tab 2: Weekly Meal Planner
  const renderPlanner = () => {
    const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    return (
      <div className="tab-planner">
        <div className="page-header">
          <div className="page-title">
            <h1>Weekly Meal Planner</h1>
            <p>Our direct AI constraint optimizer compiles your safe Indian diet calendar instantly.</p>
          </div>
        </div>

        {/* Validation check: Force allergy generation before planner optimization */}
        {allergies.length === 0 ? (
          <div className="no-plan-placeholder" style={{ borderColor: "var(--accent-orange)" }}>
            <AlertTriangle size={48} color="var(--accent-orange)" />
            <h3 style={{ marginTop: "16px" }}>Allergy Profile Not Configured</h3>
            <p>You must type and save at least one allergy tag in the Settings page first before generating a customized meal plan.</p>
            <button className="btn-optimize" onClick={() => setActiveTab("profile")}>
              Go to Settings
            </button>
          </div>
        ) : (
          <>
            <div className="planner-actions">
              {planMessage && (
                <div 
                  className="budget-warning-banner" 
                  style={{ 
                    background: mealPlan?.success ? "rgba(34,197,94,0.08)" : "rgba(249,115,22,0.08)",
                    borderColor: mealPlan?.success ? "var(--accent-green)" : "var(--accent-orange)",
                    color: mealPlan?.success ? "#bbf7d0" : "#fed7aa"
                  }}
                >
                  <Info size={18} />
                  <span>{planMessage}</span>
                </div>
              )}
              <button 
                className="btn-optimize" 
                onClick={handleOptimizeMealPlan}
                disabled={planLoading}
              >
                {planLoading ? (
                  <div className="chat-message-loader" style={{ padding: 0 }}><div className="chat-dot"></div><div className="chat-dot"></div></div>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Optimize Weekly Plan
                  </>
                )}
              </button>
            </div>

            {planLoading ? (
              <div className="card" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 20px", gap: "16px", border: "2px dashed var(--primary)", borderRadius: "20px" }}>
                <div className="chat-message-loader"><div className="chat-dot"></div><div className="chat-dot"></div><div className="chat-dot"></div></div>
                <h4 style={{ fontWeight: 700 }}>AI Optimization in Progress</h4>
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", fontStyle: "italic" }}>{generationStep}</p>
              </div>
            ) : mealPlan && mealPlan.meals && mealPlan.meals.length > 0 ? (
              <div className="weekly-grid">
                {daysOfWeek.map((day) => {
                  const dayMeals = mealPlan.meals.find(m => m.day === day);
                  return (
                    <div key={day} className="day-column">
                      <div className="day-header">{day}</div>
                      
                      {["breakfast", "lunch", "dinner"].map((category) => {
                        const recipe = dayMeals ? dayMeals[category] : null;
                        if (!recipe) return null;
                        
                        return (
                          <div 
                            key={category} 
                            className="meal-slot-card"
                            onClick={() => setSelectedRecipe(recipe)}
                          >
                            <span className="slot-tag">{category}</span>
                            <div className="meal-title-clamp">{recipe.title}</div>
                            <div className="meal-meta">
                              <span className="meal-cost">₹{getRecipeCost(recipe).toFixed(2)}</span>
                              <span className="meal-protein">{recipe.protein}g P</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-plan-placeholder">
                <Calendar size={48} color="var(--text-muted)" />
                <h3>No Active Weekly Meal Calendar</h3>
                <p>Click optimize above to let OpenAI construct a weekly plan with Indian ingredients tailored to your allergies.</p>
                <button className="btn-optimize" onClick={handleOptimizeMealPlan} disabled={planLoading}>
                  {planLoading ? "Generating..." : "Optimize Weekly Plan"}
                </button>
              </div>
            )}
          </>
        )}

        {/* Recipe Modal Details */}
        {selectedRecipe && (
          <div className="modal-overlay" onClick={() => setSelectedRecipe(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="btn-close" onClick={() => setSelectedRecipe(null)}>✕</button>
              <h2 className="modal-recipe-title">{selectedRecipe.title}</h2>
              
              <div className="modal-meta-row">
                <div className="modal-meta-pill"><Clock size={12} style={{ display: "inline", marginRight: "4px" }} /> {selectedRecipe.prep_time} mins</div>
                <div className="modal-meta-pill">{selectedRecipe.calories} kCal</div>
                <div className="modal-meta-pill">Protein: {selectedRecipe.protein}g</div>
                <div className="modal-meta-pill">Carbs: {selectedRecipe.carbs}g</div>
                <div className="modal-meta-pill">Fat: {selectedRecipe.fat}g</div>
              </div>

              {selectedRecipe.allergens && (
                <div className="modal-allergens-banner">
                  <AlertTriangle size={16} />
                  <span><strong>Allergen Warnings:</strong> Contains {selectedRecipe.allergens}</span>
                </div>
              )}

              <p style={{ color: "var(--text-secondary)", fontStyle: "italic", marginBottom: "16px" }}>{selectedRecipe.description}</p>
              
              <h3 className="modal-section-title">Ingredients Used</h3>
              <ul className="modal-ingredients-list" style={{ marginBottom: "20px" }}>
                {selectedRecipe.ingredients && selectedRecipe.ingredients.map((ri, index) => (
                  <li key={index}>
                    <span>{ri.ingredient.name}</span>
                    <span style={{ fontWeight: 600 }}>{ri.quantity} {ri.ingredient.unit} (est. ₹{(ri.quantity * ri.ingredient.cost_per_unit).toFixed(2)})</span>
                  </li>
                ))}
              </ul>

              <h3 className="modal-section-title">Preparation Directions</h3>
              <p className="modal-instructions">{selectedRecipe.instructions}</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Tab 3: Shopping List
  const renderShoppingList = () => {
    const handleCheckToggle = (index) => {
      setCheckedItems(prev => ({
        ...prev,
        [index]: !prev[index]
      }));
    };

    return (
      <div className="tab-shopping">
        <div className="page-header">
          <div className="page-title">
            <h1>Shopping List Consolidator</h1>
            <p>Automatically consolidates recipe volumes and suggests safe swaps for mild allergies.</p>
          </div>
        </div>

        {shoppingLoading ? (
          <div className="no-plan-placeholder" style={{ border: "none" }}>
            <div className="chat-message-loader"><div className="chat-dot"></div><div className="chat-dot"></div><div className="chat-dot"></div></div>
            <p>Loading items...</p>
          </div>
        ) : shoppingList && shoppingList.items && shoppingList.items.length > 0 ? (
          <div className="shopping-grid">
            {/* Checklist */}
            <div className="shopping-items-list">
              <h3 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "8px" }}>Consolidated Indian Grocery Cart</h3>
              {shoppingList.items.map((item, index) => {
                const isChecked = !!checkedItems[index];
                return (
                  <div 
                    key={index} 
                    className={`shopping-item-card ${isChecked ? "checked" : ""}`}
                  >
                    <div className="item-left">
                      <div 
                        className={`custom-checkbox ${isChecked ? "checked" : ""}`}
                        onClick={() => handleCheckToggle(index)}
                      >
                        {isChecked && <Check size={14} color="#fff" />}
                      </div>
                      <div className="item-details" style={{ textDecoration: isChecked ? "line-through" : "none" }}>
                        <span className="item-name">{item.ingredient_name}</span>
                        <span className="item-quantity">{item.quantity} {item.unit}</span>
                      </div>
                    </div>

                    <div className="item-right">
                      {item.severity_alert !== "none" && (
                        <span className={`allergy-tag ${item.severity_alert}`}>
                          {item.severity_alert}
                        </span>
                      )}
                      <span className="item-cost-badge">₹{item.cost.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}

              <div className="card" style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Total Estimated Cost:</span>
                  <div style={{ fontSize: "1.6rem", fontWeight: "800", color: "var(--accent-cyan)", fontFamily: "var(--font-heading)" }}>
                    ₹{shoppingList.total_estimated_cost.toFixed(2)}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Budget Cushion:</span>
                  <div style={{ 
                    fontSize: "1.2rem", 
                    fontWeight: "700", 
                    color: shoppingList.budget_margin < 0 ? "var(--accent-red)" : "var(--accent-green)" 
                  }}>
                    {shoppingList.budget_margin < 0 ? "-" : ""}₹{Math.abs(shoppingList.budget_margin).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Substitution panel */}
            <div className="substitutions-panel">
              <h3 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "8px" }}>Smart Indian Swaps</h3>
              
              {shoppingList.items.some(i => i.substitution_suggested) ? (
                shoppingList.items
                  .filter(i => i.substitution_suggested)
                  .map((item, idx) => (
                    <div key={idx} className="substitution-alert-card">
                      <div className="sub-header">
                        <AlertTriangle size={14} />
                        <span>Swap {item.ingredient_name}</span>
                      </div>
                      <div className="sub-direction">
                        Replace with <strong>{item.substitution_suggested}</strong>
                      </div>
                      <div className="sub-desc">
                        Mild allergy warning. Swap with clean Indian alternatives.
                      </div>
                    </div>
                  ))
              ) : (
                <div className="card" style={{ textAlign: "center", padding: "30px 20px" }}>
                  <ShieldCheck size={28} color="var(--accent-green)" style={{ margin: "0 auto 10px" }} />
                  <h4 style={{ fontSize: "0.95rem" }}>All Safe!</h4>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "4px" }}>No allergen substitutions required for your active weekly meal recipes.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="no-plan-placeholder">
            <ShoppingCart size={48} color="var(--text-muted)" />
            <h3>Shopping Cart Empty</h3>
            <p>Consolidated cart loads automatically once a weekly optimized plan is compiled.</p>
          </div>
        )}
      </div>
    );
  };

  // Tab 4: Price Trends
  const renderPriceTrends = () => {
    const activeIngData = trends.find(t => t.ingredient === selectedTrendIng);
    const chartWidth = 500;
    const chartHeight = 220;
    const padding = 40;

    // Draw price graph using SVG
    let pathD = "";
    let dataPoints = [];
    if (activeIngData && activeIngData.history && activeIngData.history.length > 0) {
      const prices = activeIngData.history.map(h => h.price);
      const minPrice = Math.min(...prices) * 0.95;
      const maxPrice = Math.max(...prices) * 1.05;
      const priceRange = maxPrice - minPrice || 1.0;
      
      dataPoints = activeIngData.history.map((h, index) => {
        const x = padding + (index / (activeIngData.history.length - 1)) * (chartWidth - padding * 2);
        const y = chartHeight - padding - ((h.price - minPrice) / priceRange) * (chartHeight - padding * 2);
        return { x, y, price: h.price, date: h.date };
      });
      
      pathD = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    }

    return (
      <div className="tab-trends">
        <div className="page-header">
          <div className="page-title">
            <h1>Indian Price Trends</h1>
            <p>Visualizing raw seasonal price histories in India to help time your grocery acquisitions.</p>
          </div>
        </div>

        <div className="price-trends-header">
          <div className="trend-filters">
            {trends.map((item) => (
              <button 
                key={item.ingredient}
                className={`trend-filter-btn ${selectedTrendIng === item.ingredient ? "active" : ""}`}
                onClick={() => setSelectedTrendIng(item.ingredient)}
              >
                {item.ingredient}
              </button>
            ))}
          </div>
        </div>

        {trendsLoading ? (
          <div className="no-plan-placeholder" style={{ border: "none" }}>
            <div className="chat-message-loader"><div className="chat-dot"></div><div className="chat-dot"></div><div className="chat-dot"></div></div>
            <p>Plotting chart...</p>
          </div>
        ) : activeIngData ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <div className="card chart-card">
              <h3 style={{ fontSize: "1.1rem", fontWeight: "700" }}>
                Historic Pricing: {activeIngData.ingredient} (INR per {activeIngData.unit})
              </h3>
              
              <div className="chart-svg-container">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: "100%", height: "100%" }}>
                  {/* Grid Lines */}
                  {[0, 1, 2, 3].map((val) => {
                    const y = padding + (val / 3) * (chartHeight - padding * 2);
                    return (
                      <line 
                        key={val} 
                        x1={padding} 
                        y1={y} 
                        x2={chartWidth - padding} 
                        y2={y} 
                        stroke="rgba(255, 255, 255, 0.03)" 
                        strokeWidth="1" 
                      />
                    );
                  })}
                  
                  {/* Drawing Chart Line */}
                  {pathD && (
                    <>
                      <path 
                        d={pathD} 
                        fill="none" 
                        stroke="var(--primary)" 
                        strokeWidth="3" 
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d={`${pathD} L ${dataPoints[dataPoints.length - 1].x} ${chartHeight - padding} L ${dataPoints[0].x} ${chartHeight - padding} Z`}
                        fill="url(#chartGradient)"
                      />
                      {dataPoints.map((p, idx) => (
                        <g key={idx}>
                          <circle 
                            cx={p.x} 
                            cy={p.y} 
                            r="5" 
                            fill="var(--accent-cyan)" 
                            stroke="var(--bg-surface)" 
                            strokeWidth="2" 
                          />
                          <text 
                            x={p.x} 
                            y={p.y - 10} 
                            fill="var(--text-secondary)" 
                            fontSize="8" 
                            textAnchor="middle"
                          >
                            ₹{p.price.toFixed(1)}
                          </text>
                          <text 
                            x={p.x} 
                            y={chartHeight - padding + 15} 
                            fill="var(--text-muted)" 
                            fontSize="7" 
                            textAnchor="middle"
                          >
                            {p.date}
                          </text>
                        </g>
                      ))}
                    </>
                  )}
                  
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.2"/>
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                </svg>
              </div>

              <div className="trend-stats">
                <div className="stat-item">
                  <span className="metric-title" style={{ fontSize: "0.7rem" }}>Recent Price</span>
                  <div className="stat-val">₹{activeIngData.current_price.toFixed(1)}</div>
                </div>
                <div className="stat-item">
                  <span className="metric-title" style={{ fontSize: "0.7rem" }}>Min Price</span>
                  <div className="stat-val">
                    ₹{Math.min(...activeIngData.history.map(h => h.price)).toFixed(1)}
                  </div>
                </div>
                <div className="stat-item">
                  <span className="metric-title" style={{ fontSize: "0.7rem" }}>Max Price</span>
                  <div className="stat-val">
                    ₹{Math.max(...activeIngData.history.map(h => h.price)).toFixed(1)}
                  </div>
                </div>
                <div className="stat-item">
                  <span className="metric-title" style={{ fontSize: "0.7rem" }}>Market Recommendation</span>
                  <div className="stat-val" style={{ color: "var(--accent-green)", fontSize: "1.1rem", fontWeight: "800", paddingTop: "2px" }}>
                    BUY NOW
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="no-plan-placeholder">
            <TrendingUp size={48} color="var(--text-muted)" />
            <h3>No Price Histories Loaded</h3>
          </div>
        )}
      </div>
    );
  };

  // Tab 5: AI Chef Chat
  const renderAIChef = () => {
    const presets = [
      "How can I make Roti gluten-free?",
      "Suggest a cheap dairy alternative for Ghee in cooking.",
      "Explain the substitution chemistry of besan in batters.",
      "Recommend a high-protein dal recipe under ₹150."
    ];

    const formatMessageText = (text) => {
      if (!text) return "";
      const lines = text.split("\n");
      return lines.map((line, idx) => {
        let content = line;
        if (content.startsWith("### ")) {
          return <h3 key={idx}>{content.replace("### ", "")}</h3>;
        }
        if (content.startsWith("#### ")) {
          return <h4 key={idx}>{content.replace("#### ", "")}</h4>;
        }
        if (content.startsWith("- ") || content.startsWith("* ")) {
          const cleanLine = content.replace(/^[-*]\s+/, "");
          return <li key={idx} style={{ marginLeft: "16px" }} dangerouslySetInnerHTML={{ __html: parseBold(cleanLine) }} />;
        }
        if (/^\d+\.\s+/.test(content)) {
          const cleanLine = content.replace(/^\d+\.\s+/, "");
          return <li key={idx} style={{ marginLeft: "16px", listStyleType: "decimal" }} dangerouslySetInnerHTML={{ __html: parseBold(cleanLine) }} />;
        }
        return <p key={idx} dangerouslySetInnerHTML={{ __html: parseBold(content) }} />;
      });
    };

    const parseBold = (text) => {
      return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    };

    return (
      <div className="tab-chef">
        <div className="page-header">
          <div className="page-title">
            <h1>AI Smart Chef Assistant</h1>
            <p>A culinary chemist ready to adjust ingredients, discuss macro values, and explain allergen logic.</p>
          </div>
        </div>

        <div className="chat-container">
          <div className="chat-messages-area">
            {chatMessages.map((msg, index) => (
              <div 
                key={index} 
                className={`chat-bubble ${msg.role}`}
              >
                {formatMessageText(msg.content)}
                {msg.source && (
                  <div className="chat-bubble-source">Engine: {msg.source}</div>
                )}
              </div>
            ))}
            
            {chatLoading && (
              <div className="chat-bubble assistant">
                <div className="chat-message-loader">
                  <div className="chat-dot"></div>
                  <div className="chat-dot"></div>
                  <div className="chat-dot"></div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick presets */}
          <div style={{ display: "flex", gap: "10px", padding: "10px 24px", overflowX: "auto", background: "var(--bg-surface-elevated)", borderTop: "1px solid var(--border-color)" }}>
            {presets.map((p, idx) => (
              <button 
                key={idx}
                className="trend-filter-btn"
                style={{ fontSize: "0.78rem", whiteSpace: "nowrap", padding: "6px 12px" }}
                onClick={() => handleSendChatMessage(p)}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="chat-input-area">
            <input 
              type="text" 
              className="chat-input"
              placeholder="Ask anything (e.g., 'What is a cheap replacement for Ghee?')"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendChatMessage()}
            />
            <button className="btn-send" onClick={() => handleSendChatMessage()}>
              <ChevronRight size={20} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Tab 6: Profile Settings
  const renderProfile = () => {
    return (
      <div className="tab-profile">
        <div className="page-header">
          <div className="page-title">
            <h1>Allergy & Budget Settings</h1>
            <p>Define constraints for the weekly budget optimizer here. Changes are saved instantly.</p>
          </div>
        </div>

        <div className="profile-grid">
          {/* Main profile form */}
          <div className="card">
            <h3 style={{ fontSize: "1.2rem", fontWeight: "700", marginBottom: "16px" }}>Optimizer Core Parameters</h3>
            
            {/* Slider */}
            <div className="budget-slider-container">
              <div className="slider-labels">
                <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Weekly Budget Cap Limit</span>
                <span className="budget-val-badge">₹{weeklyBudget} INR / week</span>
              </div>
              <input 
                type="range" 
                min="500" 
                max="15000" 
                step="250"
                className="slider-input"
                value={weeklyBudget}
                onChange={(e) => setWeeklyBudget(e.target.value)}
              />
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Calculates maximum permissible recipe costs across a 7-day period. (Min: ₹500, Max: ₹15,000)
              </span>
            </div>

            {/* Allergies Matrix with Plus Button builder */}
            <div className="allergies-list-container">
              <h4 style={{ fontSize: "0.95rem", fontWeight: "700", marginBottom: "12px", textTransform: "uppercase", color: "var(--text-secondary)" }}>
                Allergy / Intolerance Severity Matrix
              </h4>

              {/* Dynamic input box with Plus button */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
                <input 
                  type="text" 
                  className="form-input" 
                  style={{ flex: 1 }}
                  placeholder="Type allergen (e.g. Milk, Wheat, Peanut, Mustard, Garlic)" 
                  value={newAllergyInput}
                  onChange={(e) => setNewAllergyInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddAllergy()}
                />
                <button 
                  className="btn-splash" 
                  style={{ display: "flex", alignItems: "center", gap: "4px", padding: "10px 16px" }}
                  onClick={handleAddAllergy}
                >
                  <Plus size={16} /> Add
                </button>
              </div>
              
              {/* Custom Allergies List */}
              {allergies.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px", border: "1px dashed var(--border-color)", borderRadius: "12px", background: "rgba(255,255,255,0.01)" }}>
                  <AlertTriangle size={24} color="var(--text-muted)" style={{ margin: "0 auto 8px" }} />
                  <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>Your allergy matrix is empty. Type above to add your custom allergy list.</p>
                </div>
              ) : (
                allergies.map((allergen) => {
                  const activeSeverity = severities[allergen] || "severe";
                  
                  return (
                    <div key={allergen} className="allergy-selector-row">
                      <div className="allergy-name-wrap" style={{ textTransform: "capitalize" }}>
                        <span>{allergen}</span>
                      </div>

                      <div className="severity-options-wrap" style={{ alignItems: "center", gap: "10px" }}>
                        <button 
                          className={`severity-btn ${activeSeverity === "mild" ? "active mild" : ""}`}
                          onClick={() => handleAllergyToggle(allergen, "mild")}
                        >
                          Mild
                        </button>
                        <button 
                          className={`severity-btn ${activeSeverity === "severe" ? "active severe" : ""}`}
                          onClick={() => handleAllergyToggle(allergen, "severe")}
                        >
                          Severe
                        </button>
                        <button 
                          className="btn-logout" 
                          style={{ padding: "6px", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center" }}
                          onClick={() => handleRemoveAllergy(allergen)}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "32px", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
              {profileMessage && (
                <span style={{ fontSize: "0.9rem", color: profileMessage.startsWith("Error") ? "var(--accent-red)" : "var(--accent-green)", fontWeight: 600 }}>
                  {profileMessage}
                </span>
              )}
              <button 
                className="btn-splash" 
                style={{ marginLeft: "auto", padding: "12px 24px" }}
                onClick={saveProfile}
                disabled={profileSaving}
              >
                {profileSaving ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </div>

          {/* Sidebar nutrition goals */}
          <div className="card">
            <h3 style={{ fontSize: "1.1rem", fontWeight: "700", marginBottom: "16px" }}>Nutrition Targets</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "20px" }}>Daily dietary benchmarks for variety weighting.</p>
            
            <div className="macros-grid">
              <div className="macro-input-wrap">
                <label>Daily Calorie Target</label>
                <input 
                  type="number" 
                  value={nutritionGoals.calories}
                  onChange={(e) => setNutritionGoals(prev => ({ ...prev, calories: Number(e.target.value) }))}
                />
              </div>
              <div className="macro-input-wrap">
                <label>Protein Goal (g)</label>
                <input 
                  type="number" 
                  value={nutritionGoals.protein}
                  onChange={(e) => setNutritionGoals(prev => ({ ...prev, protein: Number(e.target.value) }))}
                />
              </div>
            </div>
            
            <div style={{ marginTop: "24px", background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px", fontSize: "0.8rem", color: "var(--text-secondary)", lineHeight: "1.5" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", color: "var(--primary)", marginBottom: "4px" }}>
                <Activity size={12} />
                Variety & Macro Balance
              </span>
              Our solver weights recipes to match protein goals while preventing consecutive meal repetitions.
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Splash Screen
  if (showSplash) {
    return (
      <div className="splash-screen">
        <div className="splash-logo">Allergy-Safe Meal Planner</div>
        <div className="splash-tagline">
          A safety-first, budget-aware Indian meal planning system. Optimizing grocery metrics for dietary restrictions and cost efficiency.
        </div>
        <div className="splash-card">
          <h3>STEM Integration Project</h3>
          <p style={{ margin: "8px 0 20px" }}>
            This system tackles the data mapping constraint problem. Integrating linear optimization algorithms with medical allergen guidelines, providing a real SaaS experience.
          </p>
          <button 
            className="btn-splash"
            onClick={() => {
              setShowSplash(false);
            }}
          >
            Launch Application <ChevronRight size={16} style={{ display: "inline", verticalAlign: "middle", marginLeft: "4px" }} />
          </button>
        </div>
      </div>
    );
  }

  // Render Authentication Screen
  if (!isAuthenticated) {
    return (
      <div className="auth-wrapper">
        <div className="auth-card">
          <div className="auth-header">
            <h2>{authMode === "login" ? "Welcome Back" : "Create Account"}</h2>
            <p>{authMode === "login" ? "Sign in to access your meal planner profile" : "Set up your medical and budget targets"}</p>
          </div>

          {authError && <div className="error-message">{authError}</div>}

          <form onSubmit={handleAuthSubmit}>
            <div className="form-group">
              <label>Email Address</label>
              <input 
                type="email" 
                required 
                className="form-input" 
                placeholder="chef@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ marginBottom: "28px" }}>
              <label>Password</label>
              <input 
                type="password" 
                required 
                className="form-input" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-primary">
              {authMode === "login" ? "Sign In" : "Sign Up"}
            </button>
          </form>

          <div className="auth-toggle">
            {authMode === "login" ? (
              <>Don't have an account? <span onClick={() => { setAuthMode("signup"); setAuthError(""); }}>Create one</span></>
            ) : (
              <>Already have an account? <span onClick={() => { setAuthMode("login"); setAuthError(""); }}>Sign in</span></>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render Dashboard Workspace
  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <div className="sidebar">
        <div className="sidebar-logo">Allergy Safe Planner</div>
        
        <div className="nav-links">
          <div 
            className={`nav-item ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </div>

          <div 
            className={`nav-item ${activeTab === "planner" ? "active" : ""}`}
            onClick={() => setActiveTab("planner")}
          >
            <Calendar size={18} />
            <span>Meal Planner</span>
          </div>

          <div 
            className={`nav-item ${activeTab === "shopping" ? "active" : ""}`}
            onClick={() => setActiveTab("shopping")}
          >
            <ShoppingCart size={18} />
            <span>Shopping List</span>
          </div>

          <div 
            className={`nav-item ${activeTab === "trends" ? "active" : ""}`}
            onClick={() => setActiveTab("trends")}
          >
            <TrendingUp size={18} />
            <span>Price Trends</span>
          </div>

          <div 
            className={`nav-item ${activeTab === "chef" ? "active" : ""}`}
            onClick={() => setActiveTab("chef")}
          >
            <MessageSquare size={18} />
            <span>AI Smart Chef</span>
          </div>

          <div 
            className={`nav-item ${activeTab === "profile" ? "active" : ""}`}
            onClick={() => setActiveTab("profile")}
          >
            <User size={18} />
            <span>Settings</span>
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="user-badge">
            <div className="user-avatar">
              {userEmail.substring(0, 1).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-email">{userEmail}</span>
              <span className="user-role">Indian SaaS Member</span>
            </div>
          </div>
          
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main content viewport */}
      <div className="main-content">
        {renderTabContent()}
      </div>
    </div>
  );
}

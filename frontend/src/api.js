const OPENAI_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";
const MODEL_NAME = "gpt-4o-mini";

// Helper for local profile loading
const getLocalProfile = (email) => {
  const defaultProfile = {
    weekly_budget: 4000,
    allergies: [],
    allergen_severities: {},
    nutrition_goals: { calories: 2000, protein: 70 }
  };
  try {
    const raw = localStorage.getItem(`profile_${email}`);
    return raw ? JSON.parse(raw) : defaultProfile;
  } catch (e) {
    return defaultProfile;
  }
};

export const api = {
  setToken: (token) => {
    localStorage.setItem("token", token);
  },
  
  clearToken: () => {
    localStorage.removeItem("token");
  },
  
  getToken: () => {
    return localStorage.getItem("token");
  },

  get: async (endpoint) => {
    const activeEmail = localStorage.getItem("token");
    if (!activeEmail) throw new Error("Unauthorized");

    if (endpoint === "/profile") {
      const p = getLocalProfile(activeEmail);
      return {
        id: 1,
        user_id: 1,
        ...p
      };
    }

    if (endpoint === "/meal-plan/current") {
      const plan = localStorage.getItem(`mealplan_${activeEmail}`);
      if (!plan) {
        return { meals: [], total_cost: 0.0, message: "No active meal plan found. Generate one now!" };
      }
      return JSON.parse(plan);
    }

    if (endpoint === "/shopping-list") {
      const planRaw = localStorage.getItem(`mealplan_${activeEmail}`);
      const profile = getLocalProfile(activeEmail);
      
      if (!planRaw) {
        return {
          items: [],
          total_estimated_cost: 0.0,
          budget_limit: profile.weekly_budget,
          exceeds_budget: false,
          budget_margin: profile.weekly_budget
        };
      }

      const plan = JSON.parse(planRaw);
      const userAllergies = profile.allergies.map(a => a.toLowerCase().trim());
      const severities = profile.allergen_severities;
      
      const indianSubs = {
        "milk": "Coconut Milk or Almond Milk",
        "paneer": "Tofu (Soya Paneer)",
        "ghee": "Mustard Oil or Coconut Oil",
        "wheat flour": "Ragi (Finger Millet) or Rice Flour",
        "atta": "Gluten-Free Atta (Jowar & Bajra)",
        "butter": "Coconut Oil or Olive Oil",
        "mustard": "Jeera (Cumin) or Fenugreek",
        "peanuts": "Roasted Chickpeas (Sattu)",
        "soy": "Chickpea flour (Besan)",
        "eggs": "Mashed Banana or Curd (Yoghurt)"
      };

      const consolidated = {};
      
      plan.meals.forEach(day => {
        ["breakfast", "lunch", "dinner"].forEach(cat => {
          const recipe = day[cat];
          if (!recipe) return;
          
          recipe.ingredients.forEach(ri => {
            const ingName = ri.ingredient.name;
            const ingId = ingName.toLowerCase();
            
            const ingAllergens = (ri.ingredient.allergens || "")
              .split(",")
              .map(a => a.trim().toLowerCase())
              .filter(a => a);

            if (!consolidated[ingId]) {
              consolidated[ingId] = {
                name: ingName,
                quantity: 0.0,
                unit: ri.ingredient.unit || "g",
                cost_per_unit: ri.ingredient.cost_per_unit || 0.5,
                allergens: ingAllergens,
                severity: "none",
                substitution: null
              };
            }
            consolidated[ingId].quantity += Number(ri.quantity);
          });
        });
      });

      const items = [];
      let total_estimated_cost = 0.0;

      Object.keys(consolidated).forEach(id => {
        const item = consolidated[id];
        let severity_alert = "none";
        let substitution_suggested = null;

        for (const allergen of item.allergens) {
          if (userAllergies.includes(allergen)) {
            severity_alert = severities[allergen] || "severe";
            break;
          }
        }
        
        userAllergies.forEach(allergy => {
          if (item.name.toLowerCase().includes(allergy)) {
            severity_alert = severities[allergy] || "severe";
          }
        });

        if (severity_alert !== "none") {
          let sub = null;
          for (const key of Object.keys(indianSubs)) {
            if (item.name.toLowerCase().includes(key)) {
              sub = indianSubs[key];
              break;
            }
          }
          if (!sub) {
            sub = "Allergen-Free Indian Substitute";
          }
          substitution_suggested = sub;
        }

        const cost = roundDec(item.quantity * item.cost_per_unit, 2);
        total_estimated_cost += cost;

        items.push({
          ingredient_name: item.name,
          quantity: roundDec(item.quantity, 1),
          unit: item.unit,
          cost: cost,
          allergens: item.allergens,
          severity_alert,
          substitution_suggested
        });
      });

      total_estimated_cost = roundDec(total_estimated_cost, 2);
      const budget_limit = profile.weekly_budget;
      const exceeds_budget = total_estimated_cost > budget_limit;
      const budget_margin = roundDec(budget_limit - total_estimated_cost, 2);

      return {
        items,
        total_estimated_cost,
        budget_limit,
        exceeds_budget,
        budget_margin
      };
    }

    if (endpoint.startsWith("/price-trends")) {
      const planRaw = localStorage.getItem(`mealplan_${activeEmail}`);
      const cached = localStorage.getItem(`pricetrends_${activeEmail}`);
      
      let targetIngredients = [];
      if (planRaw) {
        try {
          const plan = JSON.parse(planRaw);
          const uniqueIngs = new Set();
          
          plan.meals.forEach(day => {
            ["breakfast", "lunch", "dinner"].forEach(cat => {
              const recipe = day[cat];
              if (recipe && recipe.ingredients) {
                recipe.ingredients.forEach(ri => {
                  uniqueIngs.add(JSON.stringify({
                    name: ri.ingredient.name,
                    unit: ri.ingredient.unit || "g",
                    cost_per_unit: ri.ingredient.cost_per_unit || 1.0
                  }));
                });
              }
            });
          });
          
          targetIngredients = Array.from(uniqueIngs).map(item => JSON.parse(item));
        } catch (e) {
          console.error("Error reading ingredients from plan", e);
        }
      }

      // Default fallback popular Indian ingredients
      if (targetIngredients.length === 0) {
        targetIngredients = [
          { name: "Paneer (Cottage Cheese)", unit: "200g", cost_per_unit: 110.0 },
          { name: "Toor Dal (Arhar)", unit: "1kg", cost_per_unit: 165.0 },
          { name: "Aashirvaad Atta (Wheat)", unit: "1kg", cost_per_unit: 52.0 },
          { name: "Desi Ghee", unit: "1L", cost_per_unit: 660.0 },
          { name: "Tomatoes", unit: "1kg", cost_per_unit: 45.0 }
        ];
      }

      // Sort ingredients by cost descending (base cost)
      const sortedIngredients = [...targetIngredients].sort((a, b) => b.cost_per_unit - a.cost_per_unit);
      
      // We send only the top 5 key ingredients to OpenAI for AI pricing trends
      const keyIngredients = sortedIngredients.slice(0, 5);
      const keyIngList = keyIngredients.map(ing => ing.name);
      const minorIngredients = sortedIngredients.slice(5);

      const allIngList = targetIngredients.map(ing => ing.name);

      // Verify if cache matches the current plan ingredients
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const cachedIngs = parsed.map(p => p.ingredient);
          const matches = allIngList.every(ing => cachedIngs.includes(ing)) && cachedIngs.every(ing => allIngList.includes(ing));
          if (matches) {
            return parsed;
          }
        } catch (e) {
          // ignore cache parsing errors
        }
      }

      // If no valid cache, query OpenAI to get real AI price trends ONLY for top 5 key ingredients
      const prompt = `You are a food market pricing AI analyzer for Indian grocery stores.
Given this list of primary ingredients from an Indian weekly meal plan:
${keyIngList.join(", ")}

Generate a realistic 6-week price trend history in INR (Indian Rupees) for each ingredient. The historical points must reflect seasonal variations in Indian local markets (e.g. mandi prices, inflation, monsoon impact).
Ensure the dates cover the last 6 weeks (from 6 weeks ago up to today, spaced weekly). Use dates like '2026-06-11' to today.

You MUST respond ONLY with a valid JSON object matching this structure:
{
  "trends": [
    {
      "ingredient": "Paneer (Cottage Cheese)",
      "unit": "200g",
      "current_price": 110.0,
      "history": [
        { "date": "2026-06-11", "price": 105.0 },
        { "date": "2026-06-18", "price": 108.0 },
        { "date": "2026-06-25", "price": 107.0 },
        { "date": "2026-07-02", "price": 112.0 },
        { "date": "2026-07-09", "price": 109.0 },
        { "date": "2026-07-16", "price": 110.0 }
      ]
    },
    ...
  ]
}

Ensure all ingredients listed are included in the JSON output. Do not include markdown code block formatting except valid JSON.`;

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_KEY}`
          },
          body: JSON.stringify({
            model: MODEL_NAME,
            messages: [
              { role: "system", content: "You output raw pricing trend histories in JSON format." },
              { role: "user", content: prompt }
            ],
            temperature: 0.7
          })
        });

        if (!response.ok) {
          throw new Error("Failed to contact OpenAI API");
        }

        const resData = await response.json();
        let text = resData.choices[0].message.content.trim();
        if (text.startsWith("```")) {
          text = text.replace(/^```json/, "").replace(/```$/, "").trim();
        }

        const dataObj = JSON.parse(text);
        const aiTrends = dataObj.trends || [];

        // Generate fast simulated trends for the minor ingredients
        const minorTrends = minorIngredients.map((ing, idx) => {
          const base = ing.cost_per_unit;
          const history = [];
          const today = new Date();
          for (let w = 5; w >= 0; w--) {
            const date = new Date(today);
            date.setDate(today.getDate() - w * 7);
            history.push({
              date: date.toISOString().split("T")[0],
              price: roundDec(base * (1.0 + ((w * 3) % 10 - 5) / 100.0), 1)
            });
          }
          return {
            ingredient: ing.name,
            unit: ing.unit || "unit",
            current_price: base,
            history
          };
        });

        const combinedTrends = [...aiTrends, ...minorTrends];
        localStorage.setItem(`pricetrends_${activeEmail}`, JSON.stringify(combinedTrends));
        return combinedTrends;
      } catch (err) {
        console.error("Failed to fetch AI price trends, generating simulation fallback", err);
        const fallbackTrends = targetIngredients.map((ing, idx) => {
          const base = ing.cost_per_unit;
          const history = [];
          const today = new Date();
          for (let w = 5; w >= 0; w--) {
            const date = new Date(today);
            date.setDate(today.getDate() - w * 7);
            history.push({
              date: date.toISOString().split("T")[0],
              price: roundDec(base * (1.0 + ((w * 3) % 10 - 5) / 100.0), 1)
            });
          }
          return {
            ingredient: ing.name,
            unit: ing.unit,
            current_price: base,
            history
          };
        });
        return fallbackTrends;
      }
    }
  },

  post: async (endpoint, data) => {
    if (endpoint === "/auth/signup") {
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      if (users.includes(data.email)) {
        throw new Error("Email already registered");
      }
      users.push(data.email);
      localStorage.setItem("users", JSON.stringify(users));
      
      localStorage.setItem(`profile_${data.email}`, JSON.stringify({
        weekly_budget: 4000,
        allergies: [],
        allergen_severities: {},
        nutrition_goals: { calories: 2000, protein: 70 }
      }));

      return { id: 1, email: data.email, is_active: true };
    }

    if (endpoint === "/auth/login") {
      const users = JSON.parse(localStorage.getItem("users") || "[]");
      if (!data.email) {
        throw new Error("Email is required");
      }
      if (!users.includes(data.email)) {
        users.push(data.email);
        localStorage.setItem("users", JSON.stringify(users));
        localStorage.setItem(`profile_${data.email}`, JSON.stringify({
          weekly_budget: 4000,
          allergies: [],
          allergen_severities: {},
          nutrition_goals: { calories: 2000, protein: 70 }
        }));
      }
      return { access_token: data.email, token_type: "bearer" };
    }

    const activeEmail = localStorage.getItem("token");
    if (!activeEmail) throw new Error("Unauthorized");

    if (endpoint === "/meal-plan/generate") {
      const profile = getLocalProfile(activeEmail);
      
      if (profile.allergies.length === 0) {
        throw new Error("No allergies configured. Please save your settings in the settings tab first.");
      }

      const allergyContext = profile.allergies.map(a => `${a} (${profile.allergen_severities[a] || "severe"})`).join(", ");
      const budgetContext = `${profile.weekly_budget} INR`;

      const prompt = `You are the "Allergy-Safe Indian Meal Planner" — a professional dietitian specialized in Indian cuisines.
Generate a 7-day meal plan (Monday to Sunday) for Breakfast, Lunch, and Dinner.
The weekly budget is STRICTLY ${budgetContext} (Indian Rupees). The sum of costs of all ingredients across all 21 meals MUST NOT exceed this budget.

Dietary Restrictions / Exclusions:
${allergyContext}
- For SEVERE exclusions: DO NOT include any recipe containing these ingredients or any of their traces/derivatives (e.g. if Wheat is severe, no Maida, Roti, Atta, Rava, Semolina).
- For MILD intolerances: Avoid them if possible, or if included, suggest a safe substitution in the ingredients list.

Meal Variety Requirements:
- You MUST recommend a DIFFERENT breakfast dish for every single day. Do not repeat breakfasts (e.g., use Poha, Idli, Dosa, Upma, Paratha, Dhokla, Puri Bhaji, Uttapam).
- Ensure that the lunches and dinners also have rich variety and do not repeat.

Recommend ONLY traditional or modern popular Indian recipes.
Ensure that the ingredients include estimated individual ingredient costs in INR (₹) that sum up logically to a realistic total cost.
Specify ingredient quantities in common consumer-friendly retail sizes: grams (g), milliliters (ml), or pieces (pcs) rather than large fractional units (like 0.1 kg or 0.05 L). For example, use '150 g' instead of '0.15 kg' and '200 ml' instead of '0.2 L'.

You MUST respond ONLY with a valid JSON object matching the following structure:
{
  "success": true,
  "total_cost": 3200.50,
  "meals": [
    {
      "day": "Monday",
      "breakfast": {
        "title": "Paneer Bhurji with Roti",
        "description": "Scrambled cottage cheese cooked with Indian spices, served with soft whole wheat rotis.",
        "category": "Breakfast",
        "prep_time": 15,
        "instructions": "Sauté onions, tomatoes, and green chillies. Add crumbled paneer, turmeric, salt, and garam masala. Cook for 5 mins. Serve hot with rotis.",
        "calories": 380,
        "protein": 14,
        "carbs": 42,
        "fat": 12,
        "allergens": "dairy,gluten",
        "ingredients": [
          { "ingredient": { "name": "Paneer", "cost_per_unit": 0.5, "unit": "g", "allergens": "dairy" }, "quantity": 100 },
          { "ingredient": { "name": "Wheat Flour", "cost_per_unit": 0.05, "unit": "g", "allergens": "gluten" }, "quantity": 80 }
        ]
      },
      "lunch": { ... },
      "dinner": { ... }
    },
    ...
  ],
  "message": "Meal plan generated successfully."
}

Do not include any other markdown text except the raw JSON string.`;

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_KEY}`
          },
          body: JSON.stringify({
            model: MODEL_NAME,
            messages: [
              { role: "system", content: "You output raw structured JSON data for an Indian meal planner." },
              { role: "user", content: prompt }
            ],
            temperature: 0.7
          })
        });

        if (!response.ok) {
          throw new Error("Failed to contact OpenAI API");
        }

        const resData = await response.json();
        let text = resData.choices[0].message.content.trim();
        
        if (text.startsWith("```")) {
          text = text.replace(/^```json/, "").replace(/```$/, "").trim();
        }

        const planData = JSON.parse(text);
        localStorage.setItem(`mealplan_${activeEmail}`, JSON.stringify(planData));
        localStorage.removeItem(`pricetrends_${activeEmail}`);
        return planData;
      } catch (err) {
        console.error("OpenAI planner failed", err);
        throw new Error(`Failed to generate Indian meal plan via AI: ${err.message || "Invalid JSON format or API error"}. Please check your connection and OpenAI API key.`);
      }
    }

    if (endpoint === "/ai-chef") {
      const profile = getLocalProfile(activeEmail);
      const allergyContext = profile.allergies.map(a => `${a} (${profile.allergen_severities[a] || "severe"})`).join(", ") || "No allergies";
      const budgetContext = `${profile.weekly_budget} INR`;

      const systemInstructions = `You are the 'Allergy-Safe Indian Smart Chef'—an expert nutritionist and culinary specialist in Indian foods.
Your goal is to help users find safe, allergen-free Indian recipes, suggest budget-aware grocery alternatives (in INR), 
and explain substitution chemistry.
Current User Context:
- Allergies: ${allergyContext}
- Weekly Grocery Budget Cap: ${budgetContext}

Guidelines:
1. ALWAYS place safety first. If a user asks for something unsafe, warn them clearly.
2. Suggest creative budget-saving Indian ideas.
3. Keep answers concise, actionable, and formatted beautifully in markdown.
4. Focus strictly on Indian ingredients and dishes.`;

      try {
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_KEY}`
          },
          body: JSON.stringify({
            model: MODEL_NAME,
            messages: [
              { role: "system", content: systemInstructions },
              { role: "user", content: data.prompt }
            ],
            temperature: 0.7
          })
        });

        if (!response.ok) {
          throw new Error("Failed to contact OpenAI API");
        }

        const resData = await response.json();
        const text = resData.choices[0].message.content;
        return { response: text, source: "GPT-4o-mini (OpenAI)" };
      } catch (err) {
        return {
          response: "### Namaste! 🍳\n\nI had trouble reaching the AI server. However, as an Indian Home Chef, I can suggest naturally safe swaps:\n- **Gluten-Free swap**: Use Ragi or Bajra flour instead of wheat flour for Rotis.\n- **Dairy-Free swap**: Use Coconut Milk or Mustard Oil instead of Cow milk and Ghee.\n- **Nut-Free swap**: Use roasted chana powder instead of cashew paste in curries.",
          source: "Local Indian Chef Fallback"
        };
      }
    }
  },

  put: async (endpoint, data) => {
    const activeEmail = localStorage.getItem("token");
    if (!activeEmail) throw new Error("Unauthorized");

    if (endpoint === "/profile") {
      localStorage.setItem(`profile_${activeEmail}`, JSON.stringify({
        weekly_budget: Number(data.weekly_budget),
        allergies: data.allergies,
        allergen_severities: data.allergen_severities,
        nutrition_goals: data.nutrition_goals
      }));
      return {
        id: 1,
        user_id: 1,
        ...data
      };
    }
  }
};

const roundDec = (value, decimals) => {
  return Number(Math.round(value + 'e' + decimals) + 'e-' + decimals);
};

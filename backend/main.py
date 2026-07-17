import os
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
import httpx

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

# Local imports
from database import engine, get_db
import models
import schemas
import auth
import solver
from data_seeder import seed_db

app = FastAPI(title="Allergy-Safe Meal Planner API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development ease
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database and seed default values
@app.on_event("startup")
def startup_event():
    models.Base.metadata.create_all(bind=engine)
    seed_db()

# --- AUTH ENDPOINTS ---

@app.post("/api/auth/signup", response_model=schemas.UserResponse)
def signup(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pwd = auth.get_password_hash(user_in.password)
    user = models.User(email=user_in.email, hashed_password=hashed_pwd)
    db.add(user)
    db.flush()  # Populate user.id
    
    # Create default user profile
    profile = models.UserProfile(
        user_id=user.id,
        weekly_budget=100.0,
        allergies="[]",
        allergen_severities="{}",
        nutrition_goals=json.dumps({"calories": 2000, "protein": 70, "carbs": 250, "fat": 70})
    )
    db.add(profile)
    db.commit()
    db.refresh(user)
    return user

@app.post("/api/auth/login", response_model=schemas.Token)
def login(user_in: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if not user or not auth.verify_password(user_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth.create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

# --- PROFILE ENDPOINTS ---

@app.get("/api/profile", response_model=schemas.UserProfileResponse)
def get_profile(current_user: models.User = Depends(auth.get_current_user)):
    profile = current_user.profile
    return schemas.UserProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        weekly_budget=profile.weekly_budget,
        allergies=json.loads(profile.allergies),
        allergen_severities=json.loads(profile.allergen_severities),
        nutrition_goals=json.loads(profile.nutrition_goals)
    )

@app.put("/api/profile", response_model=schemas.UserProfileResponse)
def update_profile(
    profile_update: schemas.UserProfileUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    profile = current_user.profile
    profile.weekly_budget = profile_update.weekly_budget
    profile.allergies = json.dumps(profile_update.allergies)
    profile.allergen_severities = json.dumps(profile_update.allergen_severities)
    profile.nutrition_goals = json.dumps(profile_update.nutrition_goals)
    db.commit()
    db.refresh(profile)
    
    return schemas.UserProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        weekly_budget=profile.weekly_budget,
        allergies=json.loads(profile.allergies),
        allergen_severities=json.loads(profile.allergen_severities),
        nutrition_goals=json.loads(profile.nutrition_goals)
    )

# --- RECIPE ENDPOINTS ---

@app.get("/api/recipes", response_model=List[schemas.RecipeResponse])
def get_recipes(
    category: Optional[str] = None,
    allergen_filter: Optional[bool] = True,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(models.Recipe)
    if category:
        query = query.filter(models.Recipe.category == category)
        
    recipes = query.all()
    
    # Filter by user's severe allergies if allergen_filter is true
    if allergen_filter:
        try:
            allergies = json.loads(current_user.profile.allergies)
            severities = json.loads(current_user.profile.allergen_severities)
            severe_allergens = [a.lower().strip() for a in allergies if severities.get(a, "severe") == "severe"]
        except:
            severe_allergens = []
            
        if severe_allergens:
            filtered_recipes = []
            for r in recipes:
                recipe_allergens = [a.strip().lower() for a in r.allergens.split(",") if a.strip()]
                if not any(sa in recipe_allergens for sa in severe_allergens):
                    filtered_recipes.append(r)
            return filtered_recipes
            
    return recipes

@app.get("/api/recipes/{recipe_id}", response_model=schemas.RecipeResponse)
def get_recipe_detail(recipe_id: int, db: Session = Depends(get_db)):
    recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe

# --- MEAL PLAN ENDPOINTS ---

@app.post("/api/meal-plan/generate")
def generate_meal_plan(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    profile = current_user.profile
    today_str = datetime.now().strftime("%Y-%m-%d")
    
    try:
        plan_result = solver.generate_weekly_plan(db, profile, today_str)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
        
    # Format plan_data for DB storage (save ids instead of object serialization)
    db_plan_data = []
    for m in plan_result["meals"]:
        db_plan_data.append({
            "day": m["day"],
            "breakfast": m["breakfast"].id,
            "lunch": m["lunch"].id,
            "dinner": m["dinner"].id
        })
        
    # Check if a plan already exists for this week
    existing_plan = db.query(models.WeeklyMealPlan).filter(
        models.WeeklyMealPlan.user_id == current_user.id,
        models.WeeklyMealPlan.week_start_date == today_str
    ).first()
    
    if existing_plan:
        existing_plan.plan_data = json.dumps(db_plan_data)
        existing_plan.total_cost = plan_result["total_cost"]
        db.commit()
    else:
        new_plan = models.WeeklyMealPlan(
            user_id=current_user.id,
            week_start_date=today_str,
            plan_data=json.dumps(db_plan_data),
            total_cost=plan_result["total_cost"]
        )
        db.add(new_plan)
        db.commit()
        
    # Fetch details for UI display
    populated_meals = []
    for m in plan_result["meals"]:
        populated_meals.append({
            "day": m["day"],
            "breakfast": schemas.RecipeResponse.from_orm(m["breakfast"]),
            "lunch": schemas.RecipeResponse.from_orm(m["lunch"]),
            "dinner": schemas.RecipeResponse.from_orm(m["dinner"])
        })
        
    return {
        "success": plan_result["success"],
        "total_cost": plan_result["total_cost"],
        "meals": populated_meals,
        "message": plan_result["message"]
    }

@app.get("/api/meal-plan/current")
def get_current_meal_plan(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    plan = db.query(models.WeeklyMealPlan).filter(
        models.WeeklyMealPlan.user_id == current_user.id
    ).order_by(models.WeeklyMealPlan.id.desc()).first()
    
    if not plan:
        return {"meals": [], "total_cost": 0.0, "message": "No active meal plan found. Generate one now!"}
        
    plan_list = json.loads(plan.plan_data)
    populated_meals = []
    
    for day_data in plan_list:
        b_recipe = db.query(models.Recipe).filter(models.Recipe.id == day_data["breakfast"]).first()
        l_recipe = db.query(models.Recipe).filter(models.Recipe.id == day_data["lunch"]).first()
        d_recipe = db.query(models.Recipe).filter(models.Recipe.id == day_data["dinner"]).first()
        
        populated_meals.append({
            "day": day_data["day"],
            "breakfast": schemas.RecipeResponse.from_orm(b_recipe) if b_recipe else None,
            "lunch": schemas.RecipeResponse.from_orm(l_recipe) if l_recipe else None,
            "dinner": schemas.RecipeResponse.from_orm(d_recipe) if d_recipe else None
        })
        
    return {
        "id": plan.id,
        "week_start_date": plan.week_start_date,
        "total_cost": plan.total_cost,
        "meals": populated_meals
    }

# --- SHOPPING LIST ENDPOINT ---

@app.get("/api/shopping-list", response_model=schemas.ShoppingListResponse)
def get_shopping_list(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    profile = current_user.profile
    # Fetch active plan
    plan = db.query(models.WeeklyMealPlan).filter(
        models.WeeklyMealPlan.user_id == current_user.id
    ).order_by(models.WeeklyMealPlan.id.desc()).first()
    
    if not plan:
        return {
            "items": [],
            "total_estimated_cost": 0.0,
            "budget_limit": profile.weekly_budget,
            "exceeds_budget": False,
            "budget_margin": profile.weekly_budget
        }
        
    try:
        user_allergies = [a.lower().strip() for a in json.loads(profile.allergies)]
        user_severities = json.loads(profile.allergen_severities)
    except:
        user_allergies = []
        user_severities = {}
        
    plan_list = json.loads(plan.plan_data)
    
    # Consolidate ingredients: key is ingredient ID
    consolidated: Dict[int, Dict[str, Any]] = {}
    
    # Gather substitutions for quick reference
    subs_db = db.query(models.AllergenSubstitution).all()
    subs_map = {s.allergen_ingredient.lower().strip(): s.safe_substitution for s in subs_db}
    
    # Fetch all recipes in the plan
    for day_data in plan_list:
        meal_ids = [day_data["breakfast"], day_data["lunch"], day_data["dinner"]]
        for recipe_id in meal_ids:
            recipe = db.query(models.Recipe).filter(models.Recipe.id == recipe_id).first()
            if not recipe:
                continue
                
            for ri in recipe.ingredients:
                ing = ri.ingredient
                if ing.id not in consolidated:
                    consolidated[ing.id] = {
                        "name": ing.name,
                        "quantity": 0.0,
                        "unit": ing.unit,
                        "cost_per_unit": ing.cost_per_unit,
                        "allergens": [a.strip().lower() for a in ing.allergens.split(",") if a.strip()],
                        "severity": "none",
                        "substitution": None
                    }
                consolidated[ing.id]["quantity"] += ri.quantity
                
    # Build response list
    shopping_items = []
    total_cost = 0.0
    
    for ing_id, details in consolidated.items():
        # Check allergen status
        ing_allergens = details["allergens"]
        active_allergen = None
        severity = "none"
        
        # Check if user is allergic to any allergen in this ingredient
        for allergen in ing_allergens:
            if allergen in user_allergies:
                active_allergen = allergen
                severity = user_severities.get(allergen, "severe")
                break
                
        details["severity"] = severity
        
        # Suggest substitution if there is an active allergy
        if active_allergen:
            # Try to look up custom substitution or generic
            sub_name = None
            for key, val in subs_map.items():
                if key in details["name"].lower():
                    sub_name = val
                    break
            if not sub_name:
                sub_name = subs_map.get(active_allergen, "Safe Alternative")
            details["substitution"] = sub_name
            
        item_cost = round(details["quantity"] * details["cost_per_unit"], 2)
        total_cost += item_cost
        
        shopping_items.append(schemas.ShoppingListItem(
            ingredient_name=details["name"],
            quantity=round(details["quantity"], 1),
            unit=details["unit"],
            cost=item_cost,
            allergens=details["allergens"],
            severity_alert=details["severity"],
            substitution_suggested=details["substitution"]
        ))
        
    total_cost = round(total_cost, 2)
    exceeds_budget = total_cost > profile.weekly_budget
    margin = round(profile.weekly_budget - total_cost, 2)
    
    return schemas.ShoppingListResponse(
        items=shopping_items,
        total_estimated_cost=total_cost,
        budget_limit=profile.weekly_budget,
        exceeds_budget=exceeds_budget,
        budget_margin=margin
    )

# --- PRICE TRENDS ENDPOINT ---

@app.get("/api/price-trends")
def get_price_trends(
    ingredients: Optional[str] = None,  # comma-separated ingredient names
    db: Session = Depends(get_db)
):
    # If ingredients filter is provided, filter by it, otherwise choose 5 popular ones
    target_names = []
    if ingredients:
        target_names = [n.strip().lower() for n in ingredients.split(",") if n.strip()]
        
    # Query database
    query = db.query(models.Ingredient)
    all_ingredients = query.all()
    
    if target_names:
        selected_ings = [i for i in all_ingredients if i.name.lower() in target_names]
    else:
        # Default to Milk, Eggs, Wheat Flour, Chicken Breast, Oats
        defaults = {"milk", "eggs", "wheat flour", "chicken breast", "oats"}
        selected_ings = [i for i in all_ingredients if i.name.lower() in defaults]
        # In case some aren't seeded, pick first 5
        if len(selected_ings) < 3:
            selected_ings = all_ingredients[:5]
            
    trends = []
    for ing in selected_ings:
        histories = db.query(models.PriceHistory).filter(
            models.PriceHistory.ingredient_id == ing.id
        ).order_by(models.PriceHistory.date.asc()).all()
        
        points = [{"date": h.date, "price": h.price} for h in histories]
        trends.append({
            "ingredient": ing.name,
            "unit": ing.unit,
            "current_price": ing.cost_per_unit,
            "history": points
        })
        
    return trends

# --- AI CHEF ENDPOINT ---

@app.post("/api/ai-chef")
async def ai_chef_chat(
    payload: Dict[str, str],
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    user_prompt = payload.get("prompt", "").strip()
    if not user_prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
        
    openai_key = os.getenv("OPENAI_API_KEY", "")
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    
    # 1. Load user profile details for contextual styling
    profile = current_user.profile
    try:
        user_allergies = json.loads(profile.allergies)
        user_severities = json.loads(profile.allergen_severities)
    except:
        user_allergies = []
        user_severities = {}
        
    allergy_context = ", ".join([f"{a} ({user_severities.get(a, 'severe')})" for a in user_allergies]) if user_allergies else "No allergies"
    budget_context = f"${profile.weekly_budget:.2f}"
    
    system_instructions = (
        "You are the 'Allergy-Safe Smart Chef'—an expert nutritionist and culinary specialist. "
        "Your goal is to help users find safe, allergen-free recipes, suggest budget-aware grocery alternatives, "
        "and explain substitution chemistry (e.g. why oat milk behaves differently than cow milk in baking). "
        f"Current User Context:\n"
        f"- Allergies: {allergy_context}\n"
        f"- Weekly Grocery Budget Cap: {budget_context}\n\n"
        "Guidelines:\n"
        "1. ALWAYS place safety first. If a user asks for something unsafe, warn them clearly.\n"
        "2. Suggest creative budget-saving ideas for allergies.\n"
        "3. Keep answers concise, actionable, and formatted beautifully in markdown.\n"
        "4. NEVER recommend a food high-risk of contamination without a proper label verification disclaimer.\n"
    )

    # 2. Check if we should call the OpenAI API
    if openai_key:
        api_url = "https://api.openai.com/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {openai_key}"
        }
        
        body = {
            "model": "gpt-4o-mini",
            "messages": [
                {"role": "system", "content": system_instructions},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.7
        }
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(api_url, headers=headers, json=body)
                if res.status_code == 200:
                    data = res.json()
                    response_text = data["choices"][0]["message"]["content"]
                    return {"response": response_text, "source": "GPT-4o-mini (OpenAI)"}
                else:
                    print(f"OpenAI API Error {res.status_code}: {res.text}")
                    # Fallback to other engines if request fails
        except Exception as e:
            print(f"Failed to call OpenAI API: {e}")

    # 3. Check if we should call the Gemini API
    if gemini_key:
        api_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
        headers = {"Content-Type": "application/json"}
        
        body = {
            "contents": [{
                "parts": [{
                    "text": f"{system_instructions}\nUser Question: {user_prompt}"
                }]
            }]
        }
        
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(api_url, headers=headers, json=body)
                if res.status_code == 200:
                    data = res.json()
                    response_text = data["candidates"][0]["content"]["parts"][0]["text"]
                    return {"response": response_text, "source": "Gemini 1.5 Flash"}
                else:
                    print(f"Gemini API Error {res.status_code}: {res.text}")
                    # Fallback to local assistant if request fails
        except Exception as e:
            print(f"Failed to call Gemini API: {e}")
            
    # 4. Local Rule-Based Mock Chef Assistant (fallback)
    p_lower = user_prompt.lower()
    
    # Custom responses that look extremely intelligent
    if "gluten" in p_lower or "wheat" in p_lower:
        response_text = (
            "### Gluten-Free Chef Tip 🌾\n\n"
            "To replace **wheat flour** in recipes like our *Classic Pancakes*, use a high-quality **Gluten-Free Flour Blend** (like Bob's Red Mill 1-to-1). "
            "In baking, wheat gluten provides structure; without it, your baked goods can become crumbly. Make sure your GF blend includes **xanthan gum**, which acts as a binding agent.\n\n"
            "**Budget Idea:** Instead of buying expensive pre-packaged gluten-free bread (which can cost $6+ per loaf), rely on naturally gluten-free grains like **Quinoa ($4.00/kg)** or **White Rice ($1.20/kg)** for your weekly carb bases. They are nutrient-dense, allergen-safe, and very cheap!"
        )
    elif "dairy" in p_lower or "milk" in p_lower or "butter" in p_lower:
        response_text = (
            "### Dairy-Free Substitutions 🥛\n\n"
            "If you are managing a dairy allergy, here are some direct swaps:\n"
            "1. **Milk ➔ Oat Milk**: Perfect for oatmeal and baking because of its creamy texture. (Est. $2.20/L)\n"
            "2. **Butter ➔ Olive Oil**: Use a 3:4 ratio for cookies/cakes or 1:1 for pan searing. (Est. $8.00/L)\n"
            "3. **Heavy Cream ➔ Coconut Cream**: Keeps soup and sauces luxurious and thick. (Est. $8.00/L)\n\n"
            "**Nutrition Balance:** Almond milk is low in protein. If you swap dairy milk for plant milk, **Oat Milk** or **Soy Milk** is much better for maintaining daily protein targets."
        )
    elif "peanut" in p_lower or "nut" in p_lower or "cashew" in p_lower:
        response_text = (
            "### Nut-Free Culinary Swaps 🌻\n\n"
            "Peanut butter is a staple for cheap protein, but for nut allergies, it is highly dangerous. "
            "**Sunflower Butter (SunButter)** is the ultimate 1:1 replacement. It matches the texture, moisture, and rich profile of peanut butter, making it safe for oatmeal or toast.\n\n"
            "**Safety Tip:** Always watch out for cross-contamination. Many sunflower seeds are processed in facilities that handle tree nuts. Look for the **Certified Peanut-Free** label on the jar."
        )
    elif "cheap" in p_lower or "budget" in p_lower or "save" in p_lower:
        response_text = (
            "### Budget-Saving Strategies for Allergen-Free Cooking 💰\n\n"
            "Allergy-safe cooking is notoriously expensive, but you can beat the system by structure:\n"
            "- **Focus on naturally allergen-free foods:** Rice, quinoa, chicken breasts, spinach, and broccoli are free of the top 8 allergens and highly affordable.\n"
            "- **Avoid processed allergy food:** Gluten-free cookies and vegan cheese carry a 150%+ price markup. Stick to whole foods.\n"
            "- **Try our 'Allergy-Safe Chicken Rice Bowl'**: At roughly **$1.80 per serving**, it delivers 38g of clean protein and contains zero gluten, dairy, nuts, eggs, or soy!"
        )
    elif "egg" in p_lower:
        response_text = (
            "### Egg-Free Baking & Scrambling 🥚\n\n"
            "- **For scrambles:** Swap eggs with **Crumble Tofu** (try our *Vegan Tofu Scramble*). It absorbs garlic, salt, and pepper perfectly and yields a similar texture.\n"
            "- **For baking:** Use a **Flax Egg** (1 tbsp ground flaxseed mixed with 3 tbsp warm water, let sit for 5 minutes). The gel structure binds cakes and muffins just like egg whites."
        )
    else:
        response_text = (
            f"### Welcome to the AI Smart Chef Assistant! 🍳\n\n"
            f"I see you have set **{allergy_context}** as your restrictions, with a weekly budget cap of **{budget_context}**.\n\n"
            f"How can I help you cook safely tonight? You can ask me things like:\n"
            f"- *'How do I make my pancake recipe gluten-free?'*\n"
            f"- *'What is a cheap dairy alternative for baking?'*\n"
            f"- *'How can I get more protein on an egg-free diet under $100/week?'*\n\n"
            f"Ask away, and let's make some delicious, budget-friendly meals!"
        )
        
    return {"response": response_text, "source": "Local Rule-Based Chef Assistant (Fallback)"}


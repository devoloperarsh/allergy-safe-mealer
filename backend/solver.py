import random
from typing import List, Dict, Tuple, Any
import pulp
from sqlalchemy.orm import Session
import models

def get_recipe_cost(recipe: models.Recipe) -> float:
    """Calculate the total cost of a recipe based on its ingredient prices."""
    cost = 0.0
    for ri in recipe.ingredients:
        cost += ri.quantity * ri.ingredient.cost_per_unit
    return round(cost, 2)

def generate_weekly_plan(
    db: Session,
    user_profile: models.UserProfile,
    start_date: str
) -> Dict[str, Any]:
    """
    Generates a 7-day meal plan (Monday to Sunday) containing breakfast, lunch, and dinner.
    Obeys hard allergen filters and tries to minimize cost below user_profile.weekly_budget,
    while maximizing variety and nutritional balance.
    """
    import json
    
    # 1. Parse allergies
    try:
        user_allergies = json.loads(user_profile.allergies)
    except:
        user_allergies = []
    
    try:
        severities = json.loads(user_profile.allergen_severities)
    except:
        severities = {}
    
    # Severe allergens MUST be filtered out completely
    severe_allergens = {a.lower().strip() for a in user_allergies if severities.get(a, "severe") == "severe"}
    # Mild allergens should also be filtered by default, but we'll flag them
    mild_allergens = {a.lower().strip() for a in user_allergies if severities.get(a, "severe") == "mild"}
    all_allergens = severe_allergens.union(mild_allergens)

    # 2. Query all recipes
    all_recipes = db.query(models.Recipe).all()
    
    # 3. Filter recipes by allergen safety
    safe_recipes = []
    for recipe in all_recipes:
        recipe_allergens = {a.strip().lower() for a in recipe.allergens.split(",") if a.strip()}
        
        # Check if recipe has any severe allergens
        if any(sa in recipe_allergens for sa in severe_allergens):
            continue
            
        # Check if recipe has any mild allergens
        # We will allow mild allergens if no other recipes are available, but try to avoid them
        # For simplicity in this solver, we exclude all allergens from selection first.
        if any(ma in recipe_allergens for ma in all_allergens):
            continue
            
        safe_recipes.append(recipe)

    # If we have no safe recipes, raise an error
    if not safe_recipes:
        raise ValueError("No recipes found that are safe for your allergen profile.")

    # Group recipes by category
    categories = ["Breakfast", "Lunch", "Dinner"]
    grouped_recipes = {cat: [r for r in safe_recipes if r.category == cat] for cat in categories}
    
    # Ensure we have at least one recipe in each category
    for cat in categories:
        if not grouped_recipes[cat]:
            # If a category is empty due to strict allergen filters,
            # fall back to allowing recipes that might have mild allergens but no severe ones
            fallback_recipes = []
            for recipe in all_recipes:
                if recipe.category != cat:
                    continue
                recipe_allergens = {a.strip().lower() for a in recipe.allergens.split(",") if a.strip()}
                if not any(sa in recipe_allergens for sa in severe_allergens):
                    fallback_recipes.append(recipe)
            if fallback_recipes:
                grouped_recipes[cat] = fallback_recipes
            else:
                raise ValueError(f"No safe recipes available for category: {cat}")

    # 4. Formulate the optimization problem using PuLP
    # Days of the week
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    
    # Recipe details and costs
    recipe_costs = {r.id: get_recipe_cost(r) for r in safe_recipes}
    # Add costs for fallback recipes if added
    for cat in categories:
        for r in grouped_recipes[cat]:
            if r.id not in recipe_costs:
                recipe_costs[r.id] = get_recipe_cost(r)

    # Define variables: x[day, category, recipe_id] -> binary
    x = {}
    prob = pulp.LpProblem("Meal_Planning", pulp.LpMinimize)
    
    for day in days:
        for cat in categories:
            for r in grouped_recipes[cat]:
                x[(day, cat, r.id)] = pulp.LpVariable(f"x_{day}_{cat}_{r.id}", cat="Binary")

    # Constraint 1: Choose exactly 1 meal per day and category
    for day in days:
        for cat in categories:
            prob += pulp.lpSum([x[(day, cat, r.id)] for r in grouped_recipes[cat]]) == 1

    # Constraint 2: Stay within budget (Sum of recipe costs <= budget)
    # We sum the cost of all selected meals
    total_cost_expr = pulp.lpSum([x[(day, cat, r.id)] * recipe_costs[r.id] for day in days for cat in categories for r in grouped_recipes[cat]])
    prob += total_cost_expr <= user_profile.weekly_budget

    # Objective: Minimize cost but also maximize variety and protein
    # We can model this by adding a small penalty for cost and a reward for protein and variety.
    # To maximize variety: penalize selecting the same recipe multiple times.
    # To do this in LP, we can bound how many times a recipe is selected.
    # Let's say a recipe can be selected at most 3 times a week.
    recipe_ids = list(recipe_costs.keys())
    for r_id in recipe_ids:
        # Sum of recipe 'r_id' across all days and categories
        r_sum_list = []
        for day in days:
            for cat in categories:
                if (day, cat, r_id) in x:
                    r_sum_list.append(x[(day, cat, r_id)])
        if r_sum_list:
            prob += pulp.lpSum(r_sum_list) <= 3

    # Objective function: Minimize (Cost * 1.0 - Protein * 0.1 - Variety Penalty)
    # To keep it linear and clean, let's minimize cost while adding a small negative weight for protein.
    protein_map = {r.id: r.protein for r in safe_recipes}
    for cat in categories:
        for r in grouped_recipes[cat]:
            if r.id not in protein_map:
                protein_map[r.id] = r.protein
                
    objective_terms = []
    for day in days:
        for cat in categories:
            for r in grouped_recipes[cat]:
                # Cost penalty + small reward for protein to balance nutrition
                val = recipe_costs[r.id] - (protein_map[r.id] * 0.05)
                objective_terms.append(x[(day, cat, r.id)] * val)
                
    prob += pulp.lpSum(objective_terms)

    # Solve the optimization problem
    # Disable logs for uvicorn cleanliness
    status = prob.solve(pulp.PULP_CBC_CMD(msg=False))
    
    plan_meals = []
    
    # Check if a feasible solution was found
    if status == pulp.LpStatusOptimal:
        # Solution found!
        for day in days:
            day_meals = {"day": day}
            for cat in categories:
                for r in grouped_recipes[cat]:
                    if x[(day, cat, r.id)].varValue == 1:
                        day_meals[cat.lower()] = r
            plan_meals.append(day_meals)
        
        actual_total_cost = sum(recipe_costs[day_meals[cat.lower()].id] for day_meals in plan_meals for cat in categories)
        return {
            "success": True,
            "meals": plan_meals,
            "total_cost": round(actual_total_cost, 2),
            "message": "Optimal meal plan generated within budget."
        }
    else:
        # Budget constraint makes it infeasible. Let's fall back to a Greedy Selection.
        # We will pick the cheapest available safe recipe for each category to minimize cost.
        print("LP Solver infeasible. Falling back to cheapest safe recipes.")
        plan_meals = []
        cheapest_by_cat = {}
        
        for cat in categories:
            sorted_recipes = sorted(grouped_recipes[cat], key=lambda r: recipe_costs[r.id])
            cheapest_by_cat[cat] = sorted_recipes  # Sorted list of recipes
            
        for i, day in enumerate(days):
            day_meals = {"day": day}
            for cat in categories:
                # Add some slight rotation so we don't eat the EXACT same cheap meal every single day
                recipes_pool = cheapest_by_cat[cat]
                pool_index = i % len(recipes_pool)
                day_meals[cat.lower()] = recipes_pool[pool_index]
            plan_meals.append(day_meals)
            
        actual_total_cost = sum(recipe_costs[day_meals[cat.lower()].id] for day_meals in plan_meals for cat in categories)
        
        return {
            "success": False,
            "meals": plan_meals,
            "total_cost": round(actual_total_cost, 2),
            "message": f"Could not fit variety goals completely within your ${user_profile.weekly_budget:.2f} budget. "
                       f"Generated the cheapest alternative plan costing ${actual_total_cost:.2f}. "
                       f"Please consider increasing your budget to at least ${actual_total_cost:.2f}."
        }

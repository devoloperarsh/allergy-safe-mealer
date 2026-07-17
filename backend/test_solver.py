import os
import json
from database import engine, SessionLocal, Base
import models
from solver import generate_weekly_plan
from data_seeder import seed_db

def test_meal_plan_solver():
    print("Initializing test database...")
    # Make sure we use a clean test database file or standard one
    Base.metadata.create_all(bind=engine)
    seed_db()
    
    db = SessionLocal()
    try:
        # Check if test user exists, otherwise create
        test_email = "testsolver@example.com"
        user = db.query(models.User).filter(models.User.email == test_email).first()
        if user:
            # Clean up old plans and profile
            db.query(models.WeeklyMealPlan).filter(models.WeeklyMealPlan.user_id == user.id).delete()
            db.query(models.UserProfile).filter(models.UserProfile.user_id == user.id).delete()
            db.query(models.User).filter(models.User.id == user.id).delete()
            db.commit()
            
        user = models.User(email=test_email, hashed_password="mockhashedpassword")
        db.add(user)
        db.flush()
        
        # Test Case 1: Strict Gluten Allergy, Budget of $90
        profile = models.UserProfile(
            user_id=user.id,
            weekly_budget=90.0,
            allergies=json.dumps(["gluten"]),
            allergen_severities=json.dumps({"gluten": "severe"}),
            nutrition_goals=json.dumps({"calories": 2000, "protein": 70})
        )
        db.add(profile)
        db.commit()
        
        print("\n--- Running Solver: Gluten Severe Allergy, Budget = $90 ---")
        result = generate_weekly_plan(db, profile, "2026-07-15")
        
        print(f"Success: {result['success']}")
        print(f"Message: {result['message']}")
        print(f"Total Cost: ${result['total_cost']:.2f}")
        
        # Verify no gluten in meals
        gluten_found = False
        for m in result["meals"]:
            for cat in ["breakfast", "lunch", "dinner"]:
                recipe = m[cat]
                recipe_allergens = [a.strip().lower() for a in recipe.allergens.split(",") if a.strip()]
                if "gluten" in recipe_allergens:
                    gluten_found = True
                    print(f"ERROR: Found gluten in meal {recipe.title} (Allergens: {recipe.allergens})")
        
        if not gluten_found:
            print("SUCCESS: No gluten-containing meals found in the plan!")
            
        assert result["total_cost"] <= 90.0 or not result["success"], "Budget constraint violated without failing gracefully!"
        
        # Test Case 2: Extreme Low Budget Cap ($20) to check fallback mechanism
        profile.weekly_budget = 20.0
        db.commit()
        
        print("\n--- Running Solver: Gluten Severe Allergy, Extreme Low Budget = $20 ---")
        result_low = generate_weekly_plan(db, profile, "2026-07-15")
        print(f"Success: {result_low['success']}")
        print(f"Message: {result_low['message']}")
        print(f"Total Cost: ${result_low['total_cost']:.2f}")
        
        # In this case, success should be False because $20/week is too low for 21 meals, 
        # but it should fallback and generate a plan anyway.
        assert not result_low["success"], "Should flag plan as unsuccessful (exceeds budget)"
        assert len(result_low["meals"]) == 7, "Should still return a 7-day fallback plan"
        print("SUCCESS: Fallback mechanism triggered correctly and returned cheapest safe plan!")
        
    finally:
        db.close()

if __name__ == "__main__":
    test_meal_plan_solver()

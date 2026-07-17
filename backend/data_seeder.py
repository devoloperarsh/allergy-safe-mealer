import json
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import engine, SessionLocal
import models

def seed_db():
    models.Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Check if database is already seeded
        if db.query(models.User).first() is not None or db.query(models.Recipe).first() is not None:
            print("Database already seeded.")
            return

        print("Seeding database...")

        # 1. Seed Allergen Substitutions
        substitutions = [
            {"allergen_ingredient": "milk", "safe_substitution": "oat milk", "notes": "Replace 1:1. High in fiber and allergen-free."},
            {"allergen_ingredient": "butter", "safe_substitution": "olive oil", "notes": "Use 3/4 cup of olive oil for every cup of butter when baking, or 1:1 for savory dishes."},
            {"allergen_ingredient": "peanut butter", "safe_substitution": "sunflower butter", "notes": "Replace 1:1. Rich flavor and completely nut-free."},
            {"allergen_ingredient": "wheat flour", "safe_substitution": "gluten-free flour", "notes": "Replace 1:1. Make sure to use a blend that contains xanthan gum."},
            {"allergen_ingredient": "soy sauce", "safe_substitution": "coconut aminos", "notes": "Replace 1:1. Contains 70% less sodium and is soy/gluten free."},
            {"allergen_ingredient": "eggs", "safe_substitution": "flaxseed meal", "notes": "Mix 1 tbsp ground flaxseed with 3 tbsp water per egg; let sit for 5 mins to gel."},
            {"allergen_ingredient": "heavy cream", "safe_substitution": "coconut cream", "notes": "Replace 1:1. Lends a rich, dairy-free creaminess."},
            {"allergen_ingredient": "mayonnaise", "safe_substitution": "vegan mayonnaise", "notes": "Replace 1:1. Egg-free and dairy-free."}
        ]
        for sub_data in substitutions:
            sub = models.AllergenSubstitution(**sub_data)
            db.add(sub)

        # 2. Seed Ingredients with average prices and allergen associations
        ingredients_data = [
            # Dairy category
            {"name": "Milk", "cost_per_unit": 0.0015, "unit": "ml", "allergens": "dairy"},
            {"name": "Butter", "cost_per_unit": 0.008, "unit": "g", "allergens": "dairy"},
            {"name": "Heavy Cream", "cost_per_unit": 0.006, "unit": "ml", "allergens": "dairy"},
            {"name": "Parmesan Cheese", "cost_per_unit": 0.015, "unit": "g", "allergens": "dairy"},
            
            # Nuts category
            {"name": "Peanuts", "cost_per_unit": 0.006, "unit": "g", "allergens": "nuts"},
            {"name": "Almond Milk", "cost_per_unit": 0.0025, "unit": "ml", "allergens": "nuts"},
            {"name": "Peanut Butter", "cost_per_unit": 0.009, "unit": "g", "allergens": "nuts"},
            
            # Gluten category
            {"name": "Wheat Flour", "cost_per_unit": 0.0015, "unit": "g", "allergens": "gluten"},
            {"name": "Bread", "cost_per_unit": 0.004, "unit": "g", "allergens": "gluten"},
            {"name": "Pasta", "cost_per_unit": 0.003, "unit": "g", "allergens": "gluten"},
            {"name": "Oats", "cost_per_unit": 0.002, "unit": "g", "allergens": "gluten"},
            
            # Soy category
            {"name": "Soy Sauce", "cost_per_unit": 0.004, "unit": "ml", "allergens": "soy,gluten"},
            {"name": "Tofu", "cost_per_unit": 0.005, "unit": "g", "allergens": "soy"},
            {"name": "Soy Milk", "cost_per_unit": 0.002, "unit": "ml", "allergens": "soy"},
            
            # Eggs category
            {"name": "Eggs", "cost_per_unit": 0.20, "unit": "pcs", "allergens": "eggs"},
            {"name": "Mayonnaise", "cost_per_unit": 0.006, "unit": "g", "allergens": "eggs"},
            
            # Shellfish / Fish category
            {"name": "Shrimp", "cost_per_unit": 0.018, "unit": "g", "allergens": "shellfish"},
            {"name": "Salmon Filet", "cost_per_unit": 0.022, "unit": "g", "allergens": "fish"},
            
            # Safe Substitutions
            {"name": "Oat Milk", "cost_per_unit": 0.0022, "unit": "ml", "allergens": ""},
            {"name": "Gluten-Free Flour", "cost_per_unit": 0.0035, "unit": "g", "allergens": ""},
            {"name": "Sunflower Butter", "cost_per_unit": 0.012, "unit": "g", "allergens": ""},
            {"name": "Coconut Aminos", "cost_per_unit": 0.012, "unit": "ml", "allergens": ""},
            {"name": "Coconut Cream", "cost_per_unit": 0.008, "unit": "ml", "allergens": ""},
            {"name": "Vegan Mayonnaise", "cost_per_unit": 0.009, "unit": "g", "allergens": ""},
            
            # Clean ingredients
            {"name": "Chicken Breast", "cost_per_unit": 0.008, "unit": "g", "allergens": ""},
            {"name": "Beef Steak", "cost_per_unit": 0.015, "unit": "g", "allergens": ""},
            {"name": "Turkey Bacon", "cost_per_unit": 0.012, "unit": "g", "allergens": ""},
            {"name": "Quinoa", "cost_per_unit": 0.005, "unit": "g", "allergens": ""},
            {"name": "White Rice", "cost_per_unit": 0.0012, "unit": "g", "allergens": ""},
            {"name": "Olive Oil", "cost_per_unit": 0.009, "unit": "ml", "allergens": ""},
            {"name": "Spinach", "cost_per_unit": 0.004, "unit": "g", "allergens": ""},
            {"name": "Broccoli", "cost_per_unit": 0.003, "unit": "g", "allergens": ""},
            {"name": "Avocado", "cost_per_unit": 1.20, "unit": "pcs", "allergens": ""},
            {"name": "Tomato", "cost_per_unit": 0.002, "unit": "g", "allergens": ""},
            {"name": "Garlic", "cost_per_unit": 0.005, "unit": "g", "allergens": ""},
            {"name": "Honey", "cost_per_unit": 0.010, "unit": "g", "allergens": ""},
            {"name": "Banana", "cost_per_unit": 0.40, "unit": "pcs", "allergens": ""},
            {"name": "Strawberry", "cost_per_unit": 0.008, "unit": "g", "allergens": ""},
            {"name": "Lemon", "cost_per_unit": 0.50, "unit": "pcs", "allergens": ""}
        ]

        ingredients_map = {}
        for ing_data in ingredients_data:
            ing = models.Ingredient(**ing_data)
            db.add(ing)
            db.flush()  # Populates ing.id
            ingredients_map[ing.name.lower()] = ing

        # 3. Seed Price History for Ingredients (for visual trend tracking)
        # We will generate price points for the last 6 weeks
        today = datetime.now()
        for ing_name, ing_obj in ingredients_map.items():
            # Add some fluctuation based on allergen status or generic trends
            base_price = ing_obj.cost_per_unit
            for w in range(6):
                date_str = (today - timedelta(weeks=w)).strftime("%Y-%m-%d")
                # Fluctuate price by a small percentage (-10% to +15%)
                multiplier = 1.0 + (((w * 3) % 15 - 5) / 100.0)
                hist = models.PriceHistory(
                    ingredient_id=ing_obj.id,
                    date=date_str,
                    price=round(base_price * multiplier, 5)
                )
                db.add(hist)

        # 4. Seed Recipes
        recipes_data = [
            # BREAKFAST RECIPES
            {
                "title": "Classic Wheat Pancakes",
                "description": "Fluffy traditional pancakes served with syrup.",
                "image_url": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&q=80&w=400",
                "category": "Breakfast",
                "prep_time": 20,
                "instructions": "Whisk flour, eggs, and milk. Melt butter on a skillet. Pour batter and cook until golden brown on both sides. Serve hot.",
                "calories": 420, "protein": 12, "carbs": 55, "fat": 15,
                "allergens": "gluten,dairy,eggs",
                "ingredients": [
                    ("Wheat Flour", 100),
                    ("Milk", 150),
                    ("Eggs", 1),
                    ("Butter", 20)
                ]
            },
            {
                "title": "Gluten-Free Berry Pancakes",
                "description": "Deliciously fluffy gluten-free pancakes with fresh berries.",
                "image_url": "https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&q=80&w=400",
                "category": "Breakfast",
                "prep_time": 20,
                "instructions": "Mix gluten-free flour, oat milk, and a sliced banana. Fry in olive oil. Top with strawberries.",
                "calories": 350, "protein": 6, "carbs": 60, "fat": 8,
                "allergens": "",
                "ingredients": [
                    ("Gluten-Free Flour", 100),
                    ("Oat Milk", 150),
                    ("Banana", 1),
                    ("Olive Oil", 10),
                    ("Strawberry", 50)
                ]
            },
            {
                "title": "Peanut Butter Oatmeal",
                "description": "Creamy oatmeal topped with peanut butter and honey.",
                "image_url": "https://images.unsplash.com/photo-1517686469429-8bdb88b9f907?auto=format&fit=crop&q=80&w=400",
                "category": "Breakfast",
                "prep_time": 10,
                "instructions": "Boil oats in milk. Stir in peanut butter and top with honey.",
                "calories": 480, "protein": 16, "carbs": 60, "fat": 20,
                "allergens": "gluten,dairy,nuts",
                "ingredients": [
                    ("Oats", 50),
                    ("Milk", 200),
                    ("Peanut Butter", 20),
                    ("Honey", 10)
                ]
            },
            {
                "title": "Allergy-Safe Strawberry Oatmeal",
                "description": "Safe, nut-free, dairy-free oatmeal sweet and full of berries.",
                "image_url": "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&q=80&w=400",
                "category": "Breakfast",
                "prep_time": 10,
                "instructions": "Cook oats in oat milk. Top with sunflower butter and fresh strawberries.",
                "calories": 380, "protein": 10, "carbs": 55, "fat": 14,
                "allergens": "gluten",
                "ingredients": [
                    ("Oats", 50),
                    ("Oat Milk", 200),
                    ("Sunflower Butter", 15),
                    ("Strawberry", 60)
                ]
            },
            {
                "title": "Scrambled Eggs with Spinach",
                "description": "Fluffy scrambled eggs with wilted spinach, cooked in butter.",
                "image_url": "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&q=80&w=400",
                "category": "Breakfast",
                "prep_time": 10,
                "instructions": "Whisk eggs. Melt butter in pan. Cook spinach until soft, pour eggs, and scramble.",
                "calories": 250, "protein": 14, "carbs": 2, "fat": 20,
                "allergens": "eggs,dairy",
                "ingredients": [
                    ("Eggs", 2),
                    ("Spinach", 50),
                    ("Butter", 15)
                ]
            },
            {
                "title": "Avocado Toast",
                "description": "Mashed seasoned avocado on toasted wheat bread.",
                "image_url": "https://images.unsplash.com/photo-1541532713592-79a0317b6b77?auto=format&fit=crop&q=80&w=400",
                "category": "Breakfast",
                "prep_time": 8,
                "instructions": "Toast bread slices. Mash avocado with olive oil, salt, and pepper. Spread on toast.",
                "calories": 290, "protein": 6, "carbs": 30, "fat": 16,
                "allergens": "gluten",
                "ingredients": [
                    ("Bread", 80),
                    ("Avocado", 1),
                    ("Olive Oil", 5)
                ]
            },
            {
                "title": "Vegan Tofu Scramble",
                "description": "High-protein, soy-based scrambled tofu with vegetables.",
                "image_url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400",
                "category": "Breakfast",
                "prep_time": 15,
                "instructions": "Crumble tofu. Sauté in olive oil with spinach and tomatoes. Season with salt and pepper.",
                "calories": 220, "protein": 15, "carbs": 8, "fat": 14,
                "allergens": "soy",
                "ingredients": [
                    ("Tofu", 150),
                    ("Olive Oil", 10),
                    ("Spinach", 50),
                    ("Tomato", 50)
                ]
            },
            # LUNCH RECIPES
            {
                "title": "Classic Caesar Salad",
                "description": "Chicken Caesar Salad with wheat bread croutons and egg mayonnaise dressing.",
                "image_url": "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&q=80&w=400",
                "category": "Lunch",
                "prep_time": 20,
                "instructions": "Grill chicken breast. Toss lettuce, parmesan cheese, sliced chicken, croutons, and mayonnaise. Serve.",
                "calories": 490, "protein": 35, "carbs": 12, "fat": 32,
                "allergens": "dairy,gluten,eggs",
                "ingredients": [
                    ("Chicken Breast", 150),
                    ("Bread", 40),
                    ("Parmesan Cheese", 20),
                    ("Mayonnaise", 20),
                    ("Spinach", 50)  # Use spinach as greens fallback
                ]
            },
            {
                "title": "Gluten-Free Chicken Quinoa Bowl",
                "description": "Steaming quinoa with grilled chicken, broccoli, and rich olive oil.",
                "image_url": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400",
                "category": "Lunch",
                "prep_time": 25,
                "instructions": "Cook quinoa. Grill chicken breast and steam broccoli. Toss together with olive oil.",
                "calories": 520, "protein": 42, "carbs": 45, "fat": 18,
                "allergens": "",
                "ingredients": [
                    ("Quinoa", 80),
                    ("Chicken Breast", 150),
                    ("Broccoli", 100),
                    ("Olive Oil", 15)
                ]
            },
            {
                "title": "Garlic Butter Shrimp Pasta",
                "description": "Garlic-sautéed shrimp over wheat spaghetti with butter sauce.",
                "image_url": "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&q=80&w=400",
                "category": "Lunch",
                "prep_time": 20,
                "instructions": "Boil pasta. Sauté shrimp and garlic in butter. Combine with pasta and top with parmesan.",
                "calories": 580, "protein": 30, "carbs": 65, "fat": 22,
                "allergens": "shellfish,gluten,dairy",
                "ingredients": [
                    ("Pasta", 100),
                    ("Shrimp", 100),
                    ("Butter", 20),
                    ("Garlic", 10),
                    ("Parmesan Cheese", 15)
                ]
            },
            {
                "title": "Vegan Buddha Bowl",
                "description": "Quinoa bowl with crispy tofu, fresh avocado, spinach, and tomato.",
                "image_url": "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&q=80&w=400",
                "category": "Lunch",
                "prep_time": 20,
                "instructions": "Cook quinoa. Sauté tofu cubes in olive oil. Assemble bowl with quinoa, tofu, spinach, tomatoes, and sliced avocado.",
                "calories": 490, "protein": 18, "carbs": 48, "fat": 24,
                "allergens": "soy",
                "ingredients": [
                    ("Quinoa", 80),
                    ("Tofu", 100),
                    ("Olive Oil", 10),
                    ("Spinach", 50),
                    ("Tomato", 50),
                    ("Avocado", 0.5)
                ]
            },
            {
                "title": "Egg Salad Sandwich",
                "description": "Creamy egg salad served between slices of wheat bread.",
                "image_url": "https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&q=80&w=400",
                "category": "Lunch",
                "prep_time": 15,
                "instructions": "Boil and mash eggs. Mix with mayonnaise. Spread onto wheat bread slices.",
                "calories": 390, "protein": 16, "carbs": 28, "fat": 23,
                "allergens": "gluten,eggs",
                "ingredients": [
                    ("Bread", 80),
                    ("Eggs", 2),
                    ("Mayonnaise", 20)
                ]
            },
            {
                "title": "Allergy-Safe Chicken Rice Bowl",
                "description": "A very clean, allergen-free chicken and rice bowl.",
                "image_url": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=400",
                "category": "Lunch",
                "prep_time": 20,
                "instructions": "Boil white rice. Pan-fry chicken breast in olive oil. Top with steamed broccoli.",
                "calories": 460, "protein": 38, "carbs": 50, "fat": 10,
                "allergens": "",
                "ingredients": [
                    ("White Rice", 80),
                    ("Chicken Breast", 150),
                    ("Olive Oil", 10),
                    ("Broccoli", 100)
                ]
            },
            # DINNER RECIPES
            {
                "title": "Beef and Broccoli Stir-Fry",
                "description": "Tender beef slices stir-fried with broccoli in soy sauce.",
                "image_url": "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=400",
                "category": "Dinner",
                "prep_time": 25,
                "instructions": "Cook white rice. Slice beef. Stir-fry beef in olive oil with garlic. Add broccoli and soy sauce. Serve over rice.",
                "calories": 550, "protein": 36, "carbs": 55, "fat": 20,
                "allergens": "soy,gluten",
                "ingredients": [
                    ("Beef Steak", 150),
                    ("Broccoli", 100),
                    ("Soy Sauce", 20),
                    ("White Rice", 100),
                    ("Olive Oil", 10)
                ]
            },
            {
                "title": "Soy-Free Garlic Beef and Rice",
                "description": "Savory beef and broccoli flavored with coconut aminos over white rice.",
                "image_url": "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&q=80&w=400",
                "category": "Dinner",
                "prep_time": 25,
                "instructions": "Sauté beef steak in olive oil. Pour coconut aminos and toss in broccoli. Serve with rice.",
                "calories": 570, "protein": 36, "carbs": 55, "fat": 22,
                "allergens": "",
                "ingredients": [
                    ("Beef Steak", 150),
                    ("White Rice", 100),
                    ("Broccoli", 100),
                    ("Coconut Aminos", 20),
                    ("Olive Oil", 12)
                ]
            },
            {
                "title": "Creamy Salmon and Broccoli",
                "description": "Seared salmon cooked in heavy cream and butter sauce, with broccoli.",
                "image_url": "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&q=80&w=400",
                "category": "Dinner",
                "prep_time": 25,
                "instructions": "Pan-sear salmon in butter. Pour in heavy cream and simmer. Add steamed broccoli.",
                "calories": 610, "protein": 32, "carbs": 6, "fat": 50,
                "allergens": "fish,dairy",
                "ingredients": [
                    ("Salmon Filet", 150),
                    ("Heavy Cream", 50),
                    ("Butter", 15),
                    ("Broccoli", 100)
                ]
            },
            {
                "title": "Allergy-Safe Lemon Herb Salmon",
                "description": "Healthy baked salmon seasoned with herbs and olive oil, served with quinoa.",
                "image_url": "https://images.unsplash.com/photo-1485921325833-c519f76c4927?auto=format&fit=crop&q=80&w=400",
                "category": "Dinner",
                "prep_time": 20,
                "instructions": "Bake salmon filet with olive oil, lemon juice, and herbs. Serve alongside cooked quinoa and broccoli.",
                "calories": 480, "protein": 34, "carbs": 38, "fat": 20,
                "allergens": "fish",
                "ingredients": [
                    ("Salmon Filet", 150),
                    ("Quinoa", 80),
                    ("Olive Oil", 10),
                    ("Lemon", 0.5),
                    ("Broccoli", 80)
                ]
            },
            {
                "title": "Chicken Quinoa Bowl (Dairy-Free)",
                "description": "Grilled chicken breast, turkey bacon, quinoa, and fresh spinach.",
                "image_url": "https://images.unsplash.com/photo-1606787366850-de6330128bfc?auto=format&fit=crop&q=80&w=400",
                "category": "Dinner",
                "prep_time": 30,
                "instructions": "Cook quinoa. Cook turkey bacon until crispy and grill chicken. Combine with fresh baby spinach and olive oil.",
                "calories": 590, "protein": 46, "carbs": 44, "fat": 24,
                "allergens": "",
                "ingredients": [
                    ("Chicken Breast", 150),
                    ("Turkey Bacon", 40),
                    ("Quinoa", 80),
                    ("Spinach", 50),
                    ("Olive Oil", 10)
                ]
            },
            {
                "title": "Shrimp Fried Rice",
                "description": "Stir-fried shrimp with rice, eggs, broccoli, and soy sauce.",
                "image_url": "https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&q=80&w=400",
                "category": "Dinner",
                "prep_time": 20,
                "instructions": "Scramble eggs and set aside. Sauté shrimp in olive oil. Stir fry cooked white rice, broccoli, eggs, shrimp and soy sauce.",
                "calories": 490, "protein": 28, "carbs": 52, "fat": 14,
                "allergens": "shellfish,eggs,soy,gluten",
                "ingredients": [
                    ("White Rice", 100),
                    ("Shrimp", 100),
                    ("Eggs", 1),
                    ("Broccoli", 80),
                    ("Soy Sauce", 15),
                    ("Olive Oil", 10)
                ]
            },
            {
                "title": "Gluten-Free Tomato Pasta",
                "description": "A comforting plate of gluten-free pasta with rich olive oil tomato sauce and spinach.",
                "image_url": "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&q=80&w=400",
                "category": "Dinner",
                "prep_time": 20,
                "instructions": "Boil gluten-free pasta. Sauté tomatoes, garlic, and spinach in olive oil. Mix with pasta.",
                "calories": 410, "protein": 8, "carbs": 68, "fat": 12,
                "allergens": "",
                "ingredients": [
                    ("Gluten-Free Flour", 80),  # Representative for GF pasta
                    ("Olive Oil", 15),
                    ("Tomato", 100),
                    ("Spinach", 50),
                    ("Garlic", 5)
                ]
            }
        ]

        for recipe_item in recipes_data:
            recipe = models.Recipe(
                title=recipe_item["title"],
                description=recipe_item["description"],
                image_url=recipe_item["image_url"],
                category=recipe_item["category"],
                prep_time=recipe_item["prep_time"],
                instructions=recipe_item["instructions"],
                calories=recipe_item["calories"],
                protein=recipe_item["protein"],
                carbs=recipe_item["carbs"],
                fat=recipe_item["fat"],
                allergens=recipe_item["allergens"]
            )
            db.add(recipe)
            db.flush()

            # Link ingredients
            for ing_name, qty in recipe_item["ingredients"]:
                ing_obj = ingredients_map.get(ing_name.lower())
                if ing_obj:
                    ri = models.RecipeIngredient(
                        recipe_id=recipe.id,
                        ingredient_id=ing_obj.id,
                        quantity=float(qty)
                    )
                    db.add(ri)

        db.commit()
        print("Database seeded successfully with all default ingredients and recipes!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()

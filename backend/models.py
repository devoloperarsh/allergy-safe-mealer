from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, Table, Date
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    profile = relationship("UserProfile", back_populates="user", uselist=False)
    meal_plans = relationship("WeeklyMealPlan", back_populates="user")

class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True)
    weekly_budget = Column(Float, default=100.0)
    # Stored as JSON string or comma-separated list
    # e.g., ["nuts", "gluten"]
    allergies = Column(String, default="[]")
    # Stored as JSON string, mapping allergy to severity
    # e.g., {"nuts": "severe", "dairy": "mild"}
    allergen_severities = Column(String, default="{}")
    # Stored as JSON string
    # e.g., {"calories": 2000, "protein": 75, "carbs": 250, "fat": 70}
    nutrition_goals = Column(String, default="{}")

    user = relationship("User", back_populates="profile")

class Ingredient(Base):
    __tablename__ = "ingredients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    cost_per_unit = Column(Float, nullable=False)  # Price in USD
    unit = Column(String, nullable=False)  # e.g., "g", "ml", "pcs", "slice"
    allergens = Column(String, default="")  # comma-separated list of allergens

    recipe_ingredients = relationship("RecipeIngredient", back_populates="ingredient")
    price_histories = relationship("PriceHistory", back_populates="ingredient")

class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(String, default="")
    image_url = Column(String, default="")
    category = Column(String, nullable=False)  # "Breakfast", "Lunch", "Dinner"
    prep_time = Column(Integer, default=20)  # minutes
    instructions = Column(String, default="")
    
    # Nutrition fields per serving
    calories = Column(Float, default=0.0)
    protein = Column(Float, default=0.0)
    carbs = Column(Float, default=0.0)
    fat = Column(Float, default=0.0)

    # Aggregated allergen tags for quick queries (comma-separated, e.g. "gluten,dairy")
    allergens = Column(String, default="")

    ingredients = relationship("RecipeIngredient", back_populates="recipe", cascade="all, delete-orphan")

class RecipeIngredient(Base):
    __tablename__ = "recipe_ingredients"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"), nullable=False)
    quantity = Column(Float, nullable=False)  # Quantity in units

    recipe = relationship("Recipe", back_populates="ingredients")
    ingredient = relationship("Ingredient", back_populates="recipe_ingredients")

class PriceHistory(Base):
    __tablename__ = "price_histories"

    id = Column(Integer, primary_key=True, index=True)
    ingredient_id = Column(Integer, ForeignKey("ingredients.id"), nullable=False)
    date = Column(String, nullable=False)  # YYYY-MM-DD format
    price = Column(Float, nullable=False)

    ingredient = relationship("Ingredient", back_populates="price_histories")

class WeeklyMealPlan(Base):
    __tablename__ = "weekly_meal_plans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    week_start_date = Column(String, nullable=False)  # YYYY-MM-DD format
    # Stored as JSON string containing a list of recipes for each day
    # e.g., [{"day": "Monday", "breakfast": 1, "lunch": 2, "dinner": 3}, ...]
    plan_data = Column(String, nullable=False)
    total_cost = Column(Float, nullable=False)

    user = relationship("User", back_populates="meal_plans")

class AllergenSubstitution(Base):
    __tablename__ = "allergen_substitutions"

    id = Column(Integer, primary_key=True, index=True)
    allergen_ingredient = Column(String, nullable=False, index=True)  # e.g., "cow milk"
    safe_substitution = Column(String, nullable=False)  # e.g., "oat milk"
    notes = Column(String, default="")

from pydantic import BaseModel, EmailStr, Field
from typing import List, Dict, Optional, Any

# Authentication Schemas
class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    email: str
    is_active: bool

    class Config:
        from_attributes = True

# User Profile Schemas
class UserProfileUpdate(BaseModel):
    weekly_budget: float = Field(..., gt=0, description="Weekly grocery budget in USD")
    allergies: List[str] = Field(default=[], description="List of active allergies")
    allergen_severities: Dict[str, str] = Field(default={}, description="Mapping of allergen to severity, e.g. {'nuts': 'severe'}")
    nutrition_goals: Dict[str, float] = Field(default={}, description="Energy/macronutrient targets")

class UserProfileResponse(BaseModel):
    id: int
    user_id: int
    weekly_budget: float
    allergies: List[str]
    allergen_severities: Dict[str, str]
    nutrition_goals: Dict[str, float]

    class Config:
        from_attributes = True

# Ingredient Schemas
class IngredientBase(BaseModel):
    name: str
    cost_per_unit: float
    unit: str
    allergens: str

class IngredientResponse(IngredientBase):
    id: int

    class Config:
        from_attributes = True

# Recipe Ingredient Schema
class RecipeIngredientResponse(BaseModel):
    ingredient: IngredientResponse
    quantity: float

    class Config:
        from_attributes = True

# Recipe Schema
class RecipeResponse(BaseModel):
    id: int
    title: str
    description: str
    image_url: str
    category: str
    prep_time: int
    instructions: str
    calories: float
    protein: float
    carbs: float
    fat: float
    allergens: str
    ingredients: List[RecipeIngredientResponse] = []

    class Config:
        from_attributes = True

# Weekly Meal Plan Schema
class MealPlanDay(BaseModel):
    day: str
    breakfast: RecipeResponse
    lunch: RecipeResponse
    dinner: RecipeResponse

class WeeklyMealPlanResponse(BaseModel):
    id: int
    week_start_date: str
    total_cost: float
    plan_data: List[MealPlanDay]

    class Config:
        from_attributes = True

# Allergen Substitution Schema
class AllergenSubstitutionResponse(BaseModel):
    id: int
    allergen_ingredient: str
    safe_substitution: str
    notes: Optional[str] = None

    class Config:
        from_attributes = True

# Price History Schema
class PriceHistoryResponse(BaseModel):
    id: int
    ingredient_id: int
    date: str
    price: float

    class Config:
        from_attributes = True

# Shopping List Consolidator Schema
class ShoppingListItem(BaseModel):
    ingredient_name: str
    quantity: float
    unit: str
    cost: float
    allergens: List[str]
    severity_alert: str  # "none", "mild", "severe"
    substitution_suggested: Optional[str] = None

class ShoppingListResponse(BaseModel):
    items: List[ShoppingListItem]
    total_estimated_cost: float
    budget_limit: float
    exceeds_budget: bool
    budget_margin: float

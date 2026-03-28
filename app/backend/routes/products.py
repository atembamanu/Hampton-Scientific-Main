import uuid
from typing import List

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from models.product import Product, ProductCategory
from utils.logger import logger
from deps import get_db
from repositories import products as products_repo

router = APIRouter()


# ============================================
# public / customer endpoints
# ============================================

@router.get("", response_model=List[Product], tags=["products"])
async def list_products(db: Session = Depends(get_db)):
    """Public listing of all products."""
    try:
        return products_repo.list_products(db)
    except Exception as e:
        logger.error(f"Failed to list products: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve products")


@router.get("/categories", response_model=List[ProductCategory], tags=["products"])
async def list_categories(db: Session = Depends(get_db)):
    """Public listing of all categories."""
    try:
        return products_repo.list_categories(db)
    except Exception as e:
        logger.error(f"Failed to list categories: {e}")
        raise HTTPException(status_code=500, detail="Could not retrieve categories")


@router.get("/{product_id}", response_model=Product, tags=["products"])
async def get_product(product_id: str, db: Session = Depends(get_db)):
    """Fetch a single product by its ID."""
    prod = products_repo.get_product_by_product_id(db, product_id)
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    return prod


@router.get("/search", response_model=List[Product], tags=["products"])
async def search_products(q: str, db: Session = Depends(get_db)):
    """Fuzzy search products by name or category."""
    try:
        return products_repo.search_products(db, q)
    except Exception as e:
        logger.error(f"Failed to search products: {e}")
        raise HTTPException(status_code=500, detail="Could not search products")

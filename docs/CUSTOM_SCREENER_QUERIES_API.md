# Custom Screener Queries API Documentation

Complete CRUD API for managing custom stock screener queries.

## Table of Contents
- [Overview](#overview)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Integration](#integration)
- [Examples](#examples)

---

## Overview

This API allows users to:
- View prebuild screens from JSON
- Create custom screening queries
- Search and filter screens
- Edit their own screens
- Delete their own screens
- Publish screens for others to see

---

## Database Schema

**Table:** `custom_screener_queries`

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key, auto-increment |
| `user_id` | INTEGER | Foreign key to app_users |
| `category` | STRING | Screen category (e.g., "growth", "value") |
| `title` | STRING | Screen title |
| `description` | TEXT | Screen description |
| `backend_query` | TEXT | Query format: `market_cap > 500 AND roe_per > 15` |
| `frontend_query` | TEXT | Display format: `Market Cap > 500 AND ROE > 15%` |
| `publish` | BOOLEAN | Whether screen is public (default: false) |
| `time` | TIME | Creation time |
| `created_at` | DATE | Creation date |

---

## API Endpoints

### 1. Get Prebuild Screens

Get all prebuild screens from JSON file.

**Endpoint:** `GET /ai/api/custom-screener/prebuild-screens`

**Response:**
```json
{
  "status": 1,
  "message": "Prebuild screens fetched successfully",
  "data": {
    "popular_themes": [...],
    "popular_formulas": [...],
    "price_or_volume": [...],
    "quarterly_results": [...],
    "valuation_screens": [...],
    "fundamental_strength": [...],
    "growth_screens": [...],
    "dividend_screens": [...],
    "momentum_screens": [...],
    "quality_screens": [...]
  }
}
```

---

### 2. Search Screens

Search and filter user screens.

**Endpoint:** `GET /ai/api/custom-screener/search-screens`

**Query Parameters:**
- `user_id` (optional) - Filter by user ID
- `category` (optional) - Filter by category
- `search` (optional) - Search in title/description
- `publish` (optional) - Filter by publish status (true/false)
- `limit` (optional) - Results per page (default: 50)
- `offset` (optional) - Pagination offset (default: 0)

**Example:**
```
GET /ai/api/custom-screener/search-screens?category=growth&publish=true&limit=10
```

**Response:**
```json
{
  "status": 1,
  "message": "Screens fetched successfully",
  "data": {
    "total": 25,
    "screens": [
      {
        "id": 1,
        "user_id": 123,
        "category": "growth",
        "title": "High Growth Stocks",
        "description": "Companies with strong revenue and earnings growth",
        "backend_query": "eps_growth_5y > 20 AND rev_growth_5y > 15",
        "frontend_query": "EPS Growth 5Y > 20% AND Revenue Growth 5Y > 15%",
        "publish": true,
        "time": "14:30:00",
        "created_at": "2025-11-26"
      }
    ],
    "limit": 10,
    "offset": 0
  }
}
```

---

### 3. Get Published Screens

Get only published (public) screens.

**Endpoint:** `GET /api/custom-screener-queries/published`

**Query Parameters:**
- `category` (optional) - Filter by category
- `search` (optional) - Search in title/description
- `limit` (optional) - Results per page (default: 50)
- `offset` (optional) - Pagination offset (default: 0)

**Example:**
```
GET /api/custom-screener-queries/published?category=value&limit=20
```

---

### 4. Get User's Own Screens

Get all screens created by a specific user.

**Endpoint:** `GET /api/custom-screener-queries/my-screens`

**Query Parameters:**
- `user_id` (required) - User ID
- `limit` (optional) - Results per page (default: 100)
- `offset` (optional) - Pagination offset (default: 0)

**Example:**
```
GET /api/custom-screener-queries/my-screens?user_id=123
```

---

### 5. Get Screen by ID

Get a single screen by its ID.

**Endpoint:** `GET /api/custom-screener-queries/:id`

**Query Parameters:**
- `user_id` (optional) - If provided, checks ownership or published status

**Example:**
```
GET /api/custom-screener-queries/5?user_id=123
```

**Response:**
```json
{
  "status": 1,
  "message": "Screen fetched successfully",
  "data": {
    "id": 5,
    "user_id": 123,
    "category": "growth",
    "title": "High Growth Stocks",
    "description": "Companies with strong revenue and earnings growth",
    "backend_query": "eps_growth_5y > 20 AND rev_growth_5y > 15",
    "frontend_query": "EPS Growth 5Y > 20% AND Revenue Growth 5Y > 15%",
    "publish": true,
    "time": "14:30:00",
    "created_at": "2025-11-26"
  }
}
```

---

### 6. Create User Screen

Create a new custom screen.

**Endpoint:** `POST /api/custom-screener-queries/user`

**Request Body:**
```json
{
  "user_id": 123,
  "category": "growth",
  "title": "My Custom Growth Screen",
  "description": "High growth companies with good margins",
  "backend_query": "eps_growth_5y > 20 AND net_prof_marg_ttm > 10",
  "frontend_query": "EPS Growth 5Y > 20% AND Net Profit Margin > 10%",
  "publish": false
}
```

**Response:**
```json
{
  "status": 1,
  "message": "Screen created successfully",
  "data": {
    "id": 10,
    "user_id": 123,
    "category": "growth",
    "title": "My Custom Growth Screen",
    "description": "High growth companies with good margins",
    "backend_query": "eps_growth_5y > 20 AND net_prof_marg_ttm > 10",
    "frontend_query": "EPS Growth 5Y > 20% AND Net Profit Margin > 10%",
    "publish": false,
    "time": "15:45:30",
    "created_at": "2025-11-26"
  }
}
```

---

### 7. Create Admin Screen

Create a new admin screen (published by default).

**Endpoint:** `POST /api/custom-screener-queries/admin`

**Request Body:**
```json
{
  "user_id": 1,
  "category": "quality",
  "title": "Quality at Fair Price",
  "description": "High quality companies at reasonable valuations",
  "backend_query": "roe_per > 18 AND stock_p_e < 30 AND debt_to_equity < 0.5",
  "frontend_query": "ROE > 18% AND PE < 30 AND Debt to Equity < 0.5"
}
```

**Note:** Admin screens are automatically published (`publish: true`).

---

### 8. Update User Screen

Update an existing screen (user must own the screen).

**Endpoint:** `PUT /api/custom-screener-queries/:id`

**Request Body:**
```json
{
  "user_id": 123,
  "title": "Updated Title",
  "description": "Updated description",
  "backend_query": "eps_growth_5y > 25 AND net_prof_marg_ttm > 12",
  "frontend_query": "EPS Growth 5Y > 25% AND Net Profit Margin > 12%",
  "publish": true
}
```

**Response:**
```json
{
  "status": 1,
  "message": "Screen updated successfully",
  "data": {
    "id": 10,
    "user_id": 123,
    "category": "growth",
    "title": "Updated Title",
    "description": "Updated description",
    "backend_query": "eps_growth_5y > 25 AND net_prof_marg_ttm > 12",
    "frontend_query": "EPS Growth 5Y > 25% AND Net Profit Margin > 12%",
    "publish": true,
    "time": "15:45:30",
    "created_at": "2025-11-26"
  }
}
```

---

### 9. Delete User Screen

Delete a screen (user must own the screen).

**Endpoint:** `DELETE /api/custom-screener-queries/:id`

**Request Body:**
```json
{
  "user_id": 123
}
```

**Response:**
```json
{
  "status": 1,
  "message": "Screen deleted successfully",
  "data": {
    "id": 10
  }
}
```

---

## Integration

### Add to app.js

```javascript
import custom_screener_queries_routes from "./routers/custom_screener_queries.Route.js";

app.use("/ai/api/custom-screener-queries", custom_screener_queries_routes);
```

---

## Examples

### Example 1: User Creates a Screen

```javascript
// Create a new screen
const response = await fetch('/api/custom-screener-queries/user', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: 123,
    category: 'value',
    title: 'Undervalued Gems',
    description: 'Low PE stocks with good fundamentals',
    backend_query: 'stock_p_e < 12 AND roe_per > 15 AND debt_to_equity < 0.5',
    frontend_query: 'PE < 12 AND ROE > 15% AND Debt to Equity < 0.5',
    publish: false
  })
});

const data = await response.json();
console.log('Created screen ID:', data.data.id);
```

### Example 2: Search Published Screens

```javascript
// Search for growth screens
const response = await fetch(
  '/api/custom-screener-queries/published?category=growth&search=EPS&limit=10'
);

const data = await response.json();
console.log('Found screens:', data.data.total);
console.log('Screens:', data.data.screens);
```

### Example 3: Update a Screen

```javascript
// Update screen title and publish it
const response = await fetch('/api/custom-screener-queries/5', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: 123,
    title: 'Updated Screen Title',
    publish: true
  })
});

const data = await response.json();
console.log('Updated:', data.message);
```

### Example 4: Get User's Screens

```javascript
// Get all screens created by user
const response = await fetch('/api/custom-screener-queries/my-screens?user_id=123');

const data = await response.json();
console.log('My screens:', data.data.screens);
```

### Example 5: Delete a Screen

```javascript
// Delete a screen
const response = await fetch('/api/custom-screener-queries/5', {
  method: 'DELETE',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: 123
  })
});

const data = await response.json();
console.log('Deleted:', data.message);
```

---

## Error Responses

### 400 Bad Request
```json
{
  "status": 0,
  "message": "Missing required fields: user_id, category, title, description, backend_query, frontend_query",
  "data": null
}
```

### 403 Forbidden
```json
{
  "status": 0,
  "message": "You don't have permission to edit this screen",
  "data": null
}
```

### 404 Not Found
```json
{
  "status": 0,
  "message": "Screen not found",
  "data": null
}
```

### 409 Conflict
```json
{
  "status": 0,
  "message": "A screen with this title already exists",
  "data": null
}
```

### 500 Internal Server Error
```json
{
  "status": 0,
  "message": "Internal server error. Please try again later.",
  "data": null
}
```

---

## Categories

Suggested categories for screens:
- `popular_themes`
- `popular_formulas`
- `price_or_volume`
- `quarterly_results`
- `valuation_screens`
- `fundamental_strength`
- `growth_screens`
- `dividend_screens`
- `momentum_screens`
- `quality_screens`
- `custom` (user-defined)

---

## Files Created

1. ✅ `services/custom_screener_queries.Services.js` - Business logic
2. ✅ `controllers/custom_screener_queries.Controller.js` - Request handlers
3. ✅ `routers/custom_screener_queries.Route.js` - Route definitions
4. ✅ `docs/CUSTOM_SCREENER_QUERIES_API.md` - This documentation

---

## Testing

Use the provided Postman collection or test with cURL:

```bash
# Get prebuild screens
curl http://localhost:4000/ai/api/custom-screener-queries/prebuild

# Search screens
curl "http://localhost:4000/ai/api/custom-screener-queries/search?category=growth"

# Create screen
curl -X POST http://localhost:4000/ai/api/custom-screener-queries/user \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 123,
    "category": "growth",
    "title": "Test Screen",
    "description": "Test description",
    "backend_query": "market_cap > 1000",
    "frontend_query": "Market Cap > 1000 Cr",
    "publish": false
  }'
```

---

**Status:** Ready for Integration ✅

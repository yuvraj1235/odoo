# ⚡ AssetFlow Enterprise

<div align="center">
  <h3><strong>Intelligent Hardware Lifecycle & Shared Resource Governance Platform</strong></h3>
  <p>
    Built for enterprise scalability with automated workflows, real-time SLA enforcement, multimodal AI receipt extraction, predictive risk forecasting, and sub-second UI virtualization.
  </p>

  [![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
  [![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
  [![TanStack Query](https://img.shields.io/badge/TanStack_Query-FF4154?style=for-the-badge&logo=react-query&logoColor=white)](https://tanstack.com/query/v5)
  [![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
</div>

---

## 🌟 Executive Overview

Traditional asset and resource management platforms suffer from manual data entry bottlenecks, disconnected department workflows, and high hardware shrinkage rates. **AssetFlow Enterprise** bridges the gap by delivering a unified, intelligent control plane that combines:

1. **Strict Role-Based Access Control (RBAC)** across 4 enterprise tiers.
2. **Native Multimodal AI** for instant receipt/invoice extraction and natural language command processing.
3. **Automated Chain of Custody & Conflict Handling** that prevents double-allocations and room double-bookings.
4. **Automated SLA Tracking & Smart Swap Recommendations** to guarantee continuous operational runtime during equipment maintenance.
5. **High-Performance Architecture** engineered to effortlessly handle **50,000+ hardware records** at 60 FPS.

---

## ✨ Key Capabilities & Features

### 🔐 1. Enterprise Role-Based Access Control (RBAC)
* **Non-Self-Elevating Authentication:** New signups default securely to standard **Employee** roles.
* **4 Operational Tiers:**
  * **Admin:** Manages master taxonomy (departments, custom asset categories, custom schema definitions) and user role promotions via the Organization Setup console.
  * **Asset Manager:** Registers equipment, approves transfer chains, manages maintenance SLAs, and closes audit discrepancy cycles.
  * **Department Head:** Oversees departmental allocations, approves intra-department transfers, and reserves shared corporate resources.
  * **Employee:** Views assigned equipment, books shared resources, raises maintenance requests, and initiates returns/transfers.

---

### 🧠 2. Native AI & Multimodal Intelligence
* **AI Receipt & Invoice OCR Ingestion:** Asset Managers can upload a photo or PDF of a purchase receipt during asset registration. Our multimodal AI engine automatically parses the document, extracting the **Serial Number**, **Acquisition Cost**, and **Purchase Date**, auto-filling the onboarding form instantly.
* **Global "Ask AI" Command Palette (`Ctrl + K`):** A natural language semantic intent agent accessible anywhere in the application:
  * **Smart Filtering:** Type `"Show me all damaged electronics"` -> returns precise filtered assets (`status: under_maintenance`, `category: Electronics`).
  * **Bulk Operational Execution:** Type `"Move all assets from Desk E12 to Room B2"` -> triggers a **Safe Confirmation Guardrail** popup with affected asset counts before batch re-assignment.
* **Predictive Maintenance Risk Engine:** Machine learning algorithm that evaluates cumulative runtime hours, asset age, and physical condition to compute a real-time **Failure Probability Risk Score (`0.0 - 1.0`)**, alerting managers before equipment fails.

---

### 📦 3. Lifecycle Management & High-Density Virtualization
* **50,000+ Item Virtualization:** The Asset Directory is powered by **TableVirtuoso** and **TanStack Query**, rendering only active viewport rows while retaining native HTML `<table>` semantics and sticky headers for zero lag or memory bloat under massive datasets.
* **Custom Category Schemas:** Admins can define dynamic JSON schema fields (e.g., `GPU Memory`, `Calibration Due Date`, `MAC Address`) tailored specific asset categories.
* **Chain of Custody Transfers:** If an asset is already allocated, the system prevents direct reassignment and initiates a formal **Transfer Request Workflow** requiring check-in/check-out condition notes and Department Head sign-off.

---

### 📅 4. Shared Resource Bookings & Automated Maintenance SLAs
* **Zero-Overlap Booking Engine:** Database and API-level time-window verification instantly blocks overlapping reservation attempts for shared conference rooms, company vehicles, and projectors.
* **Automated Maintenance SLA Matrix:** Every ticket is tracked against strict resolution windows from creation:
  * **Critical:** 2 Hours | **High:** 4 Hours | **Medium:** 12 Hours | **Low:** 24 Hours
* **Automated Escalation:** A dynamic background engine monitors elapsed time, flipping ticket statuses to **`Warning`** at 75% window and red **`Breached`** upon expiration.
* **Smart Swap Recommendation Engine:** When hardware breaks down, the AI automatically analyzes specifications, category, and location to recommend the closest identical available replacement asset to eliminate employee downtime.

---

## 🏗️ Technical Architecture & Optimizations

```
+-----------------------------------------------------------------------------------+
|                            FRONTEND (React + Vite)                                |
|  +--------------------+  +----------------------+  +---------------------------+  |
|  |  TanStack Query    |  |  TableVirtuoso       |  |  Lucide Icons + Tailwind  |  |
|  |  (Caching + Sync)  |  |  (50k+ Item Scroll)  |  |  (Glassmorphism UI/UX)    |  |
|  +--------------------+  +----------------------+  +---------------------------+  |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          | HTTP / REST (Nginx Reverse Proxy)
                                          v
+-----------------------------------------+-----------------------------------------+
|                            BACKEND (FastAPI + Python 3.12)                        |
|  +--------------------+  +----------------------+  +---------------------------+  |
|  |  In-Memory TTL     |  |  SQLAlchemy Async    |  |  AI & OCR Service Engine  |  |
|  |  Cache Engine      |  |  (Eager selectinload)|  |  (Intent + OCR Parsing)   |  |
|  +--------------------+  +----------------------+  +---------------------------+  |
+-----------------------------------------+-----------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                         DATABASE (SQLite / PostgreSQL)                            |
|       Composite Indexes on `(category, status, location)` & Foreign Keys          |
+-----------------------------------------------------------------------------------+
```

### Key Performance Engineering Decisions:
1. **Elimination of N+1 Queries (`selectinload`):** All database read operations perform optimized eager relational joins, reducing query latency by up to 85%.
2. **In-Memory TTL Caching Engine (`app/cache.py`):** Caches high-compute analytical endpoints (`/analytics/kpis`, `/analytics/utilization`) and predictive metrics.
3. **Automated Mutation Cache Invalidation:** Creating or mutating an asset, allocation, or maintenance request automatically clears relevant query keys (`analytics:*`, `ai:*`) so dashboards never display stale data.
4. **Internal Reverse Proxy (`nginx.conf`):** All `/api/` traffic is proxied through Nginx over an internal Docker network, preventing CORS friction while keeping the production bundle under single-origin routing.

---

## 🚀 Getting Started (Dockerized — Recommended)

AssetFlow Enterprise is fully containerized using a multi-stage Docker setup.

### Prerequisites:
* [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)

### 1. Launch the Stack
Open your terminal at the root of the project and run:

```bash
docker compose up -d --build
```

### 2. Access the Applications
Once started, the containers will run continuously:
* 🌐 **Production Web UI:** `http://localhost/` (or `http://localhost:3000/`)
* 📚 **Interactive API Docs (Swagger):** `http://localhost:8010/docs`
* 📊 **Backend Health Check:** `http://localhost:8010/`

---

## 🛠️ Local Development Setup (Manual)

If you prefer running the services directly on your host machine without Docker:

### 1. Backend Setup (`FastAPI`)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run the API server with live reload on port 8010
uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

### 2. Frontend Setup (`Vite + React + TypeScript`)
```bash
cd frontend
npm install

# Start the Vite development server (proxies /api to localhost:8010 automatically)
npm run dev
```

Open your browser to `http://localhost:5173`.

---

## 🔑 Default Seed Credentials for Testing

Upon initial startup (`seed_database`), the system automatically pre-populates realistic enterprise data, categories, departments, assets, and 4 seeded user accounts representing every RBAC tier:

| Role | Username / Email | Password | Access Rights |
| :--- | :--- | :--- | :--- |
| **Organization Admin** | `admin@assetflow.io` | `admin123` | Full access: Organization Setup, Departments, Categories, User Role Governance |
| **Asset Manager** | `manager@assetflow.io` | `manager123` | Asset onboarding (AI OCR), Maintenance ticket SLA approvals, Audit reconciliation |
| **Department Head** | `head@assetflow.io` | `head123` | Department asset allocations, chain-of-custody transfer approvals, resource bookings |
| **Employee** | `employee@assetflow.io` | `employee123` | View assigned hardware, book shared resources, raise maintenance tickets |

---

## 📁 Project Structure

```
assetflow/
├── backend/
│   ├── app/
│   │   ├── routers/         # API Routers (auth, users, assets, ai, analytics, etc.)
│   │   ├── cache.py         # Thread-safe in-memory TTL Caching Engine
│   │   ├── database.py      # Async SQLAlchemy Engine & Session Factory
│   │   ├── models.py        # Relational Database Schema & Enums
│   │   ├── schemas.py       # Pydantic V2 Validation Schemas
│   │   └── security.py      # JWT Authentication & Role-based Guards
│   ├── Dockerfile           # Python 3.12 Slim Production Container
│   └── requirements.txt     # Python Dependencies
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios API Client & Auth Interceptors
│   │   ├── components/      # Reusable UI Components & AI Command Palette
│   │   ├── contexts/        # React Contexts (AuthContext)
│   │   └── pages/           # Application Pages (Dashboard, Assets, OrgSetup, etc.)
│   ├── Dockerfile           # Multi-stage Node 20 Build + Nginx Alpine
│   ├── nginx.conf           # Reverse Proxy & SPA Routing Configuration
│   └── package.json         # Frontend Dependencies & Scripts
├── docker-compose.yml       # Production Container Orchestration
└── README.md                # Enterprise Documentation
```

---

<div align="center">
  <p><strong>Built with ❤️ by the AssetFlow Enterprise Engineering Team</strong></p>
</div>

# TASTERA — Discover What Connects You

**An AI-powered personal discovery platform for exploring movies, books, music, and more through evolving taste profiles, personalized recommendations, and unexpected connections.**

> Your next favorite thing might be connected to something you already love.

---

## Overview

TASTERA is an early prototype and research project for a planned AI-powered discovery platform. The current repository contains a React + TypeScript frontend prototype, a minimal FastAPI health-check service, and MovieLens-based recommendation experiments. The complete personalized, cross-media product described below remains under development.

Traditional recommendation systems often focus on recommending similar items within a single category. TASTERA aims to go further by exploring relationships between different forms of content, helping users discover movies that connect with their favorite books, music that matches the atmosphere of a film, or creators and genres that align with their interests.

The long-term vision is to create a personalized discovery experience that goes beyond popularity-based recommendations and encourages users to explore unfamiliar content through meaningful connections.

The project is in early implementation. The features, architecture, and technology stack described in this document represent the longer-term vision and may evolve as implementation progresses.

## The Problem

Modern content platforms offer enormous libraries of movies, books, music, and other media. However, discovering something genuinely interesting can still be difficult.

- **Repetitive recommendations:** Users may repeatedly receive content similar to what they already consume.
- **Fragmented discovery:** Interests are often treated separately across different platforms and content categories.
- **Limited exploration:** Popularity-driven recommendations can make it difficult to discover lesser-known content.
- **Unexplored relationships:** Connections between music, films, books, themes, moods, genres, and creators are rarely presented as one unified discovery experience.
- **Changing preferences:** A user's interests evolve over time, but recommendations may not fully reflect that evolution.

TASTERA aims to address these challenges by combining personalized recommendations with cross-category discovery and a continuously evolving representation of user interests.

## Project Vision

The central idea behind TASTERA is simple:

**Understand what a person enjoys, learn what connects their interests, and use those connections to introduce them to something new.**

Rather than treating a user's history as a static list of consumed content, the platform aims to develop a richer representation of their preferences.

For example, a user who enjoys a science-fiction film, a philosophical novel, and atmospheric electronic music might discover other content through shared themes, moods, creators, or semantic similarities—even when the items belong to entirely different categories.

These connections are a proposed direction for the recommendation engine, not implemented functionality.

## Planned Features

### 1. Personalized Discovery

Recommendations will aim to reflect individual preferences rather than relying exclusively on general popularity.

Potential inputs include:

- Favorite movies, books, artists, and genres.
- Ratings, likes, saves, and dislikes.
- Search and browsing interactions.
- Explicit feedback on recommendation quality.

### 2. Cross-Category Recommendations

Explore relationships across multiple content categories instead of restricting recommendations to one domain.

Potential discovery paths include:

- Movies inspired by themes found in books.
- Music that shares the mood or atmosphere of a film.
- Books related to the themes of a favorite game.
- Artists, authors, or directors connected through shared styles or influences.

The availability and reliability of these relationships will depend on the content data and metadata sources integrated into the platform.

### 3. Evolving Taste Profile

TASTERA aims to maintain a dynamic representation of a user's preferences.

The taste profile could evolve through explicit feedback, saved items, ratings, and other meaningful interactions.

The objective is to balance familiar recommendations with opportunities for exploration as interests change.

### 4. Unexpected Discovery

The platform aims to identify relevant content that a user might not discover through ordinary similarity-based recommendations.

Potential approaches include semantic similarity, content relationships, diversity-aware ranking, and controlled exploration beyond a user's most obvious preferences.

### 5. Taste Map

A proposed visual interface will represent relationships between interests and content.

Possible elements include:

- Nodes representing movies, books, songs, artists, or genres.
- Connections representing shared themes, styles, or semantic similarity.
- Clusters representing related interests.
- New discovery paths connecting previously unrelated interests.

The visualization will aim to make recommendations more interpretable by showing why two items may be related.

### 6. Feedback-Driven Personalization

Users may be able to provide feedback on recommendations.

Examples include:

- Like or dislike an item.
- Save content for later.
- Mark recommendations as relevant or irrelevant.
- Explore alternative recommendations.
- Refine preferences over time.

This feedback could be used to improve future recommendations, subject to the eventual recommendation design.

---

## How TASTERA Could Work

The following is a conceptual workflow for the planned system.

1. **User onboarding:** Collect initial preferences, favorite content, and areas of interest.
2. **Content ingestion:** Retrieve and organize metadata from suitable content sources.
3. **Feature representation:** Represent content using available attributes such as genres, descriptions, themes, creators, and other metadata.
4. **Taste modeling:** Build an initial representation of the user's preferences.
5. **Candidate generation:** Identify potentially relevant content from one or more categories.
6. **Recommendation ranking:** Rank candidates according to relevance, diversity, novelty, and available user feedback.
7. **Connection discovery:** Identify meaningful relationships between recommended items and existing interests.
8. **User interaction:** Collect feedback and update the taste profile.
9. **Evaluation:** Measure recommendation quality and assess whether the system provides useful and diverse discoveries.

The exact workflow will depend on the selected algorithms, data sources, and implementation constraints.

## Proposed Technical Architecture

The technology stack has not yet been finalized. The following options are candidates for implementation.

| Layer | Potential technologies | Purpose |
|---|---|---|
| Frontend | HTML, CSS, JavaScript, React | User interface and discovery experience |
| Backend | Python, FastAPI | APIs, business logic, recommendation services |
| Data processing | Python, Pandas, NumPy | Data cleaning and feature preparation |
| Machine learning | scikit-learn, PyTorch | Recommendation experiments and preference modeling |
| Text representation | TF-IDF, sentence embeddings | Represent and compare content descriptions |
| Database | PostgreSQL | Store users, preferences, content metadata, and feedback |
| Vector search | pgvector or a dedicated vector index | Retrieve semantically related content if needed |
| Visualization | D3.js or Cytoscape.js | Explore relationships between content and interests |
| Testing | pytest, frontend testing tools | Verify backend and interface behavior |
| Deployment | To be determined | Host the application and supporting services |

The final stack will be chosen based on the project's requirements, available data, implementation complexity, and deployment costs. Not every technology listed above will necessarily be used.

## Recommendation System: Research Directions

A major technical goal is to explore how different recommendation strategies can work together.

### Content-Based Filtering

Recommend items based on similarities in their metadata, descriptions, genres, themes, and other attributes.

Potential techniques:
- TF-IDF with cosine similarity.
- Metadata-based feature engineering.
- Sentence embeddings for semantic similarity.

### Collaborative Filtering

Explore recommendations based on patterns in interactions between multiple users, where sufficient interaction data is available.

Potential techniques:
- User-item interaction matrices.
- Matrix factorization.
- Implicit-feedback recommendation models.

Collaborative filtering may be limited initially by the lack of real users and interaction data.

### Hybrid Recommendations

Combine content-based signals, user preferences, and interaction-based signals where available.

A hybrid approach may help balance personalization with content relevance, particularly when one type of information is missing.

### Cross-Category Similarity

Investigate ways to compare content across different categories using common representations, metadata relationships, semantic embeddings, or a combination of these methods.

Cross-category recommendations will require careful evaluation: two items being semantically similar does not necessarily mean a user will enjoy both.

### Diversity and Novelty

Investigate ranking strategies that reduce repetitive results and introduce relevant alternatives outside a user's most familiar interests.

The goal is not simply to maximize similarity, but to balance relevance, diversity, and useful exploration.

These are proposed research directions. Algorithm selection and implementation will follow experimentation and evaluation.

## Data Strategy

Content quality will be an important dependency for TASTERA.

Potential data sources include:

- Public movie and television metadata APIs.
- Book metadata and bibliographic APIs.
- Music metadata services.
- Publicly available datasets suitable for recommendation research.
- User-provided preferences and interactions collected by the application.

Each source will need to be assessed for coverage, licensing, rate limits, attribution requirements, and permitted use.

The initial prototype will prioritize a manageable set of content categories rather than attempting to integrate every source immediately.

No dataset size, recommendation accuracy, or production-scale performance is claimed at this stage.

## Evaluation Plan

TASTERA will need measurable criteria to determine whether its recommendations are useful.

Potential evaluation dimensions include:

| Metric or method | What it helps evaluate |
|---|---|
| Precision@K | How many top-ranked recommendations are relevant |
| Recall@K | How many relevant items appear in the recommendations |
| NDCG@K | Whether relevant items appear near the top |
| Catalog coverage | How much of the available catalog can be recommended |
| Intra-list diversity | How different the recommendations are from one another |
| Novelty | Whether recommendations introduce less obvious content |
| User feedback | Whether users find recommendations useful |
| Ablation studies | Whether individual model components improve results |

Offline metrics alone cannot establish whether users genuinely enjoy unexpected discoveries. Where feasible, evaluation will also include qualitative testing and feedback from users.

## Development Roadmap

The project will be developed incrementally, with each phase building on a working implementation.

### Phase 1 — Planning and Product Design
- [ ] Define the initial problem statement and target users.
- [ ] Finalize the minimum viable product (MVP).
- [ ] Identify initial content categories and suitable data sources.
- [ ] Design user flows and wireframes.
- [ ] Establish the initial technical architecture.

### Phase 2 — Data and Backend Foundations
- [ ] Create the project structure and development environment.
- [ ] Implement initial content ingestion and preprocessing.
- [ ] Design the database schema.
- [ ] Build basic backend APIs.
- [ ] Add input validation, error handling, and tests.

### Phase 3 — Recommendation Engine
- [ ] Implement a baseline content-based recommendation method.
- [ ] Develop an initial user preference representation.
- [ ] Experiment with semantic representations where appropriate.
- [ ] Evaluate recommendation quality against suitable baselines.
- [ ] Investigate cross-category recommendation strategies.

### Phase 4 — Frontend and User Experience
- [ ] Build the main discovery interface.
- [ ] Implement content search and browsing.
- [ ] Display recommendations and their explanations.
- [ ] Add feedback and saved-item interactions.
- [ ] Connect the frontend to the backend APIs.

### Phase 5 — Personalization and Taste Map
- [ ] Implement preference updates from user interactions.
- [ ] Experiment with diverse and novel recommendations.
- [ ] Build an interactive visualization of interests and relationships.
- [ ] Evaluate whether the visual connections are understandable and useful.

### Phase 6 — Testing and Deployment
- [ ] Add automated tests and integration checks.
- [ ] Evaluate performance and recommendation quality.
- [ ] Review security and privacy requirements.
- [ ] Deploy a usable version of the application.
- [ ] Document the architecture, algorithms, and limitations.
- [ ] Add screenshots, a demo link, and setup instructions.

The roadmap is provisional. Priorities may change as implementation and evaluation reveal what is most valuable.

## Repository Structure

The repository structure will evolve during development. A possible future organization is:

```text
tastera/
├── frontend/
│   ├── src/
│   ├── public/
│   └── README.md
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── models/
│   │   └── services/
│   ├── tests/
│   └── requirements.txt
├── recommendation/
│   ├── preprocessing/
│   ├── models/
│   ├── evaluation/
│   └── experiments/
├── data/
│   └── README.md
├── docs/
├── tests/
├── .gitignore
└── README.md
```

This is an illustrative structure, not the current repository layout. It may be simplified for the initial MVP.

## Current Implementation Status

**Status:** Early frontend prototype and research foundation.

- **Frontend:** React + TypeScript + Vite prototype with Discover, Library, Taste Map, and Profile views.
- **Catalog:** Six hardcoded demonstration items across movies, books, and music.
- **Backend:** FastAPI application with a health-check endpoint and a basic test.
- **ML research:** MovieLens audit notebook, baseline recommendation classes, and baseline experiment notebook are present; run/review experiments before claiming reproducible results.
- **Persistence and accounts:** Not implemented. Saved items currently reset on refresh.
- **Catalog API and database:** Not implemented.
- **Personalized/cross-media model serving:** Not implemented.
- **Deployment:** Frontend deployment may be configured separately; the FastAPI backend and persistent database are not implied by a frontend deployment.

See [Project Status](docs/PROJECT_STATUS.md) for a more detailed implemented-versus-planned inventory.

## Getting Started

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Run `npm run build` and `npm run lint` from `frontend/` to validate the frontend. See [Frontend Guide](docs/frontend.md).

### Backend

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open `http://127.0.0.1:8000/health` for the health check and `http://127.0.0.1:8000/docs` for interactive API documentation. See [Backend Guide](docs/backend.md).

### Research

Review [notebooks/README.md](notebooks/README.md), [the dataset register](docs/dataset-register.md), and the [ML roadmap](docs/ml-roadmap.md). Raw datasets should remain outside Git and must be used in accordance with their applicable terms.

## Project Goals

TASTERA is intended to explore several practical engineering and machine-learning challenges:

- Designing a full-stack application around a real discovery problem.
- Building and evaluating recommendation algorithms.
- Representing and comparing content across different categories.
- Modeling evolving user preferences.
- Making recommendation relationships interpretable.
- Creating an interactive visualization of connected interests.
- Deploying and documenting a usable software product.

The emphasis is on building a measurable, testable application rather than presenting a recommendation concept without a working implementation.

## Future Possibilities

Depending on the results of the initial implementation, future extensions could include:

- Natural-language discovery queries.
- Conversational recommendation refinement.
- Explainable recommendation paths.
- Personalized collections and discovery histories.
- Additional content categories.
- Improved cold-start handling for new users and new content.
- More sophisticated graph-based or hybrid recommendation approaches.

These possibilities are exploratory and are not commitments for the initial release.

## Contributing

TASTERA is currently an independently developed project. Contribution guidelines may be added once the core architecture and development workflow are established.

## License

A license will be selected before the project is distributed for reuse. Until a license is added, do not assume that the repository grants permission to reuse its code.

## Disclaimer

TASTERA is an independent project in development. Its proposed features, architecture, and research directions are subject to change. Third-party content and metadata will be used in accordance with the applicable providers' terms and licensing requirements.

---

**TASTERA — Discover what connects you.**

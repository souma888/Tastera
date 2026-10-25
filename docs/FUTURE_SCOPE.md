# TASTERA — Future Scope & Product Possibilities

**Purpose:** This is the long-form idea register for TASTERA. It intentionally records the full set of discussed directions, including ambitious, experimental, low-priority, and potentially never-implemented ideas. Listing an idea here is **not** a commitment, promise, or indication that it is already built.

**Last reviewed:** 2026-10-25

- **Current** means the capability exists in some form today; see the repository's implementation docs for its exact limits.
- **Planned / improvement** means an extension to an existing capability.
- **Exploratory** means an idea that needs validation, data, design, or technical research first.
- **Optional / later** means it may be postponed indefinitely or rejected.

For the actual implementation state, consult [Project Status](PROJECT_STATUS.md), [Implementation Roadmap](roadmap.md), and [Recommendation Research Roadmap](ml-roadmap.md). This file is deliberately broader than a sprint plan.

## Product direction

The long-term vision is for TASTERA to become a **personalized, explainable, cross-media discovery engine**: help people understand their taste, discover meaningful connections between movies, books, music, and other media, and understand *why* an item or pathway is relevant to them.

The product should not become only an endless recommendation feed. Its potential differentiators are:
- connections that cross media boundaries;
- a visual, evolving map of a person's taste;
- recommendations that explain their evidence and can be corrected by the user;
- journeys through themes, creators, moods, settings, influences, and adaptations;
- a transparent system whose quality can be measured rather than claimed without evidence.

These are direction-setting ideas, not a claim that the current app already delivers them.

## 1. Recommendation and machine-learning research

### 1.1 Strengthen the current baseline
- **Improvement:** Establish reproducible baselines and a clear comparison protocol before replacing the current methods.
- **Improvement:** Separate candidate retrieval from ranking so each stage can be tested and scaled independently.
- **Improvement:** Combine content similarity, explicit preferences, saves, positive/negative feedback, and collaborative signals in a hybrid ranker.
- **Improvement:** Include diversity, novelty, freshness, and catalog coverage so the feed does not only return near-duplicates or popular items.
- **Improvement:** Make recommendation reasons specific, evidence-backed, and understandable; distinguish facts, model inferences, and editorial explanations.
- **Exploratory:** Learn per-user or per-session weights for genre, mood, creator, theme, and media-category preferences.
- **Exploratory:** Use contextual signals such as current mood, desired length, occasion, or “something different” only with clear user control and appropriate privacy choices.
- **Exploratory:** Support exploration controls such as “more familiar,” “more surprising,” “shorter,” “less mainstream,” or “more like this, but from another medium.”
- **Improvement:** Add explicit feedback actions such as “not interested,” “already consumed,” “wrong match,” and “show me why,” if product research supports them.

### 1.2 Content-based and semantic discovery
- **Exploratory:** Generate text embeddings from permitted catalog metadata, descriptions, genres, creator information, and curated themes.
- **Exploratory:** Evaluate vector search and a vector index such as PostgreSQL with pgvector, subject to hosting, memory, and query-cost constraints.
- **Exploratory:** Use semantic retrieval to find conceptual similarities that exact genre matching misses.
- **Exploratory:** Add natural-language search, for example: “a hopeful science-fiction story with the feeling of a quiet indie album.”
- **Exploratory:** Allow cross-media queries and recommendations, such as a book inspired by a film's themes or music matching a book's atmosphere.
- **Exploratory:** Compare embedding models, language coverage, latency, storage, and relevance before choosing one.
- **Improvement:** Keep semantic matches explainable with the closest matching concepts or metadata; do not present embedding similarity as a verified real-world relationship.
- **Exploratory:** Use an LLM to help interpret a query, generate a concise explanation, or turn user intent into search filters. Ground output in retrieved catalog records and avoid letting generated prose invent credits or facts.
- **Optional / later:** Add retrieval-augmented generation (RAG) for catalog-grounded conversational discovery. This is not the same as training an LLM from scratch, which is not a current requirement.

### 1.3 Collaborative filtering and model development
- **Current research foundation:** MovieLens notebooks and movie-only item-item collaborative-filtering experiments exist; the current application is still a baseline and is not a fully validated cross-media ML system.
- **Improvement:** Re-run notebooks from a clean environment and document data versions, random seeds, metrics, and expected outputs.
- **Improvement:** Compare popularity, content-based, item-item, and hybrid baselines on the same splits.
- **Exploratory:** Evaluate matrix factorization or implicit-feedback methods when interaction volume and overlap justify them.
- **Exploratory:** Investigate graph-based recommendation if the catalog develops reliable item, creator, theme, adaptation, and influence relationships.
- **Exploratory:** Train or tune separate movie, book, and music recommenders only when each category has adequate data.
- **Exploratory:** Research cross-media ranking separately; a movie-only benchmark cannot establish cross-media recommendation quality.
- **Improvement:** Keep cold-start behavior useful through content-based signals and onboarding choices while collaborative signals are sparse.

### 1.4 Evaluation and model quality
- **High-value improvement:** Build an evaluation dashboard or report that compares model versions and baselines.
- Track ranking metrics appropriate to the task, such as Precision@K, Recall@K, NDCG@K, and hit rate, where the data supports them.
- Track catalog coverage, category balance, diversity, novelty, repeat rate, and cold-start performance alongside ranking metrics.
- Use temporal or user-aware splits where appropriate to reduce leakage; preserve a final holdout set where feasible.
- Record dataset version, experiment configuration, model version, and results for each run.
- Add qualitative review sets for cross-media connections and recommendation explanations.
- Measure user feedback and user-perceived usefulness without treating clicks alone as proof of relevance.
- **Exploratory:** Run opt-in, carefully scoped online experiments once the product has sufficient usage and a safe way to compare variants.
- Document limitations and avoid publishing performance claims unsupported by reproducible evidence.

## 2. Catalog, metadata, and data ingestion

### 2.1 Expand catalog coverage
- **Improvement:** Grow beyond the current small starter catalog through repeatable, source-aware imports.
- **Exploratory:** Set staged catalog targets (for example, thousands of total records first) based on quality, API terms, storage, latency, and import reliability rather than assuming a specific count is a hard platform limit.
- Add broader movie and TV coverage, books, and music; track coverage by category and genre.
- **Optional / later:** Explore podcasts, audiobooks, games, comics/graphic novels, animation, documentaries, live performances, and other media types if they fit the product's data model and audience.
- **Optional / later:** Consider creator-focused or franchise-focused exploration across media.

### 2.2 Better metadata and relationship evidence
- Improve genre normalization and completeness; consider representing multiple genres as structured relations instead of relying on one string.
- Normalize title variants, release dates, languages, alternate titles, and duplicate records.
- Normalize creator identities and merge aliases/credit variants while preserving original source credits and provenance.
- Add reliable setting, mood, theme, influence, adaptation, soundtrack, franchise, collaboration, and related-work links where source data permits.
- Record each relationship's source, confidence, and type. Clearly label editorial interpretation or model inference.
- Do not infer a factual creator credit, adaptation, influence, or setting just because two records appear similar.
- Improve artwork/cover URL reliability and record missing or broken assets.
- **Exploratory:** Use human review or assisted labeling to curate a high-quality cross-media relationship set.
- **Exploratory:** Create a catalog quality report for duplicates, missing metadata, broken artwork, suspicious records, and uneven category coverage.

### 2.3 Import workflow and provider use
- Improve import summaries with added, updated, skipped, failed, and duplicate counts, plus duration and source timestamp.
- Make imports idempotent, resumable, observable, and safe to rerun.
- Add validation, retry/backoff, rate-limit handling, and clear error logs.
- Keep provider-specific import workflows separated and document required credentials.
- Recheck each provider's current API terms, attribution, caching, and redistribution rules before expanding or commercializing the service.
- Keep tokens, raw dumps, private data, and secrets out of Git.
- **Exploratory:** Add scheduled metadata refreshes if hosting limits and provider terms allow them.
- **Exploratory:** Add a source/attribution detail view for catalog records.

## 3. Cross-media discovery and Taste Map

- **Current foundation:** The app has evidence-labeled pathways using available creator credits, normalized genres, editorial-note theme-word overlap, and user activity. These are not all equivalent forms of evidence.
- **Improvement:** Expand the relationship graph with structured themes, settings, influences, adaptations, franchises, soundtracks, and creator collaborations where supported.
- **Improvement:** Distinguish direct metadata evidence, curated links, user-derived links, and model-generated similarity visually and in text.
- **Exploratory:** Turn Taste Map into an evolving, interactive representation of a person's taste across items, creators, genres, moods, and media types.
- **Exploratory:** Show how taste changes over time, including recently explored areas and emerging interests.
- **Exploratory:** Let users switch between maps such as “my taste,” “a theme,” “a creator,” “a journey,” and “connections across media.”
- **Improvement:** Improve map layout, readability, keyboard access, mobile behavior, filtering, zoom/pan, and large-graph performance.
- **Exploratory:** Let users select a node and request recommendations that cross into another medium.
- **Exploratory:** Provide curated “taste journeys” that follow a theme, creator, adaptation, influence, mood, or historical path across different media.
- **Exploratory:** Let users save or share a journey or a filtered view, with privacy and account-sharing behavior made explicit.
- **Improvement:** Avoid misleading edges when metadata is incomplete or when the only connection is a weak shared keyword.

## 4. Personalization, onboarding, and profile

- Improve onboarding so a new user can express likes, dislikes, favorite creators, genres, moods, and preferred media mix without excessive effort.
- Let users edit or reset their taste profile and see which signals affect recommendations.
- Explain how saves and “More like this” / “Not for me” feedback affect future results.
- Add controls to correct an inferred preference or reduce a category's influence.
- **Exploratory:** Add an evolving taste timeline and summaries of how preferences shift.
- **Exploratory:** Add optional goals such as “explore outside my usual taste,” “read more,” or “discover lesser-known creators.”
- Improve Profile insights with clear definitions and avoid overstating conclusions from sparse activity.
- Ensure cold-start users still see useful recommendations before much interaction data exists.

## 5. Search, browsing, and discovery UX

- Improve title, creator, genre, and category search quality, including normalization, aliases, typo tolerance, and pagination.
- Address the current query/page-size limitations and avoid silently searching only a small subset of the catalog.
- Add efficient database indexes or dedicated search infrastructure if measured query performance warrants it.
- **Exploratory:** Add natural-language search with filters extracted from user intent.
- **Exploratory:** Add filters for mood, theme, era, language, duration/length, popularity, and “less mainstream,” where metadata supports them.
- Add “where to watch / read / listen” links only where a permitted, reliable provider exists; availability varies by region and time and must be dated or caveated.
- Add clear empty, loading, retry, offline, and API-unavailable states.
- Improve responsive behavior and accessibility for cards, menus, forms, Taste Map, and keyboard navigation.
- Improve broken-cover fallbacks and media loading performance.

## 6. Collections, sharing, community, and social discovery

- **Current limitation:** Collections are browser-side today; shared links are snapshots rather than live, synchronized server-backed collections. Community functionality is currently demo/local rather than a complete shared social system.
- **Exploratory:** Store collections on the server and sync them across devices for signed-in users.
- Add editable public/private/unlisted collections, share permissions, stable URLs, and clear ownership.
- Add collaborative collections with multiple contributors, invitations, and conflict handling.
- **Exploratory:** Add profiles that users may choose to make public, with privacy-safe controls over saved items and activity.
- **Exploratory:** Add follows, likes, comments, reactions, and collection discovery only if there is a clear moderation and privacy plan.
- **Exploratory:** Add group discovery for friends or a club, combining preferences to find something everyone may enjoy.
- **Exploratory:** Add watch/read/listen clubs, shared lists, voting, and “choose together” sessions.
- Add reporting, blocking, moderation, abuse prevention, and data-retention rules before launching community features.
- Avoid exposing private Library contents or personal taste data through share links by accident.

## 7. Conversational and AI-assisted experiences

- **Exploratory:** Add a conversational discovery assistant that can answer requests such as “recommend a book and an album with a similar atmosphere.”
- Ground suggestions in actual catalog results and show why each result was selected.
- Support follow-up refinement, exclusions, category constraints, and “surprise me” intent.
- **Exploratory:** Let the assistant build a collection or a taste journey from a conversation, with user review before saving.
- **Exploratory:** Use LLMs for query understanding, concise explanations, metadata cleanup assistance, and curated-theme drafts with human validation.
- Add guardrails against fabricated facts, creator credits, availability, or source attributions.
- Consider cost, latency, privacy, caching, and provider dependence before enabling model calls.
- Do not assume an LLM or an agent is necessary for every feature; use deterministic search and ranking where they are sufficient.

## 8. New media and ecosystem integrations

Possible extensions, all optional and dependent on data access, licensing, and product fit:
- Podcasts and spoken-word content.
- Audiobooks and book editions.
- Games and interactive narrative.
- Comics, manga, and graphic novels.
- Anime, animation, documentaries, and short films.
- Live performances, theatre, and recorded concerts.
- Creator discographies, filmographies, bibliographies, and franchise timelines.
- Links to legal streaming, library, retailer, or listening services where a stable, permitted API or link source exists.
- User imports from external watch/read/listen lists, only through supported exports/APIs and with consent.
- Import/export tools so users can bring in or retrieve their own Library data.

New categories should not be added merely to increase the number of categories: each needs useful metadata, appropriate ranking, relationship evidence, and evaluation.

## 9. Accounts, privacy, security, and user control

- Preserve account isolation for Library items, feedback, collections, and all future user-owned data.
- Add authentication rate limiting and abuse protection.
- Add email verification and a secure password-recovery flow.
- Add session listing/revocation and a deliberate sign-out-everywhere option.
- Review token storage, expiration, rotation, and session recovery; document trade-offs and test them.
- Review CORS, security headers, input validation, error messages, secrets, and production configuration.
- Add data export and account deletion flows that include future tables and external caches where applicable.
- Establish a privacy policy and clear explanation of what is stored, why, and for how long before collecting more personal data.
- Keep analytics minimal and privacy-conscious; obtain consent where required.
- **Exploratory:** Offer opt-in personalization controls and a way to reset or delete learned preference signals.
- Never expose private account records in public collections, logs, client caches, or error reports.

## 10. Engineering quality, architecture, and testing

- Add automated CI for frontend and backend linting, type checks, tests, and build verification.
- Add frontend unit/component tests and end-to-end browser-flow tests for sign-in, onboarding, saves, unsaves, feedback, refresh/recovery, search, and collections.
- Expand backend tests for authentication, authorization, user isolation, pagination, imports, recommendation ranking, migrations, and error handling.
- Preserve the Library recovery regression behavior: temporary API failures must not erase a valid session or cached per-account Library; confirmed expired sessions should request sign-in.
- Split the very large frontend application component into focused pages, hooks, services, and reusable UI components without changing behavior accidentally.
- Separate catalog retrieval, feature construction, candidate generation, ranking, and explanation logic into testable modules.
- Add API schemas/contracts and a clear versioning/deprecation strategy as the client and server grow.
- Add database migrations checks, test fixtures, seed-data consistency, and a clean setup guide.
- Add structured logs, error tracking, service health checks, latency/error dashboards, and alerts.
- Document backup frequency, restore tests, disaster recovery, deployment rollback, and incident response.
- Add a license after choosing one deliberately; until then, do not imply that reuse is permitted.
- Improve accessibility, performance budgets, dependency maintenance, and developer setup documentation.

## 11. Database, performance, deployment, and scale

- Measure real API latency, database size, query plans, memory, CPU, cold starts, and network transfer before choosing upgrades.
- Optimize current full-candidate Python ranking if catalog growth makes it slow; use SQL filtering, precomputed features, batching, caching, or a dedicated ranking stage as evidence supports.
- Add indexes for actual search and join patterns; consider full-text search only after profiling.
- Review connection pooling, Neon compute behavior, query timeouts, and database connection limits.
- Cache safe, public catalog data where useful while keeping account-specific data isolated.
- Make background imports and expensive model jobs resilient; do not assume they belong in a short-lived web request.
- Evaluate scheduled jobs or a worker service if imports, embeddings, or model evaluation become too heavy for the API process.
- Treat Vercel, Render, and Neon free-tier limits as changing operational constraints, not fixed catalog-size limits.
- Watch Render free-service sleep/cold starts, CPU/RAM, ephemeral filesystem behavior, and database lifecycle limits.
- Monitor Vercel transfer/build usage and Neon storage, compute-hours, and network transfer.
- **Exploratory:** Move long-running jobs to a worker or managed job runner when justified.
- **Exploratory:** Introduce a managed vector store, search service, or separate analytics store only if measured requirements justify the added cost and complexity.
- Create load tests and capacity estimates for staged catalog sizes before promising support for very large catalogs.

## 12. Analytics and product learning

- Build a simple internal dashboard for catalog health, import runs, search usage, recommendation feedback, and service errors.
- Define product questions and metrics before collecting analytics.
- Measure whether users find useful connections, save discoveries, and return—not just page views.
- Track recommendation feedback by category and cold-start status without exposing individual users.
- Add opt-in feedback prompts or small user studies to validate whether cross-media pathways are genuinely useful.
- Use aggregated or anonymized reporting where possible and document retention.
- **Exploratory:** Add A/B tests or staged feature rollouts when traffic and safeguards are sufficient.

## 13. Documentation and project presentation

- Keep README, architecture, roadmap, project status, ML roadmap, and dataset register aligned with actual code.
- Document which features are production-ready, experimental, demo-only, browser-local, or planned.
- Add architecture diagrams, data-flow diagrams, API examples, import instructions, and model evaluation instructions as the system grows.
- Publish reproducible screenshots or a demo walkthrough if useful for users and portfolio reviewers.
- Explain data-source attribution, known limitations, model evaluation, and privacy choices honestly.
- Maintain a changelog or release notes for user-visible changes.
- Document a chosen license and contribution process if the project opens to outside contributors.

## 14. Possible phased path (non-binding)

This is an example ordering, not a promise or deadline. Priorities should change with evidence and available time.

1. **Reliability first:** CI, automated tests, auth hardening, import visibility, database backups/restore, and clearer service monitoring.
2. **Catalog quality:** grow coverage in controlled batches, normalize genres/creators, repair artwork, and add source provenance.
3. **Measured recommendation baseline:** clean evaluation splits, baseline comparisons, an evaluation report/dashboard, and stronger feedback loops.
4. **Semantic discovery prototype:** embeddings, semantic retrieval, natural-language query experiments, and evidence-grounded explanations.
5. **Distinctive discovery UX:** improve Taste Map, theme/creator journeys, preference controls, and optional saved journeys.
6. **Account-backed social features:** server-synced collections and sharing first; community/group features only with moderation and privacy design.
7. **Expansion:** new media types, imports, availability links, conversational experiences, and infrastructure changes when validated.

## Decision principles

- Treat this document as an **idea inventory**, not a delivery commitment.
- Prefer small experiments that test a product question over building every idea at once.
- Reliability, privacy, provenance, and explainability should scale with the feature set.
- Do not claim a recommendation model is complete or effective without reproducible evaluation.
- Do not add a provider, dataset, model, or media type without checking terms and the quality of its available data.
- Keep current functionality and future ideas clearly separated in user-facing copy and project documentation.

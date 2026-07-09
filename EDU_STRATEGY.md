# Conviqt for Academia — Strategy Brief

**Status:** Planning. No build yet. For review with Prof. Halit Gönenç (University of Groningen).
**Date:** 2026-06-20
**Author:** Conviqt founder + Claude
**Scope:** Repositioning of `edu.conviqt.com` from demo tools into a reproducible-research co-pilot for MSc/PhD finance & economics students.

---

## 1. Executive summary

The three current edu tools (Research Sandbox, Market Wedge Finder, Thesis Hub) are *demos*. They produce pretty outputs a master's student could rebuild in an afternoon, and they don't touch the real bottleneck in empirical finance research. They should be retired or absorbed.

The opportunity is to make Conviqt Academia solve the grunt work that actually consumes weeks of every empirical thesis: **getting messy, multi-source financial data into an analyzable shape, and constructing non-trivial variables correctly.** Library guides at Bocconi, Princeton, Cranfield and WRDS all dedicate whole pages to this — a reliable sign of a chronic, universal pain.

**The single strategic decision that defines the product:**

> Conviqt Academia generates **code + methodology + citations**. It does **not** crunch the student's data itself.

The AI sees only the *schema* (column names, data types, a few sample rows) plus a plain-English request, and emits a runnable Python/R script the student executes on their own machine. This one choice is what makes the product simultaneously **cheap to run** and **defensible against "just use ChatGPT."**

---

## 2. The validated problem

Empirical corporate-finance research has four chronic pain points. All are documented, not assumed.

### 2.1 Data harmonization / linking
Students rarely use one database. They pull fundamentals from Compustat/Datastream, ESG/carbon from Refinitiv/Bloomberg, ownership from BoardEx/Orbis. Merging them is notoriously hard because identifiers (ISIN, CUSIP, SEDOL, GVKEY, PERMNO, ticker) **change over time and are formatted differently per database** (e.g. CUSIP length varies; UK ISINs embed SEDOL; IBES stores CUSIP for US and SEDOL for non-US in one field). On top of identifier chaos: fiscal-year vs calendar-year misalignment, survivorship bias, and look-ahead bias.

> Evidence: dedicated linking guides at [Bocconi](https://unibocconi.libguides.com/c.php?g=727429&p=5294944), [Princeton](https://libguides.princeton.edu/MatchFinancial), [Cranfield](https://blogs.cranfield.ac.uk/library/company_codes/); the [WRDS CRSP/Compustat Merged link-table docs](https://wrds-www.wharton.upenn.edu/pages/grid-items/merging-crsp-and-compustat-data/) (LC/LU/LS link types, valid date windows); the empirical-research textbook chapter ["Linking databases"](https://iangow.github.io/far_book/identifiers.html).

### 2.2 Variable construction
The variables researchers actually study aren't downloadable columns. "Family firm" requires tracing the ultimate owner through pyramids and applying a definition from the literature; the control vs cash-flow **wedge** must be computed. Students hand-code this for weeks, often inconsistently.

> Evidence: [Villalonga & Amit, "How Do Family Ownership, Control and Management Affect Firm Value?"](https://finance.wharton.upenn.edu/department/Seminar/2004Fall/MicroFall2004/micro-VillalongaAmit-v2-092304.pdf) — family-firm dummy via ultimate-owner threshold; wedge between control and cash-flow rights.

### 2.3 Ownership / group structure (Gönenç's priority)
"Is this firm part of a group? A franchise? A subsidiary? Who is the ultimate owner? Is it family-controlled?" This information is genuinely hard to find, and students often don't even know it's a question they should ask — yet it can invalidate an entire research design (e.g. treating a subsidiary as an independent firm).

### 2.4 Reproducibility
Non-standard variable definitions and unshared code are a root cause of the field's replication problem. Between [27% and 53% of published finance anomalies are likely false](https://www.nber.org/system/files/working_papers/w28432/w28432.pdf) (Harvey et al. via the NBER "Is There a Replication Crisis in Finance?" working paper), and replication studies report that on average only 20–30% of the factors needed to reproduce a paper are actually documented. A tool that emits a reusable variable codebook + methods section + citations attacks this directly.

---

## 3. Why this beats "just use ChatGPT" (the moat)

ChatGPT can already write pandas code, so the product needs defensible reasons to exist:

1. **Licensing / compliance — the strongest wedge.** WRDS, Compustat, Datastream and similar licenses **forbid redistributing the raw data.** A student legally *cannot* paste a Compustat extract into a public chatbot. Conviqt Academia's schema-only design means the confidential data never leaves the student's machine — only column names and dtypes are sent. This is a real legal/ethical differentiator, not marketing. *(Confirm exact license language with Groningen's data-services / library before claiming publicly.)*
2. **Domain priors baked in.** The system prompt/templates know the standard schemas (WRDS, Orbis, BoardEx, Datastream), the CCM link-table logic, the canonical variable definitions, and the classic bias traps. A generic chatbot guesses; this is pre-loaded.
3. **Gönenç-blessed methodology.** Variable definitions follow "the way Groningen teaches it," each attached to a citation. The academic partnership is the trust moat a general tool can't replicate.
4. **Thesis-ready artifacts.** Output isn't a loose snippet — it's runnable code + a variable codebook + a methods-section paragraph + a reproducibility appendix.

---

## 4. Deliverable specifications

All five share the same engine pattern (Section 5). Each is schema-in, artifact-out.

### D1 — Data Mapper / Merger  *(recommended first build — most universal)*
- **Input:** schemas of 2+ uploaded files (headers, dtypes, 3 sample rows each) + the student's goal in plain English ("merge my Compustat fundamentals with my Orbis ownership file by firm-year").
- **What the AI does:** detect which columns are identifiers and their format (ISIN/CUSIP/SEDOL/GVKEY/PERMNO/ticker); pick a join strategy; warn about historical identifier changes, fiscal-vs-calendar alignment, survivorship and look-ahead bias; choose Python or R per student preference.
- **Output:** a runnable merge script + a plain-English explanation of the join keys and assumptions + an explicit caveats list.
- **Pitch:** "weeks → minutes" on the single most universal task.

### D2 — Variable Builder
- **Input:** schema of the student's dataset + a plain-English variable request ("family-firm dummy = 1 if an individual blockholder holds >20% of voting rights").
- **What the AI does:** map the request to a canonical literature definition, generate the construction code against the student's actual columns, and attach the citation.
- **Output:** construction code + the formal definition + the source citation, drawn from a curated library of canonical finance/ESG variables (family-firm dummy, control–cash-flow wedge, Tobin's Q, leverage, ESG-score normalization, etc.).
- **Pitch:** the closest fit to Gönenç's teaching; the variable library is co-authored with him.

### D3 — Ownership / Group Explainer  *(Gönenç's hot button — highest novelty, hardest to do honestly)*
- **Input:** a company name or identifier (this one needs data, not just a schema).
- **What the AI does:** reason over public filings to propose the ultimate owner / group membership / family-control status / franchise-or-subsidiary status.
- **Output:** a structured **hypothesis with an explicit confidence level** plus **where to verify it** (Orbis BvD ID, SEC 13D/13G, proxy statements). Framed as a *research lead*, never as ground truth.
- **Honesty guardrail:** must obey Conviqt's existing Alpha-honesty rule — never present a guess as a verified fact. The "where to verify" pointer is mandatory, not optional.
- **Note:** the only deliverable that may need a paid data source or live filings access; scope a public-domain-only v1 (SEC EDGAR) first.

### D4 — Robustness / Replication Checker
- **Input:** the student's regression specification and/or a description of their results.
- **What the AI does:** flag multiple-testing risk, winsorizing choices, standard-error clustering, endogeneity, and missing robustness checks reviewers will demand.
- **Output:** a reviewer-style checklist + suggested additional specifications.
- **Pitch:** "what your supervisor / referee will ask before they ask it."

### D5 — Methods Writer
- **Input:** the code and variable choices produced in D1/D2 (chained).
- **What the AI does:** assemble a thesis methodology section, a variable codebook, and a reproducibility appendix.
- **Output:** publication-ready methods prose + codebook. **Absorbs the current Thesis Hub** (CSV export + citations become features here).

**Build order rationale:** D1 (broadest pain, clearest story) → D2 (deepest partnership fit) → D5 (cheap, ties the workflow together) → D4 → D3 (most novel but needs careful honesty + possibly paid data).

---

## 5. Architecture — the schema-only principle

```
Student's machine                         Conviqt Academia (server)
─────────────────                         ─────────────────────────
full dataset  ──parse locally──►  schema only (cols, dtypes, 3 rows)
                                          + plain-English request
                                                │
                                                ▼
                                       LLM (code generation)
                                                │
                                                ▼
            ◄──────────  runnable script + methods + citations
run script
on full data
locally
```

- The big/confidential data **never leaves the browser**; parsing (CSV/Excel headers, dtypes, sample rows) happens client-side — the sor.corp upload pattern already does client-side file handling and can be reused.
- The server sees ~1–2K tokens of input and returns ~1–2K tokens of code. This is why it is near-free (Section 6).
- Consistent with the existing edu engine rule ("AI never draws the chart; deterministic compute"): here the AI writes the *code*, and the student's own machine does the computation. The reframe resolves the tension with the current "interactive graphs" approach, which fights that rule.
- Reuse from sor.corp: client-side file upload/drag-drop, the results/insight-card layout, Supabase persistence of past analyses. Drop the Chart.js dashboard emphasis — charts are not the value here.

---

## 6. AI model & cost model

Cost target: near-zero per request. Not constrained to one vendor; pick the best model per task. Research basis (June 2026 pricing, per 1M tokens):

| Model | Input | Output | Notes |
|---|---|---|---|
| DeepSeek V4 Flash | $0.14 | $0.28 | Cheapest; MIT weights (self-hostable); strong at code |
| GPT-4o-mini | $0.15 | $0.60 | Cheap, reliable, easy integration |
| DeepSeek V3.2 | $0.28 | $0.42 | ~90%+ quality, cost leader for reasoning |
| MiniMax M3 | $0.30 | $1.20 | Cheapest model >80% on SWE-bench Verified |
| Gemini 2.5 Flash | $0.30 | $2.50 | Free tier exists but **gutted to ~20 req/day** — dev only, not production |
| Claude Haiku 4.5 | $1.00 | $5.00 | Pricey for this tier |
| Claude Sonnet 4.6 | (premium) | (premium) | Best coding quality + tool reliability — reserve for hardest D3/D4 |

> Sources: [morphllm LLM API price comparison](https://www.morphllm.com/llm-api), [morphllm best-coding-model ranking](https://www.morphllm.com/best-ai-model-for-coding), [OpenRouter free models list](https://costgoat.com/pricing/openrouter-free-models), [Gemini free-tier cuts](https://www.howtogeek.com/gemini-slashed-free-api-limits-what-to-use-instead/), [Claude API pricing](https://www.cloudzero.com/blog/claude-api-pricing/).

**Free options (use as dev/fallback, not sole production path):** Qwen3 Coder (free on OpenRouter, 1M context, currently the strongest free coding model), GLM-4.x-Flash (free on Z.AI), DeepSeek V4 self-hosted (MIT weights). Free tiers have rate limits unsuited to production load — pay DeepSeek for production; it is still effectively free per request.

**Recommended routing (mixed tier):**
- **D1, D2, D5** (code generation): DeepSeek V4 Flash as primary, Qwen3 Coder (free) as fallback.
- **D3, D4** (heavier reasoning): DeepSeek V3.2 / V4 reasoner, escalating to Claude Sonnet 4.6 only for the hardest ownership-tracing cases.

**Per-request cost estimate** (schema-only: ~1.5K input + ~1.5K output):
- DeepSeek V4 Flash: ≈ **$0.0006 / request**
- MiniMax M3: ≈ $0.002 / request
- Even Claude Sonnet 4.6 on a hard D3 request: ≈ $0.02–0.05

**Projection:** 500 students × 20 requests/month ≈ 10,000 requests/month. On DeepSeek V4 Flash that is **≈ $6/month**. Cost is a non-issue; the constraint is correctness, not spend.

**Integration:** extend the existing `src/lib/openai.ts` adapter with a cheap-model route (DeepSeek/OpenRouter) so edu requests bypass the premium retail providers. Keep one adapter, add provider selection by task type.

---

## 7. What to retire

- **Research Sandbox (OLS toy)** — retire. Overfit betas (R²≈4%), illustrative-only; not real research help.
- **Market Wedge Finder (DCF toy)** — retire as a standalone. The *concept* of distortion-detection could resurface inside D4, but the current sliders are a demo.
- **Thesis Hub** — absorb into **D5** (CSV export + citations become features, not a standalone tool).

---

## 8. Phased roadmap

- **Phase 0 — validation (now):** review this brief with Gönenç. Confirm the licensing claim with Groningen library/data services. Lock the first variable definitions for the D2 library.
- **Phase 1 — D1 Data Mapper:** the universal painkiller; proves the schema-only architecture end to end.
- **Phase 2 — D2 Variable Builder + the canonical-variable library** (co-authored with Gönenç).
- **Phase 3 — D5 Methods Writer:** chains D1/D2, absorbs Thesis Hub.
- **Phase 4 — D4 Robustness Checker.**
- **Phase 5 — D3 Ownership Explainer:** public-domain (SEC EDGAR) v1 first; evaluate paid data later.
- **Cross-cutting (pending from prior work):** auth/cohort wiring + Supabase migration `025_edu_tenancy.sql`; amend CLAUDE.md to formally bless the edu surface.

---

## 9. Open questions for Gönenç

1. Which variables should seed the D2 library, and whose definitions are canonical for Groningen's MSc?
2. Is the licensing/compliance angle (students can't upload licensed data to public chatbots) accurate and promotable for Groningen's data agreements?
3. For D3, which sources do *you* trust for ultimate-owner / group-structure ground truth (Orbis BvD, hand-collection, other)?
4. Python or R as the default code target — what does the MSc cohort actually use?
5. Pilot cohort: run D1 with one class as a live test before building the rest?

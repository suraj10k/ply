# Project State: Knoply (formerly OKF Multi-Platform Orchestrator)

## 1. System Vision & Core Delivery Philosophy
We are building a **completely portable, harness-agnostic, developer-first tool** called **ply**. 
* **The Goal:** Any external developer or engineering organization should be able to download this tool to generate local OKF knowledge bundles across their microservices.
* **Architecture:** Delivered strictly as a standardized **Model Context Protocol (MCP) Server** running locally in the user's workspace.
* **Harness Agnostic:** Because it uses the open MCP standard, it must work seamlessly whether triggered via *Antigravity CLI*, *Claude Code*, *Cursor*, *Windsurf*, or a custom enterprise agent framework.
* **Separation of Concerns:** 
    * The **Local MCP Server** handles deterministic actions (AST codebase parsing, Git state interaction, filesystem mutations) to ensure enterprise code never leaves the user's secure environment.
    * The **Connected AI Harness** handles the heavy lifting of natural language processing (conducting the interview, parsing human responses, and writing markdown content) by executing tools exposed by our server.

## 2. Enforced OKF Concepts (Mandatory 6-File Schema)
Every onboarded microservice repository must generate the following concepts inside a local `/.knowledge/` folder:
1. `Domain`: Business rules, terminology glossary, lifecycle maps, geographic scopes.
2. `APIs`: Internal service mesh communication paths and external 3rd-party integration contracts.
3. `Architecture`: Technical stack layout, framework versions, structural patterns used.
4. `Data`: Database schema definitions, column types, and foundational Foreign Key mappings.
5. `References`: Target layer for deep document offloading or localized RAG/lazy-loading.
6. `Operations`: Observability, logging formats, metric emissions, and feature flags.

## 3. The 5-Step Onboarding Pipeline
Our target onboarding engine execution lifecycle follows this sequential strategy:
1. **Deterministic Pre-Flight Scan:** Local AST parses configuration files from the outside-in to fill template skeletons.
2. **Adaptive Interview Pass:** Conversational interview filling data gaps, supporting external document link scraping.
3. **Divergence Validation Engine:** Compares interview outputs against code state to highlight explicit technical inconsistencies.
4. **Interactive Triage:** User chooses how to resolve conflicts (Code is right / Human is right / Backlog ticket).
5. **Finalization & Local Commit:** Validates schema bounds, writes bundle to local `/.knowledge/` repository.

## Current Objective
We are diving deep into the technical design of **Step 3 (The Divergence Validation Engine)**. We need to define how the local MCP server structure pairs with the LLM to catch contradictions between human input and actual source code architecture.

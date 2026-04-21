# ArchMate - Auto Architecture Diagram Generator

[![CI](https://github.com/moggan1337/ArchMate/actions/workflows/ci.yml/badge.svg)](https://github.com/moggan1337/ArchMate/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/moggan1337/ArchMate)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> Automatically generate beautiful architecture diagrams from your source code. No manual diagramming required.

## 🎬 Demo

![ArchMate Demo](demo.gif)

*Auto-generated architecture diagram from source code*

## ✨ Features

- **Auto-detection** - Identifies services, layers, and dependencies automatically
- **Multiple formats** - Export to Mermaid, PlantUML, Graphviz, SVG
- **C4 Model support** - Generate C1, C2, C3, C4 level diagrams
- **Real-time sync** - Diagrams update as code changes
- **IDE integration** - VS Code and IntelliJ plugins available

## 🚀 Quick Start

```bash
npm install -g @moggan1337/archmate
archmate generate --input ./src --output ./docs/architecture.md
```

## 🏗️ Architecture Diagram Demo

### System Overview (C1 Level)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              E-COMMERCE PLATFORM                                 │
│                                 (System Context)                                │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ┌─────────────┐
                                    │   Customer  │
                                    │   Browser   │
                                    └──────┬──────┘
                                           │
                                           │ HTTPS/REST
                                           ▼
        ┌──────────────────────────────────────────────────────────────────┐
        │                      E-Commerce Platform                           │
        │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌───────────┐ │
        │  │    API     │  │   Order    │  │   Payment   │  │   User    │ │
        │  │   Gateway  │◄─┤   Service  │◄─┤   Service   │◄─┤  Service  │ │
        │  └─────┬──────┘  └──────┬─────┘  └──────┬──────┘  └─────┬────┘ │
        │        │                │                │               │      │
        │        │         ┌──────▼─────────────────▼───────────────▼────┐ │
        │        │         │              Message Bus                    │ │
        │        │         └──────┬─────────────────┬───────────────────┘ │
        │        │                │                 │                     │
        │  ┌─────▼─────┐   ┌──────▼─────┐   ┌───────▼───────┐            │
        │  │   Cache   │   │   Search   │   │  Notification │            │
        │  │  (Redis)  │   │  (Elastic) │   │    Service    │            │
        │  └───────────┘   └────────────┘   └───────────────┘            │
        └──────────────────────────────────────────────────────────────────┘
                                           │
                                    ┌──────▼──────┐
                                    │  Database   │
                                    │ (PostgreSQL)│
                                    └─────────────┘
```

### Component Diagram (C2 Level - Order Service)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              ORDER SERVICE                                       │
│                              (Container View)                                    │
└─────────────────────────────────────────────────────────────────────────────────┘

         ┌────────────────────────────────────────────────────────────────┐
         │                      Order Service                                │
         │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
         │  │   REST API      │  │   GraphQL API   │  │  gRPC API       │  │
         │  │   Controller    │  │   Resolvers     │  │   Handlers      │  │
         │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
         │           │                    │                    │           │
         │           └────────────────────┼────────────────────┘           │
         │                                ▼                                  │
         │                    ┌─────────────────────────┐                   │
         │                    │    Order Orchestrator   │                   │
         │                    │    (Domain Logic)        │                   │
         │                    └────────────┬──────────────┘                   │
         │                             │                                    │
         │           ┌─────────────────┼─────────────────┐                 │
         │           ▼                 ▼                 ▼                 │
         │  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐     │
         │  │ Order Repository│ │ Payment Client │ │ Inventory Client│     │
         │  └────────┬────────┘ └────────┬────────┘ └────────┬────────┘     │
         └───────────┼───────────────────┼───────────────────┼──────────────┘
                     │                   │                   │
                     ▼                   ▼                   ▼
              ┌────────────┐      ┌────────────┐       ┌────────────┐
              │  Database  │      │  Payment   │       │ Inventory  │
              │  (Orders)  │      │  Gateway   │       │  Service   │
              └────────────┘      └────────────┘       └────────────┘
```

### Dependency Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DEPENDENCY FLOW ANALYSIS                             │
│                         (Generated from source code)                           │
└─────────────────────────────────────────────────────────────────────────────────┘

     Layer: External     Layer: API        Layer: Service     Layer: Data
     ─────────────────   ───────────────   ────────────────   ───────────────

     ┌───────────┐                                                                 
     │ Stripe API │                                                                 
     └─────┬─────┘                                                                 
           │                                                                        
           │ stripe.payment.create()                                               
           │                                                                        
           ▼                                                                        
     ┌───────────┐       ┌───────────┐       ┌───────────┐       ┌───────────┐    
     │  Express  │──────►│  Order    │──────►│ Inventory │       │ PostgreSQL│    
     │  Router   │       │  Service  │       │  Service  │       │   (DB)    │    
     └───────────┘       └─────┬─────┘       └─────┬─────┘       └───────────┘    
                               │                     │                              
                               │ checkStock()        │                              
                               │                     │                              
                               ▼                     ▼                              
                         ┌───────────┐         ┌───────────┐                        
                         │  Payment  │         │   Cache   │                        
                         │  Gateway  │         │  (Redis)  │                        
                         └───────────┘         └───────────┘                        
                               │                                                       
                               │ payment.confirmed()                                 
                               │                                                       
                               ▼                                                       
                         ┌───────────┐                                               
                         │   Email   │                                               
                         │  Service  │                                               
                         └───────────┘                                               

     🔴 Circular dependency detected: Order → Payment → Order (VIOLATION)
     🟡 High coupling: Order Service imports 7 modules (WARNING)
     🟢 Stable: Email Service has 0 incoming deps (GOOD)
```

### Module Dependency Graph (Mermaid Format)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        MODULE DEPENDENCY GRAPH                                   │
│                    (Auto-generated Mermaid diagram)                              │
└─────────────────────────────────────────────────────────────────────────────────┘

     ┌──────────────────────────────────────────────────────────────────────────┐
     │                                                                        │
     │    graph TD                                                             │
     │        subgraph "Presentation Layer"                                   │
     │            UI[React Components]                                         │
     │            Pages[Next.js Pages]                                         │
     │        end                                                              │
     │                                                                        │
     │        subgraph "Application Layer"                                    │
     │            API[API Routes]                                              │
     │            SVC[Services]                                                │
     │        end                                                              │
     │                                                                        │
     │        subgraph "Domain Layer"                                         │
     │            MOD[Models]                                                 │
     │            EVT[Events]                                                 │
     │        end                                                              │
     │                                                                        │
     │        subgraph "Infrastructure Layer"                                  │
     │            DB[(Database)]                                               │
     │            CACHE[(Redis Cache)]                                         │
     │            MQ[Message Queue]                                            │
     │        end                                                              │
     │                                                                        │
     │        UI --> API                                                       │
     │        Pages --> API                                                    │
     │        API --> SVC                                                      │
     │        SVC --> MOD                                                      │
     │        SVC --> EVT                                                      │
     │        MOD --> DB                                                       │
     │        SVC --> CACHE                                                    │
     │        EVT --> MQ                                                       │
     │                                                                        │
     └──────────────────────────────────────────────────────────────────────────┘
```

### Codebase Statistics

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CODEBASE ANALYSIS                                     │
│                          Source: ./src (2,847 files)                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  LAYER DISTRIBUTION                                                              │
│  ─────────────────                                                              │
│  presentation    ████████████████████████████████░░░░░░░░░░░  42% (1,198)      │
│  application     ██████████████████████░░░░░░░░░░░░░░░░░░░░░  28% (797)         │
│  domain          ██████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  18% (512)         │
│  infrastructure  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  12% (340)         │
│                                                                                  │
│  COMPLEXITY METRICS                                                              │
│  ────────────────                                                               │
│  Cyclomatic Complexity:     avg 4.2    (threshold: 10)                          │
│  Depth of Inheritance:      avg 2.1    (threshold: 6)                            │
│  Coupling:                  847 imports, 234 exports                            │
│  Cohesion (LCOM):           1.42    (healthy range: 1-2)                        │
│                                                                                  │
│  DEPENDENCY HEALTH                                                             │
│  ─────────────────                                                             │
│  ✓ No circular dependencies     ✗ 3 potential issues                          │
│  ✓ Layer boundaries respected   ⚠ High fan-out in Services                    │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 🛠️ Installation

```bash
npm install -g @moggan1337/archmate
```

## 📖 Usage

```bash
# Generate default diagram
archmate generate

# Generate with specific format
archmate generate --format mermaid --output diagram.md

# Watch mode (auto-regenerate on changes)
archmate watch --src ./src

# Generate C4 diagrams
archmate generate --c4 --level 2
```

## 📊 Supported Formats

| Format | Extension | Description |
|--------|-----------|-------------|
| Mermaid | `.mmd` | Markdown-compatible diagrams |
| PlantUML | `.puml` | UML diagrams |
| Graphviz | `.dot` | DOT language graphs |
| SVG | `.svg` | Scalable vector graphics |
| JSON | `.json` | Raw data for custom rendering |

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📝 License

MIT © 2024 moggan1337

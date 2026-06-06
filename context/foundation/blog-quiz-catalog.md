# Blog Quiz Catalog

Long-lived source catalog for future `interactive-quiz` blog posts. This file is a planning and tracking artifact only; published quiz posts live in `src/content/blog/`.

## Purpose

- Keep a single backlog of interactive quiz topics that can later be turned into blog posts.
- Track intended slugs, target audience, and planned question volume before content is written.
- Record which quiz topics are already published so future work builds on what exists.

## Question Count Tiers

| Depth | Planned Questions | When to use it |
| --- | --- | --- |
| `light` | `5` | Narrow refreshers or highly focused subtopics |
| `standard` | `10` | Default interview-prep quiz size for most topics |
| `deep` | `15` | Broad, high-signal, or senior-level topics |

## Status Values

| Status | Meaning |
| --- | --- |
| `idea` | Topic is approved for the backlog but not yet drafted |
| `draft` | Topic is being turned into a post file |
| `published` | Topic already exists as a live blog post |

## Catalog

### Java and JVM

| # | Topic | Slug | Category | Audience | Planned Questions | Depth | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Java collections quick quiz | `java-collections-quick-quiz` | Java | mid backend | 5 | light | published | Existing post in `src/content/blog/java-collections-quick-quiz.md` |
| 2 | Java mid-level interview quiz | `java-mid-interview-quiz` | Java | mid backend | 10 | standard | published | Existing post in `src/content/blog/java-mid-interview-quiz.md` |
| 3 | Java concurrency fundamentals quiz | `java-concurrency-fundamentals-quiz` | Java | mid backend | 10 | standard | published | Existing post in `src/content/blog/java-concurrency-fundamentals-quiz.md` |
| 4 | Java memory model quiz | `java-memory-model-quiz` | Java | senior backend | 15 | deep | published | Existing post in `src/content/blog/java-memory-model-quiz.md` |
| 5 | Java streams and collectors quiz | `java-streams-and-collectors-quiz` | Java | mid backend | 10 | standard | published | Existing post in `src/content/blog/java-streams-and-collectors-quiz.md` |
| 6 | Java generics interview quiz | `java-generics-interview-quiz` | Java | mid backend | 10 | standard | idea | - |
| 7 | Java exception handling quiz | `java-exception-handling-quiz` | Java | junior backend | 5 | light | idea | - |
| 8 | Java multithreading interview quiz | `java-multithreading-interview-quiz` | Java | senior backend | 15 | deep | idea | - |
| 9 | Java collections deep dive quiz | `java-collections-deep-dive-quiz` | Java | senior backend | 15 | deep | idea | - |
| 10 | JVM garbage collection quiz | `jvm-garbage-collection-quiz` | JVM | senior backend | 15 | deep | idea | - |
| 11 | Java virtual threads quiz | `java-virtual-threads-quiz` | Java | mid backend | 10 | standard | idea | Loom and structured concurrency basics |
| 12 | Java records and sealed classes quiz | `java-records-and-sealed-classes-quiz` | Java | mid backend | 10 | standard | idea | - |
| 13 | Java I/O and NIO quiz | `java-io-and-nio-quiz` | Java | mid backend | 10 | standard | idea | - |
| 14 | Java synchronization and locks quiz | `java-synchronization-and-locks-quiz` | Java | senior backend | 15 | deep | idea | - |
| 15 | Java performance tuning quiz | `java-performance-tuning-quiz` | Java | senior backend | 15 | deep | idea | - |
| 16 | Java design patterns quiz | `java-design-patterns-quiz` | Java | mid backend | 10 | standard | idea | - |
| 17 | Java lambdas and functional interfaces quiz | `java-lambdas-and-functional-interfaces-quiz` | Java | mid backend | 10 | standard | idea | - |
| 18 | Java annotations and reflection quiz | `java-annotations-and-reflection-quiz` | Java | senior backend | 15 | deep | idea | - |
| 19 | Java date and time API quiz | `java-date-and-time-api-quiz` | Java | junior backend | 5 | light | idea | - |
| 20 | Java serialization and deserialization quiz | `java-serialization-and-deserialization-quiz` | Java | mid backend | 10 | standard | idea | - |

### JavaScript and TypeScript

| # | Topic | Slug | Category | Audience | Planned Questions | Depth | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 21 | JavaScript fundamentals quiz | `javascript-fundamentals-quiz` | JavaScript | junior frontend | 10 | standard | published | Existing post in `src/content/blog/javascript-fundamentals-quiz.md` |
| 22 | JavaScript closures and scope quiz | `javascript-closures-and-scope-quiz` | JavaScript | mid frontend | 10 | standard | published | Existing post in `src/content/blog/javascript-closures-and-scope-quiz.md` |
| 23 | JavaScript async and await quiz | `javascript-async-and-await-quiz` | JavaScript | mid full-stack | 10 | standard | published | Existing post in `src/content/blog/javascript-async-and-await-quiz.md` |
| 24 | JavaScript event loop quiz | `javascript-event-loop-quiz` | JavaScript | mid frontend | 15 | deep | idea | - |
| 25 | JavaScript promises quiz | `javascript-promises-quiz` | JavaScript | mid full-stack | 10 | standard | idea | - |
| 26 | JavaScript array methods quiz | `javascript-array-methods-quiz` | JavaScript | junior frontend | 5 | light | idea | - |
| 27 | JavaScript prototypes quiz | `javascript-prototypes-quiz` | JavaScript | senior frontend | 15 | deep | idea | Prototype chain and inheritance |
| 28 | JavaScript object fundamentals quiz | `javascript-object-fundamentals-quiz` | JavaScript | junior frontend | 5 | light | idea | - |
| 29 | TypeScript basics quiz | `typescript-basics-quiz` | TypeScript | junior frontend | 10 | standard | idea | - |
| 30 | TypeScript advanced types quiz | `typescript-advanced-types-quiz` | TypeScript | senior frontend | 15 | deep | idea | Unions, intersections, mapped types |
| 31 | TypeScript generics quiz | `typescript-generics-quiz` | TypeScript | mid frontend | 10 | standard | idea | - |
| 32 | TypeScript type narrowing quiz | `typescript-type-narrowing-quiz` | TypeScript | mid frontend | 10 | standard | idea | - |
| 33 | TypeScript utility types quiz | `typescript-utility-types-quiz` | TypeScript | mid frontend | 10 | standard | idea | - |
| 34 | TypeScript configuration quiz | `typescript-configuration-quiz` | TypeScript | mid full-stack | 10 | standard | idea | `tsconfig` trade-offs |
| 35 | JavaScript modules quiz | `javascript-modules-quiz` | JavaScript | junior full-stack | 5 | light | idea | ESM vs CommonJS |
| 36 | JavaScript memory leaks quiz | `javascript-memory-leaks-quiz` | JavaScript | senior frontend | 15 | deep | idea | - |
| 37 | Browser storage quiz | `browser-storage-quiz` | JavaScript | junior frontend | 5 | light | idea | Cookies, localStorage, sessionStorage, IndexedDB |
| 38 | Web workers quiz | `web-workers-quiz` | JavaScript | mid frontend | 10 | standard | idea | - |
| 39 | Node.js event loop quiz | `nodejs-event-loop-quiz` | Node.js | mid backend | 15 | deep | idea | - |
| 40 | Package management quiz | `package-management-quiz` | JavaScript | junior full-stack | 5 | light | idea | npm, pnpm, lockfiles |

### Python and Other Languages

| # | Topic | Slug | Category | Audience | Planned Questions | Depth | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 41 | Python fundamentals quiz | `python-fundamentals-quiz` | Python | junior backend | 10 | standard | idea | - |
| 42 | Python data structures quiz | `python-data-structures-quiz` | Python | junior backend | 10 | standard | idea | - |
| 43 | Python iterators and generators quiz | `python-iterators-and-generators-quiz` | Python | mid backend | 10 | standard | idea | - |
| 44 | Python async programming quiz | `python-async-programming-quiz` | Python | senior backend | 15 | deep | idea | asyncio and coroutines |
| 45 | Python typing quiz | `python-typing-quiz` | Python | mid backend | 10 | standard | idea | - |
| 46 | Python object-oriented programming quiz | `python-object-oriented-programming-quiz` | Python | junior backend | 10 | standard | idea | - |
| 47 | Python decorators quiz | `python-decorators-quiz` | Python | mid backend | 10 | standard | idea | - |
| 48 | Python testing basics quiz | `python-testing-basics-quiz` | Python | junior backend | 5 | light | idea | pytest and mocks |
| 49 | Go fundamentals quiz | `go-fundamentals-quiz` | Go | junior backend | 10 | standard | idea | - |
| 50 | Go concurrency quiz | `go-concurrency-quiz` | Go | mid backend | 15 | deep | idea | Goroutines and channels |
| 51 | Go interfaces quiz | `go-interfaces-quiz` | Go | mid backend | 10 | standard | idea | - |
| 52 | C# fundamentals quiz | `csharp-fundamentals-quiz` | C# | junior backend | 10 | standard | idea | - |
| 53 | C# LINQ quiz | `csharp-linq-quiz` | C# | mid backend | 10 | standard | idea | - |
| 54 | .NET async programming quiz | `dotnet-async-programming-quiz` | .NET | mid backend | 10 | standard | idea | - |
| 55 | Rust ownership quiz | `rust-ownership-quiz` | Rust | mid systems | 15 | deep | idea | - |
| 56 | Rust borrowing and lifetimes quiz | `rust-borrowing-and-lifetimes-quiz` | Rust | senior systems | 15 | deep | idea | - |
| 57 | C programming fundamentals quiz | `c-programming-fundamentals-quiz` | C | junior systems | 10 | standard | idea | - |
| 58 | C++ modern language features quiz | `cpp-modern-language-features-quiz` | C++ | senior systems | 15 | deep | idea | - |
| 59 | Kotlin fundamentals quiz | `kotlin-fundamentals-quiz` | Kotlin | junior backend | 10 | standard | idea | - |
| 60 | Swift fundamentals quiz | `swift-fundamentals-quiz` | Swift | junior mobile | 10 | standard | idea | - |

### Frameworks and Libraries

| # | Topic | Slug | Category | Audience | Planned Questions | Depth | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 61 | React fundamentals quiz | `react-fundamentals-quiz` | React | junior frontend | 10 | standard | idea | - |
| 62 | React hooks quiz | `react-hooks-quiz` | React | mid frontend | 10 | standard | idea | - |
| 63 | React state management quiz | `react-state-management-quiz` | React | mid frontend | 10 | standard | idea | - |
| 64 | React performance quiz | `react-performance-quiz` | React | senior frontend | 15 | deep | idea | - |
| 65 | React context quiz | `react-context-quiz` | React | mid frontend | 10 | standard | idea | - |
| 66 | Next.js fundamentals quiz | `nextjs-fundamentals-quiz` | Next.js | mid frontend | 10 | standard | idea | - |
| 67 | Next.js rendering modes quiz | `nextjs-rendering-modes-quiz` | Next.js | senior frontend | 15 | deep | idea | SSR, SSG, ISR, RSC |
| 68 | Astro fundamentals quiz | `astro-fundamentals-quiz` | Astro | mid frontend | 10 | standard | idea | - |
| 69 | Vue fundamentals quiz | `vue-fundamentals-quiz` | Vue | junior frontend | 10 | standard | idea | - |
| 70 | Angular fundamentals quiz | `angular-fundamentals-quiz` | Angular | junior frontend | 10 | standard | idea | - |
| 71 | Redux quiz | `redux-quiz` | Redux | mid frontend | 10 | standard | idea | - |
| 72 | React Query and TanStack Query quiz | `tanstack-query-quiz` | React | mid frontend | 10 | standard | idea | Data fetching and caching |
| 73 | Form handling in React quiz | `react-form-handling-quiz` | React | mid frontend | 10 | standard | idea | Controlled vs uncontrolled forms |
| 74 | Tailwind CSS quiz | `tailwind-css-quiz` | Tailwind CSS | junior frontend | 5 | light | idea | - |
| 75 | Spring Boot fundamentals quiz | `spring-boot-fundamentals-quiz` | Spring Boot | mid backend | 10 | standard | idea | - |
| 76 | Spring dependency injection quiz | `spring-dependency-injection-quiz` | Spring | mid backend | 10 | standard | idea | - |
| 77 | Hibernate and JPA quiz | `hibernate-and-jpa-quiz` | Java persistence | mid backend | 10 | standard | idea | - |
| 78 | Express.js fundamentals quiz | `expressjs-fundamentals-quiz` | Express.js | junior backend | 5 | light | idea | - |
| 79 | NestJS fundamentals quiz | `nestjs-fundamentals-quiz` | NestJS | mid backend | 10 | standard | idea | - |
| 80 | Django fundamentals quiz | `django-fundamentals-quiz` | Django | junior backend | 10 | standard | idea | - |

### Databases and SQL

| # | Topic | Slug | Category | Audience | Planned Questions | Depth | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 81 | SQL fundamentals quiz | `sql-fundamentals-quiz` | SQL | junior backend | 10 | standard | idea | - |
| 82 | SQL joins quiz | `sql-joins-quiz` | SQL | junior backend | 10 | standard | idea | - |
| 83 | SQL aggregation quiz | `sql-aggregation-quiz` | SQL | junior backend | 5 | light | idea | - |
| 84 | SQL window functions quiz | `sql-window-functions-quiz` | SQL | senior backend | 15 | deep | idea | - |
| 85 | Database indexing quiz | `database-indexing-quiz` | Databases | mid backend | 10 | standard | idea | - |
| 86 | Query optimization quiz | `query-optimization-quiz` | Databases | senior backend | 15 | deep | idea | - |
| 87 | Database normalization quiz | `database-normalization-quiz` | Databases | junior backend | 10 | standard | idea | - |
| 88 | Database transactions quiz | `database-transactions-quiz` | Databases | mid backend | 10 | standard | idea | ACID and isolation |
| 89 | PostgreSQL fundamentals quiz | `postgresql-fundamentals-quiz` | PostgreSQL | mid backend | 10 | standard | idea | - |
| 90 | PostgreSQL locking quiz | `postgresql-locking-quiz` | PostgreSQL | senior backend | 15 | deep | idea | MVCC and locks |
| 91 | MySQL fundamentals quiz | `mysql-fundamentals-quiz` | MySQL | mid backend | 10 | standard | idea | - |
| 92 | MongoDB fundamentals quiz | `mongodb-fundamentals-quiz` | MongoDB | junior backend | 10 | standard | idea | - |
| 93 | MongoDB schema design quiz | `mongodb-schema-design-quiz` | MongoDB | mid backend | 10 | standard | idea | - |
| 94 | Redis fundamentals quiz | `redis-fundamentals-quiz` | Redis | mid backend | 10 | standard | idea | - |
| 95 | Redis caching patterns quiz | `redis-caching-patterns-quiz` | Redis | mid backend | 10 | standard | idea | - |
| 96 | Data modeling interview quiz | `data-modeling-interview-quiz` | Databases | mid backend | 10 | standard | idea | Relational vs document trade-offs |
| 97 | Database replication quiz | `database-replication-quiz` | Databases | senior backend | 15 | deep | idea | - |
| 98 | Database sharding quiz | `database-sharding-quiz` | Databases | senior backend | 15 | deep | idea | - |
| 99 | Stored procedures quiz | `stored-procedures-quiz` | SQL | mid backend | 10 | standard | idea | - |
| 100 | ETL and data pipelines quiz | `etl-and-data-pipelines-quiz` | Data engineering | mid data | 10 | standard | idea | - |

### Backend and APIs

| # | Topic | Slug | Category | Audience | Planned Questions | Depth | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 101 | HTTP fundamentals quiz | `http-fundamentals-quiz` | Backend | junior full-stack | 10 | standard | idea | - |
| 102 | REST API design quiz | `rest-api-design-quiz` | Backend | mid backend | 10 | standard | idea | - |
| 103 | GraphQL fundamentals quiz | `graphql-fundamentals-quiz` | Backend | mid full-stack | 10 | standard | idea | - |
| 104 | API versioning quiz | `api-versioning-quiz` | Backend | mid backend | 10 | standard | idea | - |
| 105 | Pagination and filtering quiz | `pagination-and-filtering-quiz` | Backend | junior backend | 5 | light | idea | - |
| 106 | Caching strategies quiz | `caching-strategies-quiz` | Backend | mid backend | 10 | standard | idea | - |
| 107 | Rate limiting quiz | `rate-limiting-quiz` | Backend | mid backend | 10 | standard | idea | - |
| 108 | Message queues quiz | `message-queues-quiz` | Backend | senior backend | 15 | deep | idea | - |
| 109 | Event-driven architecture quiz | `event-driven-architecture-quiz` | Backend | senior backend | 15 | deep | idea | - |
| 110 | Background jobs quiz | `background-jobs-quiz` | Backend | mid backend | 10 | standard | idea | - |
| 111 | Webhooks quiz | `webhooks-quiz` | Backend | mid backend | 10 | standard | idea | Delivery, retries, signatures |
| 112 | WebSockets and realtime systems quiz | `websockets-and-realtime-systems-quiz` | Backend | mid full-stack | 10 | standard | idea | - |
| 113 | gRPC fundamentals quiz | `grpc-fundamentals-quiz` | Backend | senior backend | 15 | deep | idea | - |
| 114 | Microservices fundamentals quiz | `microservices-fundamentals-quiz` | Backend | senior backend | 15 | deep | idea | - |
| 115 | Idempotency quiz | `idempotency-quiz` | Backend | mid backend | 10 | standard | idea | - |
| 116 | File upload systems quiz | `file-upload-systems-quiz` | Backend | mid full-stack | 10 | standard | idea | - |
| 117 | Search systems fundamentals quiz | `search-systems-fundamentals-quiz` | Backend | senior backend | 15 | deep | idea | Elasticsearch and relevance basics |
| 118 | API error handling quiz | `api-error-handling-quiz` | Backend | junior backend | 5 | light | idea | - |
| 119 | Backend observability quiz | `backend-observability-quiz` | Backend | senior backend | 15 | deep | idea | Logs, metrics, traces |
| 120 | Service resilience patterns quiz | `service-resilience-patterns-quiz` | Backend | senior backend | 15 | deep | idea | Retries, timeouts, circuit breakers |

### Frontend and Web Fundamentals

| # | Topic | Slug | Category | Audience | Planned Questions | Depth | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 121 | HTML fundamentals quiz | `html-fundamentals-quiz` | Frontend | junior frontend | 10 | standard | idea | - |
| 122 | Semantic HTML quiz | `semantic-html-quiz` | Frontend | junior frontend | 5 | light | idea | - |
| 123 | CSS fundamentals quiz | `css-fundamentals-quiz` | Frontend | junior frontend | 10 | standard | idea | - |
| 124 | CSS Flexbox quiz | `css-flexbox-quiz` | Frontend | junior frontend | 10 | standard | idea | - |
| 125 | CSS Grid quiz | `css-grid-quiz` | Frontend | mid frontend | 10 | standard | idea | - |
| 126 | Responsive design quiz | `responsive-design-quiz` | Frontend | junior frontend | 10 | standard | idea | - |
| 127 | Accessibility fundamentals quiz | `accessibility-fundamentals-quiz` | Accessibility | mid frontend | 10 | standard | idea | - |
| 128 | ARIA and screen reader quiz | `aria-and-screen-reader-quiz` | Accessibility | senior frontend | 15 | deep | idea | - |
| 129 | Browser rendering pipeline quiz | `browser-rendering-pipeline-quiz` | Frontend | senior frontend | 15 | deep | idea | - |
| 130 | Core Web Vitals quiz | `core-web-vitals-quiz` | Frontend | mid frontend | 10 | standard | idea | - |
| 131 | DOM manipulation quiz | `dom-manipulation-quiz` | Frontend | junior frontend | 5 | light | idea | - |
| 132 | Form UX quiz | `form-ux-quiz` | Frontend | junior frontend | 5 | light | idea | Validation, labels, errors |
| 133 | Browser networking quiz | `browser-networking-quiz` | Frontend | mid frontend | 10 | standard | idea | Caching and request lifecycle |
| 134 | SEO fundamentals for developers quiz | `seo-fundamentals-for-developers-quiz` | Frontend | mid full-stack | 10 | standard | idea | - |
| 135 | Progressive enhancement quiz | `progressive-enhancement-quiz` | Frontend | mid frontend | 10 | standard | idea | - |
| 136 | Internationalization fundamentals quiz | `internationalization-fundamentals-quiz` | Frontend | mid frontend | 10 | standard | idea | - |
| 137 | Design systems fundamentals quiz | `design-systems-fundamentals-quiz` | Frontend | senior frontend | 15 | deep | idea | - |
| 138 | CSS specificity quiz | `css-specificity-quiz` | Frontend | junior frontend | 5 | light | idea | - |
| 139 | Frontend state management fundamentals quiz | `frontend-state-management-fundamentals-quiz` | Frontend | mid frontend | 10 | standard | idea | - |
| 140 | Web performance optimization quiz | `web-performance-optimization-quiz` | Frontend | senior frontend | 15 | deep | idea | - |

### Cloud, DevOps, and Tooling

| # | Topic | Slug | Category | Audience | Planned Questions | Depth | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 141 | Docker fundamentals quiz | `docker-fundamentals-quiz` | DevOps | junior backend | 10 | standard | idea | - |
| 142 | Kubernetes fundamentals quiz | `kubernetes-fundamentals-quiz` | DevOps | senior backend | 15 | deep | idea | - |
| 143 | CI and CD quiz | `ci-and-cd-quiz` | DevOps | mid full-stack | 10 | standard | idea | - |
| 144 | Git fundamentals quiz | `git-fundamentals-quiz` | Tooling | junior full-stack | 10 | standard | idea | - |
| 145 | Git branching strategies quiz | `git-branching-strategies-quiz` | Tooling | mid full-stack | 10 | standard | idea | - |
| 146 | Linux command line quiz | `linux-command-line-quiz` | Tooling | junior backend | 5 | light | idea | - |
| 147 | Linux systems basics quiz | `linux-systems-basics-quiz` | DevOps | mid backend | 10 | standard | idea | Processes, signals, services |
| 148 | AWS fundamentals quiz | `aws-fundamentals-quiz` | Cloud | mid backend | 10 | standard | idea | - |
| 149 | AWS networking quiz | `aws-networking-quiz` | Cloud | senior backend | 15 | deep | idea | VPC, subnets, gateways |
| 150 | Terraform fundamentals quiz | `terraform-fundamentals-quiz` | DevOps | mid devops | 10 | standard | idea | - |
| 151 | Infrastructure as code quiz | `infrastructure-as-code-quiz` | DevOps | mid devops | 10 | standard | idea | - |
| 152 | Observability fundamentals quiz | `observability-fundamentals-quiz` | DevOps | mid backend | 10 | standard | idea | - |
| 153 | Logging and monitoring quiz | `logging-and-monitoring-quiz` | DevOps | junior devops | 5 | light | idea | - |
| 154 | Incident response quiz | `incident-response-quiz` | DevOps | senior backend | 15 | deep | idea | - |
| 155 | CDN fundamentals quiz | `cdn-fundamentals-quiz` | Cloud | mid full-stack | 10 | standard | idea | - |
| 156 | Load balancers quiz | `load-balancers-quiz` | Cloud | mid backend | 10 | standard | idea | - |
| 157 | Nginx fundamentals quiz | `nginx-fundamentals-quiz` | DevOps | mid backend | 10 | standard | idea | - |
| 158 | Vercel deployment quiz | `vercel-deployment-quiz` | Deployment | mid frontend | 10 | standard | idea | Relevant to current stack |
| 159 | Feature flags quiz | `feature-flags-quiz` | Tooling | mid full-stack | 10 | standard | idea | - |
| 160 | Build tools fundamentals quiz | `build-tools-fundamentals-quiz` | Tooling | junior frontend | 5 | light | idea | Bundlers, transpilers, task runners |

### System Design

| # | Topic | Slug | Category | Audience | Planned Questions | Depth | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 161 | System design fundamentals quiz | `system-design-fundamentals-quiz` | System Design | mid backend | 10 | standard | idea | - |
| 162 | Scalability basics quiz | `scalability-basics-quiz` | System Design | mid backend | 10 | standard | idea | - |
| 163 | CAP theorem quiz | `cap-theorem-quiz` | System Design | senior backend | 15 | deep | idea | - |
| 164 | Consistency models quiz | `consistency-models-quiz` | System Design | senior backend | 15 | deep | idea | - |
| 165 | Caching in distributed systems quiz | `caching-in-distributed-systems-quiz` | System Design | senior backend | 15 | deep | idea | - |
| 166 | API gateway quiz | `api-gateway-quiz` | System Design | mid backend | 10 | standard | idea | - |
| 167 | Queue-based architecture quiz | `queue-based-architecture-quiz` | System Design | senior backend | 15 | deep | idea | - |
| 168 | Pub sub systems quiz | `pub-sub-systems-quiz` | System Design | senior backend | 15 | deep | idea | - |
| 169 | Database selection quiz | `database-selection-quiz` | System Design | mid backend | 10 | standard | idea | SQL vs NoSQL trade-offs |
| 170 | Search system design quiz | `search-system-design-quiz` | System Design | senior backend | 15 | deep | idea | - |
| 171 | Realtime collaboration systems quiz | `realtime-collaboration-systems-quiz` | System Design | senior full-stack | 15 | deep | idea | - |
| 172 | Notification systems quiz | `notification-systems-quiz` | System Design | mid backend | 10 | standard | idea | Email, push, SMS patterns |
| 173 | Rate limiter system design quiz | `rate-limiter-system-design-quiz` | System Design | senior backend | 15 | deep | idea | - |
| 174 | URL shortener system design quiz | `url-shortener-system-design-quiz` | System Design | mid backend | 10 | standard | idea | - |
| 175 | Chat system design quiz | `chat-system-design-quiz` | System Design | senior full-stack | 15 | deep | idea | - |
| 176 | Video streaming basics quiz | `video-streaming-basics-quiz` | System Design | senior backend | 15 | deep | idea | - |
| 177 | Multi-tenant architecture quiz | `multi-tenant-architecture-quiz` | System Design | senior backend | 15 | deep | idea | - |
| 178 | Fault tolerance quiz | `fault-tolerance-quiz` | System Design | senior backend | 15 | deep | idea | - |
| 179 | Service discovery quiz | `service-discovery-quiz` | System Design | senior backend | 15 | deep | idea | - |
| 180 | Data partitioning quiz | `data-partitioning-quiz` | System Design | senior backend | 15 | deep | idea | - |

### Security and Auth

| # | Topic | Slug | Category | Audience | Planned Questions | Depth | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 181 | Web security fundamentals quiz | `web-security-fundamentals-quiz` | Security | mid full-stack | 10 | standard | idea | - |
| 182 | Authentication vs authorization quiz | `authentication-vs-authorization-quiz` | Security | junior full-stack | 5 | light | idea | - |
| 183 | Session management quiz | `session-management-quiz` | Security | mid backend | 10 | standard | idea | - |
| 184 | JWT fundamentals quiz | `jwt-fundamentals-quiz` | Security | mid full-stack | 10 | standard | idea | - |
| 185 | OAuth 2.0 quiz | `oauth-2-fundamentals-quiz` | Security | senior full-stack | 15 | deep | idea | - |
| 186 | OpenID Connect quiz | `openid-connect-quiz` | Security | senior full-stack | 15 | deep | idea | - |
| 187 | Password security quiz | `password-security-quiz` | Security | mid backend | 10 | standard | idea | Hashing, salting, resets |
| 188 | SQL injection quiz | `sql-injection-quiz` | Security | junior full-stack | 5 | light | idea | - |
| 189 | XSS fundamentals quiz | `xss-fundamentals-quiz` | Security | mid frontend | 10 | standard | idea | - |
| 190 | CSRF fundamentals quiz | `csrf-fundamentals-quiz` | Security | mid full-stack | 10 | standard | idea | - |
| 191 | CORS quiz | `cors-quiz` | Security | mid full-stack | 10 | standard | idea | - |
| 192 | Secure cookies quiz | `secure-cookies-quiz` | Security | junior frontend | 5 | light | idea | - |
| 193 | API security quiz | `api-security-quiz` | Security | senior backend | 15 | deep | idea | - |
| 194 | Secrets management quiz | `secrets-management-quiz` | Security | senior devops | 15 | deep | idea | - |
| 195 | HTTPS and TLS quiz | `https-and-tls-quiz` | Security | mid full-stack | 10 | standard | idea | - |
| 196 | OWASP Top 10 quiz | `owasp-top-10-quiz` | Security | mid full-stack | 10 | standard | idea | - |
| 197 | Secure coding review quiz | `secure-coding-review-quiz` | Security | senior full-stack | 15 | deep | idea | - |
| 198 | RBAC and permission models quiz | `rbac-and-permission-models-quiz` | Security | mid backend | 10 | standard | idea | - |
| 199 | Multi-factor authentication quiz | `multi-factor-authentication-quiz` | Security | mid full-stack | 10 | standard | idea | - |
| 200 | Identity provider integration quiz | `identity-provider-integration-quiz` | Security | senior full-stack | 15 | deep | idea | SSO and external auth providers |

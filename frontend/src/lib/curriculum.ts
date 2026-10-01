export type CurriculumWeek = {
  week: number;
  title: string;
  topics: string[];
};

export type CurriculumMonth = {
  label: string;
  focus: string;
  weeks: CurriculumWeek[];
  ships: string;
};

export type ProgrammeTrack = {
  code: "THREE_MONTH" | "FOUR_MONTH" | "FIVE_MONTH" | "SIX_MONTH";
  months: number;
  weeks: number;
  title: string;
  pitch: string;
  pace: string;
  mentorship: string;
  monthsPlan: CurriculumMonth[];
  extras: string[];
};

export const CURRICULUM_INTRO = {
  title: "How The Digital 26 programme is structured",
  lede:
    "We teach vibe coding by shipping real web work: prompts, pages, APIs, Git, and deploy. Physical or online class. Length is pace and depth, not a different subject. Registration is a one-time $3 USD fee. Class, library, attendance, and chat unlock after that payment. Certificates stay admin-issued when you finish.",
  howWeTeach: [
    "Same core path on every track: web, Git, HTML, CSS, JavaScript, vibe coding, React, APIs, data, security, deploy, then a capstone.",
    "Shorter tracks meet more often. Longer tracks give more labs, recordings, and time to redo weak spots.",
    "Every month ships something public: a live URL, a GitHub repo, or both.",
    "Vibe coding is required: write a spec, prompt clearly, then read, debug, and reject sloppy or unsafe AI code.",
    "Physical studio or online. Same paper. Same public certificate path.",
  ],
};

export const PROGRAMME_TRACKS: ProgrammeTrack[] = [
  {
    code: "THREE_MONTH",
    months: 3,
    weeks: 12,
    title: "3-Month Intensive",
    pitch: "Constant class, high-frequency shipping. Best if you can show up often.",
    pace: "Very fast. Five live sessions a week suggested. Hands-on shipping every week. Priority mentor access.",
    mentorship: "3-year mentorship support after class",
    extras: [
      "High-frequency live classes",
      "Hands-on project shipping every week",
      "Priority mentor access",
      "Certificate of completion",
    ],
    monthsPlan: [
      {
        label: "Month 1: Frontend and first deploy",
        focus:
          "Stand up a real toolchain, ship HTML and CSS that holds on a phone, then add JavaScript and a first live URL.",
        ships: "A deployed interactive site (GitHub Pages or similar) with a public repo.",
        weeks: [
          {
            week: 1,
            title: "Setup, Git, HTML, CSS",
            topics: [
              "How the web works in one sitting: browser, DNS, hosting, HTTP request and response.",
              "VS Code: extensions, integrated terminal, workspace folders, saving and running files.",
              "Git from day one: init, status, add, commit, clone. GitHub account, .gitignore, first remote.",
              "HTML skeleton: doctype, head, semantic landmarks (header, main, nav, footer), links and images.",
              "CSS start: selectors, colors, fonts, spacing, the box model. No layout frameworks yet.",
              "Studio habit: one repo per project, README with your name, what it does, and how to open it.",
            ],
          },
          {
            week: 2,
            title: "Flexbox, Grid, responsive design. First deployment",
            topics: [
              "Flexbox: row vs column, wrap, alignment, gap, common nav and card patterns.",
              "CSS Grid: tracks, areas, simple two-column pages without fighting the layout.",
              "Mobile first: viewport meta, fluid widths, media queries, touch-sized targets.",
              "Images and type that do not break: max-width, srcset idea, readable contrast.",
              "First deploy: GitHub Pages (or studio host). Custom 404 is optional. Live URL in the README.",
              "Debug on a real phone. Fix overflow, tiny text, and links that do not tap.",
            ],
          },
          {
            week: 3,
            title: "JavaScript core, with a vibe coding intro",
            topics: [
              "Values, variables, functions, if/else, loops, arrays, objects. Console as a lab.",
              "Vibe coding from day one: a one-page spec before any prompt. Task size: one function, not a whole app.",
              "How to read AI output: names, types, missing errors, copy-paste that you cannot explain.",
              "When to stop trusting the model: secrets in code, fake APIs, 'just trust me' comments.",
              "Student must rewrite at least one generated function by hand so they own it.",
            ],
          },
          {
            week: 4,
            title: "DOM, fetch, async. Month project review",
            topics: [
              "Selecting nodes, creating elements, listening to clicks and submits, preventing default.",
              "Form validation you write: required fields, simple email check, error text next to the field.",
              "fetch, JSON, then/catch or async/await. Loading and empty states. What a 404 looks like in the Network tab.",
              "Month review with mentor: repo hygiene, live URL, and one feature you can explain without the AI.",
            ],
          },
        ],
      },
      {
        label: "Month 2: React and backend",
        focus: "Component UI, then a small server the frontend actually talks to.",
        ships: "A React app connected to its own backend, with a live or recorded demo of the request.",
        weeks: [
          {
            week: 5,
            title: "React fundamentals",
            topics: [
              "Why components exist. JSX, props, composition, one-way data.",
              "Create a Vite React app. File layout. Dev server vs production build.",
              "Lists and keys. Conditional rendering. Extracting a Card or Button you reuse.",
              "Vibe coding in React: prompt for one component, paste into the right file, then read the JSX.",
            ],
          },
          {
            week: 6,
            title: "State, routing, consuming APIs",
            topics: [
              "useState for inputs and toggles. Controlled forms. Lifting state when two children need the same data.",
              "Client routing (React Router): Home, a detail page, a not-found page.",
              "useEffect for fetch. Abort or ignore stale responses. Loading, error, and retry.",
              "Never put API keys in the frontend. Show what leaks look like in the built JS.",
            ],
          },
          {
            week: 7,
            title: "Node, Express, REST",
            topics: [
              "Node runtime vs the browser. npm scripts. Environment vs hard-coded URLs.",
              "Express: listen, JSON body, GET and POST. Status codes you actually use (200, 201, 400, 404, 500).",
              "REST shape: resources, not random /getData. One router file, one handler file.",
              "CORS in one sentence: why the browser blocks you, how to open it for your frontend origin only.",
            ],
          },
          {
            week: 8,
            title: "Databases, connecting frontend to backend",
            topics: [
              "Tables vs documents in plain language. Primary keys, why you do not store passwords in plain text (preview).",
              "One table for the month project (notes, tasks, or products). Create, list, update, delete through the API.",
              "Wire React to Express: same JSON both sides. Handle 400 from the server in the form.",
              "Month review: draw the request path on paper (click to fetch to SQL and back).",
            ],
          },
        ],
      },
      {
        label: "Month 3: Launch",
        focus: "Accounts, hardening, hosting, then a capstone that is public by week 12.",
        ships: "Capstone and portfolio, shipped by the end of week 12.",
        weeks: [
          {
            week: 9,
            title: "Authentication and security",
            topics: [
              "Register and login: hash passwords (bcrypt or studio standard). Never log the raw password.",
              "Sessions or JWT: what is stored where, expiry, logout.",
              "Protected routes on API and UI. Redirect when the token is missing.",
              "Input validation, SQL injection idea, XSS in innerHTML. .env files and gitignore.",
            ],
          },
          {
            week: 10,
            title: "Deployment and integrations",
            topics: [
              "Build the frontend. Set production API URL. Deploy API and web (Render, similar, or studio host).",
              "Custom domain optional. HTTPS. What a failed deploy log looks like.",
              "One integration: email, or a payment test mode, or maps. Read the vendor docs, do not invent keys.",
              "Health check route. Do not ship with debug CORS * if the mentor forbids it.",
            ],
          },
          {
            week: 11,
            title: "Capstone build",
            topics: [
              "One-page spec: user, problem, three screens, data tables, must-have vs later.",
              "Daily commits. Mentor checkpoints. AI allowed for boilerplate only after the spec exists.",
              "If a feature is late, cut it. A finished small product beats a broken big one.",
            ],
          },
          {
            week: 12,
            title: "Capstone ships, portfolio, demo day",
            topics: [
              "Polish: empty states, errors, README, screenshots, live URL.",
              "Portfolio page: photo, tracks, three shipped links, one paragraph on how you used AI and what you rewrote.",
              "Demo day: five minutes, one problem, one demo, one lesson. Certificate path after admin review of completion.",
            ],
          },
        ],
      },
    ],
  },
  {
    code: "FOUR_MONTH",
    months: 4,
    weeks: 16,
    title: "4-Month Advanced",
    pitch: "Richer curriculum and a wider weekly schedule than the 3-month track.",
    pace: "Brisk. Four live sessions a week suggested. 1-on-1 project reviews. Broader weekly schedule than 3-month.",
    mentorship: "2-year mentorship support after class",
    extras: [
      "Richer curriculum than 3-month",
      "Broader weekly schedule",
      "1-on-1 project reviews",
      "Certificate of completion",
    ],
    monthsPlan: [
      {
        label: "Month 1: Frontend core",
        focus: "Tooling through interactive JS, with extra lab time the intensive track does not have.",
        ships: "An interactive responsive site, live, with a clean Git history.",
        weeks: [
          {
            week: 1,
            title: "Web basics, tooling, Git, HTML",
            topics: [
              "Browser, server, domain, hosting, HTTP methods and status codes in the Network panel.",
              "VS Code, terminal (cd, ls/dir, mkdir), project folders, package.json later in the month.",
              "Git and GitHub: clone, branch, commit messages that say why, pull, push, open a pull request even if you merge your own.",
              "Semantic HTML: headings in order, forms (label, input, textarea, button type), images with alt.",
              "Accessibility first pass: contrast, keyboard tab order, skip link optional.",
            ],
          },
          {
            week: 2,
            title: "CSS, Flexbox, Grid, responsive design",
            topics: [
              "Cascade, specificity, custom properties (CSS variables) for brand color.",
              "Box model, margin collapse, padding, border-box.",
              "Flexbox layouts for nav and cards. Grid for a landing page sections.",
              "Mobile first, breakpoints, hiding vs stacking. Test at 360px and 1280px.",
              "A small design pass: type scale, spacing scale (8px rhythm), not random pixels.",
            ],
          },
          {
            week: 3,
            title: "JavaScript fundamentals",
            topics: [
              "Types, let/const, functions, scope, arrays (map, filter, find), objects, JSON.parse/stringify.",
              "Errors: try/catch, reading a stack trace, debugger statement or breakpoints.",
              "Modules in the browser (type=module) vs one giant script tag.",
              "Lab: rebuild a tiny feature twice, once by hand, once with a prompt, then diff them.",
            ],
          },
          {
            week: 4,
            title: "DOM, events, fetch, async",
            topics: [
              "Event delegation, input vs change, submit. Prevent double-submit.",
              "Async: promises, async/await, fetch with GET and POST JSON.",
              "Query params vs body. CORS errors vs 401 vs 500: how you tell them apart.",
              "Month ship: interactive responsive site. 1-on-1 looks at code taste, not only 'it works'.",
            ],
          },
        ],
      },
      {
        label: "Month 2: Vibe coding and React",
        focus: "A repeatable AI workflow plus a real React app that hits live data.",
        ships: "A working React app with routing and at least one 1-on-1 review notes file.",
        weeks: [
          {
            week: 5,
            title: "Vibe coding workflow plus React basics",
            topics: [
              "Mini spec template: goal, screens, data, out of scope, acceptance checks.",
              "Prompt patterns: constraints, file names, 'do not invent endpoints'.",
              "React: Vite, components, props, JSX, children.",
              "Review ritual: run it, read it, delete dead code, commit in small chunks.",
            ],
          },
          {
            week: 6,
            title: "State, hooks, routing",
            topics: [
              "useState, useEffect rules (no infinite loops), derived state vs extra state.",
              "Controlled forms, field-level errors, disable submit while saving.",
              "React Router: nested routes optional. Active nav styling.",
              "Custom hook only if you repeat fetch logic twice. Do not abstract too early.",
            ],
          },
          {
            week: 7,
            title: "API consumption, forms, login screens",
            topics: [
              "List/detail from a public or studio API. Pagination if the API has it.",
              "Login screen UX even if auth is mocked: loading, invalid credentials, logout.",
              "Store tokens only as the mentor specifies (memory vs httpOnly cookie later).",
              "Error boundaries optional. Always a user-visible error, never a white screen.",
            ],
          },
          {
            week: 8,
            title: "React project with a 1-on-1 review",
            topics: [
              "Ship a complete slice: three routes, one form, one list from an API.",
              "1-on-1: naming, folder structure, secrets, and whether you can delete the AI comments.",
              "Write a REVIEW.md: what the model got wrong and what you changed.",
            ],
          },
        ],
      },
      {
        label: "Month 3: Backend",
        focus: "Your own API, a database, auth, then a full-stack slice.",
        ships: "A full-stack app: React talking to Express plus a database.",
        weeks: [
          {
            week: 9,
            title: "Node, Express, REST",
            topics: [
              "Layering: routes, controllers, a thin data module. No business logic in the React file.",
              "REST resources, nested routes if needed, consistent JSON error shape { error }.",
              "Request logging. 404 handler. Do not swallow errors.",
              "Postman or similar: save a collection for the mentor to replay.",
            ],
          },
          {
            week: 10,
            title: "Databases",
            topics: [
              "SQL: CREATE TABLE, INSERT, SELECT, UPDATE, DELETE, WHERE, JOIN at a basic level.",
              "Migrations or a schema file in the repo. Seed data for class.",
              "Indexes in one sentence. Why N+1 queries hurt even on small tables.",
              "Prisma or studio SQL: one Student/Note/Order table that matches the UI.",
            ],
          },
          {
            week: 11,
            title: "Authentication and security",
            topics: [
              "Hashing, unique emails, rate-limit login in idea if not in code.",
              "Protected API middleware. CSRF vs JWT in plain language.",
              "Helmet-level headers optional. Never commit .env. Rotate a leaked key in class if someone does.",
              "Validate body with a schema (zod or equivalent) before the database.",
            ],
          },
          {
            week: 12,
            title: "Full-stack project",
            topics: [
              "End-to-end: register, create a record, see it after refresh, delete it.",
              "Deploy a preview if time. Otherwise a recorded demo of local full stack.",
              "1-on-1 on the data model: would this survive a second feature?",
            ],
          },
        ],
      },
      {
        label: "Month 4: Launch",
        focus: "Host it, add one real integration, finish a capstone, then career-facing demo.",
        ships: "Capstone and portfolio, plus a final 1-on-1 review.",
        weeks: [
          {
            week: 13,
            title: "Deployment and integrations",
            topics: [
              "Production env vars. Build vs start. Health checks.",
              "Domains, DNS A/CNAME, HTTPS certificates at a high level.",
              "One integration in test mode: payments, email, or maps. Webhooks as an idea if payments.",
              "Rollback: previous deploy, why you keep Git tags or release notes in README.",
            ],
          },
          {
            week: 14,
            title: "Capstone build",
            topics: [
              "Spec, wireframes (paper is enough), schema, three user stories.",
              "Build in vertical slices, not 'all frontend then all backend'.",
              "Mentor hours booked. Cut features that threaten week 15.",
            ],
          },
          {
            week: 15,
            title: "Capstone finish, portfolio",
            topics: [
              "Testing by hand with a checklist. Fix the worst bugs first.",
              "Docs: README, env example without secrets, screenshots.",
              "Portfolio: three projects, stack list, live links, GitHub.",
            ],
          },
          {
            week: 16,
            title: "Career prep, final 1-on-1, demo day",
            topics: [
              "CV bullets that name shipped URLs. How to price a small site. Client scope in writing.",
              "Final 1-on-1: what to learn next, what to stop copying from the model.",
              "Demo day. Certificate of completion path.",
            ],
          },
        ],
      },
    ],
  },
  {
    code: "FIVE_MONTH",
    months: 5,
    weeks: 20,
    title: "5-Month Accelerated",
    pitch: "Intensive vibe coding with weekly mentor Q&A and career-facing extras.",
    pace: "Fast but structured. Three live sessions a week suggested, plus a weekly live Q&A. Priority 1-on-1 reviews and premium templates.",
    mentorship: "1-year mentorship support after class",
    extras: [
      "Priority 1-on-1 project reviews",
      "Weekly live Q&A with mentor",
      "Premium templates and resources",
      "Fast-track career support",
    ],
    monthsPlan: [
      {
        label: "Month 1: Foundations",
        focus: "A complete frontend toolkit and a real business site, using studio templates where they help.",
        ships: "A responsive business website, live, built from semantic HTML and CSS you can explain.",
        weeks: [
          {
            week: 1,
            title: "Web basics, VS Code, terminal, Git and GitHub",
            topics: [
              "Request path: URL, DNS, TLS idea, HTML response. DevTools: Elements, Network, Console.",
              "Editor and terminal until they are not scary. Shortcuts the class actually uses.",
              "Git: commit, branch, push, PR. Resolve a tiny conflict in class so it is not a myth.",
              "Repo standards: README, license optional, no node_modules in Git.",
            ],
          },
          {
            week: 2,
            title: "HTML in depth, forms, accessibility",
            topics: [
              "Landmarks, lists, tables when data is tabular, not for layout.",
              "Forms: GET vs POST, name attributes, types (email, tel, password), textarea, select, labels.",
              "Accessibility: alt, labels, focus, heading levels, reduced-motion note.",
              "Template use: start from a studio HTML skeleton, then replace every dummy string.",
            ],
          },
          {
            week: 3,
            title: "CSS, box model, Flexbox",
            topics: [
              "Units: rem, %, vw. Why px for borders is fine and for type is often not.",
              "Flexbox layouts from the template library: hero, feature row, footer.",
              "States: hover, focus-visible, disabled. Buttons that look like buttons.",
            ],
          },
          {
            week: 4,
            title: "Grid, responsive design, mobile first",
            topics: [
              "Grid for gallery and dashboard-like cards. minmax, auto-fit as a preview.",
              "Breakpoints the studio uses. Container queries only if the mentor opts in.",
              "Ship the business site. Q&A this week is 'why did this wrap on my phone'.",
            ],
          },
        ],
      },
      {
        label: "Month 2: JavaScript and vibe coding",
        focus: "Language fluency, then a disciplined AI workflow, not prompt-and-pray.",
        ships: "An interactive app built partly with AI, with a written review of what you kept and deleted.",
        weeks: [
          {
            week: 5,
            title: "JavaScript fundamentals",
            topics: [
              "Functions, closures at a light level, arrays and objects, truthy/falsy.",
              "Strict equality. Number vs string bugs. Template strings.",
              "Small kata set in class. No libraries.",
            ],
          },
          {
            week: 6,
            title: "The DOM, events, validation",
            topics: [
              "Query, create, classList, dataset. Event object.",
              "Client validation plus a note that the server must validate too (preview of month 4).",
              "A multi-step form or quiz UI without a framework.",
            ],
          },
          {
            week: 7,
            title: "Async JS, fetch, working with APIs",
            topics: [
              "Public APIs vs your future API. API keys belong on a server.",
              "AbortController idea. Timeouts. Retry once, then show error.",
              "JSON shape. Optional chaining without hiding real bugs.",
            ],
          },
          {
            week: 8,
            title: "Vibe coding workflow",
            topics: [
              "Prompting, specs, reviewing and debugging AI code as a weekly ritual.",
              "Red flags: hallucinated packages, eval, innerHTML with user text, 'ignore previous instructions' jokes in source.",
              "1-on-1: walk the mentor through a generated function line by line.",
            ],
          },
        ],
      },
      {
        label: "Month 3: React",
        focus: "From components to a live-data app, with premium component templates as a starting point only.",
        ships: "A React app pulling real data, reviewed in 1-on-1.",
        weeks: [
          {
            week: 9,
            title: "React basics: components, props, JSX",
            topics: [
              "Vite React. File-per-component. Props as a contract.",
              "Compose a page from template pieces, then break the template so you understand it.",
            ],
          },
          {
            week: 10,
            title: "State, hooks, forms",
            topics: [
              "useState, lifting state, useRef for focus only when needed.",
              "Forms that match the HTML month, now in React. Disable double submit.",
            ],
          },
          {
            week: 11,
            title: "Routing, API data, error handling",
            topics: [
              "Routes, params, a 404 page. Fetch on param change.",
              "Error and empty. Skeleton optional. Never mute console errors to 'look clean'.",
            ],
          },
          {
            week: 12,
            title: "React project with live data, AI-assisted, reviewed in 1-on-1",
            topics: [
              "Ship. Q&A clinic on hooks bugs. 1-on-1 on structure and data flow.",
            ],
          },
        ],
      },
      {
        label: "Month 4: Backend",
        focus: "A real API, a database, accounts, then a full-stack product slice.",
        ships: "A full-stack app with accounts.",
        weeks: [
          {
            week: 13,
            title: "Node, Express, REST APIs",
            topics: [
              "Router split. JSON errors. Versioning is not required; consistent paths are.",
              "Studio Express starter template: strip what you do not use.",
            ],
          },
          {
            week: 14,
            title: "Databases and connecting them to the API",
            topics: [
              "SQL modeling for the account app. Foreign keys if you have posts/orders.",
              "Connection string in env. Pooling as an idea.",
            ],
          },
          {
            week: 15,
            title: "Authentication and protected routes",
            topics: [
              "Register, login, me route, logout. Hashing. Unique constraints.",
              "Frontend route guards that match the API, not only hide a button.",
            ],
          },
          {
            week: 16,
            title: "Full-stack project build",
            topics: [
              "One product loop with login. Seed a demo user for Q&A. 1-on-1 on auth holes.",
            ],
          },
        ],
      },
      {
        label: "Month 5: Launch",
        focus: "Harden, integrate, capstone, then fast-track career support.",
        ships: "Capstone and portfolio.",
        weeks: [
          {
            week: 17,
            title: "Security basics and deployment",
            topics: [
              "Env, validation, CORS allowlist, common attacks (XSS, injection, brute force).",
              "Deploy frontend and API. Custom domain if ready.",
            ],
          },
          {
            week: 18,
            title: "Integrations: payments, email, third-party APIs",
            topics: [
              "Test keys only. Webhook signature idea for payments.",
              "Transactional email: signup or 'message received'. Never spam.",
            ],
          },
          {
            week: 19,
            title: "Capstone build",
            topics: [
              "Spec, templates allowed for UI chrome, all data and auth must be yours.",
              "Daily Q&A unblock. Priority 1-on-1 mid-build.",
            ],
          },
          {
            week: 20,
            title: "Capstone finish, portfolio, fast-track career, demo day",
            topics: [
              "Polish, docs, live URL. Portfolio and CV clinic.",
              "Pricing a freelance site, scope in writing, when to say no.",
              "Demo day. Certificate path.",
            ],
          },
        ],
      },
    ],
  },
  {
    code: "SIX_MONTH",
    months: 6,
    weeks: 24,
    title: "6-Month Standard",
    pitch: "Complete vibe coding at a calmer pace, with recordings and self-paced reviews.",
    pace: "Calm and thorough. Two live sessions a week suggested. Recordings for everything. Self-paced project reviews.",
    mentorship: "6-month mentorship support after class",
    extras: [
      "Self-paced project reviews",
      "Recorded session access",
      "Standard templates and resources",
      "Certificate of completion",
    ],
    monthsPlan: [
      {
        label: "Month 1: Foundations",
        focus: "The web, your editor, Git, HTML, and CSS, slow enough to redo labs from recordings.",
        ships: "A personal profile page on GitHub Pages.",
        weeks: [
          {
            week: 1,
            title: "How the web works. VS Code, terminal, folders",
            topics: [
              "Browser, server, domain, hosting. What localhost is. HTTP vs HTTPS in one diagram.",
              "VS Code: explorer, terminal, extensions the class uses, autosave.",
              "Terminal: navigate, create folders, open files. Path vs filename.",
              "A week-1 sandbox folder. Nothing fancy. Muscle memory over speed.",
            ],
          },
          {
            week: 2,
            title: "Git and GitHub: commits, branches, pushing, pull requests",
            topics: [
              "init, clone, status, diff, log. Commit messages in present tense, short.",
              "main vs a feature branch. Push, pull, fetch. What origin means.",
              "GitHub: repo, README, .gitignore. Open a PR even for a one-person project.",
              "Recover from a mistake: checkout a file, amend only if not pushed and mentor says so.",
            ],
          },
          {
            week: 3,
            title: "HTML in depth: semantic tags, forms, links, images, accessibility",
            topics: [
              "Document outline. header/main/footer/nav/article/section. When a div is honest.",
              "Links, images, figure/figcaption. Forms with real labels. Button types.",
              "Accessibility: alt, lang on html, contrast, skip to content optional.",
              "Validate HTML. Broken tags show up in unexpected places.",
            ],
          },
          {
            week: 4,
            title: "CSS basics: box model, colors, typography, spacing",
            topics: [
              "Selectors, classes vs ids, inheritance. box-sizing.",
              "Color and type: readable sizes, line-height, font pairing without a circus.",
              "Spacing system. Self-paced review of the profile page before it goes live.",
              "Ship: GitHub Pages profile. Recording covers the deploy clicks.",
            ],
          },
        ],
      },
      {
        label: "Month 2: Layout and JavaScript",
        focus: "Layout that survives phones, then JS that drives the page.",
        ships: "An interactive quiz or calculator, with source on GitHub.",
        weeks: [
          {
            week: 5,
            title: "Flexbox and Grid",
            topics: [
              "Flex for nav, toolbars, card internals. Grid for page regions.",
              "Practice set from recordings. Redo until the inspector matches your intent.",
            ],
          },
          {
            week: 6,
            title: "Responsive design, mobile first, media queries",
            topics: [
              "Viewport, fluid images, wrapping vs shrinking. Breakpoints you write down.",
              "Touch targets. Horizontal scroll is a bug. Test on a real device.",
            ],
          },
          {
            week: 7,
            title: "JavaScript fundamentals",
            topics: [
              "Variables, functions, conditions, loops, arrays, objects.",
              "Debugging with console and breakpoints. No frameworks.",
              "Extra lab time: kata from the library, marked self-paced.",
            ],
          },
          {
            week: 8,
            title: "The DOM, events, form validation",
            topics: [
              "querySelector, createElement, addEventListener, preventDefault.",
              "Quiz or calculator logic. Invalid input should not crash.",
              "Self-paced review: mentor comments on the PR or a recorded walkthrough.",
            ],
          },
        ],
      },
      {
        label: "Month 3: Modern JS, vibe coding, React start",
        focus: "Async JS, a serious AI workflow, then the first React components.",
        ships: "A small React app built with AI help and reviewed line by line by the student.",
        weeks: [
          {
            week: 9,
            title: "ES6 features, async JavaScript, fetch, JSON",
            topics: [
              "Destructuring, spread, arrow functions, modules.",
              "Promises, async/await, fetch, JSON. Error paths.",
              "Public API lab. Rate limits and polite use.",
            ],
          },
          {
            week: 10,
            title: "Vibe coding part 1: prompts, mini spec, small tasks",
            topics: [
              "Write a spec before a prompt. Split a feature into tasks that fit one commit.",
              "Prompt with file names, stack, and 'do not invent'. Save prompts in /prompts for class.",
            ],
          },
          {
            week: 11,
            title: "Vibe coding part 2: review, debug, when to stop trusting the AI",
            topics: [
              "Read diffs. Run the code. Delete unused helpers. Search for API keys.",
              "Insecure patterns: eval, unsanitized HTML, fake crypto, 'admin' bypass comments.",
              "Self-paced review: you narrate a recording of the review, or notes in REVIEW.md.",
            ],
          },
          {
            week: 12,
            title: "React basics: components, props, JSX",
            topics: [
              "Vite React. One component per concern. Props as data, not magic.",
              "Ship a small app. Line-by-line student review is the grade, not the model's first draft.",
            ],
          },
        ],
      },
      {
        label: "Month 4: React depth and backend start",
        focus: "Hooks and routing, then Node and a REST API you own.",
        ships: "A React frontend talking to their own live API.",
        weeks: [
          {
            week: 13,
            title: "State and hooks, controlled forms",
            topics: [
              "useState, controlled inputs, lifting state. Avoid storing the same fact twice.",
              "useEffect for fetch. Cleanup. Dependency arrays without cargo cult.",
            ],
          },
          {
            week: 14,
            title: "Routing, consuming APIs, loading and error states",
            topics: [
              "React Router. Params. A dedicated error UI.",
              "Talk to last week's public API or a stub, then swap to your API in week 16.",
            ],
          },
          {
            week: 15,
            title: "Node and Express basics",
            topics: [
              "Runtime, npm, scripts, nodemon or equivalent.",
              "GET/POST JSON. Folder layout the studio uses. Standard templates as a start.",
            ],
          },
          {
            week: 16,
            title: "REST API design and CRUD",
            topics: [
              "Resource names, status codes, validation errors as JSON.",
              "CRUD for one resource. Live API (hosted or tunnel). React wired to it.",
            ],
          },
        ],
      },
      {
        label: "Month 5: Data, security, deployment",
        focus: "A database, real auth, hardening, then hosting and one integration.",
        ships: "A full-stack app with login, hosted online.",
        weeks: [
          {
            week: 17,
            title: "Databases: SQL basics, tables, connecting to the API",
            topics: [
              "Tables, keys, simple relations. SELECT/INSERT/UPDATE/DELETE.",
              "Connect Express. Never commit the database password.",
            ],
          },
          {
            week: 18,
            title: "Authentication: hashing, sessions or JWT, protected routes",
            topics: [
              "Register/login. bcrypt (or studio choice). Cookie vs bearer token.",
              "Protect mutating routes. Frontend hides admin UI only after the API says no.",
            ],
          },
          {
            week: 19,
            title: "Security basics: env, validation, CORS, common attacks",
            topics: [
              "dotenv. Schema validation. CORS origins. XSS, injection, path traversal at a briefing level.",
              "Self-paced security checklist against your own repo.",
            ],
          },
          {
            week: 20,
            title: "Deployment, domains, and integrations",
            topics: [
              "Host frontend and API. Domain optional. HTTPS.",
              "One integration: payments, email, or maps in test mode. Recorded deploy walkthrough.",
            ],
          },
        ],
      },
      {
        label: "Month 6: Capstone and career",
        focus: "Plan, build, polish, then show the work and talk about paid work.",
        ships: "Capstone and portfolio.",
        weeks: [
          {
            week: 21,
            title: "Capstone planning: idea, spec, wireframes, database design",
            topics: [
              "Pick a problem you can finish. Users, screens, tables, out of scope.",
              "Wireframes on paper. Mentor sign-off before heavy coding.",
            ],
          },
          {
            week: 22,
            title: "Capstone build",
            topics: [
              "Vertical slices. Recordings for stuck points. Self-paced review mid-week.",
              "AI for boilerplate after the spec. You own auth and data.",
            ],
          },
          {
            week: 23,
            title: "Capstone finish: testing, polish, documentation. Portfolio live",
            topics: [
              "Checklist test. README, env example, screenshots.",
              "Portfolio site live with the capstone plus earlier ships.",
            ],
          },
          {
            week: 24,
            title: "CV, freelance basics, pricing, clients, demo day",
            topics: [
              "CV with URLs. How to quote a landing page vs an app. Written scope.",
              "Handling clients: changes, deposits, when work stops.",
              "Demo day. Certificate of completion path.",
            ],
          },
        ],
      },
    ],
  },
];

export const CURRICULUM_CUSTOM =
  "Custom length is set by admin, not on the student form. About four class weeks per month. Same vibe-coding core as the tracks above, stretched or compressed to those months. Recordings and reviews follow the nearest standard track.";

export const CURRICULUM_ENROL =
  "Apply with Google, pick a track and class mode, then pay $3 USD once. Class tools unlock when that payment is verified.";

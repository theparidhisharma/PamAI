
# Pam AI
### An intelligent front desk for exception resolution.

Pam AI transforms unexpected arrivals into policy-driven workflows, connecting real-world events with business rules, human approvals, and auditable outcomes.

**An arrival is an event. Authorization is a decision. Resolution is an outcome.**

---

## The Problem

Traditional front-desk and visitor-management systems often stop at detecting an arrival or sending a notification. Someone still has to interpret the situation, check business policies, contact the right person, obtain approval, and document the outcome.

This creates fragmented workflows, unnecessary delays, and inconsistent decisions.

## Our Solution

Pam AI acts as an intelligent operational layer between arrival events and the business processes needed to resolve them.

Instead of treating every arrival as a generic alert, Pam AI helps teams understand what happened, evaluate applicable policies, coordinate approvals, and track each case through resolution.

## Key Features

- **Live Desk:** A centralized view of arrival exceptions and their current status.
- **Policy-driven evaluation:** Evaluate scenarios against explicit business rules.
- **Human-in-the-loop approvals:** Coordinate manager decisions and host confirmations.
- **Case lifecycle management:** Track cases from initial detection through resolution.
- **Activity history:** Maintain a timeline of decisions and workflow events.
- **Adaptive persistence:** Support local demo mode and a configurable AWS-backed persistence layer.
- **Connection diagnostics:** Test backend connectivity and surface useful error states.
- **Graceful local development:** Preserve demo scenarios when cloud configuration is absent.

## Demo Scenarios

Pam AI demonstrates three operational exceptions:

| Scenario | Challenge | Intended workflow |
|---|---|---|
| DL-204 — Early delivery | A courier arrives before the delivery window | Evaluate the delivery policy and determine the appropriate next step |
| MT-118 — Contractor approval | A contractor arrives without the required approval | Request and record a manager decision |
| VIS-082 — Visitor confirmation | A visitor is waiting for host confirmation | Coordinate confirmation and track the resulting case state |

These scenarios illustrate why detecting an arrival is not equivalent to authorizing access.

## How It Works

1. **Capture:** An arrival event enters the workflow.
2. **Evaluate:** The policy engine checks the relevant business rules.
3. **Determine:** Pam AI identifies the missing information or decision required.
4. **Coordinate:** The appropriate approval or host confirmation is requested.
5. **Resolve:** The case progresses through its lifecycle.
6. **Record:** Workflow events and decisions are reflected in the activity history.

The workflow is designed to preserve human authorization boundaries rather than treating an event or recommendation as permission to grant physical access.

## Architecture

### Application

- React
- TypeScript
- Tailwind CSS
- TanStack Start and TanStack Router

### AWS integration architecture

The application includes a typed API adapter and persistence layer designed for the following serverless architecture:

```text
Pam AI Web Application
        |
        | HTTPS / JSON
        v
Amazon API Gateway
        |
        v
AWS Lambda
        |
        v
Amazon DynamoDB
```

**Integration components:**

- `src/lib/pamAwsApi.ts` — typed HTTP client and connection diagnostics.
- `src/lib/pamRepository.ts` — persistence abstraction for cloud and local modes.
- `src/components/pam/aws-connection-status.tsx` — backend connection indicator.
- `docs/AWS_INTEGRATION.md` — backend contract and deployment guidance.

The live cloud workflow requires the AWS infrastructure to be deployed and configured. The application can retain local demo functionality without a configured API endpoint.

## AWS Configuration

Configure the following environment variable when connecting to a deployed backend:

```env
VITE_PAM_AWS_API_URL=https://YOUR_API_ID.execute-api.YOUR_REGION.amazonaws.com
```

The URL must point to your actual API Gateway deployment.

The intended backend contract includes:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | Check backend connectivity |
| GET | `/cases` | List cases |
| GET | `/cases/{caseId}` | Retrieve a case |
| POST | `/cases` | Create a case |
| PUT | `/cases/{caseId}` | Update a case |
| GET | `/cases/{caseId}/history` | Retrieve case activity |

See [`docs/AWS_INTEGRATION.md`](docs/AWS_INTEGRATION.md) for the backend contract, infrastructure requirements, permissions, and deployment instructions.

**Security:** Never place AWS access keys or secret credentials in frontend environment variables or client-side code. Use an appropriately scoped IAM execution role for backend access.

## Getting Started

### Prerequisites

- Node.js compatible with the project configuration
- npm
- Git

### Installation

Clone the repository:

```bash
git clone https://github.com/theparidhisharma/PamAI.git
cd PamAI
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Use the development URL printed in the terminal to open Pam AI.

### Build

```bash
npm run build
```

Run tests using the test script configured in `package.json`, for example:

```bash
npm test
```

If the repository uses a different test script, use the actual script defined in `package.json`.

## Project Structure

```text
src/
├── components/
│   └── pam/
│       ├── aws-connection-status.tsx
│       └── desk-views.tsx
├── lib/
│   ├── pam-workflow.ts
│   ├── pamAwsApi.ts
│   └── pamRepository.ts
├── routes/
│   └── index.tsx
├── styles.css
└── test/
    ├── pamAwsApi.test.ts
    └── aws-settings.test.tsx

docs/
└── AWS_INTEGRATION.md
```

The exact file layout may evolve as the project develops.

## Design Principles

**Policy before action.** Business rules determine the appropriate workflow.

**Human oversight.** Approval-dependent actions require the relevant decision.

**Traceability.** Case histories make workflow progress and decisions easier to follow.

**Clear authorization boundaries.** Arrival detection, policy evaluation, approval, and physical access authorization are distinct concepts.

**Resilient development.** Local demonstration and cloud persistence are separate operating modes.

## Current Scope

Pam AI is a prototype focused on policy-driven arrival exception resolution and workflow orchestration.

The AWS integration layer and deployment documentation provide a path toward cloud-backed persistence. Availability of live AWS services depends on deployment and configuration. Ring device or API connectivity must be validated separately before being represented as a live integration.

## Roadmap

- Deploy and validate the AWS serverless backend.
- Verify persistent case creation, retrieval, updates, and history.
- Expand configurable business policies.
- Strengthen audit history and error recovery.
- Validate integration with real-world arrival event sources.
- Evaluate production authentication, monitoring, and operational safeguards.

## Built With

- React
- TypeScript
- Tailwind CSS
- TanStack Start
- Lovable
- AWS serverless architecture (integration and deployment status documented separately)

## Team

Built for the Amazon Developer Hackathon: **Build, Ship, Shape**.

## License

Add the open-source license required by the hackathon before submission. If using the MIT License, include a valid `LICENSE` file with the appropriate copyright holder and year.

import { OnboardingInterviewState, CodebaseFacts } from './types.js';

export const mockInterviewState: OnboardingInterviewState = {
  domain: {
    businessRules: [
      "User accounts must be verified via email before signing in.",
      "Transactions above $1000 require multi-factor authorization."
    ],
    terminologyGlossary: {
      "User": "An authenticated entity utilizing the payment gateway.",
      "Transaction": "A ledger movement representing currency transfer."
    }
  },
  apis: {
    endpoints: [
      { path: "/api/v1/users", method: "GET", description: "List all active users" },
      { path: "/api/v1/auth/login", method: "POST", description: "Authenticate and retrieve token" }
    ],
    externalIntegrations: ["Stripe"]
  },
  architecture: {
    primaryFramework: "Express",
    frameworkVersion: "^4.18.2",
    databaseType: "PostgreSQL"
  },
  data: {
    tables: [
      {
        name: "users",
        primaryKey: "id",
        columns: ["id", "email", "password_hash", "is_verified"]
      },
      {
        name: "transactions",
        primaryKey: "id",
        columns: ["id", "user_id", "amount", "status", "created_at"]
      }
    ]
  },
  references: {
    externalDocLinks: [
      "https://docs.stripe.com/api"
    ]
  },
  operations: {
    loggingFormat: "JSON",
    metricPrefix: "ply_service"
  }
};

export const mockCodebaseFacts: CodebaseFacts = {
  dependencies: {
    "koa": "^2.15.0",
    "mongoose": "^8.0.3",
    "dotenv": "^16.3.1"
  },
  detectedDBDrivers: ["mongodb", "mongoose"],
  detectedRoutes: [
    { path: "/users", method: "GET" },
    { path: "/login", method: "POST" }
  ],
  framework: "Koa",
  configFiles: ["nodemon.json", "mongodb.config.js"]
};

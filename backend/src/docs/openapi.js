const serverUrl = process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 5000}`;

const openapiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Student Learning Recovery Planner API",
    version: "1.0.0",
    description: "REST API for auth, subjects, tasks, gaps, recovery plans, progress, resources, and assessments.",
  },
  servers: [{ url: serverUrl }],
  tags: [
    { name: "Auth" },
    { name: "Subjects" },
    { name: "Tasks" },
    { name: "Progress" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  paths: {
    "/api/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Create user account",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "User created" },
          400: { description: "Validation error" },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login user",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Login success with JWT token" },
          401: { description: "Invalid credentials" },
        },
      },
    },
    "/api/subjects": {
      get: {
        tags: ["Subjects"],
        summary: "List user subjects",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "List of subjects" },
          401: { description: "Unauthorized" },
        },
      },
      post: {
        tags: ["Subjects"],
        summary: "Create subject",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name"],
                properties: {
                  name: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Subject created" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/api/tasks": {
      get: {
        tags: ["Tasks"],
        summary: "List all user tasks",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "List of tasks" },
          401: { description: "Unauthorized" },
        },
      },
      post: {
        tags: ["Tasks"],
        summary: "Create task",
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["title", "task_date"],
                properties: {
                  title: { type: "string" },
                  task_date: { type: "string", format: "date" },
                  subject_id: { type: "integer", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Task created" },
          401: { description: "Unauthorized" },
        },
      },
    },
    "/api/progress/summary": {
      get: {
        tags: ["Progress"],
        summary: "Get progress summary",
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: "Progress summary payload" },
          401: { description: "Unauthorized" },
        },
      },
    },
  },
};

export default openapiSpec;

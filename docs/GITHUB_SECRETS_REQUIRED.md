# Deployment secrets

Production frontend and API configuration belongs to the corresponding Railway
service in the production environment. Keep credentials server-side; expose only
intentional public frontend variables. GitHub Actions secrets are required only
when a current workflow explicitly consumes them. Do not copy application secrets
into GitHub or documentation by default.

# Smart Study Planner 📚

A full-stack study planner built with HTML, CSS, JavaScript, Node.js, Express and SQLite.

## Features
- Student registration and login.
- Student name, email and course/class saved in SQLite.
- Passwords are hashed with bcryptjs, never stored as plain text.
- Students can create, complete, and delete their own study tasks.
- Admin-only student directory shows name, email, course, join date, task count and completed task count.
- SQLite-backed login sessions, server-side validation, parameterized SQL, responsive UI.
- No external database account is needed for local development.

## Structure
```text
smart-study-planner-fullstack/
├── server.js
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── data/                  # SQLite database created at runtime
└── public/
    ├── index.html
    ├── admin.html
    ├── style.css
    ├── app.js
    └── admin.js
```

## Requirements
Node.js 20+ (LTS recommended), VS Code, a modern browser, and Git for publishing.

## Run on Windows
1. Install Node.js LTS from https://nodejs.org/.
2. Extract this ZIP and open the folder in VS Code.
3. Open Terminal → New Terminal and run:
   ```powershell
   npm install
   Copy-Item .env.example .env
   ```
   In Command Prompt, use `copy .env.example .env` instead.
4. Open `.env` and change `SESSION_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`. Keep `.env` private.
5. Start the app:
   ```powershell
   npm start
   ```
6. Open http://localhost:3000.

For auto-restart during development, run `npm run dev`.

## Where student data is saved
The server creates `data/study_planner.db`. The `students` table contains id, name, email, password hash, course/class and registration timestamp. The `tasks` table associates each task with a student ID. Sessions are stored in `data/sessions.db`.

To inspect the database, use a SQLite viewer extension in VS Code or DB Browser for SQLite: https://sqlitebrowser.org/. Never publish the database file or password hashes.

## View registered students
1. Open http://localhost:3000/admin.html.
2. Log in with the values set in `.env` (`ADMIN_EMAIL` and `ADMIN_PASSWORD`).
3. View registrations, course, join time, and task statistics. Only authorized admins should access this data.

## Test checklist
- Register a student, then log out and log in again.
- Register the same email twice; the second registration should be rejected.
- Add, complete and delete a task.
- Restart the server and check that local SQLite records remain.
- Log in at `/admin.html` and verify the student appears.
- Request `/api/admin/students` while logged out; it should reject access.
- Check `/health` for `{"status":"ok","service":"smart-study-planner"}`.

## API routes
| Method | Route | Purpose |
|---|---|---|
| GET | `/api/me` | Current session |
| POST | `/api/register` | Register student |
| POST | `/api/login` | Student login |
| POST | `/api/logout` | End session |
| GET/POST | `/api/tasks` | List/create own tasks |
| PATCH | `/api/tasks/:id/toggle` | Toggle task completion |
| DELETE | `/api/tasks/:id` | Delete own task |
| POST | `/api/admin/login` | Admin login |
| GET | `/api/admin/students` | Admin-only student directory |
| GET | `/health` | Health check |

## Publish on GitHub
1. Create a repository at https://github.com/new named `smart-study-planner`.
2. In VS Code terminal, run:
   ```powershell
   git init
   git add .
   git commit -m "Build Smart Study Planner with student database"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/smart-study-planner.git
   git push -u origin main
   ```
3. Replace `YOUR-USERNAME` with your GitHub username and sign in when prompted.
4. `.env` and SQLite files are ignored by `.gitignore`. Never commit real credentials.

## Live deployment
GitHub Pages cannot host this backend. Use a Node.js host such as Render or Railway:
- Build command: `npm install`
- Start command: `npm start`
- Set environment variables: `NODE_ENV=production`, a random `SESSION_SECRET` of 32+ characters, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
- Configure persistent storage and set `DATABASE_PATH` to a path on that volume if supported.

SQLite data can disappear on hosts with ephemeral filesystems. For multi-user production use, configure a persistent volume or migrate to managed PostgreSQL. Hosting free-tier limits change, so check the provider's current documentation.

## Troubleshooting
- `node` / `npm` not found: install Node.js LTS and restart VS Code.
- `better-sqlite3` install error: use Node.js 20 or 22 LTS and run `npm install` again.
- Port 3000 busy: set `PORT=3001` in `.env`, restart, then open `http://localhost:3001`.
- Admin login fails: check `.env`, restart the server, and remove accidental spaces.
- Data missing online: configure persistent storage or use a managed database.

## Security notes
Change the sample admin password before deployment. Use HTTPS and a strong session secret. This is a learning project; for a real public service add rate limiting, CSRF protection, email verification, password reset, backups and a privacy policy. Collect only student data you actually need.
